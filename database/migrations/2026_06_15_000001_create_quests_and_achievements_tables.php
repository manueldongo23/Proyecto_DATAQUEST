<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quests', function (Blueprint $table) {
            $table->id();
            $table->string('title', 200);
            $table->text('description');
            $table->string('quest_type', 20);
            $table->integer('difficulty');
            $table->integer('xp_reward');
            $table->string('nf_requirement', 10)->nullable();
            $table->jsonb('initial_schema_json')->nullable();
            $table->jsonb('expected_solution_json')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index('quest_type');
            $table->index('difficulty');
            $table->index('is_active');
        });

        Schema::create('quest_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('quest_id')->constrained('quests')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status', 20)->default('started');
            $table->integer('score')->nullable();
            $table->integer('xp_earned')->nullable();
            $table->integer('hints_used')->default(0);
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->index(['quest_id', 'user_id']);
            $table->index('status');
        });

        Schema::create('achievements', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->text('description');
            $table->string('icon', 100);
            $table->integer('xp_reward');
            $table->string('criteria_type', 50);
            $table->integer('criteria_value');
            $table->timestamps();
        });

        Schema::create('user_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('achievement_id')->constrained('achievements')->cascadeOnDelete();
            $table->timestamp('unlocked_at')->useCurrent();
            $table->timestamps();
            $table->unique(['user_id', 'achievement_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_achievements');
        Schema::dropIfExists('achievements');
        Schema::dropIfExists('quest_attempts');
        Schema::dropIfExists('quests');
    }
};
