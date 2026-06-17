<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Puzzle extends Model
{
    protected $fillable = [
        'enunciado',
        'tablas_inicial',
        'df_inicial',
        'solucion_esperada',
        'nivel_dificultad',
        'activo',
    ];

    protected $casts = [
        'tablas_inicial' => 'array',
        'df_inicial' => 'array',
        'solucion_esperada' => 'array',
        'activo' => 'boolean',
    ];

    public $timestamps = false;

    public function intentos()
    {
        return $this->hasMany(IntentoPuzzle::class);
    }
}
