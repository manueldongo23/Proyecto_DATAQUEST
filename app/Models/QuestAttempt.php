<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestAttempt extends Model
{
    protected $fillable = [
        'quest_id',
        'user_id',
        'status',
        'score',
        'xp_earned',
        'hints_used',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'score' => 'integer',
        'xp_earned' => 'integer',
        'hints_used' => 'integer',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function quest()
    {
        return $this->belongsTo(Quest::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    public function isCompleted(): bool
    {
        return $this->status === 'completed';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }
}
