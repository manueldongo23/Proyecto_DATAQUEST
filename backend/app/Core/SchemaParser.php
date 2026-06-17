<?php
class SchemaParser {
    public static function parse($text) {
        $lines = preg_split('/\r?\n/', $text);
        $entities = [];
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            if (preg_match('/^(\w+)\s*\((.*)\)$/i', $line, $matches)) {
                $name = $matches[1];
                $attrsRaw = explode(',', $matches[2]);
                $attributes = [];
                $pk = null;
                $fks = [];
                foreach ($attrsRaw as $attr) {
                    $attr = trim($attr);
                    $isPk = stripos($attr, 'pk') !== false;
                    $fkMatch = null;
                    if (preg_match('/FK→(\w+)/i', $attr, $fkMatch)) {
                        $fks[] = ['attr' => trim(str_replace('FK→'.$fkMatch[1], '', $attr)), 'ref' => $fkMatch[1]];
                    }
                    $clean = preg_replace('/\s*PK\s*/i', '', $attr);
                    $clean = preg_replace('/FK→\w+/i', '', $clean);
                    $clean = trim($clean);
                    if ($isPk) $pk = $clean;
                    $attributes[] = $clean;
                }
                $entities[] = ['name' => $name, 'attributes' => $attributes, 'pk' => $pk, 'fks' => $fks];
            }
        }
        return $entities;
    }

    public static function toMermaid($entities) {
        if (empty($entities)) return "erDiagram\n    %% No data";
        $out = "erDiagram\n";
        foreach ($entities as $e) {
            $out .= "    {$e['name']} {\n";
            foreach ($e['attributes'] as $attr) {
                $out .= "        {$attr}" . ($attr == $e['pk'] ? " PK" : "") . "\n";
            }
            $out .= "    }\n";
        }
        foreach ($entities as $e) {
            foreach ($e['fks'] as $fk) {
                $out .= "    {$e['name']} }o--|| {$fk['ref']} : \"FK\"\n";
            }
        }
        return $out;
    }
}