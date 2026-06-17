<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IntentoPuzzle extends Model
{
    protected $table = 'intentos_puzzle';

    protected $fillable = [
        'user_id',
        'puzzle_id',
        'puntuacion',
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

    public function puzzle()
    {
        return $this->belongsTo(Puzzle::class);
    }
}
