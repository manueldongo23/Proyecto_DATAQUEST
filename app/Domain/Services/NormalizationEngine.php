<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class NormalizationEngine
{
    private static int $closureCounter = 0;

    private array $closureCache = [];

    public static function resetClosureCounter(): void
    {
        self::$closureCounter = 0;
    }

    public static function getClosureCounter(): int
    {
        return self::$closureCounter;
    }

    public function computeClosure(array $attributes, array $fds): array
    {
        self::$closureCounter++;
        $closure = $attributes;
        $changed = true;

        while ($changed) {
            $changed = false;
            foreach ($fds as $fd) {
                if (array_diff($fd->determinant, $closure) === []) {
                    foreach ($fd->dependent as $dep) {
                        if (!in_array($dep, $closure)) {
                            $closure[] = $dep;
                            $changed = true;
                        }
                    }
                }
            }
        }

        return $closure;
    }

    public function findCandidateKeys(RelationSchema $schema): array
    {
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $candidateKeys = [];
        $superkeySet = [];
        $this->closureCache = [];

        $subsets = $this->generatePowerSet($attributes);
        usort($subsets, fn($a, $b) => count($a) - count($b));

        foreach ($subsets as $subset) {
            if (empty($subset)) continue;

            $isSuperset = false;
            foreach ($superkeySet as $sk) {
                if (array_diff($sk, $subset) === []) {
                    $isSuperset = true;
                    break;
                }
            }
            if ($isSuperset) continue;

            $cacheKey = $this->makeCacheKey($subset);
            if (!isset($this->closureCache[$cacheKey])) {
                $this->closureCache[$cacheKey] = $this->computeClosure($subset, $fds);
            }
            $closure = $this->closureCache[$cacheKey];

            if (array_diff($attributes, $closure) === []) {
                $superkeySet[] = $subset;
                $isMinimal = true;
                foreach ($subset as $attr) {
                    $reduced = array_values(array_diff($subset, [$attr]));
                    if (!empty($reduced)) {
                        $redKey = $this->makeCacheKey($reduced);
                        if (!isset($this->closureCache[$redKey])) {
                            $this->closureCache[$redKey] = $this->computeClosure($reduced, $fds);
                        }
                        if (array_diff($attributes, $this->closureCache[$redKey]) === []) {
                            $isMinimal = false;
                            break;
                        }
                    }
                }
                if ($isMinimal) {
                    $candidateKeys[] = $subset;
                }
            }
        }

        $this->closureCache = [];
        return $candidateKeys;
    }

    public function diagnoseNormalization(RelationSchema $schema): array
    {
        $candidateKeys = $this->findCandidateKeys($schema);

        $diagnosis = [
            'current_nf' => '1NF',
            'violations' => [],
            'didactic_steps' => [],
            'suggestions' => []
        ];

        $diagnosis['didactic_steps'][] = [
            'step' => 'Verificando Primera Forma Normal (1FN)',
            'explanation' => 'Se asume que la tabla está en 1FN (atributos atómicos).',
            'rule_codd' => 'Regla de Codd: "Los atributos deben contener valores atómicos."'
        ];

        $partialDeps = $this->findPartialDependencies($schema);
        if (!empty($partialDeps)) {
            $diagnosis['violations'][] = '2FN';
            $diagnosis['didactic_steps'][] = [
                'step' => 'Verificando Segunda Forma Normal (2FN)',
                'explanation' => 'Una tabla está en 2FN si está en 1FN y todos los atributos no clave dependen de toda clave candidata (no solo de una parte).',
                'violation_detail' => $this->explainPartialDependency($partialDeps, $candidateKeys[0] ?? []),
                'rule_codd' => 'Regla de Codd: "Cada atributo no clave debe depender funcionalmente de toda clave candidata, no de un subconjunto."'
            ];
            $diagnosis['suggestions'][] = 'Extrae los atributos que dependen parcialmente en una nueva tabla.';
        } else {
            $diagnosis['current_nf'] = '2NF';
        }

        $transitiveDeps = $this->findTransitiveDependencies($schema);
        if (!empty($transitiveDeps)) {
            $diagnosis['violations'][] = '3FN';
            $diagnosis['didactic_steps'][] = [
                'step' => 'Verificando Tercera Forma Normal (3FN)',
                'explanation' => 'Una tabla está en 3FN si está en 2FN y ningún atributo no clave depende transitivamente de una clave candidata.',
                'violation_detail' => $this->explainTransitiveDependency($transitiveDeps),
                'rule_codd' => 'Regla de Codd: "Los atributos no clave no deben depender de otros atributos no clave."'
            ];
            $diagnosis['suggestions'][] = 'Divide la tabla moviendo los atributos transitivamente dependientes a otra tabla.';
        } else {
            $diagnosis['current_nf'] = '3NF';
        }

        if ($diagnosis['current_nf'] !== '1NF') {
            $bcnfViolations = $this->findBCNFViolations($schema);
            if (!empty($bcnfViolations)) {
                $diagnosis['violations'][] = 'BCNF';
                $diagnosis['didactic_steps'][] = [
                    'step' => 'Verificando Forma Normal de Boyce-Codd (BCNF)',
                    'explanation' => 'Una tabla está en BCNF si para toda dependencia funcional no trivial, el determinante es superclave.',
                    'violation_detail' => implode("\n", $bcnfViolations),
                    'rule_codd' => 'Regla de Codd extendida: "Todo determinante debe ser clave candidata."'
                ];
                $diagnosis['suggestions'][] = 'Descompón la tabla según la dependencia que viola BCNF.';
            } else {
                $diagnosis['current_nf'] = 'BCNF';
            }
        }

        if ($diagnosis['current_nf'] === 'BCNF') {
            $mvdViolations = $this->check4NF($schema);
            if (!empty($mvdViolations)) {
                $diagnosis['violations'][] = '4FN';
                $diagnosis['didactic_steps'][] = [
                    'step' => 'Verificando Cuarta Forma Normal (4FN)',
                    'explanation' => 'Una tabla está en 4FN si está en BCNF y no tiene dependencias multivaluadas no triviales.',
                    'violation_detail' => implode("\n", array_map(fn($v) => $v['detail'], $mvdViolations)),
                    'analogies' => array_map(fn($v) => $v['analogy'], $mvdViolations),
                    'rule_codd' => 'Regla de Fagin: "Los atributos independientes deben estar en tablas separadas."'
                ];
                $diagnosis['suggestions'][] = 'Separa los atributos independientes en tablas diferentes.';
            } else {
                $diagnosis['current_nf'] = '4NF';
            }
        }

        if ($diagnosis['current_nf'] === '4NF') {
            $jdViolations = $this->check5NF($schema);
            if (!empty($jdViolations)) {
                $diagnosis['violations'][] = '5FN';
                $diagnosis['didactic_steps'][] = [
                    'step' => 'Verificando Quinta Forma Normal (5FN)',
                    'explanation' => 'Una tabla está en 5FN si no puede descomponerse sin pérdida en tablas más pequeñas.',
                    'violation_detail' => $jdViolations[0]['detail'],
                    'analogies' => [$jdViolations[0]['analogy']],
                    'rule_codd' => 'Regla de Codd: "Toda dependencia de unión debe ser implicada por una clave candidata."'
                ];
                $diagnosis['suggestions'][] = 'Considera descomponer la tabla en relaciones más pequeñas basadas en las claves candidatas.';
            } else {
                $diagnosis['current_nf'] = '5NF';
            }
        }

        return $diagnosis;
    }

    public function findMultivaluedDependencies(RelationSchema $schema, array $fds = null): array
    {
        $attributes = $schema->getAttributesSet();
        $fds = $fds ?? $schema->getFds();
        $mvdViolations = [];
        $primeAttrs = $this->getPrimeAttributes($schema);
        $nonKeyAttrs = array_diff($attributes, $primeAttrs);

        foreach ($nonKeyAttrs as $a1) {
            foreach ($nonKeyAttrs as $a2) {
                if ($a1 >= $a2) continue;

                $dependsOnKey1 = false;
                $dependsOnKey2 = false;

                foreach ($fds as $fd) {
                    if (in_array($a1, $fd->dependent) && count($fd->determinant) <= 1) {
                        $dependsOnKey1 = true;
                    }
                    if (in_array($a2, $fd->dependent) && count($fd->determinant) <= 1) {
                        $dependsOnKey2 = true;
                    }
                }

                if ($dependsOnKey1 && $dependsOnKey2) {
                    $mvdViolations[] = sprintf(
                        "Posible dependencia multivaluada: {%s} y {%s} son independientes pero dependen de la misma clave. Separar en tablas independientes.",
                        $a1, $a2
                    );
                }
            }
        }

        return array_unique($mvdViolations);
    }

    public function findJoinDependencies(RelationSchema $schema): array
    {
        $result = $this->check5NF($schema);
        return array_map(fn($v) => $v['detail'], $result);
    }

    public function check4NF(RelationSchema $schema): array
    {
        $violations = [];
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $primeAttrs = $this->getPrimeAttributes($schema);
        $nonKeyAttrs = array_values(array_diff($attributes, $primeAttrs));

        if (count($nonKeyAttrs) < 2) return $violations;

        for ($i = 0; $i < count($nonKeyAttrs); $i++) {
            for ($j = $i + 1; $j < count($nonKeyAttrs); $j++) {
                $a1 = $nonKeyAttrs[$i];
                $a2 = $nonKeyAttrs[$j];

                $hasDirectFd = false;
                foreach ($fds as $fd) {
                    if ((in_array($a1, $fd->determinant) && in_array($a2, $fd->dependent)) ||
                        (in_array($a2, $fd->determinant) && in_array($a1, $fd->dependent))) {
                        $hasDirectFd = true;
                        break;
                    }
                }
                if ($hasDirectFd) continue;

                $bothInSameFd = false;
                $a1DependsOnKey = false;
                $a2DependsOnKey = false;

                foreach ($fds as $fd) {
                    $detIsPrime = count(array_intersect($fd->determinant, $primeAttrs)) > 0
                        || count($fd->determinant) === 0;
                    if (in_array($a1, $fd->dependent) && $detIsPrime) {
                        $a1DependsOnKey = true;
                        if (in_array($a2, $fd->dependent)) {
                            $bothInSameFd = true;
                        }
                    }
                    if (in_array($a2, $fd->dependent) && $detIsPrime) {
                        $a2DependsOnKey = true;
                    }
                }

                if (!$bothInSameFd && $a1DependsOnKey && $a2DependsOnKey) {
                    $violations[] = [
                        'type' => 'MVD',
                        'detail' => "Posible dependencia multivaluada entre {$a1} y {$a2}: "
                            . "ambos atributos dependen de la clave pero son independientes entre sí. "
                            . "Esto genera redundancia innecesaria.",
                        'analogy' => "Es como si en una tabla de Cursos guardaras Profesores y Libros de texto juntos: "
                            . "cada profesor aparece repetido por cada libro, y viceversa.",
                        'attributes' => [$a1, $a2]
                    ];
                }
            }
        }

        return $violations;
    }

    public function check5NF(RelationSchema $schema): array
    {
        $violations = [];
        $attributes = $schema->getAttributesSet();
        $candidateKeys = $this->findCandidateKeys($schema);

        if (count($attributes) < 4) return $violations;
        if (count($candidateKeys) < 2) return $violations;

        $hasOverlapping = false;
        for ($i = 0; $i < count($candidateKeys); $i++) {
            for ($j = $i + 1; $j < count($candidateKeys); $j++) {
                $intersection = array_intersect($candidateKeys[$i], $candidateKeys[$j]);
                $union = array_unique(array_merge($candidateKeys[$i], $candidateKeys[$j]));
                if (!empty($intersection) && count($union) > max(count($candidateKeys[$i]), count($candidateKeys[$j]))) {
                    $hasOverlapping = true;
                    break 2;
                }
            }
        }

        if ($hasOverlapping) {
            $keyDescriptions = array_map(fn($k) => '{' . implode(',', $k) . '}', $candidateKeys);
            $violations[] = [
                'type' => 'JD',
                'detail' => "Posible dependencia de unión (5FN): La tabla tiene " . count($attributes)
                    . " atributos y " . count($candidateKeys) . " claves candidatas con superposición ("
                    . implode(', ', $keyDescriptions) . "). "
                    . "Podría descomponerse sin pérdida en tablas más pequeñas basadas en subconjuntos de atributos.",
                'analogy' => "Es como una agenda de reuniones donde guardas Empleado, Departamento y Proyecto: "
                    . "la información se puede dividir en tablas más pequeñas sin perder datos al recombinarlas.",
                'candidate_keys' => $candidateKeys
            ];
        }

        return $violations;
    }

    public function getPrimeAttributes(RelationSchema $schema): array
    {
        $candidateKeys = $this->findCandidateKeys($schema);
        $prime = [];
        foreach ($candidateKeys as $ck) {
            $prime = array_unique(array_merge($prime, $ck));
        }
        return $prime;
    }

    private function findPartialDependencies(RelationSchema $schema, array $primaryKey = []): array
    {
        $partials = [];
        $primeAttrs = $this->getPrimeAttributes($schema);
        $candidateKeys = $this->findCandidateKeys($schema);

        foreach ($schema->getFds() as $fd) {
            if (empty($fd->determinant)) continue;

            foreach ($candidateKeys as $ck) {
                if (count($fd->determinant) >= count($ck)) continue;

                if (array_diff($fd->determinant, $ck) === []) {
                    $nonPrimeDeps = array_diff($fd->dependent, $primeAttrs);
                    if (!empty($nonPrimeDeps)) {
                        $partials[] = $fd;
                        break;
                    }
                }
            }
        }

        return $partials;
    }

    private function findTransitiveDependencies(RelationSchema $schema, array $primaryKey = []): array
    {
        $transitives = [];
        $primeAttrs = $this->getPrimeAttributes($schema);
        $allAttrs = $schema->getAttributesSet();
        $nonPrimeAttrs = array_diff($allAttrs, $primeAttrs);

        foreach ($schema->getFds() as $fd) {
            if (empty($fd->determinant)) continue;

            $detIsNonPrime = array_diff($fd->determinant, $nonPrimeAttrs) === [];
            $depHasNonPrime = array_diff($fd->dependent, $primeAttrs) !== [];

            if ($detIsNonPrime && $depHasNonPrime) {
                $transitives[] = $fd;
            }
        }

        return $transitives;
    }

    private function explainPartialDependency(array $partialDeps, array $primaryKey): string
    {
        $explanation = "Dependencias parciales detectadas: ";
        foreach ($partialDeps as $dep) {
            $explanation .= sprintf(
                "{%s} \u{2192} {%s} (determinante es subconjunto de una clave candidata). ",
                implode(',', $dep->determinant),
                implode(',', $dep->dependent)
            );
        }
        return $explanation;
    }

    private function explainTransitiveDependency(array $transitiveDeps): string
    {
        $explanation = "Dependencias transitivas detectadas: ";
        foreach ($transitiveDeps as $dep) {
            $explanation .= sprintf(
                "{%s} \u{2192} {%s} (atributos no clave que dependen de otros atributos no clave). ",
                implode(',', $dep->determinant),
                implode(',', $dep->dependent)
            );
        }
        return $explanation;
    }

    private function findBCNFViolations(RelationSchema $schema): array
    {
        $allAttributes = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $violations = [];

        foreach ($fds as $fd) {
            if (array_diff($fd->dependent, $fd->determinant) === []) {
                continue;
            }

            $closure = $this->computeClosure($fd->determinant, $fds);
            if (array_diff($allAttributes, $closure) !== []) {
                $violations[] = sprintf(
                    "{%s} \u{2192} {%s}: el determinante no es superclave (cierre: {%s})",
                    implode(',', $fd->determinant),
                    implode(',', $fd->dependent),
                    implode(',', $closure)
                );
            }
        }

        return $violations;
    }

    public function isBCNF(RelationSchema $schema): bool
    {
        $allAttributes = $schema->getAttributesSet();
        foreach ($schema->getFds() as $fd) {
            if (array_diff($fd->dependent, $fd->determinant) === []) continue;
            $closure = $this->computeClosure($fd->determinant, $schema->getFds());
            if (array_diff($allAttributes, $closure) !== []) return false;
        }
        return true;
    }

    public function decomposeToBCNF(RelationSchema $schema): array
    {
        $result = $this->decomposeBCNFRecursive($schema->getAttributesSet(), $schema->getFds());

        $namedResult = [];
        foreach ($result as $i => $r) {
            $namedResult[] = [
                'name' => $schema->name . '_' . ($i + 1),
                'attributes' => $r['attributes'],
                'fds' => $r['fds']
            ];
        }

        return $namedResult;
    }

    public function isLosslessJoin(RelationSchema $original, array $decomposedSchemas): bool
    {
        $allAttributes = $original->getAttributesSet();
        $fds = $original->getFds();
        $attrIndex = array_flip($allAttributes);
        if (count($attrIndex) !== count($allAttributes)) return false;

        // Build the chase tableau
        $tableau = [];
        foreach ($decomposedSchemas as $i => $schema) {
            $attrs = is_array($schema) ? $schema['attributes'] : $schema->getAttributesSet();
            $row = [];
            foreach ($allAttributes as $j => $attr) {
                if (in_array($attr, $attrs)) {
                    $row[$j] = 'a' . ($j + 1);
                } else {
                    $row[$j] = 'b' . ($i + 1) . ($j + 1);
                }
            }
            $tableau[] = $row;
        }

        // Apply each FD until no change
        $changed = true;
        while ($changed) {
            $changed = false;
            foreach ($fds as $fd) {
                $detIndices = array_map(fn($a) => $attrIndex[$a] ?? -1, $fd->determinant);
                $depIndices = array_map(fn($a) => $attrIndex[$a] ?? -1, $fd->dependent);
                if (in_array(-1, $detIndices) || in_array(-1, $depIndices)) continue;

                $groups = [];
                foreach ($tableau as $rowIdx => $row) {
                    $key = '';
                    foreach ($detIndices as $idx) {
                        $key .= $row[$idx] . "\0";
                    }
                    $groups[$key][] = $rowIdx;
                }

                foreach ($groups as $group) {
                    if (count($group) < 2) continue;
                    foreach ($depIndices as $depIdx) {
                        $targetVal = $tableau[$group[0]][$depIdx];
                        foreach ($group as $rowIdx) {
                            if (str_starts_with($tableau[$rowIdx][$depIdx], 'a')) {
                                $targetVal = $tableau[$rowIdx][$depIdx];
                                break;
                            }
                        }
                        foreach ($group as $rowIdx) {
                            if ($tableau[$rowIdx][$depIdx] !== $targetVal) {
                                $tableau[$rowIdx][$depIdx] = $targetVal;
                                $changed = true;
                            }
                        }
                    }
                }
            }
        }

        foreach ($tableau as $row) {
            $allDistinguished = true;
            foreach ($row as $val) {
                if (!str_starts_with($val, 'a')) {
                    $allDistinguished = false;
                    break;
                }
            }
            if ($allDistinguished) return true;
        }

        return false;
    }

    public function isDependencyPreserved(RelationSchema $original, array $decomposedSchemas): array
    {
        $allFds = $original->getFds();

        $decomposedAttrs = [];
        foreach ($decomposedSchemas as $schema) {
            $decomposedAttrs[] = is_array($schema) ? $schema['attributes'] : $schema->getAttributesSet();
        }

        // Collect the union of all FDs fully contained in any decomposed schema
        $projectedFds = [];
        foreach ($decomposedAttrs as $riAttrs) {
            foreach ($allFds as $ofd) {
                $allOfdAttrs = array_unique(array_merge($ofd->determinant, $ofd->dependent));
                if (array_diff($allOfdAttrs, $riAttrs) === []) {
                    $found = false;
                    foreach ($projectedFds as $pf) {
                        if ($pf->equals($ofd)) { $found = true; break; }
                    }
                    if (!$found) $projectedFds[] = $ofd;
                }
            }
        }

        $preserved = [];
        $notPreserved = [];

        foreach ($allFds as $fd) {
            $closure = $this->computeClosure($fd->determinant, $projectedFds);
            if (array_diff($fd->dependent, $closure) === []) {
                $preserved[] = $fd;
            } else {
                $notPreserved[] = $fd;
            }
        }

        return [
            'preserved' => $preserved,
            'not_preserved' => $notPreserved,
            'is_fully_preserved' => empty($notPreserved)
        ];
    }

    private function decomposeBCNFRecursive(array $attributes, array $fds): array
    {
        $violatingFD = $this->findBCNFViolatingFDRaw($attributes, $fds);
        if ($violatingFD === null) {
            return [[
                'attributes' => $attributes,
                'fds' => $this->getRelevantFDs($attributes, $fds)
            ]];
        }

        // R1 = X ∪ Y
        $r1Attrs = array_values(array_unique(array_merge($violatingFD->determinant, $violatingFD->dependent)));
        // R2 = X ∪ (R - X - Y)  — keep determinant as join key
        $r2Attrs = array_values(array_unique(array_merge(
            $violatingFD->determinant,
            array_diff($attributes, $violatingFD->determinant, $violatingFD->dependent)
        )));

        return array_merge(
            $this->decomposeBCNFRecursive($r1Attrs, $fds),
            $this->decomposeBCNFRecursive($r2Attrs, $fds)
        );
    }

    private function findBCNFViolatingFDRaw(array $attributes, array $fds): ?FunctionalDependency
    {
        $relevantFds = $this->getRelevantFDs($attributes, $fds);
        foreach ($relevantFds as $fd) {
            if (array_diff($fd->dependent, $fd->determinant) === []) continue;
            $closure = $this->computeClosure($fd->determinant, $relevantFds);
            if (array_diff($attributes, $closure) !== []) return $fd;
        }
        return null;
    }

    private function getRelevantFDs(array $attributes, array $fds): array
    {
        $relevant = [];
        foreach ($fds as $fd) {
            $allAttrs = array_unique(array_merge($fd->determinant, $fd->dependent));
            if (array_diff($allAttrs, $attributes) === []) $relevant[] = $fd;
        }
        return $relevant;
    }

    private function generatePowerSet(array $set): array
    {
        $powerSet = [[]];
        foreach ($set as $element) {
            foreach ($powerSet as $subset) {
                $newSubset = array_merge($subset, [$element]);
                $powerSet[] = $newSubset;
            }
        }
        return $powerSet;
    }

    private function makeCacheKey(array $subset): string
    {
        sort($subset);
        return implode(',', $subset);
    }

    public function computeCanonicalCover(array $fds): array
    {
        $result = [];
        foreach ($fds as $fd) {
            $result = array_merge($result, $this->decomposeRHS($fd));
        }

        $changed = true;
        while ($changed) {
            $changed = false;
            foreach ($result as $i => $fd) {
                $determinant = $fd->determinant;
                $newDet = $determinant;
                foreach ($determinant as $attr) {
                    $reduced = array_values(array_diff($newDet, [$attr]));
                    if (empty($reduced)) continue;
                    if ($this->isExtraneous($attr, $fd, $result)) {
                        $newDet = $reduced;
                        $result[$i] = new FunctionalDependency($newDet, $fd->dependent);
                        $changed = true;
                        break 2;
                    }
                }
            }
        }

        $result = array_values($result);
        $result = $this->removeDuplicateFds($result);

        $toRemove = [];
        foreach ($result as $i => $fd) {
            if ($this->isRedundant($fd, $result)) {
                $toRemove[] = $i;
            }
        }

        foreach (array_reverse($toRemove) as $i) {
            array_splice($result, $i, 1);
        }

        return array_values($result);
    }

    public function synthesizeTo3NF(array $fds): array
    {
        $canonical = $this->computeCanonicalCover($fds);

        $allAttrs = [];
        foreach ($fds as $fd) {
            $allAttrs = array_unique(array_merge($allAttrs, $fd->determinant, $fd->dependent));
        }

        $groups = [];
        foreach ($canonical as $fd) {
            $key = implode(',', $fd->determinant);
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'determinant' => $fd->determinant,
                    'attributes' => $fd->determinant,
                    'fds' => [],
                ];
            }
            $groups[$key]['attributes'] = array_values(array_unique(array_merge(
                $groups[$key]['attributes'],
                $fd->dependent
            )));
            $groups[$key]['fds'][] = $fd;
        }

        $schemas = [];
        foreach ($groups as $key => $group) {
            $schemas[] = [
                'name' => 'R_' . implode('', $group['determinant']),
                'attributes' => $group['attributes'],
                'fds' => $group['fds'],
            ];
        }

        if (!empty($allAttrs)) {
            $tempSchema = new RelationSchema('temp', $allAttrs, $fds);
            $candidateKeys = $this->findCandidateKeys($tempSchema);

            $hasKey = false;
            foreach ($schemas as $schema) {
                foreach ($candidateKeys as $ck) {
                    if (array_diff($ck, $schema['attributes']) === []) {
                        $hasKey = true;
                        break 2;
                    }
                }
            }

            if (!$hasKey && !empty($candidateKeys)) {
                $minKey = $candidateKeys[0];
                $schemas[] = [
                    'name' => 'R_' . implode('', $minKey),
                    'attributes' => $minKey,
                    'fds' => [],
                ];
            }
        }

        $filtered = [];
        foreach ($schemas as $i => $schema) {
            $isSubset = false;
            foreach ($schemas as $j => $other) {
                if ($i === $j) continue;
                $diff = array_diff($schema['attributes'], $other['attributes']);
                if (empty($diff) && count($schema['attributes']) < count($other['attributes'])) {
                    $isSubset = true;
                    break;
                }
            }
            if (!$isSubset) {
                $filtered[] = $schema;
            }
        }

        return $filtered;
    }

    private function decomposeRHS(FunctionalDependency $fd): array
    {
        if (count($fd->dependent) <= 1) {
            return [$fd];
        }
        $result = [];
        foreach ($fd->dependent as $dep) {
            $result[] = new FunctionalDependency($fd->determinant, [$dep]);
        }
        return $result;
    }

    private function isExtraneous(string $attribute, FunctionalDependency $fd, array $allFds): bool
    {
        $reduced = array_values(array_diff($fd->determinant, [$attribute]));
        if (empty($reduced)) return false;
        $closure = $this->computeClosure($reduced, $allFds);
        return in_array($fd->dependent[0], $closure);
    }

    private function isRedundant(FunctionalDependency $fd, array $allFds): bool
    {
        $remaining = [];
        foreach ($allFds as $existing) {
            if ($existing !== $fd) {
                $remaining[] = $existing;
            }
        }
        $closure = $this->computeClosure($fd->determinant, $remaining);
        return in_array($fd->dependent[0], $closure);
    }

    private function removeDuplicateFds(array $fds): array
    {
        $seen = [];
        $unique = [];
        foreach ($fds as $fd) {
            $key = implode(',', $fd->determinant) . '->' . implode(',', $fd->dependent);
            if (!isset($seen[$key])) {
                $seen[$key] = true;
                $unique[] = $fd;
            }
        }
        return $unique;
    }
}
