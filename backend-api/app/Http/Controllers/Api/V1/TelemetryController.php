<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreTelemetryRequest;
use App\Models\TelemetryEvent;
use Illuminate\Http\JsonResponse;

class TelemetryController extends Controller
{
    public function store(StoreTelemetryRequest $request): JsonResponse
    {
        TelemetryEvent::query()->create([
            'user_id' => $request->user()?->id,
            'event' => $request->validated('event'),
            'value' => $request->validated('value'),
            'platform' => $request->validated('platform'),
            'app_version' => $request->validated('app_version'),
            'meta' => $request->validated('meta'),
            'recorded_at' => now(),
        ]);

        return response()->json([
            'ok' => true,
        ], 201);
    }
}
