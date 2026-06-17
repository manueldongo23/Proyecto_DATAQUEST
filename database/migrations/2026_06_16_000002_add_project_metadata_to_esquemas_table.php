<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('esquemas', function (Blueprint $table) {
            $table->text('descripcion')->nullable()->after('nombre');
            $table->timestamp('archived_at')->nullable()->after('fecha_creacion');
        });
    }

    public function down(): void
    {
        Schema::table('esquemas', function (Blueprint $table) {
            $table->dropColumn(['descripcion', 'archived_at']);
        });
    }
};
