<?php

namespace App\Domain\Services;

use App\Domain\Entities\FunctionalDependency;

/**
 * ClosureExplainerService
 * 
 * Provides step-by-step explanation of attribute closure calculation (X+)
 * Educational tool to show students how the algorithm works.
 * 
 * Algorithm: X+ Closure
 * =====================
 * 1. Initialize X+ = X
 * 2. Repeat until no new attributes are added:
 *    - For each FD A -> B:
 *      - If A ⊆ X+, then X+ = X+ ∪ B
 * 3. Return X+
 */
class ClosureExplainerService
{
    /**
     * Calculate X+ closure with detailed step-by-step explanation
     * 
     * @param array<string> $attributes Initial attribute set (X)
     * @param array<FunctionalDependency> $dependencies List of functional dependencies
     * @return array{
     *   closure: array<string>,
     *   steps: array<array{
     *     step_number: int,
     *     description: string,
     *     current_closure: array<string>,
     *     applied_fd: ?string,
     *     reasoning: string
     *   }>
     * }
     */
    public function explainClosure(array $attributes, array $dependencies): array
    {
        $steps = [];
        $closure = $attributes;
        $step = 1;

        // Step 0: Initialization
        $steps[] = [
            'step_number' => 0,
            'description' => 'Inicializar X+',
            'current_closure' => $closure,
            'applied_fd' => null,
            'reasoning' => "X+ se inicia con el conjunto de atributos iniciales: {" . 
                           implode(', ', $closure) . "}"
        ];

        $maxIterations = 100; // Safety limit
        $iteration = 1;
        $changed = true;

        while ($changed && $iteration < $maxIterations) {
            $changed = false;
            $previousClosure = $closure;

            foreach ($dependencies as $fd) {
                // Check if all determinant attributes are in X+
                $determinantInClosure = $this->isSubset($fd->determinant, $closure);

                if ($determinantInClosure) {
                    // Add dependent attributes to closure
                    $newAttributes = array_diff($fd->dependent, $closure);
                    
                    if (!empty($newAttributes)) {
                        $closure = array_unique(array_merge($closure, $newAttributes));
                        $changed = true;

                        $steps[] = [
                            'step_number' => $step++,
                            'description' => "Aplicar FD: {" . 
                                           implode(', ', $fd->determinant) . "} → {" . 
                                           implode(', ', $fd->dependent) . "}",
                            'current_closure' => $closure,
                            'applied_fd' => $this->formatFD($fd),
                            'reasoning' => "Los determinantes {" . implode(', ', $fd->determinant) . 
                                         "} están en X+ = {" . implode(', ', $previousClosure) . "}, " .
                                         "por lo tanto podemos agregar {" . 
                                         implode(', ', $fd->dependent) . "} a X+"
                        ];
                    }
                }
            }

            $iteration++;
        }

        // Final step
        $steps[] = [
            'step_number' => $step,
            'description' => 'Algoritmo Completado',
            'current_closure' => $closure,
            'applied_fd' => null,
            'reasoning' => "El cierre ya no puede crecer. X+ = {" . 
                          implode(', ', $closure) . "}"
        ];

        return [
            'closure' => $closure,
            'steps' => $steps,
            'total_steps' => count($steps),
        ];
    }

    /**
     * Find all candidate keys with explanation
     */
    public function explainCandidateKeys(
        array $attributes,
        array $dependencies
    ): array {
        $candidateKeys = [];
        $explanations = [];

        // Check all subsets of attributes
        $subsets = $this->generateSubsets($attributes);

        foreach ($subsets as $subset) {
            $closure = $this->calculateClosureSimple($subset, $dependencies);

            // If closure equals all attributes, it's a candidate key
            if (count(array_diff($attributes, $closure)) === 0) {
                // Check if it's minimal (no proper subset is also a key)
                $isMinimal = true;
                foreach ($candidateKeys as $key) {
                    if ($this->isProperSubset($key, $subset)) {
                        $isMinimal = false;
                        break;
                    }
                }

                if ($isMinimal) {
                    $candidateKeys[] = $subset;
                    
                    $explanations[] = [
                        'key' => $subset,
                        'closure' => $closure,
                        'reasoning' => "{" . implode(', ', $subset) . "}+ = {" . 
                                     implode(', ', $closure) . "} = R, " .
                                     "por lo tanto es una clave candidata."
                    ];
                }
            }
        }

        return [
            'candidate_keys' => $candidateKeys,
            'total_keys' => count($candidateKeys),
            'explanations' => $explanations,
        ];
    }

