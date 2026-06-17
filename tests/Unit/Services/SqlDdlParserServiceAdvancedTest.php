<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\SqlDdlParserService;

class SqlDdlParserServiceAdvancedTest extends TestCase
{
    private SqlDdlParserService $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new SqlDdlParserService();
    }

    public function test_parses_serial_types(): void
    {
        $sql = 'CREATE TABLE t (id SERIAL PRIMARY KEY, bid BIGSERIAL, sid SMALLSERIAL)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('SERIAL', $result['raw_columns'][0]['type']);
        $this->assertEquals('BIGSERIAL', $result['raw_columns'][1]['type']);
        $this->assertEquals('SMALLSERIAL', $result['raw_columns'][2]['type']);
    }

    public function test_parses_uuid_type(): void
    {
        $sql = 'CREATE TABLE t (id UUID PRIMARY KEY, data UUID)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('UUID', $result['raw_columns'][0]['type']);
        $this->assertTrue($result['raw_columns'][0]['primary_key']);
        $this->assertEquals('UUID', $result['raw_columns'][1]['type']);
    }

    public function test_parses_json_types(): void
    {
        $sql = 'CREATE TABLE t (data JSON, meta JSONB)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('JSON', $result['raw_columns'][0]['type']);
        $this->assertEquals('JSONB', $result['raw_columns'][1]['type']);
    }

    public function test_parses_enum_type(): void
    {
        $sql = "CREATE TABLE t (status VARCHAR(20) CHECK (status IN ('active', 'inactive')))";

        $result = $this->parser->parse($sql);

        $this->assertEquals('VARCHAR(20)', $result['raw_columns'][0]['type']);
    }

    public function test_parses_decimal_types(): void
    {
        $sql = 'CREATE TABLE t (price NUMERIC(10,2), qty DECIMAL(8,0), rate REAL, val FLOAT, precise DOUBLE PRECISION)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('NUMERIC(10,2)', $result['raw_columns'][0]['type']);
        $this->assertEquals('DECIMAL(8,0)', $result['raw_columns'][1]['type']);
        $this->assertEquals('REAL', $result['raw_columns'][2]['type']);
        $this->assertEquals('FLOAT', $result['raw_columns'][3]['type']);
        $this->assertEquals('DOUBLE PRECISION', $result['raw_columns'][4]['type']);
    }

    public function test_parses_temporal_types(): void
    {
        $sql = 'CREATE TABLE t (d DATE, t TIME, ts TIMESTAMP, tstz TIMESTAMPTZ, tswtz TIMESTAMP WITH TIME ZONE)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('DATE', $result['raw_columns'][0]['type']);
        $this->assertEquals('TIME', $result['raw_columns'][1]['type']);
        $this->assertEquals('TIMESTAMP', $result['raw_columns'][2]['type']);
        $this->assertEquals('TIMESTAMPTZ', $result['raw_columns'][3]['type']);
        $this->assertEquals('TIMESTAMP WITH TIME ZONE', $result['raw_columns'][4]['type']);
    }

    public function test_parses_text_and_char_types(): void
    {
        $sql = 'CREATE TABLE t (txt TEXT, c CHAR(1), vc VARCHAR(255), cv CHARACTER VARYING(100))';

        $result = $this->parser->parse($sql);

        $this->assertEquals('TEXT', $result['raw_columns'][0]['type']);
        $this->assertEquals('CHAR(1)', $result['raw_columns'][1]['type']);
        $this->assertEquals('VARCHAR(255)', $result['raw_columns'][2]['type']);
        $this->assertEquals('CHARACTER VARYING(100)', $result['raw_columns'][3]['type']);
    }

    public function test_parses_binary_types(): void
    {
        $sql = 'CREATE TABLE t (b BLOB, bt BYTEA)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('BLOB', $result['raw_columns'][0]['type']);
        $this->assertEquals('BYTEA', $result['raw_columns'][1]['type']);
    }

    public function test_parses_boolean_type(): void
    {
        $sql = 'CREATE TABLE t (flag BOOLEAN, active BOOL DEFAULT TRUE)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('BOOLEAN', $result['raw_columns'][0]['type']);
        $this->assertEquals('BOOL', $result['raw_columns'][1]['type']);
    }

    public function test_parses_network_types(): void
    {
        $sql = 'CREATE TABLE t (ip INET, net CIDR, mac MACADDR)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('INET', $result['raw_columns'][0]['type']);
        $this->assertEquals('CIDR', $result['raw_columns'][1]['type']);
        $this->assertEquals('MACADDR', $result['raw_columns'][2]['type']);
    }

    public function test_parses_interval_type(): void
    {
        $sql = 'CREATE TABLE t (duration INTERVAL)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('INTERVAL', $result['raw_columns'][0]['type']);
    }

    public function test_parses_array_type(): void
    {
        $sql = 'CREATE TABLE t (tags TEXT[])';

        $result = $this->parser->parse($sql);

        $this->assertEquals('TEXT[]', $result['raw_columns'][0]['type']);
    }

    public function test_parses_check_constraint_column_level(): void
    {
        $sql = 'CREATE TABLE t (age INT CHECK (age > 18))';

        $result = $this->parser->parse($sql);

        $this->assertEquals('(age > 18)', $result['raw_columns'][0]['check']);
    }

    public function test_parses_check_constraint_table_level(): void
    {
        $sql = 'CREATE TABLE t (start_date DATE, end_date DATE, CHECK (end_date > start_date))';

        $result = $this->parser->parse($sql);

        $this->assertCount(1, $result['checks']);
        $this->assertEquals('(end_date > start_date)', $result['checks'][0]);
    }

    public function test_parses_named_check_constraint(): void
    {
        $sql = 'CREATE TABLE t (age INT, CONSTRAINT age_check CHECK (age >= 0))';

        $result = $this->parser->parse($sql);

        $this->assertCount(1, $result['checks']);
        $this->assertEquals('(age >= 0)', $result['checks'][0]);
    }

    public function test_parses_default_values(): void
    {
        $sql = "CREATE TABLE t (id INT DEFAULT 0, name VARCHAR(100) DEFAULT 'anonymous', ts TIMESTAMP DEFAULT NOW())";

        $result = $this->parser->parse($sql);

        $this->assertEquals('0', $result['raw_columns'][0]['default']);
        $this->assertEquals("'anonymous'", $result['raw_columns'][1]['default']);
        $this->assertEquals('NOW()', $result['raw_columns'][2]['default']);
    }

    public function test_parses_default_boolean_and_current_timestamp(): void
    {
        $sql = 'CREATE TABLE t (active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('TRUE', $result['raw_columns'][0]['default']);
        $this->assertEquals('CURRENT_TIMESTAMP', $result['raw_columns'][1]['default']);
    }

    public function test_parses_default_uuid_generate(): void
    {
        $sql = 'CREATE TABLE t (id UUID DEFAULT uuid_generate_v4())';

        $result = $this->parser->parse($sql);

        $this->assertEquals('uuid_generate_v4()', $result['raw_columns'][0]['default']);
    }

    public function test_parses_create_index(): void
    {
        $sql = 'CREATE INDEX idx_name ON users (email)';

        $result = $this->parser->parseCreateIndex($sql);

        $this->assertEquals('idx_name', $result['name']);
        $this->assertEquals('users', $result['table']);
        $this->assertEquals(['email'], $result['columns']);
        $this->assertFalse($result['unique']);
        $this->assertFalse($result['concurrently']);
    }

    public function test_parses_create_unique_index(): void
    {
        $sql = 'CREATE UNIQUE INDEX idx_email ON users (email)';

        $result = $this->parser->parseCreateIndex($sql);

        $this->assertTrue($result['unique']);
        $this->assertEquals('idx_email', $result['name']);
    }

    public function test_parses_create_index_concurrently(): void
    {
        $sql = 'CREATE INDEX CONCURRENTLY idx_name ON users (email)';

        $result = $this->parser->parseCreateIndex($sql);

        $this->assertTrue($result['concurrently']);
    }

    public function test_parses_create_index_multi_column(): void
    {
        $sql = 'CREATE INDEX idx_name ON users (last_name, first_name)';

        $result = $this->parser->parseCreateIndex($sql);

        $this->assertEquals(['last_name', 'first_name'], $result['columns']);
    }

    public function test_parses_alter_table_add_column(): void
    {
        $sql = 'ALTER TABLE users ADD COLUMN age INT';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('users', $result['table']);
        $this->assertCount(1, $result['operations']);
        $this->assertEquals('ADD_COLUMN', $result['operations'][0]['operation']);
        $this->assertEquals('age', $result['operations'][0]['column_definition']['name']);
        $this->assertEquals('INT', $result['operations'][0]['column_definition']['type']);
    }

    public function test_parses_alter_table_add_primary_key(): void
    {
        $sql = 'ALTER TABLE users ADD PRIMARY KEY (id)';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('ADD_PRIMARY_KEY', $result['operations'][0]['operation']);
        $this->assertEquals(['id'], $result['operations'][0]['columns']);
    }

    public function test_parses_alter_table_add_foreign_key(): void
    {
        $sql = 'ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users(id)';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('ADD_FOREIGN_KEY', $result['operations'][0]['operation']);
        $this->assertEquals(['user_id'], $result['operations'][0]['columns']);
        $this->assertEquals('users', $result['operations'][0]['referenced_table']);
        $this->assertEquals(['id'], $result['operations'][0]['referenced_columns']);
    }

    public function test_parses_alter_table_add_constraint_unique(): void
    {
        $sql = 'ALTER TABLE users ADD CONSTRAINT uq_email UNIQUE (email)';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('ADD_UNIQUE', $result['operations'][0]['operation']);
        $this->assertEquals('uq_email', $result['operations'][0]['constraint_name']);
        $this->assertEquals(['email'], $result['operations'][0]['columns']);
    }

    public function test_parses_alter_table_set_not_null(): void
    {
        $sql = 'ALTER TABLE users ALTER COLUMN email SET NOT NULL';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('ALTER_SET_NOT_NULL', $result['operations'][0]['operation']);
        $this->assertEquals('email', $result['operations'][0]['column']);
    }

    public function test_parses_alter_table_drop_column(): void
    {
        $sql = 'ALTER TABLE users DROP COLUMN age';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('DROP_COLUMN', $result['operations'][0]['operation']);
        $this->assertEquals('age', $result['operations'][0]['column']);
    }

    public function test_parses_alter_table_rename_column(): void
    {
        $sql = 'ALTER TABLE users RENAME COLUMN old_name TO new_name';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('RENAME_COLUMN', $result['operations'][0]['operation']);
        $this->assertEquals('old_name', $result['operations'][0]['old_name']);
        $this->assertEquals('new_name', $result['operations'][0]['new_name']);
    }

    public function test_parses_drop_table(): void
    {
        $sql = 'DROP TABLE users';

        $result = $this->parser->parseDropTable($sql);

        $this->assertEquals('users', $result['table']);
        $this->assertFalse($result['if_exists']);
        $this->assertFalse($result['cascade']);
    }

    public function test_parses_drop_table_if_exists(): void
    {
        $sql = 'DROP TABLE IF EXISTS users';

        $result = $this->parser->parseDropTable($sql);

        $this->assertTrue($result['if_exists']);
    }

    public function test_parses_drop_table_cascade(): void
    {
        $sql = 'DROP TABLE users CASCADE';

        $result = $this->parser->parseDropTable($sql);

        $this->assertTrue($result['cascade']);
    }

    public function test_parses_multiple_statements(): void
    {
        $sql = "CREATE TABLE t1 (id INT PRIMARY KEY);\nCREATE TABLE t2 (id INT, ref INT REFERENCES t1(id));\nCREATE INDEX idx_t2_ref ON t2(ref);";

        $results = $this->parser->parseMultiple($sql);

        $this->assertCount(3, $results);

        $this->assertEquals('CREATE_TABLE', $results[0]['type']);
        $this->assertEquals('t1', $results[0]['data']['schema']->name);

        $this->assertEquals('CREATE_TABLE', $results[1]['type']);
        $this->assertEquals('t2', $results[1]['data']['schema']->name);

        $this->assertEquals('CREATE_INDEX', $results[2]['type']);
        $this->assertEquals('idx_t2_ref', $results[2]['data']['name']);
        $this->assertEquals('t2', $results[2]['data']['table']);
    }

    public function test_parses_multiple_mixed_statements(): void
    {
        $sql = "CREATE TABLE t (id INT PRIMARY KEY);\nALTER TABLE t ADD COLUMN name TEXT;\nDROP TABLE t;";

        $results = $this->parser->parseMultiple($sql);

        $this->assertCount(3, $results);

        $this->assertEquals('CREATE_TABLE', $results[0]['type']);
        $this->assertEquals('ALTER_TABLE', $results[1]['type']);
        $this->assertEquals('DROP_TABLE', $results[2]['type']);
        $this->assertEquals('t', $results[2]['data']['table']);
    }

    public function test_normalize_sql_removes_comments(): void
    {
        $sql = "CREATE TABLE t (id INT) -- inline comment\n/* multi\nline */";

        $normalized = $this->parser->normalizeSql($sql);

        $this->assertStringNotContainsString('comment', $normalized);
        $this->assertStringContainsString('CREATE TABLE', $normalized);
    }

    public function test_normalize_sql_uppercases_keywords(): void
    {
        $sql = 'create table users (id int primary key)';

        $normalized = $this->parser->normalizeSql($sql);

        $this->assertStringContainsString('CREATE TABLE', $normalized);
        $this->assertStringContainsString('PRIMARY KEY', $normalized);
    }

    public function test_validate_sql_valid(): void
    {
        $sql = 'CREATE TABLE t (id INT PRIMARY KEY)';

        $validation = $this->parser->validateSql($sql);

        $this->assertTrue($validation['valid']);
        $this->assertEmpty($validation['errors']);
    }

    public function test_validate_sql_invalid_statement(): void
    {
        $sql = 'SELECT * FROM users';

        $validation = $this->parser->validateSql($sql);

        $this->assertFalse($validation['valid']);
    }

    public function test_validate_sql_unmatched_parens(): void
    {
        $sql = 'CREATE TABLE t (id INT PRIMARY KEY';

        $validation = $this->parser->validateSql($sql);

        $this->assertFalse($validation['valid']);
    }

    public function test_validate_sql_empty(): void
    {
        $validation = $this->parser->validateSql('');

        $this->assertFalse($validation['valid']);
    }

    public function test_validate_sql_unterminated_string(): void
    {
        $sql = "CREATE TABLE t (name VARCHAR(100) DEFAULT 'hello)";

        $validation = $this->parser->validateSql($sql);

        $this->assertFalse($validation['valid']);
    }

    public function test_table_options_with_clause(): void
    {
        $sql = 'CREATE TABLE t (id INT) WITH (OIDS=FALSE)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('OIDS=FALSE', $result['table_options']['with']);
    }

    public function test_table_options_tablespace(): void
    {
        $sql = 'CREATE TABLE t (id INT) TABLESPACE fast_space';

        $result = $this->parser->parse($sql);

        $this->assertEquals('fast_space', $result['table_options']['tablespace']);
    }

    public function test_table_options_on_commit(): void
    {
        $sql = 'CREATE TABLE t (id INT) ON COMMIT PRESERVE ROWS';

        $result = $this->parser->parse($sql);

        $this->assertEquals('PRESERVE ROWS', $result['table_options']['on_commit']);
    }

    public function test_parses_numeric_default_with_not_null(): void
    {
        $sql = 'CREATE TABLE t (price NUMERIC(10,2) DEFAULT 0.00 NOT NULL)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('0.00', $result['raw_columns'][0]['default']);
        $this->assertFalse($result['raw_columns'][0]['nullable']);
    }

    public function test_parses_check_with_complex_condition(): void
    {
        $sql = "CREATE TABLE t (salary NUMERIC CHECK (salary > 0 AND salary < 1000000))";

        $result = $this->parser->parse($sql);

        $this->assertEquals('(salary > 0 AND salary < 1000000)', $result['raw_columns'][0]['check']);
    }

    public function test_parses_alter_rename_table(): void
    {
        $sql = 'ALTER TABLE users RENAME TO accounts';

        $result = $this->parser->parseAlterTable($sql);

        $this->assertEquals('RENAME_TABLE', $result['operations'][0]['operation']);
        $this->assertEquals('accounts', $result['operations'][0]['new_name']);
    }

    public function test_checks_in_create_table_array(): void
    {
        $sql = 'CREATE TABLE t (a INT, b INT, CHECK (a < b), CHECK (a > 0))';

        $result = $this->parser->parse($sql);

        $this->assertCount(2, $result['checks']);
        $this->assertEquals('(a < b)', $result['checks'][0]);
        $this->assertEquals('(a > 0)', $result['checks'][1]);
    }

    public function test_parses_ddl_advanced_route_data_structure(): void
    {
        // This tests that parse() returns the expected keys including new ones
        $sql = "CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(200) NOT NULL DEFAULT 'untitled',\n  price NUMERIC(10,2) CHECK (price > 0),\n  CONSTRAINT uq_name UNIQUE (name)\n) WITH (OIDS=FALSE)";

        $result = $this->parser->parse($sql);

        $this->assertArrayHasKey('schema', $result);
        $this->assertArrayHasKey('raw_columns', $result);
        $this->assertArrayHasKey('checks', $result);
        $this->assertArrayHasKey('table_options', $result);
        $this->assertArrayHasKey('fks', $result);
        $this->assertArrayHasKey('fds_from_pk', $result);
        $this->assertArrayHasKey('fds_from_unique', $result);

        $this->assertEquals('products', $result['schema']->name);
        $this->assertEquals('SERIAL', $result['raw_columns'][0]['type']);
        $this->assertTrue($result['raw_columns'][0]['primary_key']);

        $this->assertEquals("'untitled'", $result['raw_columns'][1]['default']);
        $this->assertFalse($result['raw_columns'][1]['nullable']);

        $this->assertEquals('(price > 0)', $result['raw_columns'][2]['check']);

        $this->assertCount(1, $result['fds_from_unique']);
        $this->assertEquals('OIDS=FALSE', $result['table_options']['with']);
    }
}
