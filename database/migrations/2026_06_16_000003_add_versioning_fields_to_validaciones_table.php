<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('validaciones', function (Blueprint $table) {
            $table->unsignedInteger('version_number')->nullable()->after('esquema_id');
            $table->string('version_label', 30)->nullable()->after('version_number');
            $table->string('estado', 30)->nullable()->after('version_label');
            $table->string('target_nf', 10)->nullable()->after('estado');
            $table->string('engine', 20)->nullable()->after('target_nf');
            $table->string('mode', 20)->nullable()->after('engine');
            $table->jsonb('analysis_json')->nullable()->after('violaciones_json');
            $table->jsonb('decomposition_json')->nullable()->after('analysis_json');
            $table->jsonb('snapshot_json')->nullable()->after('decomposition_json');
            $table->jsonb('changes_json')->nullable()->after('snapshot_json');
            $table->longText('sql_generado')->nullable()->after('changes_json');
        });
    }

    public function down(): void
    {
        Schema::table('validaciones', function (Blueprint $table) {
            $table->dropColumn([
                'version_number',
                'version_label',
                'estado',
                'target_nf',
                'engine',
                'mode',
                'analysis_json',
                'decomposition_json',
                'snapshot_json',
                'changes_json',
                'sql_generado',
            ]);
        });
    }
};
