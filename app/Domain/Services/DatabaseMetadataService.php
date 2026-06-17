<?php
namespace App\Domain\Services;

use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;
use PDO;
use PDOException;
use RuntimeException;

class DatabaseMetadataService
{
    private const MAX_TABLES = 50;
    private const MAX_COLUMNS = 100;
    private const TIMEOUT_SECONDS = 30;

    public function importFromConnection(string $connectionName, ?string $schema = 'public'): array
    {
        $config = config("database.connections.{$connectionName}");
        if (!$config) {
            throw new RuntimeException("Connection '{$connectionName}' not found in database configuration.");
        }

        return $this->importFromDsn(
            $config['driver'],
            $config['host'] ?? '127.0.0.1',
            (int) ($config['port'] ?? 5432),
            $config['database'] ?? '',
            $config['username'] ?? '',
            $config['password'] ?? '',
            $schema
        );
    }

    public function importFromDsn(
        string $driver,
        string $host,
        int $port,
        string $database,
        string $username,
        string $password,
        ?string $schema = 'public'
    ): array {
        set_time_limit(self::TIMEOUT_SECONDS);

        $pdo = $this->createPdo($driver, $host, $port, $database, $username, $password);

        $tables = $this->fetchTables($pdo, $schema);

        if (count($tables) > self::MAX_TABLES) {
            $tables = array_slice($tables, 0, self::MAX_TABLES);
        }

        $resultTables = [];
        $totalColumns = 0;
        $totalForeignKeys = 0;

        foreach ($tables as $tableName) {
            $columns = $this->fetchColumns($pdo, $schema, $tableName);

            if (count($columns) > self::MAX_COLUMNS) {
                $columns = array_slice($columns, 0, self::MAX_COLUMNS);
            }

            $primaryKey = $this->fetchPrimaryKey($pdo, $schema, $tableName);
            $foreignKeys = $this->fetchForeignKeys($pdo, $schema, $tableName);
            $uniqueConstraints = $this->fetchUniqueConstraints($pdo, $schema, $tableName);
            $indexes = $this->fetchIndexes($pdo, $driver, $schema, $tableName);

            $allColumnNames = array_column($columns, 'name');
            $fdCandidates = $this->generateFdCandidates($allColumnNames, $primaryKey, $uniqueConstraints);

            $fds = [];
            foreach ($fdCandidates as $fd) {
                $fds[] = new FunctionalDependency($fd['determinant'], $fd['dependent']);
            }

            $relationSchema = new RelationSchema($tableName, $allColumnNames, $fds);

            $resultTables[] = [
                'name' => $tableName,
                'columns' => $columns,
                'primary_key' => $primaryKey,
                'foreign_keys' => $foreignKeys,
                'unique_constraints' => $uniqueConstraints,
                'indexes' => $indexes,
                'fd_candidates' => $fdCandidates,
                'schema' => $relationSchema,
            ];

            $totalColumns += count($columns);
            $totalForeignKeys += count($foreignKeys);
        }

        return [
            'database' => $database,
            'tables' => $resultTables,
            'total_tables' => count($resultTables),
            'total_columns' => $totalColumns,
            'total_foreign_keys' => $totalForeignKeys,
            'message' => sprintf(
                'Importadas %d tablas desde la base de datos %s',
                count($resultTables),
                $database
            ),
        ];
    }

