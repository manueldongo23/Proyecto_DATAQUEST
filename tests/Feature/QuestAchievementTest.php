<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Quest;
use App\Models\Achievement;
use App\Models\QuestAttempt;
use App\Models\UserAchievement;
use Database\Seeders\QuestAndAchievementSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

class QuestAchievementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(QuestAndAchievementSeeder::class);
    }

    public function test_lists_quests(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->getJson('/api/quests');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    'data' => [
                        '*' => ['id', 'title', 'description', 'quest_type', 'difficulty', 'xp_reward', 'nf_requirement'],
                    ],
                ],
            ]);

        $this->assertCount(5, $response->json('data.data'));
    }

    public function test_quest_can_be_started(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;
        $quest = Quest::first();

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson("/api/quests/{$quest->id}/start");

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'message' => 'Quest iniciada correctamente.',
            ]);

        $this->assertDatabaseHas('quest_attempts', [
            'quest_id' => $quest->id,
            'user_id' => $user->id,
            'status' => 'started',
        ]);
    }

    public function test_achievements_list_returns_success(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->getJson('/api/achievements');

        $response->assertStatus(200)
            ->assertJson([
                'success' => true,
            ])
            ->assertJsonStructure([
                'success',
                'data' => [
                    '*' => ['id', 'name', 'description', 'icon', 'xp_reward', 'criteria_type', 'criteria_value', 'unlocked'],
                ],
            ]);

        $this->assertCount(8, $response->json('data'));
    }
}
