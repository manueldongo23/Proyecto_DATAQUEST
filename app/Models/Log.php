<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Log extends Model
{
    protected $table = 'logs_sistema';

    protected $fillable = [
        'tipo',
        'mensaje',
        'user_id',
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
}
