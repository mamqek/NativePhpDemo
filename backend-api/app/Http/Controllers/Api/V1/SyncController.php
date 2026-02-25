<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BatchSyncRequest;
use App\Models\Inspection;
use App\Models\SyncLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;
use Throwable;

class SyncController extends Controller
{
    public function batch(BatchSyncRequest $request): JsonResponse
    {
        $results = [];
        $user = $request->user();

        foreach ($request->validated('operations') as $operation) {
            $op = $operation['op'];
            $clientId = $operation['client_id'] ?? null;
            $payload = $operation['payload'] ?? [];
            $inspectionUuid = $operation['inspection_id'] ?? null;

            try {
                if ($op === 'upsert_inspection') {
                    $resolvedClientId = $clientId ?: ($payload['client_id'] ?? null);
                    if ($resolvedClientId) {
                        $inspection = Inspection::query()
                            ->firstOrNew([
                                'user_id' => $user->id,
                                'client_id' => $resolvedClientId,
                            ]);
                    } else {
                        $inspection = new Inspection([
                            'user_id' => $user->id,
                        ]);
                    }

                    if (! $inspection->exists) {
                        $inspection->uuid = (string) Str::uuid();
                    }

                    $inspection->fill([
                        'client_id' => $resolvedClientId,
                        'title' => $payload['title'] ?? 'Untitled inspection',
                        'notes' => $payload['notes'] ?? null,
                        'status' => 'synced',
                        'captured_at' => $payload['captured_at'] ?? null,
                        'device_info' => $payload['device_info'] ?? [],
                        'synced_at' => now(),
                    ]);
                    $inspection->save();

                    $results[] = [
                        'client_id' => $clientId,
                        'server_id' => $inspection->uuid,
                        'status' => 'ok',
                    ];

                    SyncLog::query()->create([
                        'user_id' => $user->id,
                        'operation' => $op,
                        'client_id' => $clientId,
                        'inspection_id' => $inspection->id,
                        'payload' => $payload,
                        'status' => 'ok',
                        'processed_at' => now(),
                    ]);

                    continue;
                }

                if ($op === 'upload_attachment') {
                    $inspection = null;
                    if ($inspectionUuid) {
                        $inspection = Inspection::query()
                            ->where('user_id', $user->id)
                            ->where('uuid', $inspectionUuid)
                            ->first();
                    }

                    $results[] = [
                        'client_id' => $clientId,
                        'server_id' => $inspection?->uuid ?? $inspectionUuid,
                        'status' => 'ok',
                    ];

                    SyncLog::query()->create([
                        'user_id' => $user->id,
                        'operation' => $op,
                        'client_id' => $clientId,
                        'inspection_id' => $inspection?->id,
                        'payload' => $payload,
                        'status' => 'ok',
                        'processed_at' => now(),
                    ]);

                    continue;
                }
            } catch (Throwable $exception) {
                $results[] = [
                    'client_id' => $clientId,
                    'server_id' => null,
                    'status' => 'failed',
                ];

                SyncLog::query()->create([
                    'user_id' => $user->id,
                    'operation' => $op,
                    'client_id' => $clientId,
                    'payload' => $payload,
                    'status' => 'failed',
                    'error' => $exception->getMessage(),
                    'processed_at' => now(),
                ]);
            }
        }

        return response()->json([
            'results' => $results,
        ]);
    }
}
