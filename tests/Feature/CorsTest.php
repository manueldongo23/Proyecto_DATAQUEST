<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsTest extends TestCase
{
    public function test_cors_headers_on_api_request(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
        ])->getJson('/api/health');

        $response->assertStatus(200)
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
    }

    public function test_cors_preflight_is_handled(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
        ])->options('/api/auth/login');

        $response->assertStatus(204)
            ->assertHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    }
}
