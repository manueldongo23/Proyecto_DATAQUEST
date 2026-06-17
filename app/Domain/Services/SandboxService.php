<?php

namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class SandboxService
{
    public function __construct(
        private NormalizationEngine $engine,
        private DecompositionService $decompositionService,
        private SqlGenerationService $sqlGeneration,
        private SqlDdlParserService $ddlParser,
        private CsvImportService $csvImport,
        private GlossaryService $glossary,
    ) {}

    public function analyze(array $input): array
    {
        $schema = $this->buildSchema($input);

        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $primeAttributes = $this->engine->getPrimeAttributes($schema);
        $canonicalCover = $this->engine->computeCanonicalCover($schema->getFds());
        $diagnosis = $this->engine->diagnoseNormalization($schema);
        $decomposition = $this->decompositionService->decomposeToBCNF($schema);

        $sql = $this->sqlGeneration->generateDecomposedTables(
            $decomposition['resulting_tables'] ?? []
        );

        return [
            'schema_name' => $schema->name,
            'attributes' => $schema->getAttributesSet(),
            'functional_dependencies' => array_map(
                fn($fd) => ['determinant' => $fd->determinant, 'dependent' => $fd->dependent],
                $schema->getFds()
            ),
            'candidate_keys' => $candidateKeys,
            'prime_attributes' => $primeAttributes,
            'canonical_cover' => array_map(
                fn($fd) => ['determinant' => $fd->determinant, 'dependent' => $fd->dependent],
                $canonicalCover
            ),
            'diagnosis' => $diagnosis,
            'decomposition' => $decomposition,
            'sql' => $sql,
        ];
    }

    public function buildSchema(array $input): RelationSchema
    {
        if (empty($input['table_name']) || empty($input['attributes']) || empty($input['dependencies'])) {
            throw new \InvalidArgumentException('Missing required fields: table_name, attributes, dependencies');
        }

        $fds = array_map(
            fn($dep) => new FunctionalDependency($dep['determinant'], $dep['dependent']),
            $input['dependencies']
        );

        return new RelationSchema($input['table_name'], $input['attributes'], $fds);
    }

    public function parseDdl(string $sql): array
    {
        return $this->ddlParser->parse($sql);
    }

    public function importCsv(string $csv, ?string $tableName = null): array
    {
        return $this->csvImport->import($csv, $tableName);
    }

    public function glossary(string $term, string $locale = 'es'): ?array
    {
        return $this->glossary->getTerm($term, $locale);
    }

    public function generateExercise(string $nf): array
    {
        $schemas = $this->getExerciseSchemas();
        $filtered = array_values(array_filter($schemas, fn($s) => $s['nf'] === $nf));
        return !empty($filtered) ? $filtered[array_rand($filtered)] : $schemas[array_rand($schemas)];
    }

    private function getExerciseSchemas(): array
    {
        return [
            [
                'nf' => '1FN',
                'title' => 'Identificar 1FN',
                'schema' => [
                    'table_name' => 'Estudiante',
                    'attributes' => ['id', 'nombre', 'telefonos'],
                    'dependencies' => [
                        ['determinant' => ['id'], 'dependent' => ['nombre', 'telefonos']],
                    ],
                ],
                'question' => '¿Este esquema cumple con 1FN?',
                'answer' => false,
                'explanation' => 'El atributo "telefonos" contiene múltiples valores (no atómico).',
            ],
            [
                'nf' => '2FN',
                'title' => 'Identificar dependencia parcial',
                'schema' => [
                    'table_name' => 'Inscripcion',
                    'attributes' => ['estudiante_id', 'curso_id', 'nombre_estudiante', 'nota'],
                    'dependencies' => [
                        ['determinant' => ['estudiante_id', 'curso_id'], 'dependent' => ['nota']],
                        ['determinant' => ['estudiante_id'], 'dependent' => ['nombre_estudiante']],
                    ],
                ],
                'question' => '¿Este esquema viola 2FN?',
                'answer' => true,
                'explanation' => 'nombre_estudiante depende solo de estudiante_id (parte de la clave), no de toda la clave.',
            ],
            [
                'nf' => '3FN',
                'title' => 'Identificar dependencia transitiva',
                'schema' => [
                    'table_name' => 'Empleado',
                    'attributes' => ['emp_id', 'depto_id', 'depto_nombre', 'salario'],
                    'dependencies' => [
                        ['determinant' => ['emp_id'], 'dependent' => ['depto_id', 'salario']],
                        ['determinant' => ['depto_id'], 'dependent' => ['depto_nombre']],
                    ],
                ],
                'question' => '¿Este esquema viola 3FN?',
                'answer' => true,
                'explanation' => 'depto_nombre depende transitivamente de emp_id a través de depto_id.',
            ],
            [
                'nf' => 'BCNF',
                'title' => 'Identificar violación BCNF',
                'schema' => [
                    'table_name' => 'Asignacion',
                    'attributes' => ['profesor', 'aula', 'horario'],
                    'dependencies' => [
                        ['determinant' => ['profesor', 'aula'], 'dependent' => ['horario']],
                        ['determinant' => ['horario'], 'dependent' => ['aula']],
                    ],
                ],
                'question' => '¿Este esquema cumple BCNF?',
                'answer' => false,
                'explanation' => 'horario → aula viola BCNF porque horario no es superclave.',
            ],
            [
                'nf' => '4FN',
                'title' => 'Identificar dependencia multivaluada',
                'schema' => [
                    'table_name' => 'ProfesorCursoLibro',
                    'attributes' => ['prof_id', 'curso', 'libro'],
                    'dependencies' => [
                        ['determinant' => ['prof_id'], 'dependent' => ['curso']],
                        ['determinant' => ['prof_id'], 'dependent' => ['libro']],
                    ],
                ],
                'question' => '¿Este esquema viola 4FN?',
                'answer' => true,
                'explanation' => 'prof_id →→ curso y prof_id →→ libro son independientes, generando redundancia.',
            ],
            [
                'nf' => '5FN',
                'title' => 'Identificar dependencia de join',
                'schema' => [
                    'table_name' => 'ProveedorPiezaProyecto',
                    'attributes' => ['prov_id', 'pieza_id', 'proy_id'],
                    'dependencies' => [
                        ['determinant' => ['prov_id', 'pieza_id'], 'dependent' => ['proy_id']],
                        ['determinant' => ['prov_id', 'proy_id'], 'dependent' => ['pieza_id']],
                        ['determinant' => ['pieza_id', 'proy_id'], 'dependent' => ['prov_id']],
                    ],
                ],
                'question' => '¿Este esquema requiere verificación de 5FN?',
                'answer' => true,
                'explanation' => 'Múltiples claves candidatas superpuestas sugieren una posible dependencia de join.',
            ],
        ];
    }
}
