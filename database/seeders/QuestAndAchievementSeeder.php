<?php

namespace Database\Seeders;

use App\Models\Achievement;
use App\Models\DominioAprendizaje;
use App\Models\LogroUsuario;
use App\Models\Quest;
use App\Models\QuestAttempt;
use App\Models\User;
use App\Models\UserAchievement;
use App\Services\QuestGenerationService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class QuestAndAchievementSeeder extends Seeder
{
    public function run(): void
    {
        $this->resetQuestData();
        $this->createQuests();
        $this->createAchievements();
        $this->seedLearningProfiles();
        $this->seedQuestAttempts();
        $this->seedUserAchievements();
        $this->seedProgressLogros();
    }

    private function resetQuestData(): void
    {
        DB::transaction(function () {
            UserAchievement::query()->delete();
            QuestAttempt::query()->delete();
            LogroUsuario::query()->delete();
            DominioAprendizaje::query()->delete();
            Quest::query()->delete();
            Achievement::query()->delete();
        });
    }

    private function createQuests(): void
    {
        app(QuestGenerationService::class)->refreshCatalog();
    }

    private function createAchievements(): void
    {
        $achievements = [
            [
                'name' => 'Primer Reto',
                'description' => 'Completa tu primera quest.',
                'icon' => 'star',
                'xp_reward' => 50,
                'criteria_type' => 'quests_completed',
                'criteria_value' => 1,
            ],
            [
                'name' => '3FN Master',
                'description' => 'Domina la Tercera Forma Normal.',
                'icon' => 'trophy',
                'xp_reward' => 120,
                'criteria_type' => 'nf_mastery',
                'criteria_value' => 3,
            ],
            [
                'name' => 'Dependencia',
                'description' => 'Resuelve dependencias y sube tu maestria.',
                'icon' => 'link-2',
                'xp_reward' => 100,
                'criteria_type' => 'nf_mastery',
                'criteria_value' => 2,
            ],
            [
                'name' => 'BCNF Pro',
                'description' => 'Lleva tu esquema a BCNF.',
                'icon' => 'shield-check',
                'xp_reward' => 200,
                'criteria_type' => 'nf_mastery',
                'criteria_value' => 4,
            ],
            [
                'name' => 'Coleccionista',
                'description' => 'Completa 5 quests en total.',
                'icon' => 'award',
                'xp_reward' => 100,
                'criteria_type' => 'quests_completed',
                'criteria_value' => 5,
            ],
            [
                'name' => 'Velocista',
                'description' => 'Acumula 500 puntos de XP.',
                'icon' => 'zap',
                'xp_reward' => 150,
                'criteria_type' => 'total_xp',
                'criteria_value' => 500,
            ],
            [
                'name' => 'Perfeccion Relacional',
                'description' => 'Obtén una puntuacion perfecta en cualquier quest.',
                'icon' => 'sparkles',
                'xp_reward' => 200,
                'criteria_type' => 'perfect_score',
                'criteria_value' => 1,
            ],
            [
                'name' => 'Leyenda Relacional',
                'description' => 'Alcanza 1000 puntos de XP totales.',
                'icon' => 'crown',
                'xp_reward' => 500,
                'criteria_type' => 'total_xp',
                'criteria_value' => 1000,
            ],
        ];

        foreach ($achievements as $achievement) {
            Achievement::firstOrCreate(
                ['name' => $achievement['name']],
                $achievement
            );
        }
    }

    private function seedLearningProfiles(): void
    {
        $users = User::where('activo', true)->get();
        $concepts = ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];

        foreach ($users as $user) {
            $profile = $this->profileForXp($user->xp);

            foreach ($concepts as $concept) {
                DominioAprendizaje::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'concepto' => $concept,
                    ],
                    [
                        'porcentaje' => $profile[$concept] ?? 0,
                    ]
                );
            }
        }
    }

    private function seedQuestAttempts(): void
    {
        $quests = Quest::generated()->get()->keyBy('quest_key');
        $now = Carbon::now();

        $plans = [
            1 => [
                ['key' => '2026-06-1fn-ventas-1', 'status' => 'completed', 'score' => 100, 'xp_earned' => 150, 'offset' => 10],
                ['key' => '2026-06-2fn-ventas-1', 'status' => 'completed', 'score' => 94, 'xp_earned' => 120, 'offset' => 8],
                ['key' => '2026-06-3fn-ventas-1', 'status' => 'completed', 'score' => 91, 'xp_earned' => 160, 'offset' => 6],
                ['key' => '2026-06-bcnf-rrhh-1', 'status' => 'completed', 'score' => 88, 'xp_earned' => 230, 'offset' => 4],
                ['key' => '2026-06-4fn-rrhh-1', 'status' => 'completed', 'score' => 86, 'xp_earned' => 260, 'offset' => 2],
                ['key' => '2026-06-5fn-logistica-1', 'status' => 'failed', 'score' => 60, 'xp_earned' => 0, 'offset' => 1],
            ],
            2 => [
                ['key' => '2026-06-1fn-academia-2', 'status' => 'completed', 'score' => 96, 'xp_earned' => 130, 'offset' => 8],
                ['key' => '2026-06-2fn-logistica-2', 'status' => 'completed', 'score' => 84, 'xp_earned' => 120, 'offset' => 5],
                ['key' => '2026-06-3fn-academia-2', 'status' => 'completed', 'score' => 78, 'xp_earned' => 150, 'offset' => 3],
                ['key' => '2026-06-bcnf-logistica-2', 'status' => 'failed', 'score' => 52, 'xp_earned' => 0, 'offset' => 1],
            ],
            3 => [
                ['key' => '2026-06-1fn-salud-3', 'status' => 'completed', 'score' => 98, 'xp_earned' => 140, 'offset' => 9],
                ['key' => '2026-06-2fn-rrhh-3', 'status' => 'completed', 'score' => 91, 'xp_earned' => 130, 'offset' => 7],
                ['key' => '2026-06-3fn-biblioteca-3', 'status' => 'completed', 'score' => 90, 'xp_earned' => 170, 'offset' => 5],
                ['key' => '2026-06-bcnf-ventas-3', 'status' => 'completed', 'score' => 84, 'xp_earned' => 240, 'offset' => 2],
                ['key' => '2026-06-4fn-salud-3', 'status' => 'failed', 'score' => 55, 'xp_earned' => 0, 'offset' => 1],
            ],
            4 => [
                ['key' => '2026-06-1fn-ventas-1', 'status' => 'completed', 'score' => 86, 'xp_earned' => 120, 'offset' => 4],
                ['key' => '2026-06-1fn-academia-2', 'status' => 'failed', 'score' => 58, 'xp_earned' => 0, 'offset' => 2],
            ],
            5 => [
                ['key' => '2026-06-1fn-salud-3', 'status' => 'completed', 'score' => 82, 'xp_earned' => 110, 'offset' => 3],
                ['key' => '2026-06-1fn-academia-2', 'status' => 'completed', 'score' => 88, 'xp_earned' => 95, 'offset' => 1],
            ],
        ];

        foreach ($plans as $userId => $attempts) {
            foreach ($attempts as $attempt) {
                $quest = $quests->get($attempt['key']);
                if (!$quest) {
                    continue;
                }

                $startedAt = $now->copy()->subDays($attempt['offset'])->setTime(9, 0, 0);
                $payload = [
                    'quest_id' => $quest->id,
                    'user_id' => $userId,
                    'status' => $attempt['status'],
                    'score' => $attempt['score'],
                    'xp_earned' => $attempt['xp_earned'],
                    'hints_used' => $attempt['status'] === 'completed' ? 0 : 1,
                    'started_at' => $startedAt,
                    'completed_at' => $attempt['status'] === 'completed' ? $startedAt->copy()->addMinutes(34) : null,
                ];

                QuestAttempt::updateOrCreate(
                    [
                        'quest_id' => $quest->id,
                        'user_id' => $userId,
                        'status' => $attempt['status'],
                        'started_at' => $startedAt,
                    ],
                    $payload
                );
            }
        }
    }

    private function seedUserAchievements(): void
    {
        $users = User::where('activo', true)->get();
        $achievements = Achievement::all()->keyBy('name');

        foreach ($users as $user) {
            $profile = DominioAprendizaje::where('user_id', $user->id)->get()->keyBy('concepto');
            $masteredCount = $profile->filter(fn ($entry) => $entry->porcentaje >= 80)->count();
            $questsCompleted = QuestAttempt::where('user_id', $user->id)
                ->where('status', 'completed')
                ->count();
            $perfectScores = QuestAttempt::where('user_id', $user->id)
                ->where('status', 'completed')
                ->where('score', 100)
                ->count();

            foreach ($achievements as $achievement) {
                $meetsCriteria = match ($achievement->criteria_type) {
                    'quests_completed' => $questsCompleted >= $achievement->criteria_value,
                    'nf_mastery' => $masteredCount >= $achievement->criteria_value,
                    'total_xp' => $user->xp >= $achievement->criteria_value,
                    'perfect_score' => $perfectScores >= $achievement->criteria_value,
                    default => false,
                };

                if (!$meetsCriteria) {
                    continue;
                }

                UserAchievement::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'achievement_id' => $achievement->id,
                    ],
                    [
                        'unlocked_at' => now(),
                    ]
                );
            }
        }
    }

    private function seedProgressLogros(): void
    {
        $users = User::where('activo', true)->get();

        foreach ($users as $user) {
            $profile = DominioAprendizaje::where('user_id', $user->id)->get()->keyBy('concepto');
            $masteredCount = $profile->filter(fn ($entry) => $entry->porcentaje >= 80)->count();

            $rules = [
                'Aprendiz de Dependencias' => ($profile->get('DF')?->porcentaje ?? 0) >= 80,
                'Primera Normalización' => ($profile->get('1FN')?->porcentaje ?? 0) >= 80,
                'Guardián de la 2FN' => ($profile->get('2FN')?->porcentaje ?? 0) >= 80,
                'Maestro de la 3FN' => ($profile->get('3FN')?->porcentaje ?? 0) >= 80,
                'Arquitecto BCNF' => ($profile->get('BCNF')?->porcentaje ?? 0) >= 80 && ($profile->get('3FN')?->porcentaje ?? 0) >= 80,
                'Principiante' => $masteredCount >= 1,
                'Normalizador Intermedio' => $masteredCount >= 3,
                'Experto en Normalización' => $masteredCount >= 5,
            ];

            foreach ($rules as $name => $unlocked) {
                if (!$unlocked) {
                    continue;
                }

                LogroUsuario::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'medalla_nombre' => $name,
                    ],
                    [
                        'desbloqueado_en' => now(),
                    ]
                );
            }
        }
    }

    private function profileForXp(int $xp): array
    {
        return match (true) {
            $xp >= 4000 => [
                'DF' => 100,
                '1FN' => 100,
                '2FN' => 100,
                '3FN' => 100,
                'BCNF' => 92,
                '4FN' => 84,
                '5FN' => 72,
            ],
            $xp >= 1000 => [
                'DF' => 96,
                '1FN' => 92,
                '2FN' => 84,
                '3FN' => 72,
                'BCNF' => 56,
                '4FN' => 34,
                '5FN' => 18,
            ],
            $xp >= 300 => [
                'DF' => 84,
                '1FN' => 76,
                '2FN' => 62,
                '3FN' => 44,
                'BCNF' => 22,
                '4FN' => 8,
                '5FN' => 0,
            ],
            $xp >= 100 => [
                'DF' => 62,
                '1FN' => 54,
                '2FN' => 38,
                '3FN' => 18,
                'BCNF' => 0,
                '4FN' => 0,
                '5FN' => 0,
            ],
            default => [
                'DF' => 24,
                '1FN' => 16,
                '2FN' => 0,
                '3FN' => 0,
                'BCNF' => 0,
                '4FN' => 0,
                '5FN' => 0,
            ],
        };
    }
}
