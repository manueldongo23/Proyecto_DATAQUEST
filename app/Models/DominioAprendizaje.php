<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DominioAprendizaje extends Model
{
    protected $table = 'dominios_aprendizaje';

    protected $fillable = [
        'user_id',
        'concepto',
        'porcentaje',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
