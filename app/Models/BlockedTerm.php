<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BlockedTerm extends Model
{
    protected $table = 'blocked_terms';

    protected $fillable = [
        'term',
        'category',
        'severity',
        'is_active',
        'description',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public const CREATED_AT = 'created_at';
    public const UPDATED_AT = 'updated_at';

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
