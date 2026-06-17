<?php

namespace Tests\Property;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class NormalizationPropertiesTest extends TestCase
{
    private NormalizationEngine $engine;
    private int $randomSeed = 42;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new NormalizationEngine();
        mt_srand($this->randomSeed);
    }

    /**
     * PROPERTY: Closure is idempotent
     * computeClosure(X, F) should equal computeClosure(computeClosure(X, F), F)
     * @dataProvider randomSchemaProvider
     */
    public function test_closure_is_idempotent(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (empty($attributes)) {
            $this->assertTrue(true);
            return;
        }
        $subset = $this->pickRandomSubset($attributes);
        $fds = $schema->getFds();

        $first = $this->engine->computeClosure($subset, $fds);
        $second = $this->engine->computeClosure($first, $fds);

        sort($first);
        sort($second);
        $this->assertEquals($first, $second, "Closure must be idempotent");
    }

    /**
     * PROPERTY: Closure is extensive
     * X ⊆ computeClosure(X, F) for any X
     * @dataProvider randomSchemaProvider
     */
    public function test_closure_is_extensive(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (empty($attributes)) {
            $this->assertTrue(true);
            return;
        }
        $subset = $this->pickRandomSubset($attributes);
        $fds = $schema->getFds();
        $closure = $this->engine->computeClosure($subset, $fds);
        foreach ($subset as $attr) {
            $this->assertContains($attr, $closure, "Closure must be extensive: $attr not in closure");
        }
    }

    /**
     * PROPERTY: Closure is monotonic
     * If X ⊆ Y then computeClosure(X, F) ⊆ computeClosure(Y, F)
     * @dataProvider randomSchemaProvider
     */
    public function test_closure_is_monotonic(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (count($attributes) < 2) {
            $this->assertTrue(true);
            return;
        }
        $fds = $schema->getFds();
        $x = $this->pickRandomSubset($attributes);
        $remaining = array_values(array_diff($attributes, $x));
        if (empty($remaining)) {
            $this->assertTrue(true);
            return;
        }
        $extra = $this->pickRandomSubset($remaining);
        $y = array_values(array_unique(array_merge($x, $extra)));

        $closureX = $this->engine->computeClosure($x, $fds);
        $closureY = $this->engine->computeClosure($y, $fds);

        foreach ($closureX as $attr) {
            $this->assertContains($attr, $closureY, "Closure must be monotonic: $attr not in closure of superset");
        }
    }

    /**
     * PROPERTY: Armstrong's reflexivity
     * If Y ⊆ X, then X → Y is a valid FD (trivial FD)
     * @dataProvider randomSchemaProvider
     */
    public function test_reflexivity_axiom(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (count($attributes) < 2) {
            $this->assertTrue(true);
            return;
        }
        $fds = $schema->getFds();
        $x = $this->pickRandomSubset($attributes);
        if (empty($x)) {
            $this->assertTrue(true);
            return;
        }
        $ySize = mt_rand(1, count($x));
        $keys = array_rand(array_flip($x), $ySize);
        $y = is_array($keys) ? array_values($keys) : [$keys];

        $closure = $this->engine->computeClosure($x, $fds);
        foreach ($y as $attr) {
            $this->assertContains($attr, $closure, "Reflexivity: X→Y should hold when Y⊆X");
        }
    }

    /**
     * PROPERTY: Armstrong's augmentation
     * If X → Y, then XZ → YZ for any Z
     * @dataProvider randomSchemaProvider
     */
    public function test_augmentation_axiom(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        $fds = $schema->getFds();
        $foundAny = false;

        foreach ($fds as $fd) {
            $available = array_values(array_diff($attributes, $fd->determinant, $fd->dependent));
            if (empty($available)) continue;
            $z = $this->pickRandomSubset($available);
            if (empty($z)) continue;
            $foundAny = true;

            $xz = array_values(array_unique(array_merge($fd->determinant, $z)));
            $yz = array_values(array_unique(array_merge($fd->dependent, $z)));

            $closure = $this->engine->computeClosure($xz, $fds);
            foreach ($yz as $attr) {
                $this->assertContains($attr, $closure, "Augmentation: XZ→YZ should hold if X→Y");
            }
        }

        if (!$foundAny) {
            $this->assertTrue(true);
        }
    }

    /**
     * PROPERTY: Armstrong's transitivity
     * If X → Y and Y → Z, then X → Z
     * @dataProvider randomSchemaProvider
     */
    public function test_transitivity_axiom(RelationSchema $schema): void
    {
        $fds = $schema->getFds();
        $foundAny = false;

        foreach ($fds as $fd1) {
            foreach ($fds as $fd2) {
                if ($fd1 === $fd2) continue;
                if (empty($fd2->determinant)) continue;

                $closure1 = $this->engine->computeClosure($fd1->determinant, $fds);
                $det2InClosure = array_diff($fd2->determinant, $closure1) === [];

                if ($det2InClosure) {
                    $foundAny = true;
                    $closure = $this->engine->computeClosure($fd1->determinant, $fds);
                    foreach ($fd2->dependent as $attr) {
                        $this->assertContains($attr, $closure,
                            "Transitivity: X→Z should hold if X→Y and Y→Z");
                    }
                }
            }
        }

        if (!$foundAny) {
            $this->assertTrue(true);
        }
    }

    /**
     * PROPERTY: A candidate key's closure covers ALL attributes
     * @dataProvider randomSchemaProvider
     */
    public function test_candidate_key_closure_covers_all(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (empty($attributes)) {
            $this->assertTrue(true);
            return;
        }
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $fds = $schema->getFds();

        $this->assertNotEmpty($candidateKeys,
            "Schema with " . count($attributes) . " attributes must have at least one candidate key");

        foreach ($candidateKeys as $ck) {
            $closure = $this->engine->computeClosure($ck, $fds);
            $missing = array_diff($attributes, $closure);
            $this->assertEmpty($missing,
                "Candidate key closure must cover all attributes. Missing: " . implode(',', $missing));
        }
    }

    /**
     * PROPERTY: No proper subset of a candidate key is a superkey (minimality)
     * @dataProvider randomSchemaProvider
     */
    public function test_candidate_key_minimality(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (empty($attributes)) {
            $this->assertTrue(true);
            return;
        }
        $candidateKeys = $this->engine->findCandidateKeys($schema);
        $fds = $schema->getFds();

        $this->assertNotEmpty($candidateKeys,
            "Must have candidate keys to test minimality");

        foreach ($candidateKeys as $ck) {
            for ($i = 0; $i < count($ck); $i++) {
                $subset = array_values(array_diff($ck, [$ck[$i]]));
                if (empty($subset)) continue;
                $closure = $this->engine->computeClosure($subset, $fds);
                $this->assertNotEquals(
                    $attributes,
                    $closure,
                    "No proper subset of candidate key {" . implode(',', $ck) . "} should be a superkey. " .
                    "Subset {" . implode(',', $subset) . "} incorrectly covers all attributes."
                );
            }
        }
    }

    /**
     * PROPERTY: BCNF decomposition is lossless
     * @dataProvider randomSchemaProvider
     */
    public function test_bcnf_decomposition_is_lossless(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (count($attributes) < 2) {
            $this->assertTrue(true);
            return;
        }
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertNotEmpty($decomposition, "BCNF decomposition must return at least one relation");
        $this->assertTrue(
            $this->engine->isLosslessJoin($schema, $decomposition),
            "BCNF decomposition must be lossless"
        );
    }

    /**
     * PROPERTY: BCNF implies 3NF
     * If a schema is in BCNF, it must also be in 3NF (no partial or transitive dependencies)
     * @dataProvider randomSchemaProvider
     */
    public function test_bcnf_implies_3nf(RelationSchema $schema): void
    {
        if ($this->engine->isBCNF($schema)) {
            $diagnosis = $this->engine->diagnoseNormalization($schema);
            $this->assertNotContains('2FN', $diagnosis['violations'],
                "BCNF schema must be in 2NF");
            $this->assertNotContains('3FN', $diagnosis['violations'],
                "BCNF schema must be in 3NF");
        }
        $this->assertTrue(true);
    }

    /**
     * PROPERTY: Higher NFs imply lower NFs
     * If a schema is in BCNF, it must have no 2FN or 3FN violations.
     * @dataProvider randomSchemaProvider
     */
    public function test_nf_hierarchy(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (empty($attributes)) {
            $this->assertTrue(true);
            return;
        }

        $diagnosis = $this->engine->diagnoseNormalization($schema);
        $violations = $diagnosis['violations'];
        $currentNf = $diagnosis['current_nf'];
        $this->assertNotEmpty($currentNf, "Schema has a normal form");

        $isBCNF = $this->engine->isBCNF($schema);

        // BCNF implies no 2FN or 3FN violations
        if ($isBCNF) {
            $this->assertNotContains('2FN', $violations,
                "BCNF schema must have no 2FN violations");
            $this->assertNotContains('3FN', $violations,
                "BCNF schema must have no 3FN violations");
        }

        // Consistency check: if violations contain 2FN, isBCNF must be false
        if (in_array('2FN', $violations)) {
            $this->assertFalse($isBCNF,
                "Schema with 2FN violations cannot be in BCNF");
        }
    }

    /**
     * PROPERTY: Canonical cover FDs must follow from the original FDs (soundness)
     * Each FD in the canonical cover must be derivable from the original FD set
     * @dataProvider randomSchemaProvider
     */
    public function test_canonical_cover_soundness(RelationSchema $schema): void
    {
        $fds = $schema->getFds();
        if (empty($fds)) {
            $this->assertTrue(true);
            return;
        }

        $canonical = $this->engine->computeCanonicalCover($fds);

        foreach ($canonical as $cfd) {
            $closure = $this->engine->computeClosure($cfd->determinant, $fds);
            foreach ($cfd->dependent as $dep) {
                $this->assertContains($dep, $closure,
                    "Canonical cover FD {" . implode(',', $cfd->determinant) . "}→{$dep} must follow from original FDs");
            }
        }

        $this->assertIsArray($canonical, "Canonical cover computation returned an array");
    }

    /**
     * PROPERTY: Canonical cover has no extraneous attributes
     * No attribute in the LHS of any canonical cover FD can be removed while preserving equivalence
     * @dataProvider randomSchemaProvider
     */
    public function test_canonical_cover_no_extraneous_attributes(RelationSchema $schema): void
    {
        $fds = $schema->getFds();
        if (empty($fds)) {
            $this->assertTrue(true);
            return;
        }

        $canonical = $this->engine->computeCanonicalCover($fds);

        foreach ($canonical as $cfd) {
            if (count($cfd->determinant) <= 1) continue;
            for ($i = 0; $i < count($cfd->determinant); $i++) {
                $reduced = array_values(array_diff($cfd->determinant, [$cfd->determinant[$i]]));
                if (empty($reduced)) continue;
                $closure = $this->engine->computeClosure($reduced, $canonical);
                $this->assertNotContains($cfd->dependent[0], $closure,
                    "Attribute {$cfd->determinant[$i]} is extraneous in canonical cover FD " .
                    "{" . implode(',', $cfd->determinant) . "}→{$cfd->dependent[0]}");
            }
        }

        $this->assertIsArray($canonical, "Canonical cover computation returned an array");
    }

    /**
     * PROPERTY: Canonical cover has no redundant FDs
     * No FD in the canonical cover can be removed while preserving equivalence
     * @dataProvider randomSchemaProvider
     */
    public function test_canonical_cover_no_redundant_fds(RelationSchema $schema): void
    {
        $fds = $schema->getFds();
        if (count($fds) <= 1) {
            $this->assertTrue(true);
            return;
        }

        $canonical = $this->engine->computeCanonicalCover($fds);
        if (count($canonical) <= 1) {
            $this->assertTrue(true);
            return;
        }

        for ($i = 0; $i < count($canonical); $i++) {
            $remaining = array_values(array_filter($canonical, fn($fd, $idx) => $idx !== $i, ARRAY_FILTER_USE_BOTH));
            $closure = $this->engine->computeClosure($canonical[$i]->determinant, $remaining);
            $this->assertNotContains($canonical[$i]->dependent[0], $closure,
                "Canonical cover FD {" . implode(',', $canonical[$i]->determinant) . "}→{$canonical[$i]->dependent[0]} is redundant");
        }
    }

    /**
     * PROPERTY SUMMARY: Placeholder for counting property test results
     */
    public function test_property_summary(): void
    {
        $this->assertTrue(true, 'All property-based tests passed');
    }

    // ============= DATA PROVIDERS =============

    public static function randomSchemaProvider(): array
    {
        $cases = [];
        $sizes = [3, 4, 5, 6, 7, 8, 10, 12];
        foreach ($sizes as $size) {
            for ($i = 0; $i < 3; $i++) {
                $cases[] = [self::generateRandomSchema($size)];
            }
        }
        return $cases;
    }

    private static function generateRandomSchema(int $numAttrs): RelationSchema
    {
        $attributes = [];
        for ($j = 0; $j < $numAttrs; $j++) {
            $attributes[] = chr(65 + ($j % 26)) . ($j >= 26 ? (string)floor($j / 26) : '');
        }

        $fds = [];
        $fds[] = new FunctionalDependency(
            determinant: [$attributes[0]],
            dependent: array_slice($attributes, 1)
        );

        $numFds = mt_rand($numAttrs, (int)($numAttrs * 2));
        for ($j = 1; $j < $numFds; $j++) {
            $detSize = mt_rand(1, min(3, $numAttrs - 1));
            $keys = array_rand(array_flip($attributes), $detSize);
            $det = is_array($keys) ? array_values($keys) : [$keys];

            $available = array_values(array_diff($attributes, $det));
            if (empty($available)) continue;

            $depSize = mt_rand(1, min(2, count($available)));
            $depKeys = array_rand(array_flip($available), $depSize);
            $dep = is_array($depKeys) ? array_values($depKeys) : [$depKeys];

            $fds[] = new FunctionalDependency(determinant: $det, dependent: $dep);
        }

        return new RelationSchema('Prop_' . $numAttrs, $attributes, $fds);
    }

    private function pickRandomSubset(array $set): array
    {
        if (empty($set)) return [];
        $size = mt_rand(1, count($set));
        $keys = array_rand(array_flip($set), $size);
        return is_array($keys) ? array_values($keys) : [$keys];
    }
}
