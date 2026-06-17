<?php
namespace App\Http\Controllers\Api;

use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\ClosureExplainerService;
use App\Domain\Services\CsvImportService;
use App\Domain\Services\SandboxService;
use App\Domain\Services\SqlDdlParserService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use App\Application\UseCases\ValidateSchemaUseCase;
use App\Domain\Services\GamificationService;
use App\Services\ActivityRecorder;
use App\Models\Esquema;
use App\Models\Validacion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Controller;

class NormalizationController extends Controller
{
    public function __construct(
        private NormalizationEngine $engine,
        private ValidateSchemaUseCase $validateSchemaUseCase,
        private GamificationService $gamificationService,
        private ClosureExplainerService $closureExplainer,
        private CsvImportService $csvImportService,
        private SqlDdlParserService $ddlParser,
        private SandboxService $sandboxService,
        private ActivityRecorder $activityRecorder
    ) {}

    public function validateSchema(Request $request)
    {
        $validated = $request->validate([
            'table_name' => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
            'schema_id' => 'nullable|integer|exists:esquemas,id',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
            'engine' => 'nullable|string|in:postgresql,mysql,sqlite,sqlserver',
            'mode' => 'nullable|string|in:academico,profesional,estricto'
        ]);

        try {
            // Construir entidades del dominio
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $validated['dependencies']
            );
            
            $schema = new RelationSchema(
                $validated['table_name'],
                $validated['attributes'],
                $fds
            );

            // Ejecutar use case
            $result = $this->validateSchemaUseCase->execute($schema);
            $analysis = $this->sandboxService->analyze($validated);
            $diagnosis = data_get($result, 'diagnosis', []);
            $currentNf = data_get($diagnosis, 'current_nf', '1NF');
            $violations = data_get($diagnosis, 'violations', []);
            $engine = $validated['engine'] ?? 'postgresql';
            $mode = $validated['mode'] ?? 'profesional';

            $user = $request->user() ?? Auth::guard('sanctum')->user() ?? Auth::guard('web')->user();
            $gamificationData = null;
            $versionMeta = null;
            $savedSchema = null;

            if ($user) {
                $schemaId = $validated['schema_id'] ?? null;
                $previousSchema = null;

                if ($schemaId) {
                    $dbEsquema = Esquema::where('user_id', $user->id)->findOrFail($schemaId);
                    $previousSchema = [
                        'table_name' => $dbEsquema->nombre,
                        'description' => $dbEsquema->descripcion,
                        'attributes' => $dbEsquema->estructura_json ?? [],
                        'dependencies' => $dbEsquema->dependencias_json ?? [],
                    ];
                    $dbEsquema->fill([
                        'nombre' => $validated['table_name'],
                        'descripcion' => $validated['description'] ?? $dbEsquema->descripcion,
                        'estructura_json' => $validated['attributes'],
                        'dependencias_json' => $validated['dependencies'],
                    ]);
                    $dbEsquema->save();
                } else {
                    // Persistencia analítica
                    $dbEsquema = Esquema::create([
                        'user_id' => $user->id,
                        'nombre' => $validated['table_name'],
                        'descripcion' => $validated['description'] ?? null,
                        'estructura_json' => $validated['attributes'],
                        'dependencias_json' => $validated['dependencies']
                    ]);
                }

                $maxVersion = (int) Validacion::where('esquema_id', $dbEsquema->id)->max('version_number');
                $totalVersions = (int) Validacion::where('esquema_id', $dbEsquema->id)->count();
                $versionNumber = $maxVersion > 0 ? $maxVersion + 1 : $totalVersions + 1;
                $versionLabel = 'v' . $versionNumber;
                $estado = empty($violations) ? 'Completada' : 'En progreso';
                $changes = $this->buildVersionChanges($previousSchema, $validated);
                $snapshot = $this->buildVersionSnapshot(
                    $dbEsquema,
                    $validated,
                    $analysis,
                    $result,
                    $versionNumber,
                    $versionLabel,
                    $estado,
                    $currentNf,
                    $engine,
                    $mode,
                    $changes
                );

                Validacion::create([
                    'esquema_id' => $dbEsquema->id,
                    'version_number' => $versionNumber,
                    'version_label' => $versionLabel,
                    'estado' => $estado,
                    'target_nf' => $currentNf,
                    'engine' => $engine,
                    'mode' => $mode,
                    'nivel_normalizacion' => $currentNf,
                    'violaciones_json' => $violations,
                    'analysis_json' => $analysis,
                    'decomposition_json' => $analysis['decomposition'] ?? null,
                    'snapshot_json' => $snapshot,
                    'changes_json' => $changes,
                    'sql_generado' => $analysis['sql'] ?? null,
                ]);

                $savedSchema = [
                    'id' => $dbEsquema->id,
                    'nombre' => $dbEsquema->nombre,
                    'descripcion' => $dbEsquema->descripcion,
                    'estructura_json' => $dbEsquema->estructura_json,
                    'dependencias_json' => $dbEsquema->dependencias_json,
                ];
                $versionMeta = [
                    'id' => $versionNumber,
                    'version_number' => $versionNumber,
                    'version_label' => $versionLabel,
                    'estado' => $estado,
                    'target_nf' => $currentNf,
                    'engine' => $engine,
                    'mode' => $mode,
                    'changes' => $changes,
                    'snapshot' => $snapshot,
                ];

                // Gamificación: asignar xp si es una validación libre (puedes ajustar lógica si es por puzzle)
                // Se determinan los conceptos afectados por la validación
                $conceptosAfectados = [];
                if ($currentNf === '1NF' || $currentNf === '1FN') $conceptosAfectados = ['1FN'];
                if ($currentNf === '2NF' || $currentNf === '2FN') $conceptosAfectados = ['1FN', '2FN'];
                if ($currentNf === '3NF' || $currentNf === '3FN') $conceptosAfectados = ['1FN', '2FN', '3FN'];
                if ($currentNf === 'BCNF') $conceptosAfectados = ['1FN', '2FN', '3FN', 'BCNF'];

                $gamificationData = $this->gamificationService->awardXP($user, 10, $conceptosAfectados);

                $this->activityRecorder->record(
                    $user->id,
                    'validacion',
                    sprintf('Validó %s y alcanzó %s en %s.', $dbEsquema->nombre, $currentNf, $versionLabel)
                );
            }
            
            $responseData = array_merge($result, [
                'analysis' => $analysis,
                'schema' => $savedSchema ?? [
                    'id' => $validated['schema_id'] ?? null,
                    'nombre' => $validated['table_name'],
                    'descripcion' => $validated['description'] ?? null,
                    'estructura_json' => $validated['attributes'],
                    'dependencias_json' => $validated['dependencies'],
                ],
                'version' => $versionMeta,
                'schema_id' => $savedSchema['id'] ?? ($validated['schema_id'] ?? null),
            ]);

            return response()->json([
                'success' => true,
                'data' => $responseData,
                'gamification' => $gamificationData
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al procesar el esquema. Verifica los datos ingresados.'
            ], 422);
        }
    }

    private function buildVersionChanges(?array $previousSchema, array $currentSchema): array
    {
        $currentAttributes = array_values(array_map('strval', $currentSchema['attributes'] ?? []));

        if (!$previousSchema) {
            return [
                'is_initial_version' => true,
                'table_name_changed' => false,
                'description_changed' => false,
                'attributes_added' => $currentAttributes,
                'attributes_removed' => [],
                'dependencies_added' => $this->dependencySignatures($currentSchema['dependencies'] ?? []),
                'dependencies_removed' => [],
            ];
        }

        $previousAttributes = array_values(array_map('strval', $previousSchema['attributes'] ?? []));
        $previousDependencies = $this->dependencySignatures($previousSchema['dependencies'] ?? []);
        $currentDependencies = $this->dependencySignatures($currentSchema['dependencies'] ?? []);

        return [
            'is_initial_version' => false,
            'table_name_changed' => ($previousSchema['table_name'] ?? null) !== ($currentSchema['table_name'] ?? null),
            'description_changed' => ($previousSchema['description'] ?? null) !== ($currentSchema['description'] ?? null),
            'attributes_added' => array_values(array_diff($currentAttributes, $previousAttributes)),
            'attributes_removed' => array_values(array_diff($previousAttributes, $currentAttributes)),
            'dependencies_added' => array_values(array_diff($currentDependencies, $previousDependencies)),
            'dependencies_removed' => array_values(array_diff($previousDependencies, $currentDependencies)),
        ];
    }

    private function buildVersionSnapshot(
        Esquema $schema,
        array $validated,
        array $analysis,
        array $result,
        int $versionNumber,
        string $versionLabel,
        string $estado,
        string $currentNf,
        string $engine,
        string $mode,
        array $changes
    ): array {
        return [
            'schema' => [
                'id' => $schema->id,
                'table_name' => $schema->nombre,
                'description' => $schema->descripcion,
                'attributes' => array_values($validated['attributes'] ?? []),
                'dependencies' => array_map(
                    fn($dep) => [
                        'determinant' => array_values($dep['determinant'] ?? []),
                        'dependent' => array_values($dep['dependent'] ?? []),
                    ],
                    $validated['dependencies'] ?? []
                ),
            ],
            'analysis' => $analysis,
            'validation' => [
                'schema_name' => $result['schema_name'] ?? $schema->nombre,
                'candidate_keys' => $result['candidate_keys'] ?? [],
                'current_nf' => $currentNf,
                'diagnosis' => $result['diagnosis'] ?? [],
                'message' => $result['message'] ?? null,
                'is_fully_normalized' => $result['is_fully_normalized'] ?? false,
            ],
            'version' => [
                'number' => $versionNumber,
                'label' => $versionLabel,
                'estado' => $estado,
                'target_nf' => $currentNf,
                'engine' => $engine,
                'mode' => $mode,
                'created_at' => now()->toIso8601String(),
            ],
            'changes' => $changes,
        ];
    }

    private function dependencySignatures(array $dependencies): array
    {
        return array_map(function (array $dependency): string {
            $determinant = implode(', ', $dependency['determinant'] ?? []);
            $dependent = implode(', ', $dependency['dependent'] ?? []);
            return $determinant . ' -> ' . $dependent;
        }, $dependencies);
    }

    /**
     * Explain step-by-step closure calculation (X+)
     * Educational endpoint to show students how the algorithm works
     */
    public function explainClosure(Request $request)
    {
        $validated = $request->validate([
            'attributes' => 'required|array|min:1|max:50',
            'dependencies' => 'required|array|max:100'
        ]);

        try {
            // Convert dependencies to FunctionalDependency objects
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $validated['dependencies']
            );

            // Get closure explanation
            $explanation = $this->closureExplainer->explainClosure(
                $validated['attributes'],
                $fds
            );

            return response()->json([
                'success' => true,
                'data' => $explanation,
                'message' => 'Explicación del cierre calculada exitosamente'
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al explicar el cierre. Verifica los datos ingresados.'
            ], 422);
        }
    }

    /**
     * Explain candidate key discovery process
     */
    public function explainCandidateKeys(Request $request)
    {
        $validated = $request->validate([
            'attributes' => 'required|array|min:1|max:50',
            'dependencies' => 'required|array|max:100'
        ]);

        try {
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $validated['dependencies']
            );

            $explanation = $this->closureExplainer->explainCandidateKeys(
                $validated['attributes'],
                $fds
            );

            return response()->json([
                'success' => true,
                'data' => $explanation,
                'message' => 'Claves candidatas explicadas exitosamente'
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al explicar claves candidatas. Verifica los datos ingresados.'
            ], 422);
        }
    }

    /**
     * Explain 3NF decomposition strategy
     */
    public function exportValidation(Request $request)
    {
        $validated = $request->validate([
            'table_name' => 'required|string|max:100',
            'attributes' => 'required|array|min:1|max:100',
            'dependencies' => 'required|array|max:200',
        ]);

        try {
            $fds = array_map(
                fn($dep) => new \App\Domain\Entities\FunctionalDependency($dep['determinant'], $dep['dependent']),
                $validated['dependencies']
            );

            $schema = new \App\Domain\Entities\RelationSchema(
                $validated['table_name'],
                $validated['attributes'],
                $fds
            );

            $result = $this->validateSchemaUseCase->execute($schema);

            return response()->json([
                'success' => true,
                'data' => $result,
                'export' => [
                    'format' => 'json',
                    'filename' => 'normalization_export_' . date('Y-m-d') . '.json'
                ]
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al exportar el diagnóstico'
            ], 422);
        }
    }

    public function explainDecomposition(Request $request)
    {
        $validated = $request->validate([
            'attributes' => 'required|array|min:1|max:50',
            'dependencies' => 'required|array|max:100'
        ]);

        try {
            $fds = array_map(
                fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
                $validated['dependencies']
            );

            $explanation = $this->closureExplainer->explainDecomposition(
                $validated['attributes'],
                $fds
            );

            return response()->json([
                'success' => true,
                'data' => $explanation,
                'message' => 'Estrategia de descomposición explicada exitosamente'
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al explicar la descomposición. Verifica los datos ingresados.'
            ], 422);
        }
    }

    public function importCsv(Request $request)
    {
        $validated = $request->validate([
            'csv' => 'required_without:csv_file|string',
            'csv_file' => 'required_without:csv|file|mimes:csv,txt|max:1024',
            'table_name' => 'nullable|string|max:100',
            'has_header' => 'nullable|boolean',
            'delimiter' => 'nullable|string|in:,,;,,\t,|',
        ]);

        try {
            $csvContent = $validated['csv'] ?? file_get_contents($request->file('csv_file')->getRealPath());

            if (strlen($csvContent) > 1048576) {
                return response()->json([
                    'success' => false,
                    'message' => 'El CSV excede el tamaño máximo de 1MB.'
                ], 422);
            }

            $result = $this->csvImportService->import(
                $csvContent,
                $validated['table_name'] ?? null,
                $validated['has_header'] ?? true,
                $validated['delimiter'] ?? null
            );

            if ($result['row_count'] === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'El CSV está vacío o no contiene datos válidos.'
                ], 422);
            }

            $columnInfo = [];
            foreach ($result['columns'] as $col) {
                $entry = [
                    'name' => $col['name'],
                    'type' => $col['type'],
                    'nullable' => false,
                ];
                if (!empty($col['sample_values'])) {
                    $entry['sample'] = $col['sample_values'];
                }
                $columnInfo[] = $entry;
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'table_name' => $result['table_name'],
                    'columns' => $columnInfo,
                    'discovered_fds' => $result['discovered_fds'],
                    'row_count' => $result['row_count'],
                    'attribute_count' => count($result['columns']),
                    'message' => sprintf(
                        'Se importaron %d filas y se descubrieron %d dependencias funcionales.',
                        $result['row_count'],
                        count($result['discovered_fds'])
                    ),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar CSV: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function parseDdl(Request $request)
    {
        $validated = $request->validate([
            'sql' => 'required|string',
        ]);

        try {
            $result = $this->ddlParser->parse($validated['sql']);

            return response()->json([
                'success' => true,
                'data' => [
                    'table_name' => $result['schema']->name,
                    'columns' => $result['raw_columns'],
                    'functional_dependencies' => [
                        'from_pk' => array_map(fn($fd) => $fd->toArray(), $result['fds_from_pk']),
                        'from_unique' => array_map(fn($fd) => $fd->toArray(), $result['fds_from_unique']),
                    ],
                    'foreign_keys' => $result['fks'],
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al analizar SQL: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function parseDdlAdvanced(Request $request)
    {
        $validated = $request->validate([
            'sql' => 'required|string',
            'mode' => 'nullable|string|in:single,multiple,validate',
        ]);

        try {
            $mode = $validated['mode'] ?? 'single';

            if ($mode === 'validate') {
                $validation = $this->ddlParser->validateSql($validated['sql']);
                return response()->json([
                    'success' => true,
                    'data' => $validation,
                ]);
            }

            if ($mode === 'multiple') {
                $results = $this->ddlParser->parseMultiple($validated['sql']);
                return response()->json([
                    'success' => true,
                    'data' => $results,
                ]);
            }

            $result = $this->ddlParser->parse($validated['sql']);
            return response()->json([
                'success' => true,
                'data' => [
                    'type' => 'CREATE_TABLE',
                    'data' => $result,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al analizar SQL: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function importCsvAndValidate(Request $request)
    {
        $validated = $request->validate([
            'csv' => 'required_without:csv_file|string',
            'csv_file' => 'required_without:csv|file|mimes:csv,txt|max:1024',
            'table_name' => 'nullable|string|max:100',
            'has_header' => 'nullable|boolean',
            'delimiter' => 'nullable|string|in:,,;,,\t,|',
        ]);

        try {
            $csvContent = $validated['csv'] ?? file_get_contents($request->file('csv_file')->getRealPath());

            if (strlen($csvContent) > 1048576) {
                return response()->json([
                    'success' => false,
                    'message' => 'El CSV excede el tamaño máximo de 1MB.'
                ], 422);
            }

            $result = $this->csvImportService->import(
                $csvContent,
                $validated['table_name'] ?? null,
                $validated['has_header'] ?? true,
                $validated['delimiter'] ?? null
            );

            if ($result['row_count'] === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'El CSV está vacío o no contiene datos válidos.'
                ], 422);
            }

            $diagnosis = $this->engine->diagnoseNormalization($result['schema']);
            $candidateKeys = $this->engine->findCandidateKeys($result['schema']);

            $columnInfo = [];
            foreach ($result['columns'] as $col) {
                $entry = [
                    'name' => $col['name'],
                    'type' => $col['type'],
                    'nullable' => false,
                ];
                if (!empty($col['sample_values'])) {
                    $entry['sample'] = $col['sample_values'];
                }
                $columnInfo[] = $entry;
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'table_name' => $result['table_name'],
                    'columns' => $columnInfo,
                    'discovered_fds' => $result['discovered_fds'],
                    'row_count' => $result['row_count'],
                    'attribute_count' => count($result['columns']),
                    'candidate_keys' => $candidateKeys,
                    'normalization' => $diagnosis,
                    'message' => sprintf(
                        'Se importaron %d filas, se descubrieron %d dependencias funcionales. Nivel actual: %s.',
                        $result['row_count'],
                        count($result['discovered_fds']),
                        $diagnosis['current_nf']
                    ),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar y validar CSV: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function importFromDatabase(Request $request)
    {
        $validated = $request->validate([
            'driver' => 'required|string|in:pgsql,mysql',
            'host' => 'required|string',
            'port' => 'required|integer|min:1|max:65535',
            'database' => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string',
            'schema' => 'nullable|string|max:100',
        ]);

        $schema = $validated['schema'] ?? 'public';

        try {
            $result = $this->databaseMetadataService->importFromDsn(
                $validated['driver'],
                $validated['host'],
                (int) $validated['port'],
                $validated['database'],
                $validated['username'],
                $validated['password'],
                $schema
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar la base de datos: ' . $e->getMessage(),
            ], 422);
        }
    }

    public function testDatabaseConnection(Request $request)
    {
        $validated = $request->validate([
            'driver' => 'required|string|in:pgsql,mysql',
            'host' => 'required|string',
            'port' => 'required|integer|min:1|max:65535',
            'database' => 'required|string',
            'username' => 'required|string',
            'password' => 'required|string',
        ]);

        try {
            $result = $this->databaseMetadataService->testConnection(
                $validated['driver'],
                $validated['host'],
                (int) $validated['port'],
                $validated['database'],
                $validated['username'],
                $validated['password']
            );

            return response()->json($result);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    public function importFromAppDatabase(Request $request)
    {
        $schema = $request->input('schema', 'public');

        try {
            $result = $this->databaseMetadataService->importFromConnection(
                config('database.default'),
                $schema
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error al importar desde la base de datos: ' . $e->getMessage(),
            ], 422);
        }
    }
}