    /**
     * Explain decomposition process into 3NF
     */
    public function explainDecomposition(
        array $attributes,
        array $dependencies
    ): array {
        $steps = [];
        
        // Step 1: Find candidate keys
        $keyFinding = $this->explainCandidateKeys($attributes, $dependencies);
        $steps[] = [
            'phase' => 'Encontrar Claves Candidatas',
            'result' => $keyFinding['candidate_keys'],
            'detail' => "Se identificaron " . count($keyFinding['candidate_keys']) . 
                       " clave(s) candidata(s)"
        ];

        // Step 2: Identify problematic FDs
        $problematicFDs = [];
        foreach ($dependencies as $fd) {
            if (!$this->isKeyOrSubsetOfKey($fd->determinant, $keyFinding['candidate_keys'])) {
                if (!$this->isPartialKey($fd->determinant, $keyFinding['candidate_keys'])) {
                    $problematicFDs[] = $fd;
                }
            }
        }

        $steps[] = [
            'phase' => 'Identificar Dependencias Problemáticas',
            'result' => count($problematicFDs) . ' FD(s) que violan 3NF',
            'detail' => "Estas FDs tienen determinantes que no son claves ni " .
                       "superconjuntos de claves"
        ];

        // Step 3: Create new relations
        $newRelations = [];
        foreach ($problematicFDs as $fd) {
            $newRelations[] = [
                'table' => "R_" . implode('_', $fd->determinant),
                'attributes' => array_unique(
                    array_merge($fd->determinant, $fd->dependent)
                ),
                'primary_key' => $fd->determinant,
                'fd' => $this->formatFD($fd)
            ];
        }

        $steps[] = [
            'phase' => 'Crear Nuevas Relaciones',
            'result' => count($newRelations) . ' nueva(s) relación(es)',
            'detail' => 'Se crean relaciones para cada FD problemática'
        ];

        return [
            'decomposition_steps' => $steps,
            'new_relations' => $newRelations,
            'preserved_dependencies' => true, // Simplified
        ];
    }

    // ============================================
    // Helper methods
    // ============================================

    private function isSubset(array $subset, array $set): bool
    {
        return count(array_diff($subset, $set)) === 0;
    }

    private function isProperSubset(array $subset, array $set): bool
    {
        return $this->isSubset($subset, $set) && 
               count($subset) < count($set);
    }

    private function calculateClosureSimple(
        array $attributes,
        array $dependencies
    ): array {
        $closure = $attributes;
        $changed = true;
        $iterations = 0;

        while ($changed && $iterations < 100) {
            $changed = false;
            foreach ($dependencies as $fd) {
                if ($this->isSubset($fd->determinant, $closure)) {
                    $newSize = count($closure);
                    $closure = array_unique(
                        array_merge($closure, $fd->dependent)
                    );
                    if (count($closure) > $newSize) {
                        $changed = true;
                    }
                }
            }
            $iterations++;
        }

        return $closure;
    }

    private function generateSubsets(array $items): array
    {
        $subsets = [[]];
        foreach ($items as $item) {
            foreach ($subsets as $subset) {
                $subsets[] = array_merge($subset, [$item]);
            }
        }
        return $subsets;
    }

    private function isKeyOrSubsetOfKey(
        array $attributes,
        array $candidateKeys
    ): bool {
        foreach ($candidateKeys as $key) {
            if ($this->isSubset($attributes, $key) || 
                $this->isSubset($key, $attributes)) {
                return true;
            }
        }
        return false;
    }

    private function isPartialKey(
        array $attributes,
        array $candidateKeys
    ): bool {
        foreach ($candidateKeys as $key) {
            if ($this->isProperSubset($attributes, $key)) {
                return true;
            }
        }
        return false;
    }

    private function formatFD(FunctionalDependency $fd): string
    {
        return "{" . implode(', ', $fd->determinant) . "} → {" . 
               implode(', ', $fd->dependent) . "}";
    }
}
