<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Attachment extends Model
{
    protected $fillable = [
        'uuid',
        'user_id',
        'inspection_id',
        'type',
        'disk',
        'path',
        'meta',
        'mime_type',
        'size',
    ];

    protected function casts(): array
    {
        return [
            'meta' => 'array',
        ];
    }

    public function inspection(): BelongsTo
    {
        return $this->belongsTo(Inspection::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
