# NativePHP Mobile Lab

Field Inspection Benchmark monorepo for evaluating **NativePHP Mobile** (Laravel + Vue) against mobile-native product requirements.

## Projects

- `backend-api`: Laravel API-only backend (`/api/v1`, SQLite, Sanctum bearer tokens)
- `mobile-app`: Laravel + NativePHP Mobile + Vue client (API-only communication)

## What Is Implemented

- Guest-first app flow (auth is optional benchmark scenario)
- Persisted auth/session snapshot with offline restore behavior
- Dedicated `State Viewer` screen for inspecting local session/queue/cache/telemetry/runtime state
- Offline queue with retry/backoff plus deterministic blocked reasons (`auth_required`, `offline`)
- Capture/media/file/system benchmark labs with telemetry logging
- Premium capability stubs (geolocation/push/scanner) with explicit diagnostics
- Capture artifacts persisted as metadata (web-picked files require re-pick after full app restart)

## Root Commands (Short Workflow)

Run these from `nativephp-mobile-lab`:

```bash
npm run lab:up
npm run lab:mobile:web
npm run lab:mobile:doctor
npm run lab:mobile:jump:android
npm run lab:mobile:jump:ios
npm run lab:mobile:run:android
npm run lab:logs
npm run lab:down
```

Docker-based commands require Docker Desktop/Engine to be running.

## Containerized Services

`docker compose` defines:

- `backend-api`: API server on `${LAB_API_PORT}` (default `8000`)
- `mobile-web`: web preview (Laravel on `8080`, Vite on `${LAB_WEB_PORT}` default `5173`)

Create root `.env` from `.env.example` to override ports and NativePHP wrapper variables.

## NativePHP Command Wrapper Behavior

`scripts/lab.mjs` resolves PHP in this order:

1. `NATIVEPHP_PHP_BIN`
2. `.tools/php83/php.exe`
3. `.tools/php83/bin/php`
4. `php` in `PATH`

Jump commands always use explicit platform and `--no-interaction`:

- Android: `native:jump android --ip=<detected-ip> --no-interaction`
- iOS: `native:jump ios --ip=<detected-ip> --no-interaction`

Dry-run wrappers (without launching NativePHP):

- `node scripts/lab.mjs jump-android --dry-run`
- `node scripts/lab.mjs jump-ios --dry-run`
- `node scripts/lab.mjs run-android --dry-run`

IP source:

1. `NATIVEPHP_HOST_IP` (if set)
2. Auto-detected non-loopback IPv4

## Windows Notes

- iOS local compilation is out of scope on Windows.
- iOS testing path is **Jump runtime** (`npm run lab:mobile:jump:ios`).
- Signed iOS builds still require Bifrost/macOS pipeline.

## Demo Credentials

- email: `user@example.com`
- password: `secret1234`

## Docs

- `docs/api-contract.md`
- `docs/testing-matrix.md`
- `docs/nativephp-vs-rn-checklist.md`
