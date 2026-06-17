<?php
class NormalizationEngine {
    public static function computeClosure($attrsSet, $fds, $allAttrs) {
        $closure = array_flip($attrsSet);
        $changed = true;
        while ($changed) {
            $changed = false;
            foreach ($fds as $fd) {
                $lhsOk = true;
                foreach ($fd['lhs'] as $l) if (!isset($closure[$l])) { $lhsOk = false; break; }
                if ($lhsOk) {
                    foreach ($fd['rhs'] as $r) {
                        if (!isset($closure[$r])) {
                            $closure[$r] = true;
                            $changed = true;
                        }
                    }
                }
            }
        }
        return array_keys($closure);
    }

    public static function findCandidateKeys($allAttrs, $fds) {
        $attrsList = array_map('trim', $allAttrs);
        
        // Atributos que NUNCA aparecen a la derecha de ninguna DF
        // Estos DEBEN estar en cualquier clave candidata
        $rhsAttrs = [];
        foreach ($fds as $fd) {
            foreach ($fd['rhs'] as $r) $rhsAttrs[$r] = true;
        }
        $core = [];
        foreach ($attrsList as $a) {
            if (!isset($rhsAttrs[$a])) $core[] = $a;
        }
        
        // Si el core ya determina todo, es la única clave candidata
        $closure = self::computeClosure($core, $fds, $attrsList);
        if (count(array_diff($attrsList, $closure)) == 0) {
            return [array_values($core)];
        }
        
        // Si no, algoritmo greedy para encontrar UNA clave candidata mínima rápida
        $current = $attrsList;
        foreach ($attrsList as $attr) {
            // No podemos quitar los atributos core
            if (in_array($attr, $core)) continue;
            
            $test = array_diff($current, [$attr]);
            $closure = self::computeClosure($test, $fds, $attrsList);
            if (count(array_diff($attrsList, $closure)) == 0) {
                // Podemos prescindir de este atributo
                $current = $test;
            }
        }
        
        return [array_values($current)];
    }

    public static function getNormalForm($allAttrs, $fds) {
        $keys = self::findCandidateKeys($allAttrs, $fds);
        if (empty($keys)) return "1FN";
        $prime = [];
        foreach ($keys as $k) foreach ($k as $a) $prime[$a] = true;
        $is2FN = $is3FN = $isBCNF = true;
        foreach ($fds as $fd) {
            $lhs = $fd['lhs'];
            $rhs = $fd['rhs'];
            $closureX = self::computeClosure($lhs, $fds, $allAttrs);
            $isSuperkey = count(array_diff($allAttrs, $closureX)) == 0;
            // 2FN
            foreach ($keys as $key) {
                if (count($lhs) < count($key) && !array_diff($lhs, $key)) {
                    foreach ($rhs as $r) if (!isset($prime[$r])) $is2FN = false;
                }
            }
            // 3FN
            if (!$isSuperkey) {
                foreach ($rhs as $r) if (!isset($prime[$r])) $is3FN = false;
            }
            // BCNF
            if (!$isSuperkey) $isBCNF = false;
        }
        if ($isBCNF) return "BCNF";
        if ($is3FN) return "3FN";
        if ($is2FN) return "2FN";
        return "1FN";
    }

    public static function synthesize3FN($allAttrs, $fds) {
        $keys = self::findCandidateKeys($allAttrs, $fds);
        if (empty($keys)) return [];
        $key = $keys[0]; // Elegir la primera clave candidata
        
        $tables = [];
        $coveredAttrs = [];
        
        // Agrupar FDs por LHS
        $grouped = [];
        foreach ($fds as $fd) {
            $l = implode(',', $fd['lhs']);
            if (!isset($grouped[$l])) $grouped[$l] = ['lhs' => $fd['lhs'], 'rhs' => []];
            $grouped[$l]['rhs'] = array_unique(array_merge($grouped[$l]['rhs'], $fd['rhs']));
        }
        
        // Para cada FD agupada, crear una tabla
        $i = 1;
        foreach ($grouped as $g) {
            $tAttrs = array_unique(array_merge($g['lhs'], $g['rhs']));
            $tables[] = ['name' => 'Tabla_' . $i++, 'attrs' => array_values($tAttrs), 'pk' => array_values($g['lhs'])];
            foreach ($tAttrs as $a) $coveredAttrs[$a] = true;
        }
        
        // Asegurar que la clave candidata esté en alguna tabla
        $keyCovered = false;
        foreach ($tables as $t) {
            if (count(array_diff($key, $t['attrs'])) == 0) {
                $keyCovered = true;
                break;
            }
        }
        if (!$keyCovered) {
            $tables[] = ['name' => 'Tabla_' . $i++, 'attrs' => array_values($key), 'pk' => array_values($key)];
            foreach ($key as $a) $coveredAttrs[$a] = true;
        }
        
        // Atributos que no están en ninguna FD (añadirlos a la tabla principal con la clave)
        $missing = array_diff($allAttrs, array_keys($coveredAttrs));
        if (!empty($missing)) {
            $tAttrs = array_unique(array_merge($key, $missing));
            $tables[] = ['name' => 'Tabla_Principal', 'attrs' => array_values($tAttrs), 'pk' => array_values($key)];
        }
        
        // Eliminar tablas redundantes (subconjuntos de otras)
        $finalTables = [];
        foreach ($tables as $t1) {
            $isSubset = false;
            foreach ($tables as $t2) {
                if ($t1['name'] !== $t2['name'] && count(array_diff($t1['attrs'], $t2['attrs'])) == 0) {
                    $isSubset = true;
                    break;
                }
            }
            if (!$isSubset) $finalTables[] = $t1;
        }
        
        // Renumerar
        $res = [];
        $idx = 1;
        foreach ($finalTables as $t) {
            $t['name'] = 'Tabla_' . $idx++;
            $res[] = $t;
        }
        return $res;
    }

