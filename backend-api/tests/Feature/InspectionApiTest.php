<?php

namespace Tests\Feature;

use App\Models\Attachment;
use App\Models\Inspection;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class InspectionApiTest extends TestCase
{
    use RefreshDatabase;

    private function issueTokenFor(User $user): string
    {
        return $user->createToken('Pixel-USB')->plainTextToken;
    }

    public function test_can_create_inspection(): void
    {
        $user = User::factory()->create();
        $token = $this->issueTokenFor($user);

        $response = $this->withToken($token)->postJson('/api/v1/inspections', [
            'title' => 'Boiler Room',
            'notes' => 'Pressure gauge looked unstable',
            'captured_at' => now()->toISOString(),
            'device_info' => [
                'model' => 'Pixel 8',
                'os' => 'android',
            ],
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'data' => ['id', 'status'],
            ]);
    }

    public function test_can_list_inspections(): void
    {
        $user = User::factory()->create();
        $token = $this->issueTokenFor($user);

        Inspection::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'title' => 'Warehouse',
            'status' => 'draft',
        ]);

        $this->withToken($token)
            ->getJson('/api/v1/inspections')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    ['id', 'title', 'status', 'updated_at'],
                ],
            ]);
    }

    public function test_can_upload_attachment_to_inspection(): void
    {
        Storage::fake('public');

        $user = User::factory()->create();
        $token = $this->issueTokenFor($user);

        $inspection = Inspection::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $user->id,
            'title' => 'Pump Station',
            'status' => 'draft',
        ]);

        $response = $this->withToken($token)->post('/api/v1/inspections/'.$inspection->uuid.'/attachments', [
            'type' => 'photo',
            'file' => UploadedFile::fake()->image('leak.jpg'),
            'meta' => json_encode(['camera' => 'rear']),
        ], [
            'Accept' => 'application/json',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.type', 'photo');

        $attachment = Attachment::query()->firstOrFail();
        Storage::disk('public')->assertExists($attachment->path);
    }
}
