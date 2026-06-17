<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\BlockedTerm;
use Illuminate\Foundation\Testing\RefreshDatabase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed blocked terms
        BlockedTerm::create(['term' => 'admin', 'category' => 'reserved_name', 'severity' => 'medium']);
        BlockedTerm::create(['term' => 'test', 'category' => 'invalid_name', 'severity' => 'low']);
    }

    public function test_user_can_register(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'correo' => 'user@example.com',
            'apodo' => 'JuanPerez',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);
    }

    public function test_register_rejects_blocked_apodo(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'correo' => 'user@example.com',
            'apodo' => 'admin',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_user_can_login(): void
    {
        User::create([
            'correo' => 'user@example.com',
            'apodo' => 'JuanPerez',
            'password_hash' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'correo' => 'user@example.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_login_with_wrong_password_fails(): void
    {
        User::create([
            'correo' => 'user@example.com',
            'apodo' => 'JuanPerez',
            'password_hash' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/auth/login', [
            'correo' => 'user@example.com',
            'password' => 'wrongpassword',
        ]);

        $response->assertStatus(422);
    }

    public function test_authenticated_user_can_access_me(): void
    {
        $user = User::create([
            'correo' => 'user@example.com',
            'apodo' => 'JuanPerez',
            'password_hash' => bcrypt('password123'),
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withHeader('Authorization', "Bearer $token")
            ->getJson('/api/auth/me');

        $response->assertStatus(200)
            ->assertJson(['success' => true]);
    }

    public function test_unauthenticated_user_cannot_access_me(): void
    {
        $response = $this->getJson('/api/auth/me');
        $response->assertStatus(401);
    }
}
