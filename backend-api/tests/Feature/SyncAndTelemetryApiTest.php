<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SyncAndTelemetryApiTest extends TestCase
{
    use RefreshDatabase;

    private function issueTokenFor(User $user): string
    {
        return $user->createToken('Pixel-USB')->plainTextToken;
    }

    public function test_batch_sync_accepts_operations_and_returns_results(): void
    {
        $user = User::factory()->create();
        $token = $this->issueTokenFor($user);

        $response = $this->withToken($token)->postJson('/api/v1/sync/batch', [
            'operations' => [
                [
                    'op' => 'upsert_inspection',
                    'client_id' => 'tmp-1',
                    'payload' => [
                        'title' => 'Generator Room',
                        'notes' => 'Noise level high',
                    ],
                ],
                [
                    'op' => 'upload_attachment',
                    'client_id' => 'tmp-2',
                    'inspection_id' => 'placeholder-id',
                    'payload' => [
                        'filename' => 'audio-note.m4a',
                    ],
                ],
            ],
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'results' => [
                    ['client_id', 'server_id', 'status'],
                ],
            ]);

        $this->assertDatabaseHas('inspections', [
            'client_id' => 'tmp-1',
            'title' => 'Generator Room',
            'status' => 'synced',
        ]);

        $this->assertDatabaseHas('sync_logs', [
            'operation' => 'upsert_inspection',
            'status' => 'ok',
        ]);
    }

    public function test_telemetry_endpoint_persists_event(): void
    {
        $user = User::factory()->create();
        $token = $this->issueTokenFor($user);

        $this->withToken($token)->postJson('/api/v1/bench/telemetry', [
            'event' => 'camera_capture_ms',
            'value' => 842,
            'platform' => 'android',
            'app_version' => '0.1.0',
            'meta' => [
                'network' => 'wifi',
            ],
        ])->assertCreated()->assertJson([
            'ok' => true,
        ]);

        $this->assertDatabaseHas('telemetry_events', [
            'event' => 'camera_capture_ms',
            'platform' => 'android',
            'app_version' => '0.1.0',
        ]);
    }
}
