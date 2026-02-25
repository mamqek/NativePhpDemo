<?php

namespace Database\Seeders;

use App\Models\Inspection;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $user = User::query()->updateOrCreate([
            'email' => 'user@example.com',
        ], [
            'name' => 'NativePHP Demo User',
            'password' => 'secret1234',
        ]);

        Inspection::query()->updateOrCreate([
            'uuid' => '11111111-1111-1111-1111-111111111111',
        ], [
            'user_id' => $user->id,
            'client_id' => 'seed-001',
            'title' => 'Boiler Room',
            'notes' => 'Baseline seed inspection to verify API list rendering.',
            'status' => 'synced',
            'captured_at' => now()->subHour(),
            'device_info' => [
                'model' => 'Seed Emulator',
                'os' => 'android',
            ],
            'synced_at' => now()->subMinutes(50),
        ]);

        Inspection::query()->updateOrCreate([
            'uuid' => '22222222-2222-2222-2222-222222222222',
        ], [
            'user_id' => $user->id,
            'client_id' => 'seed-002',
            'title' => 'Warehouse',
            'notes' => 'Draft inspection for offline queue test.',
            'status' => 'draft',
            'captured_at' => now()->subMinutes(30),
            'device_info' => [
                'model' => 'Seed Emulator',
                'os' => 'ios',
            ],
        ]);
    }
}