    public static function generateStepByStepReport($allAttrs, $fds) {
        $keys = self::findCandidateKeys($allAttrs, $fds);
        if (empty($keys)) return [];
        $key = $keys[0]; // Elegir la primera clave candidata
        
        $report = [];
        
        // --- 1FN ---
        $report[] = [
            'step' => '1FN',
            'title' => 'Primera Forma Normal (1FN)',
            'explanation' => 'Todos los atributos son atómicos y existe una clave candidata. Esta es la tabla base.',
            'tables' => [
                ['name' => 'Tabla_Original', 'attrs' => array_values($allAttrs), 'pk' => array_values($key)]
            ]
        ];
        
        // --- 2FN ---
        $partialDeps = [];
        foreach ($fds as $fd) {
            $lhs = $fd['lhs'];
            $closureX = self::computeClosure($lhs, $fds, $allAttrs);
            $isSuperkey = count(array_diff($allAttrs, $closureX)) == 0;
            
            $isPartial = false;
            foreach ($keys as $k) {
                if (count($lhs) < count($k) && !array_diff($lhs, $k)) {
                    $isPartial = true;
                    break;
                }
            }
            if ($isPartial && !$isSuperkey) {
                $partialDeps[] = $fd;
            }
        }
        
        $tables2FN = [];
        if (!empty($partialDeps)) {
            $coveredByPartial = [];
            $i = 1;
            foreach ($partialDeps as $pd) {
                $tAttrs = array_unique(array_merge($pd['lhs'], $pd['rhs']));
                $tables2FN[] = ['name' => 'Tabla_Parcial_' . $i++, 'attrs' => array_values($tAttrs), 'pk' => array_values($pd['lhs'])];
                foreach ($pd['rhs'] as $r) $coveredByPartial[$r] = true;
            }
            $remainingAttrs = array_diff($allAttrs, array_keys($coveredByPartial));
            if (!empty($remainingAttrs)) {
                $tables2FN[] = ['name' => 'Tabla_Principal_2FN', 'attrs' => array_values($remainingAttrs), 'pk' => array_values($key)];
            }
            
            $report[] = [
                'step' => '2FN',
                'title' => 'Segunda Forma Normal (2FN)',
                'explanation' => 'Se detectaron dependencias parciales (atributos que dependen solo de una parte de la clave compuesta). Se han extraído en tablas separadas.',
                'tables' => $tables2FN
            ];
        } else {
            $tables2FN = [ ['name' => 'Tabla_Principal_2FN', 'attrs' => array_values($allAttrs), 'pk' => array_values($key)] ];
            $report[] = [
                'step' => '2FN',
                'title' => 'Segunda Forma Normal (2FN)',
                'explanation' => 'El esquema cumple con la 2FN porque no existen dependencias parciales.',
                'tables' => $tables2FN
            ];
        }
        
        // --- 3FN ---
        $tables3FN = self::synthesize3FN($allAttrs, $fds);
        $report[] = [
            'step' => '3FN',
            'title' => 'Tercera Forma Normal (3FN)',
            'explanation' => 'Se han analizado y eliminado las dependencias transitivas. El esquema resultante agrupa cada dependencia funcional en su propia tabla con su respectiva clave primaria.',
            'tables' => $tables3FN
        ];
        
        return $report;
    }

    public static function parseFDs($text) {
        $parts = explode(',', $text);
        $fds = [];
        foreach ($parts as $part) {
            $part = trim($part);
            if (strpos($part, '→') !== false) $arrow = '→';
            elseif (strpos($part, '->') !== false) $arrow = '->';
            else continue;
            list($l, $r) = explode($arrow, $part);
            $lhs = array_map('trim', explode(',', $l));
            $rhs = array_map('trim', explode(',', $r));
            $fds[] = ['lhs' => $lhs, 'rhs' => $rhs];
        }
        return $fds;
    }
}