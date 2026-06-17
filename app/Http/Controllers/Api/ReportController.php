<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;
use App\Services\ActivityRecorder;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(
        private NormalizationEngine $engine,
        private DecompositionService $decompositionService,
        private ActivityRecorder $activityRecorder
    ) {}

    public function generate(Request $request)
    {
        $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
            'engine' => 'nullable|string|in:postgresql,mysql,sqlite,sqlserver',
        ]);

        try {
            $engine = $request->input('engine', 'postgresql');
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
            $ck = $this->engine->findCandidateKeys($schema);
            $decomposition = $this->decompositionService->decomposeTo3NF($schema, $engine);

            $report = [
                'generated_at' => now()->toIso8601String(),
                'sql_engine' => $engine,
                'schema' => [
                    'name' => $schema->name,
                    'attributes' => $schema->getAttributesSet(),
                    'dependencies_count' => count($fds),
                ],
                'diagnosis' => [
                    'current_nf' => $diagnosis['current_nf'],
                    'violations' => $diagnosis['violations'],
                    'candidate_keys' => $ck,
                ],
                'decomposition' => [
                    'resulting_tables' => $decomposition['resulting_tables'],
                    'foreign_keys' => $decomposition['foreign_keys'],
                ],
                'sql' => $decomposition['sql'],
                'recommendations' => $diagnosis['suggestions'],
            ];

            $this->activityRecorder->record(
                $request->user()?->id,
                'reporte',
                sprintf('Generó un reporte para %s.', $schema->name)
            );

            return response()->json([
                'success' => true,
                'data' => $report
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar el reporte'
            ], 422);
        }
    }
}
