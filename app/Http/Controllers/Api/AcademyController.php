<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;
use App\Domain\Services\AcademicService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use Illuminate\Http\Request;

class AcademyController extends Controller
{
    public function __construct(
        private NormalizationEngine $engine,
        private DecompositionService $decompositionService,
        private AcademicService $academicService
    ) {}

    /**
     * Obtener explicación de una forma normal
     */
    public function explain(string $nf)
    {
        $explanation = $this->academicService->explainNormalForm(strtoupper($nf));

        if (empty($explanation['title'])) {
            return response()->json([
                'success' => false,
                'message' => 'Forma normal no reconocida. Usa: 1FN, 2FN, 3FN, BCNF, 4FN o 5FN'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $explanation
        ]);
    }

    /**
     * Obtener un ejercicio para práctica
     */
    public function exercise(Request $request)
    {
        $nf = $request->input('nf', '1FN');
        $difficulty = $request->input('difficulty', 1);

        $exercise = $this->academicService->generateExercise(strtoupper($nf), $difficulty);

        return response()->json([
            'success' => true,
            'data' => $exercise
        ]);
    }

    /**
     * Evaluar respuesta de un ejercicio
     */
    public function evaluate(Request $request)
    {
        $request->validate([
            'exercise_id' => 'required|string',
            'user_answer' => 'required|array',
            'expected_solution' => 'required|array'
        ]);

        $result = $this->academicService->evaluateAnswer(
            $request->user_answer,
            $request->expected_solution
        );

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    /**
     * Descomposición completa con explicación
     */
    public function decompose(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
        ]);

        try {
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $request->dependencies
            );

            $schema = new RelationSchema(
                $request->table_name,
                $request->input('attributes'),
                $fds
            );

            $result = $this->decompositionService->decomposeTo3NF($schema);

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al descomponer el esquema'
            ], 422);
        }
    }

    /**
     * Validar hasta una forma normal específica
     */
    public function validateUpTo(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
            'target_nf' => 'required|string|in:1FN,2FN,3FN,BCNF,4FN,5FN',
        ]);

        try {
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $request->dependencies
            );

            $schema = new RelationSchema(
                $request->table_name,
                $request->input('attributes'),
                $fds
            );

            $diagnosis = $this->engine->diagnoseNormalization($schema);
            $targetNf = $request->target_nf;

            $nfOrder = ['1FN' => 1, '1NF' => 1, '2FN' => 2, '2NF' => 2, '3FN' => 3, '3NF' => 3, 'BCNF' => 4, '4FN' => 5, '4NF' => 5, '5FN' => 6, '5NF' => 6];
            $currentOrder = $nfOrder[$diagnosis['current_nf']] ?? 0;
            $targetOrder = $nfOrder[$targetNf] ?? 0;

            $nfNames = ['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];
            $violations = [];

            for ($i = 0; $i < $targetOrder - 1; $i++) {
                if (in_array($nfNames[$i], $diagnosis['violations'])) {
                    $violations[] = $nfNames[$i];
                }
            }

            $compliant = $currentOrder >= $targetOrder && empty($violations);

            $messages = [
                '1FN' => 'Verifica atomicidad de atributos y ausencia de grupos repetitivos',
                '2FN' => 'Verifica que no existan dependencias parciales de la clave',
                '3FN' => 'Verifica que no existan dependencias transitivas',
                'BCNF' => 'Verifica que todo determinante sea superclave',
                '4FN' => 'Verifica que no existan dependencias multivaluadas',
                '5FN' => 'Verifica que no existan dependencias de unión'
            ];

            return response()->json([
                'success' => true,
                'data' => [
                    'target_nf' => $targetNf,
                    'current_nf' => $diagnosis['current_nf'],
                    'compliant' => $compliant,
                    'violations' => $violations,
                    'message' => $compliant
                        ? "La tabla cumple con {$targetNf}."
                        : "La tabla NO cumple con {$targetNf}. " . ($messages[$targetNf] ?? ''),
                    'diagnosis' => $diagnosis,
                    'nf_progress' => array_slice($nfNames, 0, $targetOrder),
                    'nf_reached' => $nfNames[min($currentOrder, 5)]
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al validar la forma normal'
            ], 422);
        }
    }

    /**
     * Obtener todas las explicaciones disponibles
     */
    public function index()
    {
        $nfs = ['1FN', '2FN', '3FN', 'BCNF', '4FN', '5FN'];
        $summaries = [];

        foreach ($nfs as $nf) {
            $exp = $this->academicService->explainNormalForm($nf);
            $summaries[] = [
                'id' => $nf,
                'title' => $exp['title'],
                'description' => $exp['description'],
                'rules_count' => count($exp['rules']),
                'has_exercise' => !empty($this->academicService->generateExercise($nf)),
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'normal_forms' => $summaries,
                'total' => count($summaries),
                'learning_path' => $nfs
            ]
        ]);
    }
}
