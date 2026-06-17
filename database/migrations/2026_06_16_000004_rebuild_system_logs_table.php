<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('logs_sistema') || Schema::getConnection()->getDriverName() !== 'sqlite') {
            return;
        }

        Schema::disableForeignKeyConstraints();
        if (Schema::hasTable('logs_sistema_legacy')) {
            Schema::drop('logs_sistema');
        } else {
            Schema::rename('logs_sistema', 'logs_sistema_legacy');
        }

        $this->dropSqliteIndexIfExists('logs_sistema_fecha_index');
        $this->dropSqliteIndexIfExists('logs_sistema_user_id_index');

        Schema::create('logs_sistema', function (Blueprint $table) {
            $table->id();
            $table->string('tipo', 20);
            $table->text('mensaje');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('fecha')->useCurrent();
            $table->index('fecha');
            $table->index('user_id');
        });

        foreach (DB::table('logs_sistema_legacy')->orderBy('id')->get() as $row) {
            DB::table('logs_sistema')->insert([
                'id' => $row->id,
                'tipo' => $row->tipo,
                'mensaje' => $row->mensaje,
                'user_id' => $row->user_id,
                'fecha' => $row->fecha,
            ]);
        }

        Schema::drop('logs_sistema_legacy');
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        if (!Schema::hasTable('logs_sistema') || Schema::getConnection()->getDriverName() !== 'sqlite') {
            return;
        }

        Schema::disableForeignKeyConstraints();
        if (Schema::hasTable('logs_sistema_current')) {
            Schema::drop('logs_sistema');
        } else {
            Schema::rename('logs_sistema', 'logs_sistema_current');
        }

        $this->dropSqliteIndexIfExists('logs_sistema_fecha_index');
        $this->dropSqliteIndexIfExists('logs_sistema_user_id_index');

        DB::statement(
            "CREATE TABLE logs_sistema (
                id integer primary key autoincrement not null,
                tipo varchar check (tipo in ('error', 'evento', 'admin_accion')) not null,
                mensaje text not null,
                user_id integer,
                fecha datetime not null default CURRENT_TIMESTAMP,
                foreign key(user_id) references users(id) on delete set null
            )"
        );
        DB::statement('CREATE INDEX logs_sistema_fecha_index ON logs_sistema (fecha)');
        DB::statement('CREATE INDEX logs_sistema_user_id_index ON logs_sistema (user_id)');

        foreach (DB::table('logs_sistema_current')->orderBy('id')->get() as $row) {
            $storedType = in_array($row->tipo, ['error', 'evento', 'admin_accion'], true) ? $row->tipo : 'evento';
            $storedMessage = $storedType === $row->tipo ? $row->mensaje : sprintf('[%s] %s', $row->tipo, $row->mensaje);

            DB::table('logs_sistema')->insert([
                'id' => $row->id,
                'tipo' => $storedType,
                'mensaje' => $storedMessage,
                'user_id' => $row->user_id,
                'fecha' => $row->fecha,
            ]);
        }

        Schema::drop('logs_sistema_current');
        Schema::enableForeignKeyConstraints();
    }

    private function dropSqliteIndexIfExists(string $indexName): void
    {
        $exists = DB::table('sqlite_master')
            ->where('type', 'index')
            ->where('name', $indexName)
            ->exists();

        if ($exists) {
            DB::statement(sprintf('DROP INDEX %s', $indexName));
        }
    }
};
