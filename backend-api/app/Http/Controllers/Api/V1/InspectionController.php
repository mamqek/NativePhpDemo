<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\StoreInspectionRequest;
use App\Http\Requests\Api\V1\UploadAttachmentRequest;
use App\Models\Attachment;
use App\Models\Inspection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class InspectionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $inspections = Inspection::query()
            ->where('user_id', $request->user()->id)
            ->latest('updated_at')
            ->get()
            ->map(fn (Inspection $inspection) => [
                'id' => $inspection->uuid,
                'title' => $inspection->title,
                'status' => $inspection->status,
                'updated_at' => $inspection->updated_at?->toISOString(),
            ]);

        return response()->json([
            'data' => $inspections,
        ]);
    }

    public function store(StoreInspectionRequest $request): JsonResponse
    {
        $inspection = Inspection::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'client_id' => $request->validated('client_id'),
            'title' => $request->validated('title'),
            'notes' => $request->validated('notes'),
            'status' => $request->validated('status', 'draft'),
            'captured_at' => $request->validated('captured_at'),
            'device_info' => $request->validated('device_info', []),
            'synced_at' => $request->validated('status') === 'synced' ? now() : null,
        ]);

        return response()->json([
            'data' => [
                'id' => $inspection->uuid,
                'status' => $inspection->status,
            ],
        ], 201);
    }

    public function uploadAttachment(UploadAttachmentRequest $request, Inspection $inspection): JsonResponse
    {
        abort_unless($inspection->user_id === $request->user()->id, 403, 'Inspection does not belong to this user.');

        $meta = $request->input('meta');
        if (is_string($meta)) {
            $decoded = json_decode($meta, true);
            $meta = json_last_error() === JSON_ERROR_NONE ? $decoded : ['raw' => $meta];
        }

        $uploadedFile = $request->file('file');
        $disk = 'public';
        $path = $uploadedFile->store('attachments/'.$inspection->uuid, $disk);

        $attachment = Attachment::query()->create([
            'uuid' => (string) Str::uuid(),
            'user_id' => $request->user()->id,
            'inspection_id' => $inspection->id,
            'type' => $request->validated('type'),
            'disk' => $disk,
            'path' => $path,
            'meta' => is_array($meta) ? $meta : null,
            'mime_type' => $uploadedFile->getClientMimeType(),
            'size' => $uploadedFile->getSize(),
        ]);

        return response()->json([
            'data' => [
                'id' => $attachment->uuid,
                'url' => Storage::disk($attachment->disk)->url($attachment->path),
                'type' => $attachment->type,
            ],
        ], 201);
    }
}
