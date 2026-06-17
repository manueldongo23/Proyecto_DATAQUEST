<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\DbmlGenerationService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class DbmlGenerationServiceTest extends TestCase
{
    private DbmlGenerationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new DbmlGenerationService();
    }

    public function test_generates_dbml_for_basic_schema(): void
    {
        $schema = new RelationSchema(
            name: 'Student',
            attributes: ['StudentID', 'Name', 'Email'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name', 'Email']),
            ]
        );

        $dbml = $this->service->generate($schema);

        $this->assertStringContainsString('Table Student {', $dbml);
        $this->assertStringContainsString('StudentID', $dbml);
        $this->assertStringContainsString('[pk, not null]', $dbml);
        $this->assertStringContainsString('Name', $dbml);
        $this->assertStringContainsString('Email', $dbml);
    }

    public function test_generates_dbml_with_foreign_keys(): void
    {
        $schema = new RelationSchema(
            name: 'Student',
            attributes: ['StudentID', 'Name', 'DepartmentID'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name', 'DepartmentID']),
            ]
        );

        $dbml = $this->service->generate($schema);

        $this->assertStringContainsString('Ref: Student.DepartmentID > Department.DepartmentID', $dbml);
        $this->assertStringContainsString('DepartmentID INT [not null]', $dbml);
    }

    public function test_generates_dbml_with_multiple_tables(): void
    {
        $schemas = [
            new RelationSchema(
                name: 'Student',
                attributes: ['StudentID', 'Name'],
                functionalDependencies: [
                    new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name']),
                ]
            ),
            new RelationSchema(
                name: 'Course',
                attributes: ['CourseID', 'Title'],
                functionalDependencies: [
                    new FunctionalDependency(determinant: ['CourseID'], dependent: ['Title']),
                ]
            ),
        ];

        $dbml = $this->service->generateMultiple($schemas);

        $this->assertStringContainsString('Table Student {', $dbml);
        $this->assertStringContainsString('Table Course {', $dbml);
        $this->assertStringContainsString('StudentID INT [pk, not null]', $dbml);
        $this->assertStringContainsString('CourseID INT [pk, not null]', $dbml);
    }
}
