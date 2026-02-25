<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreInspectionRequest extends FormRequest
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
            'client_id' => ['nullable', 'string', 'max:100'],
            'title' => ['required', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'captured_at' => ['nullable', 'date'],
            'device_info' => ['nullable', 'array'],
            'status' => ['nullable', 'in:draft,synced'],
        ];
    }
}
