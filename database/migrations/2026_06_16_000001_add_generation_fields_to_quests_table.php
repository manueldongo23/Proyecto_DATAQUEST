<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('quests', function (Blueprint $table) {
            $table->string('quest_key', 150)->nullable()->unique()->after('id');
            $table->string('generation_source', 50)->nullable()->index()->after('quest_key');
            $table->integer('catalog_order')->default(0)->index()->after('generation_source');
            $table->jsonb('generation_context')->nullable()->after('expected_solution_json');
        });
    }

    public function down(): void
    {
        Schema::table('quests', function (Blueprint $table) {
            $table->dropUnique(['quest_key']);
            $table->dropIndex(['generation_source']);
            $table->dropIndex(['catalog_order']);
            $table->dropColumn(['quest_key', 'generation_source', 'catalog_order', 'generation_context']);
        });
    }
};