    public function testConnection(string $driver, string $host, int $port, string $database, string $username, string $password): array
    {
        try {
            $pdo = $this->createPdo($driver, $host, $port, $database, $username, $password);
            $serverVersion = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);

            return [
                'success' => true,
                'server_version' => $serverVersion,
                'message' => "Conexion exitosa a {$database} usando {$driver} (v{$serverVersion})",
            ];
        } catch (PDOException $e) {
            throw new RuntimeException("Error de conexion: " . $e->getMessage());
        }
    }

    public function generateFdCandidates(array $allColumnNames, array $primaryKey, array $uniqueConstraints): array
    {
        $fds = [];
        $seen = [];

        if (!empty($primaryKey)) {
            $dependent = array_values(array_filter($allColumnNames, fn($c) => !in_array($c, $primaryKey)));
            if (!empty($dependent)) {
                $key = implode(',', $primaryKey) . '->' . implode(',', $dependent);
                if (!isset($seen[$key])) {
                    $fds[] = ['determinant' => $primaryKey, 'dependent' => $dependent];
                    $seen[$key] = true;
                }
            }
        }

        foreach ($uniqueConstraints as $constraint) {
            $dependent = array_values(array_filter($allColumnNames, fn($c) => !in_array($c, $constraint)));
            if (!empty($dependent)) {
                $key = implode(',', $constraint) . '->' . implode(',', $dependent);
                if (!isset($seen[$key])) {
                    $fds[] = ['determinant' => $constraint, 'dependent' => $dependent];
                    $seen[$key] = true;
                }
            }
        }

        return $fds;
    }

    protected function createPdo(string $driver, string $host, int $port, string $database, string $username, string $password): PDO
    {
        $dsn = match ($driver) {
            'pgsql' => "pgsql:host={$host};port={$port};dbname={$database}",
            'mysql' => "mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4",
            default => throw new RuntimeException("Driver '{$driver}' not supported. Use 'pgsql' or 'mysql'."),
        };

        return new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => self::TIMEOUT_SECONDS,
        ]);
    }

    protected function fetchTables(PDO $pdo, string $schema): array
    {
        $stmt = $pdo->prepare(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = 'BASE TABLE' ORDER BY table_name"
        );
        $stmt->execute([$schema]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    protected function fetchColumns(PDO $pdo, string $schema, string $table): array
    {
        $stmt = $pdo->prepare(
            "SELECT column_name, data_type, is_nullable, column_default, character_maximum_length 
             FROM information_schema.columns 
             WHERE table_schema = ? AND table_name = ? 
             ORDER BY ordinal_position"
        );
        $stmt->execute([$schema, $table]);
        $rows = $stmt->fetchAll();

        return array_map(function ($row) {
            $type = $row['data_type'];
            if ($row['character_maximum_length'] && in_array($row['data_type'], ['character varying', 'varchar', 'character', 'char'])) {
                $type .= '(' . $row['character_maximum_length'] . ')';
            }
            return [
                'name' => $row['column_name'],
                'type' => $type,
                'nullable' => $row['is_nullable'] === 'YES',
                'default' => $row['column_default'],
            ];
        }, $rows);
    }

    protected function fetchPrimaryKey(PDO $pdo, string $schema, string $table): array
    {
        $stmt = $pdo->prepare(
            "SELECT kcu.column_name 
             FROM information_schema.table_constraints tc 
             JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_catalog = kcu.constraint_catalog 
              AND tc.constraint_schema = kcu.constraint_schema 
              AND tc.constraint_name = kcu.constraint_name 
             WHERE tc.table_schema = ? AND tc.table_name = ? AND tc.constraint_type = 'PRIMARY KEY' 
             ORDER BY kcu.ordinal_position"
        );
        $stmt->execute([$schema, $table]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    protected function fetchForeignKeys(PDO $pdo, string $schema, string $table): array
    {
        $stmt = $pdo->prepare(
            "SELECT kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column 
             FROM information_schema.table_constraints tc 
             JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_catalog = kcu.constraint_catalog 
              AND tc.constraint_schema = kcu.constraint_schema 
              AND tc.constraint_name = kcu.constraint_name 
             JOIN information_schema.constraint_column_usage ccu 
               ON tc.constraint_catalog = ccu.constraint_catalog 
              AND tc.constraint_schema = ccu.constraint_schema 
              AND tc.constraint_name = ccu.constraint_name 
             WHERE tc.table_schema = ? AND tc.table_name = ? AND tc.constraint_type = 'FOREIGN KEY'"
        );
        $stmt->execute([$schema, $table]);
        return $stmt->fetchAll();
    }

    protected function fetchUniqueConstraints(PDO $pdo, string $schema, string $table): array
    {
        $stmt = $pdo->prepare(
            "SELECT kcu.column_name, tc.constraint_name
             FROM information_schema.table_constraints tc 
             JOIN information_schema.key_column_usage kcu 
               ON tc.constraint_catalog = kcu.constraint_catalog 
              AND tc.constraint_schema = kcu.constraint_schema 
              AND tc.constraint_name = kcu.constraint_name 
             WHERE tc.table_schema = ? AND tc.table_name = ? AND tc.constraint_type = 'UNIQUE' 
             ORDER BY kcu.constraint_name, kcu.ordinal_position"
        );
        $stmt->execute([$schema, $table]);
        $rows = $stmt->fetchAll();

        $grouped = [];
        foreach ($rows as $row) {
            $grouped[$row['constraint_name']][] = $row['column_name'];
        }
        return array_values($grouped);
    }

    protected function fetchIndexes(PDO $pdo, string $driver, string $schema, string $table): array
    {
        if ($driver === 'pgsql') {
            return $this->fetchPostgresIndexes($pdo, $schema, $table);
        }
        if ($driver === 'mysql') {
            return $this->fetchMySqlIndexes($pdo, $table);
        }
        return [];
    }

    private function fetchPostgresIndexes(PDO $pdo, string $schema, string $table): array
    {
        try {
            $stmt = $pdo->prepare("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ? AND tablename = ?");
            $stmt->execute([$schema, $table]);
            $rows = $stmt->fetchAll();
            $indexes = [];
            foreach ($rows as $row) {
                $indexes[$row['indexname']] = $row['indexdef'];
            }
            return $indexes;
        } catch (PDOException $e) {
            return [];
        }
    }

    private function fetchMySqlIndexes(PDO $pdo, string $table): array
    {
        try {
            $stmt = $pdo->query("SHOW INDEX FROM `{$table}`");
            $rows = $stmt->fetchAll();
            $grouped = [];
            $nonUnique = [];
            foreach ($rows as $row) {
                $keyName = $row['Key_name'];
                $grouped[$keyName][] = $row['Column_name'];
                $nonUnique[$keyName] = $row['Non_unique'];
            }
            $indexes = [];
            foreach ($grouped as $keyName => $cols) {
                $type = !empty($nonUnique[$keyName]) ? 'INDEX' : 'UNIQUE INDEX';
                $indexes[$keyName] = "CREATE {$type} {$keyName} ON {$table}(" . implode(',', $cols) . ")";
            }
            return $indexes;
        } catch (PDOException $e) {
            return [];
        }
    }
}
