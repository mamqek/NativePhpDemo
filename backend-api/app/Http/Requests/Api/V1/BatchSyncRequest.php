<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class BatchSyncRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'operations' => ['required', 'array', 'min:1'],
            'operations.*.op' => ['required', 'string', 'in:upsert_inspection,upload_attachment'],
            'operations.*.client_id' => ['nullable', 'string', 'max:100'],
            'operations.*.inspection_id' => ['nullable', 'string', 'max:64'],
            'operations.*.payload' => ['nullable', 'array'],
        ];
    }
}
