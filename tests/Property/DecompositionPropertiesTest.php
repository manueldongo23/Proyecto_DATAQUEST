<?php

namespace Tests\Property;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class DecompositionPropertiesTest extends TestCase
{
    private NormalizationEngine $engine;
    private DecompositionService $decompositionService;
    private int $randomSeed = 42;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new NormalizationEngine();
        $this->decompositionService = new DecompositionService($this->engine);
        mt_srand($this->randomSeed);
    }

    /**
     * PROPERTY: 3NF synthesis runs without error and returns an array of schema definitions
     * @dataProvider schemaProvider
     */
    public function test_3nf_synthesis_returns_valid_structure(RelationSchema $schema): void
    {
        $fds = $schema->getFds();
        $synthesized = $this->engine->synthesizeTo3NF($fds);
        $this->assertIsArray($synthesized);

        foreach ($synthesized as $rel) {
            $this->assertArrayHasKey('name', $rel);
            $this->assertArrayHasKey('attributes', $rel);
            $this->assertArrayHasKey('fds', $rel);
            $this->assertNotEmpty($rel['attributes']);
        }
    }

    /**
     * PROPERTY: Each synthesized schema's attributes are a subset of the original schema
     * @dataProvider schemaProvider
     */
    public function test_synthesized_attributes_from_original(RelationSchema $schema): void
    {
        $originalAttrs = $schema->getAttributesSet();
        $fds = $schema->getFds();
        if (empty($fds) || empty($originalAttrs)) {
            $this->assertTrue(true);
            return;
        }

        $synthesized = $this->engine->synthesizeTo3NF($fds);
        foreach ($synthesized as $rel) {
            foreach ($rel['attributes'] as $attr) {
                $this->assertContains($attr, $originalAttrs,
                    "Synthesized attr '$attr' must be in original schema");
            }
        }
    }

    /**
     * PROPERTY: BCNF decomposition is lossless
     * @dataProvider schemaProvider
     */
    public function test_bcnf_decomposition_is_lossless(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (count($attributes) < 2) {
            $this->assertTrue(true);
            return;
        }

        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertNotEmpty($decomposition);
        $this->assertTrue(
            $this->engine->isLosslessJoin($schema, $decomposition),
            'BCNF decomposition must be lossless'
        );
    }

    /**
     * PROPERTY: Each decomposed schema's attributes are a subset of the original
     * @dataProvider schemaProvider
     */
    public function test_decomposition_attributes_are_subsets(RelationSchema $schema): void
    {
        $originalAttrs = $schema->getAttributesSet();

        $bcnfDecomp = $this->engine->decomposeToBCNF($schema);
        $this->assertNotEmpty($bcnfDecomp);
        foreach ($bcnfDecomp as $rel) {
            foreach ($rel['attributes'] as $attr) {
                $this->assertContains($attr, $originalAttrs,
                    "BCNF decomposed attr '$attr' must be in original schema");
            }
        }

        $fds = $schema->getFds();
        if (!empty($fds)) {
            $synthesized = $this->engine->synthesizeTo3NF($fds);
            foreach ($synthesized as $rel) {
                foreach ($rel['attributes'] as $attr) {
                    $this->assertContains($attr, $originalAttrs,
                        "3NF synthesized attr '$attr' must be in original schema");
                }
            }
        }
    }

    /**
     * PROPERTY: Decomposition does not introduce duplicate attributes
     * @dataProvider schemaProvider
     */
    public function test_decomposition_has_no_duplicate_attributes(RelationSchema $schema): void
    {
        $bcnfDecomp = $this->engine->decomposeToBCNF($schema);
        foreach ($bcnfDecomp as $rel) {
            $unique = array_unique($rel['attributes']);
            $this->assertCount(count($unique), $rel['attributes'],
                "BCNF decomposed relation {$rel['name']} has duplicate attributes");
        }

        $fds = $schema->getFds();
        if (!empty($fds)) {
            $synthesized = $this->engine->synthesizeTo3NF($fds);
            foreach ($synthesized as $rel) {
                $unique = array_unique($rel['attributes']);
                $this->assertCount(count($unique), $rel['attributes'],
                    "3NF synthesized relation {$rel['name']} has duplicate attributes");
            }
        }
    }

    /**
     * PROPERTY: Each BCNF decomposed relation is in BCNF
     * @dataProvider schemaProvider
     */
    public function test_bcnf_decomposed_relations_are_valid(RelationSchema $schema): void
    {
        $attributes = $schema->getAttributesSet();
        if (count($attributes) < 2) {
            $this->assertTrue(true);
            return;
        }

        $decomposition = $this->engine->decomposeToBCNF($schema);
        foreach ($decomposition as $rel) {
            if (count($rel['attributes']) <= 1) continue;
            $relSchema = new RelationSchema($rel['name'], $rel['attributes'], $rel['fds']);
            $this->assertTrue(
                $this->engine->isBCNF($relSchema),
                "Decomposed relation {$rel['name']} should be in BCNF"
            );
        }
    }

    /**
     * PROPERTY: BCNF decomposition preserves all original attributes
     * The union of all decomposed schemas' attributes equals the original attribute set
     * @dataProvider schemaProvider
     */
    public function test_bcnf_decomposition_preserves_all_attributes(RelationSchema $schema): void
    {
        $originalAttrs = $schema->getAttributesSet();
        if (count($originalAttrs) < 2) {
            $this->assertTrue(true);
            return;
        }

        $decomposition = $this->engine->decomposeToBCNF($schema);
        $unionAttrs = [];
        foreach ($decomposition as $rel) {
            $unionAttrs = array_unique(array_merge($unionAttrs, $rel['attributes']));
        }

        sort($unionAttrs);
        $sortedOriginal = $originalAttrs;
        sort($sortedOriginal);
        $this->assertEquals($sortedOriginal, $unionAttrs,
            "BCNF decomposition must preserve all original attributes");
    }

    /**
     * Edge case: Single-attribute schema
     */
    public function test_single_attribute_schema(): void
    {
        $schema = new RelationSchema('Single', ['A'], []);
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertCount(1, $decomposition);
        $this->assertEquals(['A'], $decomposition[0]['attributes']);
        $this->assertTrue($this->engine->isLosslessJoin($schema, $decomposition));
    }

    /**
     * Edge case: Empty schema
     */
    public function test_empty_schema(): void
    {
        $schema = new RelationSchema('Empty', [], []);
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertIsArray($decomposition);
        $this->assertTrue($this->engine->isLosslessJoin($schema, $decomposition));
    }

    /**
     * Edge case: Canonical cover of empty FD set
     */
    public function test_empty_fds_canonical_cover(): void
    {
        $canonical = $this->engine->computeCanonicalCover([]);
        $this->assertEmpty($canonical);
    }

    /**
     * Edge case: 3NF synthesis of empty FD set
     */
    public function test_empty_fds_synthesis(): void
    {
        $result = $this->engine->synthesizeTo3NF([]);
        $this->assertIsArray($result);
    }

    /**
     * Edge case: 3NF synthesis with single FD
     */
    public function test_single_fd_synthesis(): void
    {
        $fds = [
            new FunctionalDependency(determinant: ['A'], dependent: ['B']),
        ];
        $result = $this->engine->synthesizeTo3NF($fds);
        $this->assertNotEmpty($result);
        $this->assertEquals(['A', 'B'], $result[0]['attributes']);
    }

    /**
     * Edge case: Known BCNF decomposition case
     */
    public function test_known_bcnf_decomposition(): void
    {
        $schema = new RelationSchema('R', ['A', 'B', 'C'], [
            new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
            new FunctionalDependency(determinant: ['C'], dependent: ['B']),
        ]);

        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertTrue($this->engine->isLosslessJoin($schema, $decomposition));

        $allAttrs = [];
        foreach ($decomposition as $rel) {
            $allAttrs = array_unique(array_merge($allAttrs, $rel['attributes']));
        }
        sort($allAttrs);
        $this->assertEquals(['A', 'B', 'C'], $allAttrs);
    }

    /**
     * Edge case: Schema already in BCNF
     */
    public function test_bcnf_schema_decomposition(): void
    {
        $schema = new RelationSchema('R', ['A', 'B'], [
            new FunctionalDependency(determinant: ['A'], dependent: ['B']),
        ]);

        $this->assertTrue($this->engine->isBCNF($schema));
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertCount(1, $decomposition);
        $this->assertEquals(['A', 'B'], $decomposition[0]['attributes']);
    }

    // ============= DATA PROVIDERS =============

    public static function schemaProvider(): array
    {
        $cases = [];
        $sizes = [3, 4, 5, 6, 7, 8, 10, 12];
        foreach ($sizes as $size) {
            for ($i = 0; $i < 3; $i++) {
                $cases[] = [self::generateRandomSchema($size)];
            }
        }
        $cases[] = [new RelationSchema('Empty', [], [])];
        $cases[] = [new RelationSchema('Single', ['A'], [])];
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
}
