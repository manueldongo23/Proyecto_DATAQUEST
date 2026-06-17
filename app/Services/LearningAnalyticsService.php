<?php

namespace App\Services;

use App\Models\User;
use App\Models\DominioAprendizaje;
use App\Models\Esquema;
use App\Models\Validacion;
use App\Models\IntentoPuzzle;
use App\Models\QuestAttempt;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class LearningAnalyticsService
{
    private array $allConcepts = ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];

    public function getMasteryTimeline(int $userId, string $period = 'weekly'): array
    {
        User::findOrFail($userId);

        $puzzleAttempts = IntentoPuzzle::with('puzzle')
            ->where('user_id', $userId)
            ->orderBy('fecha')
            ->get();

        $validations = Validacion::whereHas('esquema', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->orderBy('fecha')->get();

        $dataPoints = [];

        foreach ($puzzleAttempts as $attempt) {
            $nf = $this->mapDifficultyToNF($attempt->puzzle->nivel_dificultad);
            $periodKey = $this->getPeriodKey($attempt->fecha, $period);
            $isCorrect = $attempt->puntuacion >= 80;

            $dataPoints[$periodKey][$nf]['correct'] = ($dataPoints[$periodKey][$nf]['correct'] ?? 0) + ($isCorrect ? 1 : 0);
            $dataPoints[$periodKey][$nf]['total'] = ($dataPoints[$periodKey][$nf]['total'] ?? 0) + 1;

            $dataPoints[$periodKey]['DF']['correct'] = ($dataPoints[$periodKey]['DF']['correct'] ?? 0) + ($isCorrect ? 1 : 0);
            $dataPoints[$periodKey]['DF']['total'] = ($dataPoints[$periodKey]['DF']['total'] ?? 0) + 1;
        }

        foreach ($validations as $validation) {
            $nf = $validation->nivel_normalizacion;
            if (!in_array($nf, $this->allConcepts)) continue;

            $periodKey = $this->getPeriodKey($validation->fecha, $period);
            $passed = is_null($validation->violaciones_json) || empty($validation->violaciones_json);

            $dataPoints[$periodKey][$nf]['correct'] = ($dataPoints[$periodKey][$nf]['correct'] ?? 0) + ($passed ? 1 : 0);
            $dataPoints[$periodKey][$nf]['total'] = ($dataPoints[$periodKey][$nf]['total'] ?? 0) + 1;
        }

        ksort($dataPoints);

        $runningCounts = [];
        $result = [];

        foreach ($dataPoints as $periodKey => $concepts) {
            foreach ($this->allConcepts as $concept) {
                if (isset($concepts[$concept])) {
                    $runningCounts[$concept]['correct'] = ($runningCounts[$concept]['correct'] ?? 0) + $concepts[$concept]['correct'];
                    $runningCounts[$concept]['total'] = ($runningCounts[$concept]['total'] ?? 0) + $concepts[$concept]['total'];
                }

                $total = $runningCounts[$concept]['total'] ?? 0;
                $correct = $runningCounts[$concept]['correct'] ?? 0;
                $percentage = $total > 0 ? round(($correct / $total) * 100, 1) : 0;

                $result[] = [
                    'concept' => $concept,
                    'percentage' => $percentage,
                    'date' => $periodKey,
                    'attempts' => $total,
                ];
            }
        }

        return $result;
    }

    public function getConceptBreakdown(int $userId): array
    {
        $user = User::findOrFail($userId);
        $dominios = $user->dominiosAprendizaje()->get()->keyBy('concepto');

        $puzzleAttempts = IntentoPuzzle::with('puzzle')
            ->where('user_id', $userId)
            ->get();

        $validations = Validacion::whereHas('esquema', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->get();

        $breakdown = [];

        foreach ($this->allConcepts as $concept) {
            $dominio = $dominios->get($concept);
            $currentMastery = $dominio?->porcentaje ?? 0;

            $diffLevels = $this->getDifficultyLevelsForConcept($concept);

            $puzzleAttemptCount = 0;
            $puzzleCorrectCount = 0;

            foreach ($puzzleAttempts as $attempt) {
                if (in_array($attempt->puzzle->nivel_dificultad, $diffLevels)) {
                    $puzzleAttemptCount++;
                    if ($attempt->puntuacion >= 80) {
                        $puzzleCorrectCount++;
                    }
                }
            }

            $validationCount = $validations->filter(fn($v) => $v->nivel_normalizacion === $concept)->count();

            $lastPracticed = $this->getLastPracticed($userId, $concept);
            $totalAttempts = $puzzleAttemptCount + $validationCount;
            $accuracyRate = $totalAttempts > 0 ? round(($puzzleCorrectCount / $totalAttempts) * 100, 1) : 0;

            $tag = $currentMastery >= 80 ? 'strength' : ($currentMastery >= 40 ? 'developing' : 'weakness');
            $trend = $this->calculateTrend($userId, $concept);

            $breakdown[] = [
                'concept' => $concept,
                'mastery_percentage' => $currentMastery,
                'total_attempts' => $totalAttempts,
                'correct_attempts' => $puzzleCorrectCount,
                'accuracy_rate' => $accuracyRate,
                'last_practiced' => $lastPracticed?->toISOString(),
                'trend' => $trend,
                'tag' => $tag,
            ];
        }

        return $breakdown;
    }

    public function getLearningVelocity(int $userId): array
    {
        User::findOrFail($userId);
        $levels = ['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];
        $firstTimestamps = [];

        $puzzles = IntentoPuzzle::with('puzzle')
            ->where('user_id', $userId)
            ->orderBy('fecha')
            ->get();

        foreach ($puzzles as $attempt) {
            $nf = $this->mapDifficultyToNF($attempt->puzzle->nivel_dificultad);
            if (!isset($firstTimestamps[$nf])) {
                $firstTimestamps[$nf] = $attempt->fecha;
            }
        }

        $validations = Validacion::whereHas('esquema', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->orderBy('fecha')->get();

        foreach ($validations as $v) {
            if (in_array($v->nivel_normalizacion, $levels) && !isset($firstTimestamps[$v->nivel_normalizacion])) {
                $firstTimestamps[$v->nivel_normalizacion] = $v->fecha;
            }
        }

        $velocity = [];
        $prevLevel = null;
        $prevDate = null;
        $daysBetween = [];

        foreach ($levels as $level) {
            if (isset($firstTimestamps[$level])) {
                $date = $firstTimestamps[$level];
                $days = $prevDate ? $prevDate->diffInDays($date) : 0;

                if ($prevDate) {
                    $daysBetween[] = $days;
                }

                $velocity[] = [
                    'from' => $prevLevel,
                    'to' => $level,
                    'days' => $days,
                    'first_achieved' => $date->toISOString(),
                ];

                $prevLevel = $level;
                $prevDate = $date;
            } else {
                $velocity[] = [
                    'from' => $prevLevel,
                    'to' => $level,
                    'days' => null,
                    'first_achieved' => null,
                ];
            }
        }

        $avgDays = count($daysBetween) > 0 ? round(array_sum($daysBetween) / count($daysBetween), 1) : 0;

        return [
            'velocity' => $velocity,
            'average_days_per_level' => $avgDays,
            'total_days_active' => $this->getDaysActive($userId),
        ];
    }

    public function getErrorPatterns(int $userId): array
    {
        $validations = Validacion::whereHas('esquema', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->get();

        $errorCounts = [];

        foreach ($validations as $validation) {
            $violations = $validation->violaciones_json ?? [];
            foreach ($violations as $violation) {
                $type = is_array($violation)
                    ? ($violation['type'] ?? $violation['tipo'] ?? 'unknown')
                    : (is_string($violation) ? $violation : 'unknown');

                $errorCounts[$type] = ($errorCounts[$type] ?? 0) + 1;
            }
        }

        arsort($errorCounts);
        $total = array_sum($errorCounts);

        return array_map(function ($type, $count) use ($total) {
            return [
                'error_type' => $type,
                'count' => $count,
                'frequency_percent' => $total > 0 ? round(($count / $total) * 100, 1) : 0,
            ];
        }, array_keys($errorCounts), $errorCounts);
    }

    public function getCohortStats(?string $dateFrom = null, ?string $dateTo = null): array
    {
        $query = User::query();
        if ($dateFrom) $query->where('fecha_registro', '>=', $dateFrom);
        if ($dateTo) $query->where('fecha_registro', '<=', $dateTo);

        $totalUsers = (clone $query)->where('activo', true)->count();

        $ranks = config('normalization.ranks', []);
        $rankDistribution = [];
        foreach ($ranks as $rank) {
            $count = (clone $query)->where('activo', true)
                ->where('xp', '>=', $rank['min_xp'])
                ->where('xp', '<=', $rank['max_xp'])
                ->count();
            if ($count > 0) {
                $rankDistribution[$rank['name']] = $count;
            }
        }

        $avgMastery = [];
        foreach ($this->allConcepts as $concept) {
            $avg = DominioAprendizaje::whereHas('user', function ($q) use ($dateFrom, $dateTo) {
                $q->where('activo', true);
                if ($dateFrom) $q->where('fecha_registro', '>=', $dateFrom);
                if ($dateTo) $q->where('fecha_registro', '<=', $dateTo);
            })->where('concepto', $concept)->avg('porcentaje');

            $avgMastery[] = [
                'concept' => $concept,
                'average_percentage' => round($avg ?: 0, 1),
            ];
        }

        $totalSchemas = Esquema::whereHas('user', function ($q) use ($dateFrom, $dateTo) {
            if ($dateFrom) $q->where('fecha_registro', '>=', $dateFrom);
            if ($dateTo) $q->where('fecha_registro', '<=', $dateTo);
        })->count();

        $totalQuestsCompleted = QuestAttempt::where('status', 'completed')
            ->whereHas('user', function ($q) use ($dateFrom, $dateTo) {
                if ($dateFrom) $q->where('fecha_registro', '>=', $dateFrom);
                if ($dateTo) $q->where('fecha_registro', '<=', $dateTo);
            })->count();

        $regTrend = User::when($dateFrom, fn($q) => $q->where('fecha_registro', '>=', $dateFrom))
            ->when($dateTo, fn($q) => $q->where('fecha_registro', '<=', $dateTo))
            ->select(DB::raw("CAST(fecha_registro AS DATE) as date"), DB::raw('COUNT(*) as count'))
            ->groupBy(DB::raw("CAST(fecha_registro AS DATE)"))
            ->orderBy('date')
            ->get()
            ->map(fn($r) => ['date' => $r->date, 'new_users' => $r->count])
            ->toArray();

        return [
            'total_active_users' => $totalUsers,
            'rank_distribution' => $rankDistribution,
            'average_mastery' => $avgMastery,
            'total_schemas_validated' => $totalSchemas,
            'total_quests_completed' => $totalQuestsCompleted,
            'registration_trend' => $regTrend,
        ];
    }

    public function getRecommendations(int $userId): array
    {
        $user = User::findOrFail($userId);
        $dominios = $user->dominiosAprendizaje()->get()->keyBy('concepto');

        $prereqs = [
            'DF' => [],
            '1FN' => ['DF'],
            '2FN' => ['DF', '1FN'],
            '3FN' => ['DF', '1FN', '2FN'],
            'BCNF' => ['DF', '1FN', '2FN', '3FN'],
            '4FN' => ['DF', '1FN', '2FN', '3FN', 'BCNF'],
            '5FN' => ['DF', '1FN', '2FN', '3FN', 'BCNF', '4FN'],
        ];

        $recommendations = [];

        foreach ($this->allConcepts as $concept) {
            $dominio = $dominios->get($concept);
            $percentage = $dominio?->porcentaje ?? 0;

            if ($percentage >= 80) continue;

            $prereqsMet = true;
            foreach ($prereqs[$concept] as $prereq) {
                $pDominio = $dominios->get($prereq);
                if (($pDominio?->porcentaje ?? 0) < 80) {
                    $prereqsMet = false;
                    break;
                }
            }

            if (!$prereqsMet) continue;

            $recommendations[] = [
                'concept' => $concept,
                'current_percentage' => $percentage,
                'priority' => $percentage > 0 ? 'continue' : 'start',
                'reason' => $percentage > 0
                    ? "Ya has comenzado {$concept} ({$percentage}%). Sigue practicando para alcanzar el 80%."
                    : "Domina los prerrequisitos de {$concept}. ¡Es el siguiente paso!",
            ];
        }

        usort($recommendations, fn($a, $b) => $a['priority'] === 'continue' ? -1 : 1);

        return $recommendations;
    }

    public function getSessionAnalytics(int $userId): array
    {
        $schemas = Esquema::where('user_id', $userId)
            ->orderBy('fecha_creacion')
            ->get(['fecha_creacion']);

        if ($schemas->isEmpty()) {
            return [
                'total_schemas' => 0,
                'average_schemas_per_day' => 0,
                'daily_activity' => [],
                'weekly_activity' => [],
            ];
        }

        $dailyCounts = $schemas->groupBy(fn($s) => $s->fecha_creacion->format('Y-m-d'))
            ->map(fn($group) => $group->count());

        $weeklyCounts = $schemas->groupBy(fn($s) => $s->fecha_creacion->format('Y-W'))
            ->map(fn($group) => $group->count());

        $totalDays = max(1, $schemas->first()->fecha_creacion->diffInDays($schemas->last()->fecha_creacion) + 1);

        return [
            'total_schemas' => $schemas->count(),
            'average_schemas_per_day' => round($schemas->count() / $totalDays, 1),
            'daily_activity' => $dailyCounts->map(fn($c, $d) => ['date' => $d, 'schemas_validated' => $c])->values()->toArray(),
            'weekly_activity' => $weeklyCounts->map(fn($c, $w) => ['week' => $w, 'schemas_validated' => $c])->values()->toArray(),
        ];
    }

    public function getPeerComparison(int $userId): array
    {
        $user = User::findOrFail($userId);
        $allUsers = User::where('activo', true)->get();
        $totalUsers = $allUsers->count();

        if ($totalUsers <= 1) {
            return [
                'total_peers' => 0,
                'your_xp' => $user->xp,
                'your_rank' => $user->rango,
                'xp_percentile' => 100,
                'concept_comparison' => [],
            ];
        }

        $usersSortedByXp = $allUsers->sortByDesc('xp')->values();
        $userXpRank = $usersSortedByXp->search(fn($u) => $u->id === $userId) + 1;
        $xpPercentile = round((1 - ($userXpRank - 1) / ($totalUsers - 1)) * 100, 1);

        $userPuzzlesQuery = IntentoPuzzle::where('user_id', $userId);
        $userTotalAttempts = (clone $userPuzzlesQuery)->count();
        $userCorrectAttempts = (clone $userPuzzlesQuery)->where('puntuacion', '>=', 80)->count();
        $userAccuracy = $userTotalAttempts > 0 ? round(($userCorrectAttempts / $userTotalAttempts) * 100, 1) : 0;

        $allPuzzles = IntentoPuzzle::all();
        $allTotalAttempts = $allPuzzles->count();
        $allCorrectAttempts = $allPuzzles->where('puntuacion', '>=', 80)->count();
        $avgAccuracy = $allTotalAttempts > 0 ? round(($allCorrectAttempts / $allTotalAttempts) * 100, 1) : 0;

        $avgXp = round($allUsers->avg('xp'), 1);

        $userQuests = QuestAttempt::where('user_id', $userId)->where('status', 'completed')->count();
        $totalCompletedQuests = QuestAttempt::where('status', 'completed')->count();
        $avgQuests = $totalUsers > 0 ? round($totalCompletedQuests / $totalUsers, 1) : 0;

        $conceptComparison = [];
        foreach ($this->allConcepts as $concept) {
            $userDominio = DominioAprendizaje::where('user_id', $userId)
                ->where('concepto', $concept)->first();
            $userPct = $userDominio?->porcentaje ?? 0;

            $allPcts = DominioAprendizaje::where('concepto', $concept)
                ->whereHas('user', fn($q) => $q->where('activo', true))
                ->pluck('porcentaje');

            $avgPct = $allPcts->isNotEmpty() ? round($allPcts->avg(), 1) : 0;
            $below = $allPcts->filter(fn($p) => $p <= $userPct)->count();
            $percentile = $allPcts->isNotEmpty() ? round(($below / $allPcts->count()) * 100, 1) : 0;

            $conceptComparison[] = [
                'concept' => $concept,
                'your_percentage' => $userPct,
                'average_percentage' => $avgPct,
                'percentile' => $percentile,
            ];
        }

        return [
            'total_peers' => $totalUsers - 1,
            'your_xp' => $user->xp,
            'average_xp' => $avgXp,
            'your_rank' => $user->rango,
            'xp_percentile' => $xpPercentile,
            'xp_rank_position' => $userXpRank,
            'your_accuracy' => $userAccuracy,
            'average_accuracy' => $avgAccuracy,
            'your_quests_completed' => $userQuests,
            'average_quests_completed' => $avgQuests,
            'concept_comparison' => $conceptComparison,
        ];
    }

    private function mapDifficultyToNF(int $difficulty): string
    {
        return match ($difficulty) {
            1 => '1FN',
            2 => '2FN',
            3 => '3FN',
            default => 'BCNF',
        };
    }

    private function getPeriodKey(Carbon $date, string $period): string
    {
        return match ($period) {
            'daily' => $date->format('Y-m-d'),
            'monthly' => $date->format('Y-m'),
            default => $date->format('Y-W'),
        };
    }

    private function getDifficultyLevelsForConcept(string $concept): array
    {
        return match ($concept) {
            '1FN' => [1],
            '2FN' => [2],
            '3FN' => [3],
            'BCNF' => [4, 5],
            default => [],
        };
    }

    private function getLastPracticed(int $userId, string $concept): ?Carbon
    {
        $diffLevels = $this->getDifficultyLevelsForConcept($concept);
        $dates = [];

        if (!empty($diffLevels)) {
            $lastPuzzle = IntentoPuzzle::with('puzzle')
                ->where('user_id', $userId)
                ->whereHas('puzzle', function ($q) use ($diffLevels) {
                    $q->whereIn('nivel_dificultad', $diffLevels);
                })
                ->orderByDesc('fecha')
                ->first();

            if ($lastPuzzle) $dates[] = $lastPuzzle->fecha;
        }

        $lastValidation = Validacion::whereHas('esquema', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })->where('nivel_normalizacion', $concept)
            ->orderByDesc('fecha')
            ->first();

        if ($lastValidation) $dates[] = $lastValidation->fecha;

        return !empty($dates) ? max($dates) : null;
    }

    private function calculateTrend(int $userId, string $concept): string
    {
        $diffLevels = $this->getDifficultyLevelsForConcept($concept);
        if (empty($diffLevels)) return 'stable';

        $attempts = IntentoPuzzle::with('puzzle')
            ->where('user_id', $userId)
            ->whereHas('puzzle', function ($q) use ($diffLevels) {
                $q->whereIn('nivel_dificultad', $diffLevels);
            })
            ->orderBy('fecha')
            ->get();

        if ($attempts->count() < 4) return 'stable';

        $halfway = (int) floor($attempts->count() / 2);
        $older = $attempts->take($halfway);
        $recent = $attempts->skip($halfway);

        $olderAvg = $older->avg('puntuacion') ?: 0;
        $recentAvg = $recent->avg('puntuacion') ?: 0;

        $diff = $recentAvg - $olderAvg;

        if ($diff > 10) return 'improving';
        if ($diff < -10) return 'declining';
        return 'stable';
    }

    private function getDaysActive(int $userId): int
    {
        $firstPuzzle = IntentoPuzzle::where('user_id', $userId)->orderBy('fecha')->first();
        $firstSchema = Esquema::where('user_id', $userId)->orderBy('fecha_creacion')->first();

        $dates = [];
        if ($firstPuzzle) $dates[] = $firstPuzzle->fecha;
        if ($firstSchema) $dates[] = $firstSchema->fecha_creacion;

        if (empty($dates)) return 0;

        $earliest = min($dates);
        return max(1, $earliest->diffInDays(now()));
    }
}
