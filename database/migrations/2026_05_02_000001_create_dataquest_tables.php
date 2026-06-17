<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('correo', 100)->unique();
            $table->string('apodo', 50)->unique();
            $table->string('password_hash', 255);
            $table->string('role', 20)->default('usuario');
            $table->integer('xp')->default(0);
            $table->string('rango', 50)->default('Aprendiz');
            $table->text('medallas')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamp('fecha_registro')->useCurrent();
            $table->index('correo');
            $table->index('apodo');
        });

        Schema::create('esquemas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nombre', 100);
            $table->jsonb('estructura_json');
            $table->jsonb('dependencias_json')->nullable();
            $table->timestamp('fecha_creacion')->useCurrent();
            $table->index('user_id');
        });

        Schema::create('validaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('esquema_id')->constrained('esquemas')->cascadeOnDelete();
            $table->string('nivel_normalizacion', 10);
            $table->jsonb('violaciones_json')->nullable();
            $table->timestamp('fecha')->useCurrent();
            $table->index('esquema_id');
        });

        Schema::create('puzzles', function (Blueprint $table) {
            $table->id();
            $table->text('enunciado');
            $table->jsonb('tablas_inicial');
            $table->jsonb('df_inicial');
            $table->jsonb('solucion_esperada');
            $table->integer('nivel_dificultad')->default(1);
            $table->boolean('activo')->default(true);
        });

        Schema::create('intentos_puzzle', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('puzzle_id')->constrained('puzzles')->cascadeOnDelete();
            $table->integer('puntuacion');
            $table->timestamp('fecha')->useCurrent();
            $table->index('user_id');
            $table->index('puzzle_id');
        });

        Schema::create('retos_semanales', function (Blueprint $table) {
            $table->id();
            $table->text('descripcion');
            $table->jsonb('tablas');
            $table->jsonb('df');
            $table->date('fecha_inicio');
            $table->date('fecha_fin');
            $table->boolean('activo')->default(true);
            // CHECK constraint for date range (via raw SQL since Laravel doesn't support check() on columns directly)
            // DB::statement('ALTER TABLE retos_semanales ADD CONSTRAINT chk_fecha_fin CHECK (fecha_fin >= fecha_inicio)');
        });

        Schema::create('participaciones_reto', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reto_id')->constrained('retos_semanales')->cascadeOnDelete();
            $table->integer('puntuacion');
            $table->integer('tiempo_segundos');
            $table->timestamp('fecha')->useCurrent();
            $table->index('user_id');
            $table->index('reto_id');
        });

        Schema::create('logs_sistema', function (Blueprint $table) {
            $table->id();
            $table->string('tipo', 20);
            $table->text('mensaje');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fecha')->useCurrent();
            $table->index('fecha');
            $table->index('user_id');
        });

        Schema::create('dominios_aprendizaje', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('concepto', 20); // 'DF', '1FN', '2FN', '3FN', 'BCNF'
            $table->integer('porcentaje')->default(0);
            $table->timestamps();
            $table->unique(['user_id', 'concepto']);
        });

        Schema::create('logros_usuario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('medalla_nombre', 100);
            $table->timestamp('desbloqueado_en')->useCurrent();
            $table->timestamps();
            $table->unique(['user_id', 'medalla_nombre']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('logros_usuario');
        Schema::dropIfExists('dominios_aprendizaje');
        Schema::dropIfExists('logs_sistema');
        Schema::dropIfExists('participaciones_reto');
        Schema::dropIfExists('retos_semanales');
        Schema::dropIfExists('intentos_puzzle');
        Schema::dropIfExists('puzzles');
        Schema::dropIfExists('validaciones');
        Schema::dropIfExists('esquemas');
        Schema::dropIfExists('users');
    }
};
