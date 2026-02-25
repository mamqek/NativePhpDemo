<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TelemetryEvent extends Model
{
    protected $fillable = [
        'user_id',
        'event',
        'value',
        'platform',
        'app_version',
        'meta',
        'recorded_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'meta' => 'array',
            'recorded_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
