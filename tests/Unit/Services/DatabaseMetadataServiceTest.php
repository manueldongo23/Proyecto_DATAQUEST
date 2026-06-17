<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\DatabaseMetadataService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use PDO;
use RuntimeException;

class DatabaseMetadataServiceTest extends TestCase
{
    private DatabaseMetadataService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DatabaseMetadataService();
    }

    public function test_generates_fd_from_primary_key(): void
    {
        $columns = ['id', 'name', 'email'];
        $pk = ['id'];
        $unique = [];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(1, $fds);
        $this->assertEquals(['id'], $fds[0]['determinant']);
        $this->assertEquals(['name', 'email'], $fds[0]['dependent']);
    }

    public function test_generates_fd_from_unique_constraint(): void
    {
        $columns = ['id', 'email', 'name'];
        $pk = ['id'];
        $unique = [['email']];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(2, $fds);

        $this->assertEquals(['id'], $fds[0]['determinant']);
        $this->assertEquals(['email', 'name'], $fds[0]['dependent']);

        $this->assertEquals(['email'], $fds[1]['determinant']);
        $this->assertEquals(['id', 'name'], $fds[1]['dependent']);
    }

    public function test_generates_fd_from_composite_primary_key(): void
    {
        $columns = ['student_id', 'course_id', 'grade', 'enrolled_at'];
        $pk = ['student_id', 'course_id'];
        $unique = [];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(1, $fds);
        $this->assertEquals(['student_id', 'course_id'], $fds[0]['determinant']);
        $this->assertEquals(['grade', 'enrolled_at'], $fds[0]['dependent']);
    }

    public function test_no_fd_when_pk_covers_all_columns(): void
    {
        $columns = ['id'];
        $pk = ['id'];
        $unique = [];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(0, $fds);
    }

    public function test_multiple_unique_constraints(): void
    {
        $columns = ['id', 'username', 'email'];
        $pk = ['id'];
        $unique = [['username'], ['email']];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(3, $fds);

        $this->assertEquals(['id'], $fds[0]['determinant']);
        $this->assertEquals(['username', 'email'], $fds[0]['dependent']);

        $this->assertEquals(['username'], $fds[1]['determinant']);
        $this->assertEquals(['id', 'email'], $fds[1]['dependent']);

        $this->assertEquals(['email'], $fds[2]['determinant']);
        $this->assertEquals(['id', 'username'], $fds[2]['dependent']);
    }

    public function test_no_duplicate_fd_candidates(): void
    {
        $columns = ['a', 'b'];
        $pk = ['a'];
        $unique = [['a']];

        $fds = $this->service->generateFdCandidates($columns, $pk, $unique);

        $this->assertCount(1, $fds);
    }

    public function test_import_from_dsn_builds_correct_structure(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $this->assertEquals('testdb', $result['database']);
        $this->assertEquals(2, $result['total_tables']);
        $this->assertEquals(5, $result['total_columns']);
        $this->assertEquals(1, $result['total_foreign_keys']);
        $this->assertCount(2, $result['tables']);
        $this->assertStringContainsString('Importadas 2 tablas', $result['message']);
    }

    public function test_import_returns_columns_with_correct_types(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $studentsCols = $result['tables'][0]['columns'];

        $this->assertEquals('id', $studentsCols[0]['name']);
        $this->assertEquals('integer', $studentsCols[0]['type']);
        $this->assertFalse($studentsCols[0]['nullable']);

        $this->assertEquals('name', $studentsCols[1]['name']);
        $this->assertEquals('varchar(100)', $studentsCols[1]['type']);
        $this->assertFalse($studentsCols[1]['nullable']);
    }

    public function test_import_builds_relation_schema_objects(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        foreach ($result['tables'] as $table) {
            $this->assertInstanceOf(RelationSchema::class, $table['schema']);
            $this->assertInstanceOf(FunctionalDependency::class, $table['schema']->getFds()[0]);
        }

        $this->assertEquals('students', $result['tables'][0]['schema']->name);
        $this->assertEquals(['id', 'name'], $result['tables'][0]['schema']->attributes);
        $this->assertCount(1, $result['tables'][0]['schema']->getFds());
    }

    public function test_import_returns_foreign_keys(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $enrollmentsFks = $result['tables'][1]['foreign_keys'];
        $this->assertCount(1, $enrollmentsFks);
        $this->assertEquals('student_id', $enrollmentsFks[0]['column_name']);
        $this->assertEquals('students', $enrollmentsFks[0]['referenced_table']);
        $this->assertEquals('id', $enrollmentsFks[0]['referenced_column']);
    }

    public function test_import_returns_indexes(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $this->assertArrayHasKey('idx_students_name', $result['tables'][0]['indexes']);
        $this->assertEquals(
            'CREATE INDEX idx_students_name ON students(name)',
            $result['tables'][0]['indexes']['idx_students_name']
        );
    }

    public function test_import_returns_unique_constraints(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $this->assertCount(1, $result['tables'][1]['unique_constraints']);
        $this->assertEquals(['email'], $result['tables'][1]['unique_constraints'][0]);
    }

    public function test_import_returns_fd_candidates_in_output(): void
    {
        $service = $this->createMockedService();

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $studentsFds = $result['tables'][0]['fd_candidates'];
        $this->assertCount(1, $studentsFds);
        $this->assertEquals(['id'], $studentsFds[0]['determinant']);
        $this->assertEquals(['name'], $studentsFds[0]['dependent']);

        $enrollmentsFds = $result['tables'][1]['fd_candidates'];
        $this->assertCount(2, $enrollmentsFds);
        $this->assertEquals(['enrollment_id'], $enrollmentsFds[0]['determinant']);
        $this->assertEquals(['student_id', 'email'], $enrollmentsFds[0]['dependent']);
    }

    public function test_import_respects_max_tables_limit(): void
    {
        $service = $this->makeSimpleMockService();
        $service->mockTables = range('t1', 't100');

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'db', 'u', 'p');

        $this->assertLessThanOrEqual(50, $result['total_tables']);
    }

    public function test_import_respects_max_columns_per_table(): void
    {
        $service = $this->makeSimpleMockService();
        $service->mockTables = ['big_table'];
        $cols = [];
        for ($i = 0; $i < 150; $i++) {
            $cols[] = ['name' => "col_{$i}", 'type' => 'integer', 'nullable' => false, 'default' => null];
        }
        $service->mockColumns = ['big_table' => $cols];

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'db', 'u', 'p');

        $this->assertLessThanOrEqual(100, count($result['tables'][0]['columns']));
    }

    public function test_import_throws_for_unsupported_driver(): void
    {
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage("Driver 'sqlite' not supported");

        $this->service->importFromDsn('sqlite', 'localhost', 3306, 'db', 'u', 'p');
    }

    public function test_connection_test_failure_throws_exception(): void
    {
        $service = new class extends DatabaseMetadataService {
            public bool $createPdoCalled = false;
            protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
            {
                $this->createPdoCalled = true;
                throw new \PDOException('Connection refused');
            }
        };

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Error de conexion');

        $service->testConnection('pgsql', 'invalid', 5432, 'db', 'u', 'p');
        $this->assertTrue($service->createPdoCalled);
    }

    public function test_test_connection_returns_success(): void
    {
        $pdoMock = $this->createMock(PDO::class);
        $pdoMock->method('getAttribute')
            ->with(PDO::ATTR_SERVER_VERSION)
            ->willReturn('15.0');

        $service = new class($pdoMock) extends DatabaseMetadataService {
            public function __construct(private PDO $pdo) {}
            protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
            {
                return $this->pdo;
            }
        };

        $result = $service->testConnection('pgsql', 'localhost', 5432, 'testdb', 'user', 'pass');

        $this->assertTrue($result['success']);
        $this->assertEquals('15.0', $result['server_version']);
        $this->assertStringContainsString('testdb', $result['message']);
    }

    public function test_mysql_driver_creates_correct_dsn(): void
    {
        $service = $this->makeSimpleMockService();

        $result = $service->importFromDsn('mysql', 'localhost', 3306, 'testdb', 'user', 'pass');

        $this->assertEquals('testdb', $result['database']);
        $this->assertEquals(0, $result['total_tables']);
    }

    public function test_import_handles_empty_database(): void
    {
        $service = $this->makeSimpleMockService();
        $service->mockTables = [];

        $result = $service->importFromDsn('pgsql', 'localhost', 5432, 'empty_db', 'u', 'p');

        $this->assertEquals('empty_db', $result['database']);
        $this->assertEquals(0, $result['total_tables']);
        $this->assertCount(0, $result['tables']);
        $this->assertStringContainsString('Importadas 0 tablas', $result['message']);
    }

    public function test_error_handling_for_failed_connection(): void
    {
        $service = new class extends DatabaseMetadataService {
            protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
            {
                throw new \PDOException('could not connect to server');
            }
        };

        $this->expectException(\PDOException::class);

        $service->importFromDsn('pgsql', 'localhost', 5432, 'db', 'u', 'p');
    }

    private function makeSimpleMockService(): DatabaseMetadataService
    {
        $pdoMock = $this->createMock(PDO::class);
        $service = new class($pdoMock) extends DatabaseMetadataService {
            public array $mockTables = [];
            public array $mockColumns = [];
            public array $mockPrimaryKeys = [];
            public array $mockForeignKeys = [];
            public array $mockUniqueConstraints = [];
            public array $mockIndexes = [];
            private PDO $pdoMock;

            public function __construct(PDO $pdo)
            {
                $this->pdoMock = $pdo;
            }

            protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
            {
                return $this->pdoMock;
            }

            protected function fetchTables(PDO $pdo, string $schema): array
            {
                return $this->mockTables ?: [];
            }

            protected function fetchColumns(PDO $pdo, string $schema, string $table): array
            {
                return $this->mockColumns[$table] ?? [];
            }

            protected function fetchPrimaryKey(PDO $pdo, string $schema, string $table): array
            {
                return $this->mockPrimaryKeys[$table] ?? [];
            }

            protected function fetchForeignKeys(PDO $pdo, string $schema, string $table): array
            {
                return $this->mockForeignKeys[$table] ?? [];
            }

            protected function fetchUniqueConstraints(PDO $pdo, string $schema, string $table): array
            {
                return $this->mockUniqueConstraints[$table] ?? [];
            }

            protected function fetchIndexes(PDO $pdo, string $driver, string $schema, string $table): array
            {
                return $this->mockIndexes[$table] ?? [];
            }
        };
        return $service;
    }

    private function createMockedService(): DatabaseMetadataService
    {
        $pdoMock = $this->createMock(PDO::class);

        $service = new class($pdoMock) extends DatabaseMetadataService {
            private PDO $pdoMock;
            private array $tables = ['students', 'enrollments'];
            private array $columns = [
                'students' => [
                    ['name' => 'id', 'type' => 'integer', 'nullable' => false, 'default' => null],
                    ['name' => 'name', 'type' => 'varchar(100)', 'nullable' => false, 'default' => null],
                ],
                'enrollments' => [
                    ['name' => 'enrollment_id', 'type' => 'integer', 'nullable' => false, 'default' => null],
                    ['name' => 'student_id', 'type' => 'integer', 'nullable' => true, 'default' => null],
                    ['name' => 'email', 'type' => 'varchar(255)', 'nullable' => false, 'default' => null],
                ],
            ];
            private array $primaryKeys = [
                'students' => ['id'],
                'enrollments' => ['enrollment_id'],
            ];
            private array $foreignKeys = [
                'students' => [],
                'enrollments' => [
                    ['column_name' => 'student_id', 'referenced_table' => 'students', 'referenced_column' => 'id'],
                ],
            ];
            private array $uniqueConstraints = [
                'students' => [],
                'enrollments' => [['email']],
            ];
            private array $indexes = [
                'students' => ['idx_students_name' => 'CREATE INDEX idx_students_name ON students(name)'],
                'enrollments' => [],
            ];

            public function __construct(PDO $pdo)
            {
                $this->pdoMock = $pdo;
            }

            protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
            {
                return $this->pdoMock;
            }

            protected function fetchTables(PDO $pdo, string $schema): array
            {
                return $this->tables;
            }

            protected function fetchColumns(PDO $pdo, string $schema, string $table): array
            {
                return $this->columns[$table] ?? [];
            }

            protected function fetchPrimaryKey(PDO $pdo, string $schema, string $table): array
            {
                return $this->primaryKeys[$table] ?? [];
            }

            protected function fetchForeignKeys(PDO $pdo, string $schema, string $table): array
            {
                return $this->foreignKeys[$table] ?? [];
            }

            protected function fetchUniqueConstraints(PDO $pdo, string $schema, string $table): array
            {
                return $this->uniqueConstraints[$table] ?? [];
            }

            protected function fetchIndexes(PDO $pdo, string $driver, string $schema, string $table): array
            {
                return $this->indexes[$table] ?? [];
            }
        };

        return $service;
    }
}
