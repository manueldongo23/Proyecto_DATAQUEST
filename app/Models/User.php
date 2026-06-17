<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'correo',
        'apodo',
        'password_hash',
        'role',
        'xp',
        'rango',
        'medallas',
        'activo',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'medallas' => 'array',
        'activo' => 'boolean',
        'fecha_registro' => 'datetime',
    ];

    public const CREATED_AT = 'fecha_registro';
    public const UPDATED_AT = null;

    public function esquemas()
    {
        return $this->hasMany(Esquema::class);
    }

    public function intentosPuzzle()
    {
        return $this->hasMany(IntentoPuzzle::class);
    }

    public function participacionesReto()
    {
        return $this->hasMany(ParticipacionReto::class);
    }

    public function dominiosAprendizaje()
    {
        return $this->hasMany(DominioAprendizaje::class);
    }

    public function logros()
    {
        return $this->hasMany(LogroUsuario::class);
    }
}
