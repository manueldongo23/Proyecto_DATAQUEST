<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class DbmlGenerationService
{
    private NormalizationEngine $engine;

    public function __construct(?NormalizationEngine $engine = null)
    {
        $this->engine = $engine ?? new NormalizationEngine();
    }

    public function generate(RelationSchema $schema, array $diagnosis = []): string
    {
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $primaryKey = $candidateKeys[0] ?? [];
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();

        $dbml = "Table {$schema->name} {\n";

        $columns = [];
        $foreignKeys = [];

        foreach ($attributes as $attr) {
            $isPk = in_array($attr, $primaryKey);
            $type = $this->inferColumnType($attr, $isPk);
            $modifiers = [];

            if ($isPk) {
                $modifiers[] = 'pk';
            }

            $modifiers[] = 'not null';

            // Detect FK pattern: attribute ends with _id or Id/ID and is not PK
            if (!$isPk && preg_match('/^(.+?)(?:_id|Id|ID)$/', $attr, $matches)) {
                $referencedTable = $this->guessReferencedTable($matches[1]);
                $foreignKeys[] = [
                    'column' => $attr,
                    'ref_table' => $referencedTable,
                ];
            }

            // Check if attr has unique constraint via FD (is determinant of some FD)
            foreach ($fds as $fd) {
                if (count($fd->determinant) === 1 && $fd->determinant[0] === $attr
                    && !$isPk && !in_array('unique', $modifiers)) {
                    $modifiers[] = 'unique';
                }
            }

            $modifierStr = ' [' . implode(', ', $modifiers) . ']';
            $columns[] = "  {$attr} {$type}{$modifierStr}";
        }

        // Add table notes for diagnosis violations if provided
        if (!empty($diagnosis['violations'])) {
            $columns[] = '';
            $columns[] = '  // Violaciones detectadas:';
            foreach ($diagnosis['violations'] as $violation) {
                $columns[] = "  // - {$violation}";
            }
        }

        $dbml .= implode("\n", $columns);
        $dbml .= "\n}\n";

        // Generate Ref lines for FK columns
        foreach ($foreignKeys as $fk) {
            $dbml .= "\nRef: {$schema->name}.{$fk['column']} > {$fk['ref_table']}.{$fk['column']}";
        }

        $dbml .= "\n";

        return $dbml;
    }

    public function generateMultiple(array $schemas): string
    {
        $dbml = '';

        foreach ($schemas as $item) {
            if ($item instanceof RelationSchema) {
                $dbml .= $this->generate($item) . "\n";
            } elseif (is_array($item) && isset($item['schema'])) {
                $diagnosis = $item['diagnosis'] ?? [];
                $dbml .= $this->generate($item['schema'], $diagnosis) . "\n";
            }
        }

        return $dbml;
    }

    private function inferColumnType(string $attribute, bool $isPk): string
    {
        if ($isPk) {
            return 'INT';
        }

        // Detect id suffix -> integer reference
        if (preg_match('/_id$/i', $attribute) || preg_match('/[Ii][Dd]$/', $attribute)) {
            return 'INT';
        }

        // Detect common type hints in attribute name
        if (preg_match('/^(cantidad|count|numero|edad|anio|year|total|price|precio|monto)/i', $attribute)) {
            return 'INT';
        }

        // Check if it looks like an email
        if (stripos($attribute, 'email') !== false) {
            return 'VARCHAR(255)';
        }

        // Check if it looks like a name
        if (stripos($attribute, 'name') !== false || stripos($attribute, 'nombre') !== false
            || stripos($attribute, 'apellido') !== false || stripos($attribute, 'desc') !== false
            || stripos($attribute, 'direccion') !== false || stripos($attribute, 'address') !== false) {
            return 'VARCHAR(100)';
        }

        return 'VARCHAR(255)';
    }

    private function guessReferencedTable(string $name): string
    {
        return ucfirst($name);
    }
}
