<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Quest;
use App\Models\QuestAttempt;
use App\Services\AcademicProgressService;
use App\Services\QuestGenerationService;
use App\Services\ActivityRecorder;
use App\Models\User;
use Illuminate\Http\Request;

class QuestController extends Controller
{
    public function __construct(
        private AcademicProgressService $progressService,
        private QuestGenerationService $questGenerationService,
        private ActivityRecorder $activityRecorder
    ) {}

    public function index(Request $request)
    {
        $user = $request->user();
        $sessionSeed = $request->header('X-DataQuest-Session');
        $limit = max(20, min(100, (int) $request->query('limit', 100)));
        $quests = $this->questGenerationService->questsForUser($user, $sessionSeed, $limit);

        return response()->json([
            'success' => true,
            'data' => $quests->values(),
        ]);
    }

    public function show(int $id)
    {
        $quest = Quest::generated()->active()->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $quest->id,
                'title' => $quest->title,
                'description' => $quest->description,
                'quest_type' => $quest->quest_type,
                'difficulty' => $quest->difficulty,
                'xp_reward' => $quest->xp_reward,
                'nf_requirement' => $quest->nf_requirement,
                'initial_schema_json' => $quest->initial_schema_json,
            ],
        ]);
    }

    public function start(int $id, Request $request)
    {
        $quest = Quest::generated()->active()->findOrFail($id);
        $user = $request->user();

        $existing = QuestAttempt::where('quest_id', $quest->id)
            ->where('user_id', $user->id)
            ->where('status', 'started')
            ->first();

        if ($existing) {
            return response()->json([
                'success' => false,
                'message' => 'Ya tienes un intento activo para esta quest.',
            ], 409);
        }

        $attempt = QuestAttempt::create([
            'quest_id' => $quest->id,
            'user_id' => $user->id,
            'status' => 'started',
            'started_at' => now(),
        ]);

        $this->activityRecorder->record($user->id, 'reto', sprintf('Inició el reto "%s".', $quest->title));

        return response()->json([
            'success' => true,
            'data' => $attempt,
            'message' => 'Quest iniciada correctamente.',
        ], 201);
    }

    public function submit(int $id, Request $request)
    {
        $quest = Quest::generated()->active()->findOrFail($id);
        $user = $request->user();

        $attempt = QuestAttempt::where('quest_id', $quest->id)
            ->where('user_id', $user->id)
            ->where('status', 'started')
            ->latest()
            ->first();

        if (!$attempt) {
            return response()->json([
                'success' => false,
                'message' => 'No tienes un intento activo para esta quest. Inicia la quest primero.',
            ], 400);
        }

        $data = $request->validate([
            'answer' => 'required|array',
            'hints_used' => 'sometimes|integer|min:0',
        ]);

        $hintsUsed = $data['hints_used'] ?? 0;
        $expected = $quest->expected_solution_json;
        $score = 0;
        $status = 'failed';

        if ($expected && $this->matchesExpectedSolution($data['answer'], $expected)) {
            $score = 100;
            $status = 'completed';
        } elseif ($expected) {
            $score = $this->calculatePartialScore($data['answer'], $expected);
            if ($score >= 70) {
                $status = 'completed';
            }
        }

        $config = config('normalization.quests');
        $xpPerfectBonus = $config['xp_perfect_bonus'] ?? 1.5;
        $hintPenalty = $config['hint_penalty'] ?? 0.1;

        $xpEarned = $quest->xp_reward;
        if ($score === 100) {
            $xpEarned = (int) round($xpEarned * $xpPerfectBonus);
        }
        $xpEarned = (int) round($xpEarned * (1 - $hintsUsed * $hintPenalty));
        $xpEarned = max(0, $xpEarned);

        $attempt->update([
            'status' => $status,
            'score' => $score,
            'xp_earned' => $xpEarned,
            'hints_used' => $hintsUsed,
            'completed_at' => now(),
        ]);

        if ($status === 'completed') {
            $this->progressService->checkQuestCompletion($user, $quest, $score);
            $user->xp += $xpEarned;
            $user->save();
        }

        $this->activityRecorder->record(
            $user->id,
            'reto',
            sprintf(
                '%s el reto "%s" con %d puntos.',
                $status === 'completed' ? 'Completó' : 'Intentó',
                $quest->title,
                $score
            )
        );

        return response()->json([
            'success' => $status === 'completed',
            'data' => [
                'attempt_id' => $attempt->id,
                'status' => $status,
                'score' => $score,
                'xp_earned' => $xpEarned,
            ],
            'message' => $status === 'completed' ? 'Quest completada con éxito.' : 'Respuesta incorrecta. Intenta de nuevo.',
        ]);
    }

    public function leaderboard()
    {
        $users = User::where('activo', true)
            ->orderByDesc('xp')
            ->limit(20)
            ->get(['id', 'apodo', 'xp', 'rango']);

        $ranked = $users->values()->map(fn($u, $i) => [
            'rank' => $i + 1,
            'user_id' => $u->id,
            'apodo' => $u->apodo,
            'xp' => $u->xp,
            'rango' => $u->rango,
        ]);

        return response()->json([
            'success' => true,
            'data' => $ranked,
        ]);
    }

    private function matchesExpectedSolution(array $answer, array $expected): bool
    {
        return $answer === $expected;
    }

    private function calculatePartialScore(array $answer, array $expected): int
    {
        if (empty($expected)) {
            return 0;
        }

        $totalKeys = count($expected);
        $matchedKeys = 0;

        foreach ($expected as $key => $value) {
            if (isset($answer[$key]) && $answer[$key] === $value) {
                $matchedKeys++;
            }
        }

        return (int) round(($matchedKeys / $totalKeys) * 100);
    }
}
