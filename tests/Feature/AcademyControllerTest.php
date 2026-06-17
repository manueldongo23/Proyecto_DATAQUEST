<?php

namespace Tests\Feature;

use Tests\TestCase;

class AcademyControllerTest extends TestCase
{
    public function test_learning_path_returns_success(): void
    {
        $response = $this->getJson('/api/academy');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'data' => ['normal_forms', 'total', 'learning_path']
            ]);
    }

    public function test_explain_valid_nf_returns_success(): void
    {
        $response = $this->getJson('/api/academy/explain/1FN');

        $response->assertStatus(200)
            ->assertJson(['success' => true])
            ->assertJsonStructure([
                'data' => ['title', 'description', 'rules']
            ]);
    }

    public function test_explain_invalid_nf_returns_404(): void
    {
        $response = $this->getJson('/api/academy/explain/INVALID');

        $response->assertStatus(404)
            ->assertJson(['success' => false]);
    }
}
