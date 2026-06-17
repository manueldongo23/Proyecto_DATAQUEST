<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\SandboxService;
use App\Domain\Services\NormalizationEngine;
use App\Domain\Services\DecompositionService;
use App\Domain\Services\SqlGenerationService;
use App\Domain\Services\SqlDdlParserService;
use App\Domain\Services\CsvImportService;
use App\Domain\Services\GlossaryService;

class SandboxServiceTest extends TestCase
{
    private SandboxService $sandbox;

    protected function setUp(): void
    {
        parent::setUp();

        $engine = new NormalizationEngine();
        $this->sandbox = new SandboxService(
            engine: $engine,
            decompositionService: new DecompositionService($engine),
            sqlGeneration: new SqlGenerationService(),
            ddlParser: new SqlDdlParserService(),
            csvImport: new CsvImportService(),
            glossary: new GlossaryService(),
        );
    }

    public function test_analyze_returns_correct_structure(): void
    {
        $input = [
            'table_name' => 'Student',
            'attributes' => ['StudentID', 'Name', 'Email'],
            'dependencies' => [
                ['determinant' => ['StudentID'], 'dependent' => ['Name', 'Email']],
            ],
        ];

        $result = $this->sandbox->analyze($input);

        $this->assertArrayHasKey('schema_name', $result);
        $this->assertArrayHasKey('attributes', $result);
        $this->assertArrayHasKey('functional_dependencies', $result);
        $this->assertArrayHasKey('candidate_keys', $result);
        $this->assertArrayHasKey('prime_attributes', $result);
        $this->assertArrayHasKey('canonical_cover', $result);
        $this->assertArrayHasKey('diagnosis', $result);
        $this->assertArrayHasKey('decomposition', $result);
        $this->assertArrayHasKey('sql', $result);

        $this->assertEquals('Student', $result['schema_name']);
        $this->assertEquals(['StudentID', 'Name', 'Email'], $result['attributes']);
        $this->assertCount(1, $result['functional_dependencies']);
    }

    public function test_build_schema_validates_input(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Missing required fields');

        $this->sandbox->buildSchema([
            'table_name' => 'Test',
            'attributes' => [],
            'dependencies' => [],
        ]);
    }

    public function test_build_schema_creates_valid_schema(): void
    {
        $input = [
            'table_name' => 'Employee',
            'attributes' => ['ID', 'Name', 'DeptID', 'DeptName'],
            'dependencies' => [
                ['determinant' => ['ID'], 'dependent' => ['Name', 'DeptID']],
                ['determinant' => ['DeptID'], 'dependent' => ['DeptName']],
            ],
        ];

        $schema = $this->sandbox->buildSchema($input);

        $this->assertEquals('Employee', $schema->name);
        $this->assertEquals(['ID', 'Name', 'DeptID', 'DeptName'], $schema->getAttributesSet());
        $this->assertCount(2, $schema->getFds());
    }

    public function test_exercise_generation_returns_valid_format(): void
    {
        $result = $this->sandbox->generateExercise('2FN');

        $this->assertArrayHasKey('nf', $result);
        $this->assertArrayHasKey('title', $result);
        $this->assertArrayHasKey('schema', $result);
        $this->assertArrayHasKey('question', $result);
        $this->assertArrayHasKey('answer', $result);
        $this->assertArrayHasKey('explanation', $result);
        $this->assertEquals('2FN', $result['nf']);
    }

    public function test_exercise_generation_falls_back_for_invalid_nf(): void
    {
        $result = $this->sandbox->generateExercise('INVALID');

        $this->assertArrayHasKey('nf', $result);
        $this->assertArrayHasKey('title', $result);
    }

    public function test_parse_ddl_returns_array(): void
    {
        $sql = 'CREATE TABLE Test (id INTEGER PRIMARY KEY, name TEXT)';
        $result = $this->sandbox->parseDdl($sql);

        $this->assertArrayHasKey('schema', $result);
        $this->assertArrayHasKey('raw_columns', $result);
    }

    public function test_glossary_returns_term(): void
    {
        $result = $this->sandbox->glossary('DF', 'es');

        $this->assertNotNull($result);
        $this->assertEquals('Dependencia Funcional', $result['name']);
    }

    public function test_glossary_returns_null_for_unknown_term(): void
    {
        $result = $this->sandbox->glossary('TERMINO_INEXISTENTE', 'es');

        $this->assertNull($result);
    }
}
