<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\CsvImportService;
use App\Domain\Entities\FunctionalDependency;

class CsvImportServiceTest extends TestCase
{
    private CsvImportService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CsvImportService();
    }

    public function test_parses_simple_csv(): void
    {
        $csv = "id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com\n3,Charlie,charlie@example.com";

        $result = $this->service->import($csv);

        $this->assertEquals(3, $result['row_count']);
        $this->assertCount(3, $result['columns']);
        $this->assertEquals('imported_table', $result['table_name']);
        $this->assertEquals('id', $result['columns'][0]['name']);
        $this->assertEquals('name', $result['columns'][1]['name']);
        $this->assertEquals('email', $result['columns'][2]['name']);
    }

    public function test_discovers_functional_dependency(): void
    {
        $csv = "id,name,department_id\n1,Alice,10\n2,Bob,10\n3,Charlie,20\n4,Diana,20";

        $result = $this->service->import($csv, 'employees');

        $this->assertGreaterThanOrEqual(1, count($result['discovered_fds']));

        $foundIdToName = false;
        $foundIdToDept = false;
        foreach ($result['discovered_fds'] as $fd) {
            if ($fd['determinant'] === ['id'] && $fd['dependent'] === ['name']) {
                $foundIdToName = true;
            }
            if ($fd['determinant'] === ['id'] && $fd['dependent'] === ['department_id']) {
                $foundIdToDept = true;
            }
        }

        $this->assertTrue($foundIdToName, 'id -> name should be discovered');
        $this->assertTrue($foundIdToDept, 'id -> department_id should be discovered');
    }

    public function test_handles_csv_without_header(): void
    {
        $csv = "1,Alice,alice@example.com\n2,Bob,bob@example.com\n3,Charlie,charlie@example.com";

        $result = $this->service->import($csv, 'no_header', false);

        $this->assertEquals(3, $result['row_count']);
        $this->assertCount(3, $result['columns']);
        $this->assertEquals('col_1', $result['columns'][0]['name']);
        $this->assertEquals('col_2', $result['columns'][1]['name']);
        $this->assertEquals('col_3', $result['columns'][2]['name']);
    }

    public function test_infers_column_types(): void
    {
        $csv = "id,score,name,joined_at\n1,95.5,Alice,2024-01-15\n2,87.3,Bob,2023-06-20";

        $result = $this->service->import($csv);

        $types = [];
        foreach ($result['columns'] as $col) {
            $types[$col['name']] = $col['type'];
        }

        $this->assertEquals('INT', $types['id']);
        $this->assertEquals('DECIMAL', $types['score']);
        $this->assertEquals('TEXT', $types['name']);
        $this->assertEquals('DATE', $types['joined_at']);
    }

    public function test_handles_empty_csv(): void
    {
        $result = $this->service->import('');

        $this->assertEquals(0, $result['row_count']);
        $this->assertCount(0, $result['columns']);
        $this->assertCount(0, $result['discovered_fds']);
    }

    public function test_detects_semicolon_delimiter(): void
    {
        $csv = "id;name;email\n1;Alice;alice@example.com\n2;Bob;bob@example.com";

        $result = $this->service->import($csv, 'semicolon', true, ';');

        $this->assertEquals(2, $result['row_count']);
        $this->assertEquals('id', $result['columns'][0]['name']);
    }

    public function test_type_inference_empty_column(): void
    {
        $csv = "id,notes\n1,\n2,\n3,test";

        $result = $this->service->import($csv);

        $types = [];
        foreach ($result['columns'] as $col) {
            $types[$col['name']] = $col['type'];
        }

        $this->assertEquals('INT', $types['id']);
        $this->assertEquals('TEXT', $types['notes']);
    }

    public function test_schema_has_functional_dependencies(): void
    {
        $csv = "id,name\n1,Alice\n2,Bob";

        $result = $this->service->import($csv, 'test');

        $this->assertInstanceOf(\App\Domain\Entities\RelationSchema::class, $result['schema']);
        $this->assertEquals('test', $result['schema']->name);
        $this->assertEquals(['id', 'name'], $result['schema']->attributes);

        foreach ($result['schema']->getFds() as $fd) {
            $this->assertInstanceOf(FunctionalDependency::class, $fd);
        }
    }

    public function test_returns_confidence_score(): void
    {
        $csv = "id,name\n1,Alice\n2,Bob\n3,Alice";

        $result = $this->service->import($csv);

        foreach ($result['discovered_fds'] as $fd) {
            $this->assertArrayHasKey('confidence', $fd);
            $this->assertIsFloat($fd['confidence']);
        }
    }
}
