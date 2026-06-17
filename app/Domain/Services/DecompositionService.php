<?php

namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class DecompositionService
{
    private NormalizationEngine $engine;
    private SqlGenerationService $sqlService;

    public function __construct(NormalizationEngine $engine, ?SqlGenerationService $sqlService = null)
    {
        $this->engine = $engine;
        $this->sqlService = $sqlService ?? new SqlGenerationService();
    }

    /**
     * Descomposición completa hasta 3FN/BCNF
     */
    public function decomposeTo3NF(RelationSchema $schema, string $engine = 'postgresql'): array
    {
        $result = $this->engine->diagnoseNormalization($schema);
        $tables = [];
        $steps = [];

        // Paso 1: Identificar FDs problemáticas
        $fds = $schema->getFds();
        $ck = $this->engine->findCandidateKeys($schema);
        $pk = $ck[0] ?? [];

        $steps[] = [
            'step' => 1,
            'action' => 'Identificar dependencias funcionales',
            'detail' => 'Se encontraron ' . count($fds) . ' dependencias funcionales',
            'fds' => array_map(fn($fd) => $this->formatFD($fd), $fds)
        ];

        // Paso 2: Separar por dependencias problemáticas
        $processedFds = [];
        $newTables = [];

        foreach ($fds as $fd) {
            $fdKey = implode(',', $fd->determinant) . '→' . implode(',', $fd->dependent);

            if (!in_array($fdKey, $processedFds)) {
                $processedFds[] = $fdKey;

                $isPartial = count($pk) > 1 &&
                    count(array_diff($fd->determinant, $pk)) === 0 &&
                    count($fd->determinant) < count($pk);

                $isTransitive = count(array_diff($fd->determinant, $pk)) > 0 &&
                    count(array_diff($fd->dependent, $pk)) > 0 &&
                    count(array_diff($fd->determinant, $fd->dependent)) > 0;

                if ($isPartial || $isTransitive) {
                    $tableName = $schema->name . '_' . implode('_', $fd->determinant);
                    $allAttrs = array_unique(array_merge($fd->determinant, $fd->dependent));

                    $newTables[] = [
                        'name' => $tableName,
                        'attributes' => $allAttrs,
                        'primary_key' => $fd->determinant,
                        'reason' => $isPartial
                            ? 'Dependencia parcial detectada'
                            : 'Dependencia transitiva detectada',
                        'fd' => $this->formatFD($fd)
                    ];
                }
            }
        }

        // Paso 3: Tabla principal con lo que queda
        $mainAttrs = $schema->getAttributesSet();
        foreach ($newTables as $nt) {
            $mainAttrs = array_values(array_diff($mainAttrs, array_diff($nt['attributes'], $nt['primary_key'])));
        }

        if (!empty($mainAttrs)) {
            $tables[] = [
                'name' => $schema->name,
                'attributes' => $mainAttrs,
                'primary_key' => $pk,
                'is_main' => true
            ];
        }

        $tables = array_merge($tables, $newTables);

        $steps[] = [
            'step' => 2,
            'action' => 'Separar tablas problemáticas',
            'detail' => 'Se crearon ' . count($newTables) . ' tabla(s) adicional(es)',
            'tables_proposed' => $tables
        ];

        // Paso 4: Agregar claves foráneas
        $foreignKeys = [];
        foreach ($newTables as $nt) {
            $foreignKeys[] = [
                'from_table' => $nt['name'],
                'from_column' => implode(', ', $nt['primary_key']),
                'references' => $schema->name,
                'reason' => 'Mantener relación entre tablas'
            ];
        }

        $steps[] = [
            'step' => 3,
            'action' => 'Establecer relaciones',
            'detail' => 'Se definieron ' . count($foreignKeys) . ' clave(s) foránea(s)',
            'foreign_keys' => $foreignKeys
        ];

        return [
            'original_table' => $schema->name,
            'original_attributes' => $schema->getAttributesSet(),
            'current_nf' => $result['current_nf'],
            'violations' => $result['violations'],
            'sql_engine' => $engine,
            'steps' => $steps,
            'resulting_tables' => $tables,
            'foreign_keys' => $foreignKeys,
            'candidate_keys' => $ck,
            'sql' => $this->generateSQL($tables, $foreignKeys, $engine)
        ];
    }

    public function decomposeToBCNF(RelationSchema $schema, string $engine = 'postgresql'): array
    {
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $isLossless = $this->engine->isLosslessJoin($schema, $decomposition);
        $preservation = $this->engine->isDependencyPreserved($schema, $decomposition);

        $tables = [];
        foreach ($decomposition as $i => $rel) {
            $relSchema = new RelationSchema($rel['name'], $rel['attributes'], $rel['fds']);
            $ck = $this->engine->findCandidateKeys($relSchema);
            $tables[] = [
                'name' => $rel['name'],
                'attributes' => $rel['attributes'],
                'primary_key' => $ck[0] ?? [],
                'fds' => array_map(fn($fd) => $this->formatFD($fd), $rel['fds']),
                'is_main' => $i === 0
            ];
        }

        $foreignKeys = [];
        for ($i = 1; $i < count($decomposition); $i++) {
            $common = array_intersect($decomposition[0]['attributes'], $decomposition[$i]['attributes']);
            if (!empty($common)) {
                $foreignKeys[] = [
                    'from_table' => $decomposition[$i]['name'],
                    'from_column' => implode(', ', $common),
                    'references' => $decomposition[0]['name'],
                    'reason' => 'BCNF decomposition foreign key'
                ];
            }
        }

        $notPreservedStr = '';
        if (!$preservation['is_fully_preserved']) {
            $notPreservedStr = ', ' . count($preservation['not_preserved']) . ' no preservada(s)';
        }

        $steps = [
            [
                'step' => 1,
                'action' => 'Aplicar algoritmo de descomposición BCNF',
                'detail' => 'Se descompuso en ' . count($decomposition) . ' tabla(s)',
                'tables' => $tables
            ],
            [
                'step' => 2,
                'action' => 'Verificar join sin pérdida',
                'detail' => $isLossless
                    ? 'La descomposición tiene join sin pérdida ✓'
                    : 'La descomposición NO tiene join sin pérdida ✗'
            ],
            [
                'step' => 3,
                'action' => 'Verificar preservación de dependencias',
                'detail' => count($preservation['preserved']) . ' dependencia(s) preservada(s)'
                    . $notPreservedStr,
                'preserved' => array_map(fn($fd) => $this->formatFD($fd), $preservation['preserved']),
                'not_preserved' => array_map(fn($fd) => $this->formatFD($fd), $preservation['not_preserved'])
            ]
        ];

        return [
            'original_table' => $schema->name,
            'original_attributes' => $schema->getAttributesSet(),
            'sql_engine' => $engine,
            'steps' => $steps,
            'resulting_tables' => $tables,
            'foreign_keys' => $foreignKeys,
            'is_lossless' => $isLossless,
            'dependency_preservation' => $preservation,
            'sql' => $this->generateSQL($tables, $foreignKeys, $engine)
        ];
    }

    /**
     * Generar SQL de las tablas resultantes
     */
    public function generateSQL(array $tables, array $foreignKeys, string $engine = 'postgresql'): string
    {
        $sql = "-- ============================================\n";
        $sql .= "-- Esquema normalizado generado por DataQuest\n";
        $sql .= "-- Motor: " . strtoupper($engine) . "\n";
        $sql .= "-- ============================================\n\n";

        $sql .= $this->sqlService->generateDecomposedTables($tables, $engine);

        foreach ($foreignKeys as $fk) {
            $sql .= "ALTER TABLE " . $fk['from_table'] . "\n";
            $sql .= "    ADD FOREIGN KEY (" . $fk['from_column'] . ")\n";
            $sql .= "    REFERENCES " . $fk['references'] . "(" . explode(', ', $fk['from_column'])[0] . ");\n\n";
        }

        return $sql;
    }

    private function formatFD(FunctionalDependency $fd): string
    {
        return '{' . implode(', ', $fd->determinant) . '} → {' . implode(', ', $fd->dependent) . '}';
    }
}
