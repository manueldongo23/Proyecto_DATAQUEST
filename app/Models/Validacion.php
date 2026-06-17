<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Validacion extends Model
{
    protected $table = 'validaciones';

    protected $fillable = [
        'esquema_id',
        'version_number',
        'version_label',
        'estado',
        'target_nf',
        'engine',
        'mode',
        'nivel_normalizacion',
        'violaciones_json',
        'analysis_json',
        'decomposition_json',
        'snapshot_json',
        'changes_json',
        'sql_generado',
    ];

    protected $casts = [
        'violaciones_json' => 'array',
        'analysis_json' => 'array',
        'decomposition_json' => 'array',
        'snapshot_json' => 'array',
        'changes_json' => 'array',
        'fecha' => 'datetime',
    ];

    public const CREATED_AT = 'fecha';
    public const UPDATED_AT = null;

    public function esquema()
    {
        return $this->belongsTo(Esquema::class);
    }
}
