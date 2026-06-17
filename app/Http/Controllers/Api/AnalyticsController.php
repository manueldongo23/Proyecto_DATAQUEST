<?php

namespace App\Http\Controllers\Api;

use App\Models\Esquema;
use App\Models\IntentoPuzzle;
use App\Models\User;
use App\Services\LearningAnalyticsService;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class AnalyticsController extends Controller
{
    public function __construct(
        private LearningAnalyticsService $analyticsService
    ) {}

    public function validationHistory(int $userId)
    {
        $user = User::find($userId);
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Usuario no encontrado'], 404);
        }

        $limit = max(20, min(100, (int) request()->query('limit', 100)));

        $schemas = Esquema::where('user_id', $userId)
            ->with(['validaciones' => function ($query) {
                $query->orderBy('fecha');
            }])
            ->orderBy('fecha_creacion', 'desc')
            ->take($limit)
            ->get()
            ->map(function ($esquema) {
                $latestValidation = $esquema->validaciones->last();

                return [
                    'id' => $esquema->id,
                    'nombre' => $esquema->nombre,
                    'descripcion' => $esquema->descripcion,
                    'fecha' => $esquema->fecha_creacion,
                    'archived_at' => $esquema->archived_at,
                    'last_activity_at' => $latestValidation?->fecha ?? $esquema->fecha_creacion,
                    'validaciones' => $esquema->validaciones->map(function ($v) {
                        return [
                            'nivel' => $v->nivel_normalizacion,
                            'fecha' => $v->fecha,
                        ];
                    }),
                ];
            });

        return response()->json(['success' => true, 'data' => $schemas]);
    }

    public function getUserMastery(int $userId)
    {
        $user = User::find($userId);
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $intentos = IntentoPuzzle::with('puzzle')
            ->where('user_id', $userId)
            ->get();

        $conceptAccuracy = [
            '1FN' => ['correct' => 0, 'total' => 0],
            '2FN' => ['correct' => 0, 'total' => 0],
            '3FN' => ['correct' => 0, 'total' => 0],
            'BCNF' => ['correct' => 0, 'total' => 0],
            'DF' => ['correct' => 0, 'total' => 0]
        ];

        foreach ($intentos as $intento) {
            $nf = match($intento->puzzle->nivel_dificultad) {
                1 => '1FN',
                2 => '2FN',
                3 => '3FN',
                default => 'BCNF'
            };

            $isCorrect = ($intento->puntuacion >= 80);

            $conceptAccuracy[$nf]['total']++;
            if ($isCorrect) $conceptAccuracy[$nf]['correct']++;

            $conceptAccuracy['DF']['total']++;
            if ($isCorrect) $conceptAccuracy['DF']['correct']++;
        }

        $mastery = [];
        foreach ($conceptAccuracy as $concept => $data) {
            $percentage = $data['total'] > 0 ? ($data['correct'] / $data['total']) * 100 : 0;
            $mastery[] = [
                'concept' => $concept,
                'percentage' => round($percentage, 1),
                'mastered' => $percentage >= 80
            ];
        }

        return response()->json([
            'success' => true,
            'data' => $mastery
        ]);
    }

    public function masteryTimeline(Request $request, int $userId)
    {
        $period = $request->query('period', 'weekly');
        $data = $this->analyticsService->getMasteryTimeline($userId, $period);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function conceptBreakdown(int $userId)
    {
        $data = $this->analyticsService->getConceptBreakdown($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function learningVelocity(int $userId)
    {
        $data = $this->analyticsService->getLearningVelocity($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function errorPatterns(int $userId)
    {
        $data = $this->analyticsService->getErrorPatterns($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function recommendations(int $userId)
    {
        $data = $this->analyticsService->getRecommendations($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function sessionAnalytics(int $userId)
    {
        $data = $this->analyticsService->getSessionAnalytics($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function peerComparison(int $userId)
    {
        $data = $this->analyticsService->getPeerComparison($userId);

        return response()->json(['success' => true, 'data' => $data]);
    }

    public function cohortStats(Request $request)
    {
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $data = $this->analyticsService->getCohortStats($dateFrom, $dateTo);

        return response()->json(['success' => true, 'data' => $data]);
    }
}
