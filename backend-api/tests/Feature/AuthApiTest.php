<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_and_user_payload(): void
    {
        User::query()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => 'secret1234',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.com',
            'password' => 'secret1234',
            'device_name' => 'Pixel-USB',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'token',
                'user' => ['id', 'name', 'email'],
            ]);
    }

    public function test_login_rejects_invalid_credentials(): void
    {
        User::query()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => 'secret1234',
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'user@example.com',
            'password' => 'wrong-password',
            'device_name' => 'Pixel-USB',
        ]);

        $response->assertUnauthorized();
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
    }

    public function test_logout_revokes_current_token(): void
    {
        $user = User::query()->create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => 'secret1234',
        ]);

        $plainTextToken = $user->createToken('Pixel-USB')->plainTextToken;
        $tokenId = explode('|', $plainTextToken)[0];

        $this->withToken($plainTextToken)
            ->postJson('/api/v1/auth/logout')
            ->assertOk()
            ->assertJson([
                'ok' => true,
            ]);

        $this->assertNull(PersonalAccessToken::find($tokenId));
    }
}
