<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;

class StoreTelemetryRequest extends FormRequest
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
            'event' => ['required', 'string', 'max:120'],
            'value' => ['required', 'numeric'],
            'platform' => ['required', 'string', 'max:50'],
            'app_version' => ['nullable', 'string', 'max:50'],
            'meta' => ['nullable', 'array'],
        ];
    }
}
