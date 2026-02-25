<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\InspectionController;
use App\Http\Controllers\Api\V1\SyncController;
use App\Http\Controllers\Api\V1\TelemetryController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::post('/auth/login', [AuthController::class, 'login']);

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/me', [AuthController::class, 'me']);

        Route::get('/inspections', [InspectionController::class, 'index']);
        Route::post('/inspections', [InspectionController::class, 'store']);
        Route::post('/inspections/{inspection}/attachments', [InspectionController::class, 'uploadAttachment']);

        Route::post('/sync/batch', [SyncController::class, 'batch']);
        Route::post('/bench/telemetry', [TelemetryController::class, 'store']);
    });
});
