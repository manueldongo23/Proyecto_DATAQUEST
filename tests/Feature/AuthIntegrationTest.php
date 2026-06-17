<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\BlockedTerm;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AuthIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        BlockedTerm::create(['term' => 'admin', 'category' => 'reserved_name', 'severity' => 'medium']);
        BlockedTerm::create(['term' => 'test', 'category' => 'invalid_name', 'severity' => 'low']);
    }

    public function test_complete_auth_flow(): void
    {
        $registerResponse = $this->postJson('/api/auth/register', [
            'correo' => 'flow@example.com',
            'apodo' => 'FlowUser',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $registerResponse->assertStatus(201)
            ->assertJson(['success' => true]);

        $token = $registerResponse->json('access_token');
        $this->assertNotNull($token);

        $meResponse = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/auth/me');

        $meResponse->assertStatus(200)
            ->assertJson(['success' => true]);

        $logoutResponse = $this->withHeader('Authorization', "Bearer $token")
            ->postJson('/api/auth/logout');

        $logoutResponse->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_register_with_blocked_apodo_fails(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'correo' => 'blocked@example.com',
            'apodo' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_login_wrong_credentials_fails(): void
    {
        $response = $this->postJson('/api/auth/login', [
            'correo' => 'nonexistent@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422);
    }

    public function test_protected_route_without_token_fails(): void
    {
        $response = $this->getJson('/api/auth/me');
        $response->assertStatus(401);
    }
}
