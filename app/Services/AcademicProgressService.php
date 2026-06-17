<?php

namespace App\Services;

use App\Models\User;
use App\Models\DominioAprendizaje;
use App\Models\LogroUsuario;
use App\Models\Quest;
use App\Models\QuestAttempt;
use App\Models\Achievement;
use App\Models\UserAchievement;
use Illuminate\Support\Facades\Log;

class AcademicProgressService
{
    /**
     * Obtener progreso completo de un usuario
     */
    public function getProgress(User $user): array
    {
        $dominios = $user->dominiosAprendizaje()->get()->keyBy('concepto');
        $logros = $user->logros()->get();

        $nfProgress = [];
        $allNfs = ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];

        foreach ($allNfs as $nf) {
            $dominio = $dominios->get($nf);
            $nfProgress[] = [
                'concept' => $nf,
                'percentage' => $dominio?->porcentaje ?? 0,
                'mastered' => ($dominio?->porcentaje ?? 0) >= 80,
                'attempts' => 0,
            ];
        }

        return [
            'user_id' => $user->id,
            'apodo' => $user->apodo,
            'xp' => $user->xp,
            'rango' => $user->rango,
            'nf_progress' => $nfProgress,
            'mastered_count' => count(array_filter($nfProgress, fn($p) => $p['mastered'])),
            'total_nf' => count($allNfs),
            'achievements' => $logros->map(fn($l) => [
                'name' => $l->medalla_nombre,
                'unlocked_at' => $l->desbloqueado_en,
            ]),
        ];
    }

    /**
     * Actualizar progreso después de una validación
     */
    public function updateProgress(User $user, string $nfReached, int $xpEarned): void
    {
        $conceptos = $this->getConceptsForNF($nfReached);
        
        foreach ($conceptos as $concepto) {
            $dominio = DominioAprendizaje::firstOrCreate(
                ['user_id' => $user->id, 'concepto' => $concepto],
                ['porcentaje' => 0]
            );
            
            $dominio->porcentaje = min(100, $dominio->porcentaje + 10);
            $dominio->save();
        }

        // Actualizar XP
        $user->xp += $xpEarned;
        
        // Verificar logros
        $this->checkAchievements($user);
        
        $user->save();
    }

    /**
     * Verificar y otorgar logros
     */
    public function checkAchievements(User $user): void
    {
        $dominios = $user->dominiosAprendizaje()->get();
        $masteredNfs = $dominios->filter(fn($d) => $d->porcentaje >= 80)->pluck('concepto')->toArray();

        $achievementRules = [
            'Primera Normalización' => fn() => in_array('1FN', $masteredNfs),
            'Guardián de la 2FN' => fn() => in_array('2FN', $masteredNfs),
            'Maestro de la 3FN' => fn() => in_array('3FN', $masteredNfs),
            'Arquitecto BCNF' => fn() => in_array('BCNF', $masteredNfs) && in_array('3FN', $masteredNfs),
            'Aprendiz de Dependencias' => fn() => in_array('DF', $masteredNfs),
            'Principiante' => fn() => count($masteredNfs) >= 1,
            'Normalizador Intermedio' => fn() => count($masteredNfs) >= 3,
            'Experto en Normalización' => fn() => count($masteredNfs) >= 5,
        ];

        foreach ($achievementRules as $name => $rule) {
            if ($rule()) {
                LogroUsuario::firstOrCreate(
                    ['user_id' => $user->id, 'medalla_nombre' => $name],
                    ['desbloqueado_en' => now()]
                );
            }
        }
    }

    /**
     * Check and unlock achievements for a user based on criteria type
     */
    public function unlockAchievement(User $user, string $criteriaType): void
    {
        $achievements = Achievement::where('criteria_type', $criteriaType)->get();

        foreach ($achievements as $achievement) {
            $alreadyUnlocked = UserAchievement::where('user_id', $user->id)
                ->where('achievement_id', $achievement->id)
                ->exists();

            if ($alreadyUnlocked) {
                continue;
            }

            $meetsCriteria = match ($criteriaType) {
                'nf_mastery' => $this->checkNfMasteryCriteria($user, $achievement),
                'quests_completed' => $this->checkQuestsCompletedCriteria($user, $achievement),
                'total_xp' => $this->checkTotalXpCriteria($user, $achievement),
                'perfect_score' => $this->checkPerfectScoreCriteria($user, $achievement),
                default => false,
            };

            if ($meetsCriteria) {
                UserAchievement::create([
                    'user_id' => $user->id,
                    'achievement_id' => $achievement->id,
                    'unlocked_at' => now(),
                ]);

                $user->xp += $achievement->xp_reward;
                $user->save();
            }
        }
    }

    /**
     * Handle quest completion: award XP and check achievements
     */
    public function checkQuestCompletion(User $user, Quest $quest, int $score): void
    {
        if ($score === 100) {
            $this->unlockAchievement($user, 'perfect_score');
        }

        $this->unlockAchievement($user, 'quests_completed');
        $this->unlockAchievement($user, 'total_xp');
    }

    /**
     * Return top N users by XP
     */
    public function getUserRankings(int $limit = 20): array
    {
        $users = User::where('activo', true)
            ->orderByDesc('xp')
            ->limit($limit)
            ->get(['id', 'apodo', 'xp', 'rango']);

        return $users->values()->map(fn($u, $i) => [
            'rank' => $i + 1,
            'user_id' => $u->id,
            'apodo' => $u->apodo,
            'xp' => $u->xp,
            'rango' => $u->rango,
        ])->toArray();
    }

    private function checkNfMasteryCriteria(User $user, Achievement $achievement): bool
    {
        $dominios = $user->dominiosAprendizaje()->get();
        $masteredCount = $dominios->filter(fn($d) => $d->porcentaje >= 80)->count();

        return $masteredCount >= $achievement->criteria_value;
    }

    private function checkQuestsCompletedCriteria(User $user, Achievement $achievement): bool
    {
        $completedCount = QuestAttempt::where('user_id', $user->id)
            ->where('status', 'completed')
            ->count();

        return $completedCount >= $achievement->criteria_value;
    }

    private function checkTotalXpCriteria(User $user, Achievement $achievement): bool
    {
        return $user->xp >= $achievement->criteria_value;
    }

    private function checkPerfectScoreCriteria(User $user, Achievement $achievement): bool
    {
        $perfectCount = QuestAttempt::where('user_id', $user->id)
            ->where('status', 'completed')
            ->where('score', 100)
            ->count();

        return $perfectCount >= $achievement->criteria_value;
    }

    private function getConceptsForNF(string $nf): array
    {
        $map = [
            '1FN' => ['DF', '1FN'],
            '1NF' => ['DF', '1FN'],
            '2FN' => ['DF', '1FN', '2FN'],
            '2NF' => ['DF', '1FN', '2FN'],
            '3FN' => ['DF', '1FN', '2FN', '3FN'],
            '3NF' => ['DF', '1FN', '2FN', '3FN'],
            'BCNF' => ['DF', '1FN', '2FN', '3FN', 'BCNF'],
            '4FN' => ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN'],
            '4NF' => ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN'],
            '5FN' => ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'],
            '5NF' => ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'],
        ];
        return $map[$nf] ?? [];
    }

    /**
     * Generar ruta de aprendizaje personalizada
     */
    public function getLearningPath(User $user): array
    {
        $dominios = $user->dominiosAprendizaje()->get()->keyBy('concepto');

        $path = [
            ['nf' => 'DF', 'name' => 'Dependencias Funcionales', 'description' => 'Aprende a identificar dependencias entre atributos'],
            ['nf' => '1FN', 'name' => 'Primera Forma Normal', 'description' => 'Elimina grupos repetitivos y garantiza atomicidad'],
            ['nf' => '2FN', 'name' => 'Segunda Forma Normal', 'description' => 'Elimina dependencias parciales'],
            ['nf' => '3FN', 'name' => 'Tercera Forma Normal', 'description' => 'Elimina dependencias transitivas'],
            ['nf' => 'BCNF', 'name' => 'Forma Normal de Boyce-Codd', 'description' => 'Fortalece la 3FN con restricciones de clave'],
            ['nf' => '4FN', 'name' => 'Cuarta Forma Normal', 'description' => 'Elimina dependencias multivaluadas'],
            ['nf' => '5FN', 'name' => 'Quinta Forma Normal', 'description' => 'Elimina dependencias de unión'],
        ];

        $currentStep = 0;
        foreach ($path as $i => $step) {
            $dominio = $dominios->get($step['nf']);
            $percentage = $dominio?->porcentaje ?? 0;
            $path[$i]['progress'] = $percentage;
            $path[$i]['status'] = $percentage >= 80 ? 'completed' : ($percentage > 0 ? 'in_progress' : 'locked');
            
            if ($path[$i]['status'] === 'in_progress' && $currentStep === 0) {
                $currentStep = $i;
            }
            if ($path[$i]['status'] === 'locked' && $currentStep === 0) {
                $currentStep = max(0, $i - 1);
            }
        }

        // Unlock next step if current is completed
        foreach ($path as $i => $step) {
            if ($step['status'] === 'locked') {
                $prevCompleted = $i === 0 || $path[$i - 1]['status'] === 'completed';
                if ($prevCompleted) {
                    $path[$i]['status'] = 'available';
                }
            }
        }

        return [
            'learning_path' => $path,
            'current_step' => $currentStep,
            'total_steps' => count($path),
            'completed_steps' => count(array_filter($path, fn($s) => $s['status'] === 'completed')),
        ];
    }
}
