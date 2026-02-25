<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inspection extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'client_id',
        'title',
        'notes',
        'status',
        'captured_at',
        'device_info',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'captured_at' => 'datetime',
            'device_info' => 'array',
            'synced_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(Attachment::class);
    }
}
