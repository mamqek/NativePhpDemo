# API Contract

Base URL: `/api/v1`

Authentication: Bearer token from Sanctum (`Authorization: Bearer <token>`)

## 1) Login

- `POST /auth/login`

Request:

```json
{
  "email": "user@example.com",
  "password": "secret1234",
  "device_name": "Pixel-USB"
}
```

Response:

```json
{
  "token": "plain_text_token",
  "user": {
    "id": 1,
    "name": "NativePHP Demo User",
    "email": "user@example.com"
  }
}
```

## 2) Logout

- `POST /auth/logout`

Response:

```json
{
  "ok": true
}
```

## 3) Current User

- `GET /me`

Response:

```json
{
  "id": 1,
  "name": "NativePHP Demo User",
  "email": "user@example.com"
}
```

## 4) List Inspections

- `GET /inspections`

Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Boiler Room",
      "status": "draft",
      "updated_at": "2026-02-16T07:00:00.000000Z"
    }
  ]
}
```

## 5) Create Inspection

- `POST /inspections`

Request:

```json
{
  "client_id": "tmp-1",
  "title": "Boiler Room",
  "notes": "Pressure looked unstable",
  "captured_at": "2026-02-16T07:00:00.000Z",
  "device_info": {
    "platform": "android"
  },
  "status": "draft"
}
```

Response:

```json
{
  "data": {
    "id": "uuid",
    "status": "draft"
  }
}
```

## 6) Upload Attachment

- `POST /inspections/{id}/attachments`
- `multipart/form-data`

Fields:

- `type`: `photo | audio | file`
- `file`: binary
- `meta`: JSON string (optional)

Response:

```json
{
  "data": {
    "id": "uuid",
    "url": "http://localhost:8000/storage/attachments/...",
    "type": "photo"
  }
}
```

## 7) Batch Sync

- `POST /sync/batch`

Request:

```json
{
  "operations": [
    {
      "op": "upsert_inspection",
      "client_id": "tmp-1",
      "payload": {
        "title": "Generator Room"
      }
    },
    {
      "op": "upload_attachment",
      "client_id": "tmp-2",
      "inspection_id": "uuid",
      "payload": {
        "filename": "audio-note.m4a"
      }
    }
  ]
}
```

Response:

```json
{
  "results": [
    {
      "client_id": "tmp-1",
      "server_id": "uuid",
      "status": "ok"
    }
  ]
}
```

## 8) Telemetry

- `POST /bench/telemetry`

Request:

```json
{
  "event": "camera_capture_ms",
  "value": 842,
  "platform": "android",
  "app_version": "0.1.0",
  "meta": {
    "source": "native"
  }
}
```

Response:

```json
{
  "ok": true
}
```