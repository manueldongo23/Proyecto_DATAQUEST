<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use App\Domain\Services\MermaidGenerationService;
use App\Domain\Entities\RelationSchema;
use App\Domain\Entities\FunctionalDependency;

class MermaidGenerationServiceTest extends TestCase
{
    private MermaidGenerationService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new MermaidGenerationService();
    }

    public function test_generates_er_diagram(): void
    {
        $schema = new RelationSchema(
            name: 'Student',
            attributes: ['StudentID', 'Name', 'Email', 'DepartmentID'],
            functionalDependencies: [
                new FunctionalDependency(determinant: ['StudentID'], dependent: ['Name', 'Email', 'DepartmentID']),
            ]
        );

        $mermaid = $this->service->generateErDiagram($schema);

        $this->assertStringContainsString('erDiagram', $mermaid);
        $this->assertStringContainsString('Student {', $mermaid);
        $this->assertStringContainsString('int StudentID PK', $mermaid);
        $this->assertStringContainsString('varchar Name', $mermaid);
        $this->assertStringContainsString('varchar Email', $mermaid);
        $this->assertStringContainsString('StudentID', $mermaid);
    }

    public function test_generates_decomposition_flow(): void
    {
        $steps = [
            ['action' => 'Identificar dependencias funcionales'],
            ['action' => 'Separar tablas problemáticas'],
            ['action' => 'Establecer relaciones'],
        ];

        $flow = $this->service->generateDecompositionFlow($steps);

        $this->assertStringContainsString('flowchart LR', $flow);
        $this->assertStringContainsString('S0[Identificar dependencias funcionales]', $flow);
        $this->assertStringContainsString('S1[Separar tablas problemáticas]', $flow);
        $this->assertStringContainsString('S0 --> S1', $flow);
        $this->assertStringContainsString('S1 --> S2', $flow);
    }
}
