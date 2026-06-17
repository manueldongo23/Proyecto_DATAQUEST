<?php

namespace Tests\Feature;

use Tests\TestCase;

class SchemaValidationTest extends TestCase
{
    public function test_validate_schema_returns_success(): void
    {
        $response = $this->postJson('/api/validate-schema', [
            'table_name' => 'Student',
            'attributes' => ['StudentID', 'Name', 'Email'],
            'dependencies' => [
                ['determinant' => ['StudentID'], 'dependent' => ['Name', 'Email']],
            ],
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_validate_schema_rejects_empty_attributes(): void
    {
        $response = $this->postJson('/api/validate-schema', [
            'table_name' => 'Test',
            'attributes' => [],
            'dependencies' => [],
        ]);

        $response->assertStatus(422);
    }

    public function test_health_endpoint_works(): void
    {
        $response = $this->getJson('/api/health');
        $response->assertStatus(200)
            ->assertJsonStructure([
                'app', 'version', 'status', 'checks' => ['database', 'cache']
            ]);
    }
}
