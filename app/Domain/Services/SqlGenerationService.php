<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class SqlGenerationService
{
    private array $dialects = [
        'postgresql' => [
            'integer' => 'INTEGER',
            'text' => 'TEXT',
            'bigint' => 'BIGINT',
            'serial' => 'SERIAL PRIMARY KEY',
            'primary_key' => 'PRIMARY KEY',
            'references' => 'REFERENCES',
            'drop_column' => 'DROP COLUMN',
        ],
        'mysql' => [
            'integer' => 'INT',
            'text' => 'VARCHAR(255)',
            'bigint' => 'BIGINT',
            'serial' => 'INT AUTO_INCREMENT PRIMARY KEY',
            'primary_key' => 'PRIMARY KEY',
            'references' => 'REFERENCES',
            'drop_column' => 'DROP COLUMN',
        ],
        'sqlite' => [
            'integer' => 'INTEGER',
            'text' => 'TEXT',
            'bigint' => 'INTEGER',
            'serial' => 'INTEGER PRIMARY KEY AUTOINCREMENT',
            'primary_key' => 'PRIMARY KEY',
            'references' => 'REFERENCES',
            'drop_column' => 'DROP COLUMN',
        ],
        'sqlserver' => [
            'integer' => 'INT',
            'text' => 'NVARCHAR(MAX)',
            'bigint' => 'BIGINT',
            'serial' => 'INT IDENTITY(1,1) PRIMARY KEY',
            'primary_key' => 'PRIMARY KEY',
            'references' => 'REFERENCES',
            'drop_column' => 'DROP COLUMN',
        ],
    ];

    public function generateCreateTable(RelationSchema $schema, string $dialect = 'postgresql'): string
    {
        $types = $this->dialects[$dialect] ?? $this->dialects['postgresql'];
        $attributes = $schema->getAttributesSet();
        $engine = new NormalizationEngine();
        $candidateKeys = $engine->findCandidateKeys($schema);
        $primaryKey = $candidateKeys[0] ?? [];

        $sql = "-- Tabla: {$schema->name}\n";
        $sql .= "-- Dialecto: " . strtoupper($dialect) . "\n";
        $sql .= "CREATE TABLE {$schema->name} (\n";

        $columns = [];
        foreach ($attributes as $attr) {
            $isPk = in_array($attr, $primaryKey);
            if ($isPk && count($primaryKey) === 1) {
                $columns[] = "    {$attr} {$types['serial']}";
            } elseif ($isPk) {
                $columns[] = "    {$attr} {$types['bigint']} NOT NULL";
            } else {
                $columns[] = "    {$attr} {$types['text']}";
            }
        }

        if (count($primaryKey) > 1) {
            $pkCols = implode(', ', $primaryKey);
            $columns[] = "    {$types['primary_key']} ({$pkCols})";
        }

        $sql .= implode(",\n", $columns);
        $sql .= "\n);\n";

        return $sql;
    }

    public function generateNormalizationSQL(RelationSchema $schema, array $diagnosis, string $dialect = 'postgresql'): string
    {
        $types = $this->dialects[$dialect] ?? $this->dialects['postgresql'];
        $engine = new NormalizationEngine();
        $candidateKeys = $engine->findCandidateKeys($schema);
        $primaryKey = $candidateKeys[0] ?? [];
        $fds = $schema->getFds();
        $attributes = $schema->getAttributesSet();

        $sql = "-- ============================================\n";
        $sql .= "-- Pasos de normalizaci\u{00F3}n para: {$schema->name}\n";
        $sql .= "-- Dialecto: " . strtoupper($dialect) . "\n";
        $sql .= "-- ============================================\n\n";

        $sql .= "-- Esquema original\n";
        $sql .= $this->generateCreateTable($schema, $dialect);
        $sql .= "\n";

        $violations = $diagnosis['violations'] ?? [];

        foreach ($violations as $violation) {
            $sql .= "-- ============================================\n";
            $sql .= "-- Correcci\u{00F3}n para: {$violation}\n";
            $sql .= "-- ============================================\n\n";

            switch ($violation) {
                case '2FN':
                    $sql .= $this->generate2NFSQL($schema, $types, $primaryKey);
                    break;
                case '3FN':
                    $sql .= $this->generate3NFSQL($schema, $types, $primaryKey);
                    break;
                case 'BCNF':
                    $sql .= $this->generateBCNFSQL($schema, $types);
                    break;
                case '4FN':
                    $sql .= $this->generate4NFSQL($schema, $types);
                    break;
                case '5FN':
                    $sql .= $this->generate5NFSQL($schema, $types, $candidateKeys);
                    break;
            }

            $sql .= "\n";
        }

        return $sql;
    }

    public function generateDecomposedTables(array $tables, string $dialect = 'postgresql'): string
    {
        $types = $this->dialects[$dialect] ?? $this->dialects['postgresql'];
        $sql = "-- Tablas descompuestas\n";
        $sql .= "-- Dialecto: " . strtoupper($dialect) . "\n\n";

        foreach ($tables as $table) {
            $sql .= "CREATE TABLE {$table['name']} (\n";
            $columns = [];

            foreach ($table['attributes'] as $attr) {
                $isPk = in_array($attr, $table['primary_key'] ?? []);
                if ($isPk && count($table['primary_key']) === 1) {
                    $columns[] = "    {$attr} {$types['serial']}";
                } elseif ($isPk) {
                    $columns[] = "    {$attr} {$types['bigint']} NOT NULL";
                } else {
                    $columns[] = "    {$attr} {$types['text']}";
                }
            }

            if (count($table['primary_key'] ?? []) > 1) {
                $pkCols = implode(', ', $table['primary_key']);
                $columns[] = "    {$types['primary_key']} ({$pkCols})";
            }

            $sql .= implode(",\n", $columns);
            $sql .= "\n);\n\n";
        }

        return $sql;
    }

    private function generate2NFSQL(RelationSchema $schema, array $types, array $primaryKey): string
    {
        $engine = new NormalizationEngine();
        $candidateKeys = $engine->findCandidateKeys($schema);
        $fds = $schema->getFds();
        $primeAttrs = $engine->getPrimeAttributes($schema);
        $sql = "-- Soluci\u{00F3}n 2FN: Extraer dependencias parciales a nuevas tablas\n\n";

        foreach ($fds as $fd) {
            foreach ($candidateKeys as $ck) {
                if (count($fd->determinant) >= count($ck)) continue;
                if (array_diff($fd->determinant, $ck) !== []) continue;

                $nonPrimeDeps = array_diff($fd->dependent, $primeAttrs);
                if (empty($nonPrimeDeps)) continue;

                $tableName = $schema->name . '_' . implode('_', $fd->determinant);
                $allAttrs = array_unique(array_merge($fd->determinant, $fd->dependent));

                $sql .= "-- Crear tabla separada para dependencia parcial\n";
                $sql .= "CREATE TABLE {$tableName} (\n";
                $cols = [];
                foreach ($allAttrs as $attr) {
                    if (in_array($attr, $fd->determinant) && count($fd->determinant) === 1) {
                        $cols[] = "    {$attr} {$types['serial']}";
                    } elseif (in_array($attr, $fd->determinant)) {
                        $cols[] = "    {$attr} {$types['bigint']} NOT NULL";
                    } else {
                        $cols[] = "    {$attr} {$types['text']}";
                    }
                }
                if (count($fd->determinant) > 1) {
                    $cols[] = "    {$types['primary_key']} (" . implode(', ', $fd->determinant) . ")";
                }
                $sql .= implode(",\n", $cols) . "\n);\n\n";

                foreach ($fd->dependent as $dep) {
                    $sql .= "ALTER TABLE {$schema->name} {$types['drop_column']} {$dep};\n";
                }
                $sql .= "\n";

                $fkCol = implode(', ', $fd->determinant);
                $sql .= "ALTER TABLE {$tableName}\n";
                $sql .= "    ADD FOREIGN KEY ({$fkCol})\n";
                $sql .= "    {$types['references']} {$schema->name}(" . $fd->determinant[0] . ");\n\n";

                break;
            }
        }

        return $sql;
    }

    private function generate3NFSQL(RelationSchema $schema, array $types, array $primaryKey): string
    {
        $engine = new NormalizationEngine();
        $fds = $schema->getFds();
        $primeAttrs = $engine->getPrimeAttributes($schema);
        $nonPrimeAttrs = array_diff($schema->getAttributesSet(), $primeAttrs);
        $sql = "-- Soluci\u{00F3}n 3FN: Extraer dependencias transitivas a nuevas tablas\n\n";

        foreach ($fds as $fd) {
            if (empty($fd->determinant)) continue;
            $detIsNonPrime = array_diff($fd->determinant, $nonPrimeAttrs) === [];
            $depHasNonPrime = array_diff($fd->dependent, $primeAttrs) !== [];
            if (!$detIsNonPrime || !$depHasNonPrime) continue;

            $tableName = $schema->name . '_' . implode('_', $fd->determinant);
            $allAttrs = array_unique(array_merge($fd->determinant, $fd->dependent));

            $sql .= "-- Crear tabla separada para dependencia transitiva\n";
            $sql .= "CREATE TABLE {$tableName} (\n";
            $cols = [];
            foreach ($allAttrs as $attr) {
                if (in_array($attr, $fd->determinant) && count($fd->determinant) === 1) {
                    $cols[] = "    {$attr} {$types['serial']}";
                } elseif (in_array($attr, $fd->determinant)) {
                    $cols[] = "    {$attr} {$types['bigint']} NOT NULL";
                } else {
                    $cols[] = "    {$attr} {$types['text']}";
                }
            }
            if (count($fd->determinant) > 1) {
                $cols[] = "    {$types['primary_key']} (" . implode(', ', $fd->determinant) . ")";
            }
            $sql .= implode(",\n", $cols) . "\n);\n\n";

            foreach ($fd->dependent as $dep) {
                if (!in_array($dep, $primeAttrs)) {
                    $sql .= "ALTER TABLE {$schema->name} {$types['drop_column']} {$dep};\n";
                }
            }
            $sql .= "\n";
        }

        return $sql;
    }

    private function generateBCNFSQL(RelationSchema $schema, array $types): string
    {
        $engine = new NormalizationEngine();
        $fds = $schema->getFds();
        $allAttrs = $schema->getAttributesSet();
        $sql = "-- Soluci\u{00F3}n BCNF: Descomponer por dependencias problem\u{00E1}ticas\n\n";

        foreach ($fds as $fd) {
            if (array_diff($fd->dependent, $fd->determinant) === []) continue;

            $closure = $engine->computeClosure($fd->determinant, $fds);
            if (array_diff($allAttrs, $closure) === []) continue;

            $tableName = $schema->name . '_' . implode('_', $fd->determinant);
            $allFdAttrs = array_unique(array_merge($fd->determinant, $fd->dependent));

            $sql .= "-- Descomponer por: " . implode(',', $fd->determinant) . " \u{2192} " . implode(',', $fd->dependent) . "\n";
            $sql .= "CREATE TABLE {$tableName} (\n";
            $cols = [];
            foreach ($allFdAttrs as $attr) {
                if (in_array($attr, $fd->determinant) && count($fd->determinant) === 1) {
                    $cols[] = "    {$attr} {$types['serial']}";
                } elseif (in_array($attr, $fd->determinant)) {
                    $cols[] = "    {$attr} {$types['bigint']} NOT NULL";
                } else {
                    $cols[] = "    {$attr} {$types['text']}";
                }
            }
            if (count($fd->determinant) > 1) {
                $cols[] = "    {$types['primary_key']} (" . implode(', ', $fd->determinant) . ")";
            }
            $sql .= implode(",\n", $cols) . "\n);\n\n";
        }

        return $sql;
    }

    private function generate4NFSQL(RelationSchema $schema, array $types): string
    {
        $engine = new NormalizationEngine();
        $primeAttrs = $engine->getPrimeAttributes($schema);
        $nonKeyAttrs = array_values(array_diff($schema->getAttributesSet(), $primeAttrs));
        $primeList = array_values($primeAttrs);
        $sql = "-- Soluci\u{00F3}n 4FN: Separar atributos independientes en tablas diferentes\n\n";

        if (count($nonKeyAttrs) >= 2) {
            for ($i = 0; $i < count($nonKeyAttrs); $i++) {
                $attr = $nonKeyAttrs[$i];
                $tableName = $schema->name . '_' . $attr;
                $sql .= "CREATE TABLE {$tableName} (\n";
                $cols = [];
                foreach ($primeList as $p) {
                    $cols[] = "    {$p} {$types['bigint']} NOT NULL";
                }
                $cols[] = "    {$attr} {$types['text']}";
                if (count($primeList) > 0) {
                    $sql .= implode(",\n", $cols) . ",\n";
                    $sql .= "    {$types['primary_key']} (" . implode(', ', $primeList) . ")\n";
                }
                $sql .= ");\n\n";
            }
        }

        return $sql;
    }

    private function generate5NFSQL(RelationSchema $schema, array $types, array $candidateKeys): string
    {
        $sql = "-- Soluci\u{00F3}n 5FN: Descomponer seg\u{00FA}n claves candidatas\n\n";

        foreach ($candidateKeys as $i => $ck) {
            $tableName = $schema->name . '_part_' . ($i + 1);
            $remaining = array_diff($schema->getAttributesSet(), $ck);
            $allAttrs = array_unique(array_merge($ck, $remaining));

            $sql .= "CREATE TABLE {$tableName} (\n";
            $cols = [];
            foreach ($allAttrs as $attr) {
                if (in_array($attr, $ck) && count($ck) === 1) {
                    $cols[] = "    {$attr} {$types['serial']}";
                } elseif (in_array($attr, $ck)) {
                    $cols[] = "    {$attr} {$types['bigint']} NOT NULL";
                } else {
                    $cols[] = "    {$attr} {$types['text']}";
                }
            }
            if (count($ck) > 1) {
                $cols[] = "    {$types['primary_key']} (" . implode(', ', $ck) . ")";
            }
            $sql .= implode(",\n", $cols) . "\n);\n\n";
        }

        return $sql;
    }
}
