<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LogroUsuario extends Model
{
    protected $table = 'logros_usuario';

    protected $fillable = [
        'user_id',
        'medalla_nombre',
    ];

    public $timestamps = true;
    const CREATED_AT = 'desbloqueado_en';
    const UPDATED_AT = 'updated_at';

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
