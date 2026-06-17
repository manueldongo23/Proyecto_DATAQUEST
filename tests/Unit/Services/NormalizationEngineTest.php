<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class NormalizationEngineTest extends TestCase
{
    private NormalizationEngine $engine;

    protected function setUp(): void
    {
        parent::setUp();
        $this->engine = new NormalizationEngine();
    }

    public function test_detects_first_normal_form(): void
    {
        $schema = new RelationSchema(
            name: 'Student',
            attributes: ['StudentID', 'Name', 'Email', 'Phone'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name', 'Email', 'Phone']),
            ]
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertEquals('5NF', $result['current_nf']);
        $this->assertEmpty($result['violations']);
    }

    public function test_detects_partial_dependency_violation(): void
    {
        $schema = new RelationSchema(
            name: 'Enrollment',
            attributes: ['StudentID', 'CourseID', 'StudentName', 'CourseName', 'Grade'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['StudentName']),
                new FunctionalDependency(determinant: ['CourseID'], dependent: ['CourseName']),
                new FunctionalDependency(determinant: ['StudentID', 'CourseID'], dependent: ['Grade']),
            ]
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertContains('2FN', $result['violations']);
        $this->assertNotEmpty($result['didactic_steps']);
        $this->assertNotEmpty($result['suggestions']);
    }

    public function test_detects_transitive_dependency_violation(): void
    {
        $schema = new RelationSchema(
            name: 'Student',
            attributes: ['StudentID', 'Name', 'DepartmentID', 'DepartmentName', 'Building'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name', 'DepartmentID']),
                new FunctionalDependency(determinant: ['DepartmentID'], dependent: ['DepartmentName', 'Building']),
            ]
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertContains('3FN', $result['violations']);
        $this->assertStringContainsString('transitivamente', $result['didactic_steps'][1]['explanation']);
    }

    public function test_calculates_attribute_closure(): void
    {
        $dependencies = [
            new FunctionalDependency(determinant: ['A'], dependent: ['B']),
            new FunctionalDependency(determinant: ['B'], dependent: ['C']),
        ];

        $closure = $this->engine->computeClosure(['A'], $dependencies);

        $this->assertContains('A', $closure);
        $this->assertContains('B', $closure);
        $this->assertContains('C', $closure);
    }

    public function test_discovers_candidate_keys(): void
    {
        $schema = new RelationSchema(
            name: 'User',
            attributes: ['UserID', 'Email', 'Name', 'Phone'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['UserID'], dependent: ['Email', 'Name', 'Phone']),
                new FunctionalDependency(determinant: ['Email'], dependent: ['UserID', 'Name', 'Phone']),
            ]
        );

        $keys = $this->engine->findCandidateKeys($schema);

        $this->assertCount(2, $keys);
        $this->assertContains(['UserID'], $keys);
        $this->assertContains(['Email'], $keys);
    }

    public function test_detects_bcnf_violation(): void
    {
        $schema = new RelationSchema(
            name: 'R',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
                new FunctionalDependency(determinant: ['C'], dependent: ['B']),
            ]
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertContains('BCNF', $result['violations']);
    }

    public function test_handles_empty_relation(): void
    {
        $schema = new RelationSchema(
            name: 'Empty',
            attributes: [],
            functionalDependencies: []
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertEquals('5NF', $result['current_nf']);
        $this->assertEmpty($result['violations']);
    }

    public function test_handles_single_attribute(): void
    {
        $schema = new RelationSchema(
            name: 'Single',
            attributes: ['ID'],
            functionalDependencies: []
        );

        $result = $this->engine->diagnoseNormalization($schema);

        $this->assertEquals('5NF', $result['current_nf']);
        $this->assertEmpty($result['violations']);
    }

    public function test_finds_multivalued_dependencies(): void
    {
        $schema = new RelationSchema(
            name: 'Course',
            attributes: ['CourseID', 'Instructor', 'Textbook'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['CourseID'], dependent: ['Instructor']),
                new FunctionalDependency(determinant: ['CourseID'], dependent: ['Textbook']),
            ]
        );

        $mvds = $this->engine->findMultivaluedDependencies($schema);

        $this->assertIsArray($mvds);
    }

    public function test_finds_join_dependencies(): void
    {
        $schema = new RelationSchema(
            name: 'LargeTable',
            attributes: ['A', 'B', 'C', 'D'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
                new FunctionalDependency(determinant: ['A', 'C'], dependent: ['B', 'D']),
            ]
        );

        $jds = $this->engine->findJoinDependencies($schema);

        $this->assertIsArray($jds);
        $this->assertNotEmpty($jds);
    }

    public function test_multiple_candidate_keys(): void
    {
        $schema = new RelationSchema(
            name: 'R',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A'], dependent: ['B']),
                new FunctionalDependency(determinant: ['B'], dependent: ['A', 'C']),
            ]
        );

        $keys = $this->engine->findCandidateKeys($schema);

        $this->assertCount(2, $keys);
        $this->assertContains(['A'], $keys);
        $this->assertContains(['B'], $keys);
    }

    public function test_detects_multivalued_dependency(): void
    {
        $schema = new RelationSchema(
            name: 'Course',
            attributes: ['CourseID', 'Instructor', 'Textbook'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['CourseID'], dependent: ['Instructor']),
                new FunctionalDependency(determinant: ['CourseID'], dependent: ['Textbook']),
            ]
        );

        $mvds = $this->engine->findMultivaluedDependencies($schema);

        $this->assertNotEmpty($mvds);
        $this->assertStringContainsString('Instructor', $mvds[0]);
        $this->assertStringContainsString('Textbook', $mvds[0]);
    }

    public function test_passes_4fn_when_no_mvd(): void
    {
        $schema = new RelationSchema(
            name: 'Simple',
            attributes: ['ID', 'Name'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['ID'], dependent: ['Name']),
            ]
        );

        $mvds = $this->engine->findMultivaluedDependencies($schema);

        $this->assertEmpty($mvds);
    }

    public function test_detects_join_dependency(): void
    {
        $schema = new RelationSchema(
            name: 'LargeTable',
            attributes: ['A', 'B', 'C', 'D'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C', 'D']),
                new FunctionalDependency(determinant: ['B', 'C'], dependent: ['A', 'D']),
            ]
        );

        $jds = $this->engine->findJoinDependencies($schema);

        $this->assertNotEmpty($jds);
        $this->assertStringContainsString('dependencia de uni', $jds[0]);
    }

    public function test_decomposes_to_bcnf(): void
    {
        $schema = new RelationSchema(
            name: 'R',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
                new FunctionalDependency(determinant: ['C'], dependent: ['B']),
            ]
        );

        $result = $this->engine->decomposeToBCNF($schema);

        $this->assertCount(2, $result);

        // All original attributes must be covered
        $allAttrs = [];
        foreach ($result as $rel) {
            $allAttrs = array_unique(array_merge($allAttrs, $rel['attributes']));
        }
        sort($allAttrs);
        $this->assertEquals(['A', 'B', 'C'], $allAttrs);

        // Each decomposed relation must be valid and in BCNF
        foreach ($result as $rel) {
            $relSchema = new RelationSchema($rel['name'], $rel['attributes'], $rel['fds']);
            $this->assertNotEmpty($this->engine->findCandidateKeys($relSchema), $rel['name'] . ' should have a candidate key');
            $this->assertTrue($this->engine->isBCNF($relSchema), $rel['name'] . ' should be in BCNF');
        }

        // Verify R decomposes correctly: one schema must hold {B,C} with C→B, the other {A,C} with no FDs
        $hasBC = false;
        $hasAC = false;
        foreach ($result as $rel) {
            sort($rel['attributes']);
            if ($rel['attributes'] === ['B', 'C']) {
                $hasBC = true;
                $this->assertCount(1, $rel['fds']);
                $this->assertEquals(['C'], $rel['fds'][0]->determinant);
                $this->assertEquals(['B'], $rel['fds'][0]->dependent);
            }
            if ($rel['attributes'] === ['A', 'C']) {
                $hasAC = true;
                $this->assertEmpty($rel['fds']);
            }
        }
        $this->assertTrue($hasBC, 'Decomposition should include {B,C}');
        $this->assertTrue($hasAC, 'Decomposition should include {A,C}');
    }

    public function test_lossless_join_verification(): void
    {
        $schema = new RelationSchema(
            name: 'R',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
                new FunctionalDependency(determinant: ['C'], dependent: ['B']),
            ]
        );

        // BCNF decomposition should be lossless
        $decomposition = $this->engine->decomposeToBCNF($schema);
        $this->assertTrue($this->engine->isLosslessJoin($schema, $decomposition));

        // A lossy decomposition: {A,B} and {B,C} — common attr {B} does not determine either side
        $lossyDecomposition = [
            ['name' => 'R1', 'attributes' => ['A', 'B'], 'fds' => []],
            ['name' => 'R2', 'attributes' => ['B', 'C'], 'fds' => []],
        ];
        $this->assertFalse($this->engine->isLosslessJoin($schema, $lossyDecomposition));
    }

    public function test_dependency_preservation(): void
    {
        $schema = new RelationSchema(
            name: 'R',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
                new FunctionalDependency(determinant: ['C'], dependent: ['B']),
            ]
        );

        $decomposition = $this->engine->decomposeToBCNF($schema);

        $result = $this->engine->isDependencyPreserved($schema, $decomposition);

        $this->assertArrayHasKey('preserved', $result);
        $this->assertArrayHasKey('not_preserved', $result);
        $this->assertArrayHasKey('is_fully_preserved', $result);
        $this->assertIsBool($result['is_fully_preserved']);

        // C→B must be preserved (contained in {B,C})
        // AB→C may NOT be preserved (A and B split across schemas)
        $this->assertFalse($result['is_fully_preserved']);

        $preserved = $result['preserved'];
        $notPreserved = $result['not_preserved'];

        $this->assertCount(1, $preserved);
        $this->assertCount(1, $notPreserved);
        $this->assertEquals(['C'], $preserved[0]->determinant);
        $this->assertEquals(['B'], $preserved[0]->dependent);
        $this->assertEquals(['A', 'B'], $notPreserved[0]->determinant);
        $this->assertEquals(['C'], $notPreserved[0]->dependent);
    }

    public function test_passes_5fn_when_few_attributes(): void
    {
        $schema = new RelationSchema(
            name: 'Small',
            attributes: ['A', 'B', 'C'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['A'], dependent: ['B', 'C']),
            ]
        );

        $jds = $this->engine->findJoinDependencies($schema);

        $this->assertEmpty($jds);
    }

    public function test_computes_canonical_cover(): void
    {
        $fds = [
            new FunctionalDependency(determinant: ['A', 'B'], dependent: ['C']),
            new FunctionalDependency(determinant: ['A'], dependent: ['B']),
            new FunctionalDependency(determinant: ['B'], dependent: ['C']),
        ];

        $canonical = $this->engine->computeCanonicalCover($fds);

        $this->assertCount(2, $canonical);

        $foundAtoB = false;
        $foundBtoC = false;
        foreach ($canonical as $fd) {
            if ($fd->determinant === ['A'] && $fd->dependent === ['B']) {
                $foundAtoB = true;
            }
            if ($fd->determinant === ['B'] && $fd->dependent === ['C']) {
                $foundBtoC = true;
            }
        }
        $this->assertTrue($foundAtoB, 'A → B should be in canonical cover');
        $this->assertTrue($foundBtoC, 'B → C should be in canonical cover');
    }

    public function test_synthesizes_to_3nf(): void
    {
        $fds = [
            new FunctionalDependency(determinant: ['A'], dependent: ['B']),
            new FunctionalDependency(determinant: ['B'], dependent: ['C']),
        ];

        $schemas = $this->engine->synthesizeTo3NF($fds);

        $this->assertCount(2, $schemas);

        $foundAB = false;
        $foundBC = false;
        foreach ($schemas as $schema) {
            if ($schema['name'] === 'R_A' && !array_diff($schema['attributes'], ['A', 'B'])) {
                $foundAB = true;
            }
            if ($schema['name'] === 'R_B' && !array_diff($schema['attributes'], ['B', 'C'])) {
                $foundBC = true;
            }
        }
        $this->assertTrue($foundAB, 'R_A with {A, B} should be in synthesis');
        $this->assertTrue($foundBC, 'R_B with {B, C} should be in synthesis');

        foreach ($schemas as $schema) {
            $this->assertArrayHasKey('name', $schema);
            $this->assertArrayHasKey('attributes', $schema);
            $this->assertArrayHasKey('fds', $schema);
        }
    }
}
