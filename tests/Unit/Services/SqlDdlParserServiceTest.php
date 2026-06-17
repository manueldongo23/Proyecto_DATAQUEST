<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\SqlDdlParserService;

class SqlDdlParserServiceTest extends TestCase
{
    private SqlDdlParserService $parser;

    protected function setUp(): void
    {
        parent::setUp();
        $this->parser = new SqlDdlParserService();
    }

    public function test_parses_simple_create_table(): void
    {
        $sql = 'CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(255) UNIQUE)';

        $result = $this->parser->parse($sql);

        $this->assertEquals('students', $result['schema']->name);
        $this->assertEquals(['id', 'name', 'email'], $result['schema']->attributes);
        $this->assertCount(1, $result['fds_from_pk']);
        $this->assertCount(1, $result['fds_from_unique']);

        // PK FD: id -> name, email
        $this->assertEquals(['id'], $result['fds_from_pk'][0]->determinant);
        $this->assertEquals(['name', 'email'], $result['fds_from_pk'][0]->dependent);

        // Unique FD: email -> id, name
        $this->assertEquals(['email'], $result['fds_from_unique'][0]->determinant);
        $this->assertEquals(['id', 'name'], $result['fds_from_unique'][0]->dependent);
    }

    public function test_parses_composite_primary_key(): void
    {
        $sql = 'CREATE TABLE enrollments (student_id INT, course_id INT, grade TEXT, PRIMARY KEY (student_id, course_id))';

        $result = $this->parser->parse($sql);

        $this->assertEquals('enrollments', $result['schema']->name);
        $this->assertEquals(['student_id', 'course_id', 'grade'], $result['schema']->attributes);
        $this->assertCount(1, $result['fds_from_pk']);
        $this->assertCount(0, $result['fds_from_unique']);

        $this->assertEquals(['student_id', 'course_id'], $result['fds_from_pk'][0]->determinant);
        $this->assertEquals(['grade'], $result['fds_from_pk'][0]->dependent);
    }

    public function test_parses_foreign_key(): void
    {
        $sql = 'CREATE TABLE students (id INT PRIMARY KEY, name VARCHAR(100), department_id INT REFERENCES departments(id))';

        $result = $this->parser->parse($sql);

        $this->assertCount(1, $result['fks']);
        $this->assertEquals(['department_id'], $result['fks'][0]['columns']);
        $this->assertEquals('departments', $result['fks'][0]['referenced_table']);
        $this->assertEquals(['id'], $result['fks'][0]['referenced_columns']);
    }

    public function test_parses_foreign_key_table_level(): void
    {
        $sql = 'CREATE TABLE enrollments (student_id INT, course_id INT, PRIMARY KEY (student_id, course_id), FOREIGN KEY (student_id) REFERENCES students(id), FOREIGN KEY (course_id) REFERENCES courses(id))';

        $result = $this->parser->parse($sql);

        $this->assertCount(2, $result['fks']);

        $this->assertEquals(['student_id'], $result['fks'][0]['columns']);
        $this->assertEquals('students', $result['fks'][0]['referenced_table']);
        $this->assertEquals(['id'], $result['fks'][0]['referenced_columns']);

        $this->assertEquals(['course_id'], $result['fks'][1]['columns']);
        $this->assertEquals('courses', $result['fks'][1]['referenced_table']);
        $this->assertEquals(['id'], $result['fks'][1]['referenced_columns']);
    }

    public function test_parses_unique_constraint(): void
    {
        $sql = 'CREATE TABLE users (id INT, username VARCHAR(50), email VARCHAR(255), UNIQUE (username), UNIQUE (email))';

        $result = $this->parser->parse($sql);

        $this->assertCount(2, $result['fds_from_unique']);
        $this->assertEquals(['username'], $result['fds_from_unique'][0]->determinant);
        $this->assertEquals(['id', 'email'], $result['fds_from_unique'][0]->dependent);
        $this->assertEquals(['email'], $result['fds_from_unique'][1]->determinant);
        $this->assertEquals(['id', 'username'], $result['fds_from_unique'][1]->dependent);
    }

    public function test_handles_malformed_sql(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->parser->parse('SELECT * FROM users');
    }

    public function test_parses_with_if_not_exists(): void
    {
        $sql = 'CREATE TABLE IF NOT EXISTS students (id INT PRIMARY KEY, name VARCHAR(100))';

        $result = $this->parser->parse($sql);

        $this->assertEquals('students', $result['schema']->name);
    }

    public function test_parses_multi_line_sql(): void
    {
        $sql = "CREATE TABLE students (\n    id INT PRIMARY KEY,\n    name VARCHAR(100) NOT NULL,\n    email VARCHAR(255) UNIQUE\n)";

        $result = $this->parser->parse($sql);

        $this->assertEquals('students', $result['schema']->name);
        $this->assertCount(3, $result['raw_columns']);
    }

    public function test_removes_sql_comments(): void
    {
        $sql = "CREATE TABLE students (\n    -- this is a comment\n    id INT PRIMARY KEY,\n    /* another comment */\n    name VARCHAR(100)\n)";

        $result = $this->parser->parse($sql);

        $this->assertEquals('students', $result['schema']->name);
        $this->assertEquals(['id', 'name'], $result['schema']->attributes);
    }

    public function test_parses_column_nullable(): void
    {
        $sql = 'CREATE TABLE test (id INT PRIMARY KEY, name VARCHAR(100) NOT NULL, description TEXT NULL)';

        $result = $this->parser->parse($sql);

        $this->assertFalse($result['raw_columns'][1]['nullable']);
        $this->assertTrue($result['raw_columns'][2]['nullable']);
    }

    public function test_parses_empty_definition_creates_no_columns(): void
    {
        $sql = 'CREATE TABLE empty_table (id INT)';

        $result = $this->parser->parse($sql);

        $this->assertCount(1, $result['raw_columns']);
        $this->assertEquals('id', $result['raw_columns'][0]['name']);
    }
}
