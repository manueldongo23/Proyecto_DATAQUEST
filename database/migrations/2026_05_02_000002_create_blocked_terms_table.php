<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blocked_terms', function (Blueprint $table) {
            $table->id();
            $table->string('term')->unique();
            $table->string('category', 50)->default('general');
            $table->string('severity', 20)->default('medium');
            $table->boolean('is_active')->default(true);
            $table->text('description')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->nullable();
            $table->index('category');
            $table->index('is_active');
            $table->index('term');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blocked_terms');
    }
};
