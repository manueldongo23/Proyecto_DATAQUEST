<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class MermaidGenerationService
{
    private NormalizationEngine $engine;

    public function __construct(?NormalizationEngine $engine = null)
    {
        $this->engine = $engine ?? new NormalizationEngine();
    }

    public function generateErDiagram(RelationSchema $schema, array $decomposedSchemas = []): string
    {
        $mermaid = "erDiagram\n";

        // Generate the main schema table
        $mermaid .= $this->renderEntityTable($schema);

        // Generate decomposed tables
        foreach ($decomposedSchemas as $decomp) {
            $name = $decomp['name'] ?? 'Unknown';
            $attrs = $decomp['attributes'] ?? [];
            $pk = $decomp['primary_key'] ?? [];

            $mermaid .= "    {$name} {\n";
            foreach ($attrs as $attr) {
                $isPk = in_array($attr, $pk);
                $type = $this->inferMermaidType($attr, $isPk);
                $modifiers = [];
                if ($isPk) {
                    $modifiers[] = 'PK';
                }
                if (preg_match('/_id$/i', $attr) && !$isPk) {
                    $modifiers[] = 'FK';
                }
                $modifierStr = !empty($modifiers) ? ' ' . implode(', ', $modifiers) : '';
                $mermaid .= "        {$type} {$attr}{$modifierStr}\n";
            }
            $mermaid .= "    }\n";
        }

        // Generate relationships between main schema and decomposed schemas
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $pk = $candidateKeys[0] ?? [];

        foreach ($decomposedSchemas as $decomp) {
            $name = $decomp['name'] ?? 'Unknown';
            $attrs = $decomp['attributes'] ?? [];

            $common = array_intersect($attrs, $pk);
            if (!empty($common)) {
                $fkCol = reset($common);
                $mermaid .= "    {$schema->name} ||--o{ {$name} : \"has\"\n";
            } else {
                // Check for _id columns matching the main table
                foreach ($attrs as $attr) {
                    if (preg_match('/^' . preg_quote($schema->name, '/') . '_id$/i', $attr)) {
                        $mermaid .= "    {$schema->name} ||--o{ {$name} : \"has\"\n";
                        break;
                    }
                }
            }
        }

        // Detect relationships from FK-like attributes within the main schema only (no decomposition)
        if (empty($decomposedSchemas)) {
            $fds = $schema->getFds();
            foreach ($schema->getAttributesSet() as $attr) {
                if (preg_match('/^(.+)_id$/i', $attr, $matches) && !in_array($attr, $pk)) {
                    $refTable = ucfirst($matches[1]);
                    $mermaid .= "    {$refTable} ||--o{ {$schema->name} : \"has\"\n";
                }
            }
        }

        return $mermaid;
    }

    public function generateDecompositionFlow(array $steps): string
    {
        $mermaid = "flowchart LR\n";

        foreach ($steps as $i => $step) {
            $nodeId = 'S' . $i;
            $label = $this->escapeNodeLabel($step['action'] ?? 'Step ' . ($i + 1));
            $mermaid .= "    {$nodeId}[{$label}]\n";

            if ($i > 0) {
                $prevId = 'S' . ($i - 1);
                $mermaid .= "    {$prevId} --> {$nodeId}\n";
            }
        }

        return $mermaid;
    }

    private function renderEntityTable(RelationSchema $schema): string
    {
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $primaryKey = $candidateKeys[0] ?? [];
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();

        $mermaid = "    {$schema->name} {\n";

        foreach ($attributes as $attr) {
            $isPk = in_array($attr, $primaryKey);
            $type = $this->inferMermaidType($attr, $isPk);
            $modifiers = [];

            if ($isPk) {
                $modifiers[] = 'PK';
            }

            // Check unique constraint
            foreach ($fds as $fd) {
                if (count($fd->determinant) === 1 && $fd->determinant[0] === $attr && !$isPk) {
                    if (!in_array('UK', $modifiers)) {
                        $modifiers[] = 'UK';
                    }
                }
            }

            // FK marker for id columns
            if (!$isPk && (preg_match('/_id$/i', $attr) || preg_match('/[Ii][Dd]$/', $attr))) {
                $modifiers[] = 'FK';
            }

            $modifierStr = !empty($modifiers) ? ' ' . implode(', ', $modifiers) : '';
            $mermaid .= "        {$type} {$attr}{$modifierStr}\n";
        }

        $mermaid .= "    }\n";

        return $mermaid;
    }

    private function inferMermaidType(string $attribute, bool $isPk): string
    {
        if ($isPk || preg_match('/_id$/i', $attribute)) {
            return 'int';
        }
        if (stripos($attribute, 'email') !== false) {
            return 'varchar';
        }
        if (stripos($attribute, 'name') !== false || stripos($attribute, 'nombre') !== false
            || stripos($attribute, 'desc') !== false || stripos($attribute, 'direccion') !== false) {
            return 'varchar';
        }
        if (preg_match('/^(cantidad|count|numero|edad|anio|year|total|price|precio|monto)/i', $attribute)) {
            return 'int';
        }
        return 'varchar';
    }

    private function escapeNodeLabel(string $label): string
    {
        $label = preg_replace('/[{}()\[\]]/', '', $label);
        if (mb_strlen($label) > 40) {
            $label = mb_substr($label, 0, 37) . '...';
        }
        return $label;
    }
}
