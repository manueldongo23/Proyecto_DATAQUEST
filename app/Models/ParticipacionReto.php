<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ParticipacionReto extends Model
{
    protected $table = 'participaciones_reto';

    protected $fillable = [
        'user_id',
        'reto_id',
        'puntuacion',
        'tiempo_segundos',
    ];

    protected $casts = [
        'fecha' => 'datetime',
    ];

    public const CREATED_AT = 'fecha';
    public const UPDATED_AT = null;

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function retoSemanal()
    {
        return $this->belongsTo(RetoSemanal::class, 'reto_id');
    }
}
