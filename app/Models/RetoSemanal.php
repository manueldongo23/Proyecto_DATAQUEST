<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RetoSemanal extends Model
{
    protected $table = 'retos_semanales';

    protected $fillable = [
        'descripcion',
        'tablas',
        'df',
        'fecha_inicio',
        'fecha_fin',
        'activo',
    ];

    protected $casts = [
        'tablas' => 'array',
        'df' => 'array',
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
        'activo' => 'boolean',
    ];

    public $timestamps = false;

    public function participaciones()
    {
        return $this->hasMany(ParticipacionReto::class, 'reto_id');
    }
}
