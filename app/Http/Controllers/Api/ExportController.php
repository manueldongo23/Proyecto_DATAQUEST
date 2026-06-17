<?php
namespace App\Http\Controllers\Api;

use App\Domain\Services\DbmlGenerationService;
use App\Domain\Services\MermaidGenerationService;
use App\Domain\Services\PdfReportService;
use App\Domain\Services\SqlGenerationService;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ExportController extends Controller
{
    private NormalizationEngine $engine;
    private DecompositionService $decompositionService;

    public function __construct(
        private DbmlGenerationService $dbml,
        private MermaidGenerationService $mermaid,
        private PdfReportService $pdf,
        private SqlGenerationService $sql
    ) {
        $this->engine = new NormalizationEngine();
        $this->decompositionService = new DecompositionService($this->engine);
    }

    public function exportDbml(Request $request)
    {
        $validated = $this->validateInput($request);

        try {
            $schema = $this->buildSchema($validated);
            $diagnosis = $this->engine->diagnoseNormalization($schema);
            $output = $this->dbml->generate($schema, $diagnosis);

            return response($output, 200, ['Content-Type' => 'text/plain']);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar DBML: ' . $e->getMessage()
            ], 422);
        }
    }

    public function exportMermaid(Request $request)
    {
        $validated = $this->validateInput($request);

        try {
            $schema = $this->buildSchema($validated);
            $decomposition = $this->decompositionService->decomposeTo3NF($schema);
            $decomposedSchemas = $decomposition['resulting_tables'] ?? [];
            $output = $this->mermaid->generateErDiagram($schema, $decomposedSchemas);

            return response($output, 200, ['Content-Type' => 'text/plain']);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar Mermaid: ' . $e->getMessage()
            ], 422);
        }
    }

    public function exportHtml(Request $request)
    {
        $validated = $this->validateInput($request);

        try {
            $schema = $this->buildSchema($validated);
            $diagnosis = $this->engine->diagnoseNormalization($schema);
            $engine = $validated['engine'] ?? 'postgresql';
            $decomposition = $this->decompositionService->decomposeTo3NF($schema, $engine);
            $output = $this->pdf->generateHtmlReport($schema, $diagnosis, $decomposition, $engine);

            return response($output, 200, ['Content-Type' => 'text/html']);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al generar HTML: ' . $e->getMessage()
            ], 422);
        }
    }

    public function exportAll(Request $request)
    {
        $validated = $this->validateInput($request);

        try {
            $schema = $this->buildSchema($validated);
            $diagnosis = $this->engine->diagnoseNormalization($schema);
            $engine = $validated['engine'] ?? 'postgresql';
            $decomposition = $this->decompositionService->decomposeTo3NF($schema, $engine);
            $decomposedSchemas = $decomposition['resulting_tables'] ?? [];

            $bundle = [
                'dbml' => $this->dbml->generate($schema, $diagnosis),
                'mermaid' => $this->mermaid->generateErDiagram($schema, $decomposedSchemas),
                'html' => $this->pdf->generateHtmlReport($schema, $diagnosis, $decomposition, $engine),
                'sql' => $decomposition['sql'] ?? '',
                'sql_engine' => $engine,
                'format' => 'all',
            ];

            return response()->json($bundle);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar: ' . $e->getMessage()
            ], 422);
        }
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
            'engine' => 'nullable|string|in:postgresql,mysql,sqlite,sqlserver',
        ]);
    }

    private function buildSchema(array $data): RelationSchema
    {
        $fds = array_map(
            fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
            $data['dependencies']
        );

        return new RelationSchema(
            $data['table_name'],
            $data['attributes'],
            $fds
        );
    }
}
