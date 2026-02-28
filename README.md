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

Run these from `mobile-fresh`:

```bash
npm run lab:up
npm run lab:mobile:web
npm run lab:mobile:web:up
npm run lab:mobile:doctor
npm run lab:mobile:jump:android
npm run lab:mobile:jump:ios
npm run lab:mobile:run:android
npm run lab:mobile:jump:android:docker
npm run lab:mobile:jump:android:docker:manual
npm run lab:mobile:jump:android:docker:usb
npm run lab:mobile:jump:ios:docker
npm run lab:mobile:jump:ios:docker:manual
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

Container-based dry-run wrappers (without launching NativePHP):

- `node scripts/lab-docker-jump.mjs android --dry-run`
- `node scripts/lab-docker-jump.mjs ios --dry-run`
- `node scripts/lab-docker-jump.mjs android --ip-mode=manual --dry-run`
- `node scripts/lab-docker-jump.mjs android --usb --dry-run`

IP source:

1. `NATIVEPHP_HOST_IP` (if set)
2. Auto-detected non-loopback IPv4

## Container-Only Jump (No Host PHP)

If you want to share a test-ready setup and avoid installing PHP on the host, you can run Jump from the
`mobile-web` container.

1. Start services (detached):
   - `npm run lab:up`
   - `npm run lab:mobile:web:up`
2. Start Jump from container:
   - Android: `npm run lab:mobile:jump:android:docker`
   - iOS: `npm run lab:mobile:jump:ios:docker`

Notes:

- Set `NATIVEPHP_HOST_IP` in root `.env` if auto-detection picks the wrong LAN IP.
- `lab:mobile:doctor` is still host-side tooling validation (ADB/SDK/7-Zip) and is mainly for `native:run android`.

## Docker Jump Hardening Notes

Key updates made for reliable physical-device downloads:

- Added robust Docker Jump options: `--ip`, `--ip-mode=auto|manual`, `--http-port`, `--usb`.
- Added convenience scripts:
  - `lab:mobile:jump:android:docker:manual`
  - `lab:mobile:jump:android:docker:usb`
  - `lab:mobile:jump:ios:docker:manual`
- IP resolution now uses this order:
  - explicit `--ip`
  - pinned `NATIVEPHP_HOST_IP`
  - USB mode (`127.0.0.1`)
  - manual interface select
  - auto-detect
- Jump HTTP port now prefers `3000` and automatically falls back through `3010` if needed.
- Docker compose is started with runtime `LAB_JUMP_HTTP_PORT`/`LAB_JUMP_WS_PORT` overrides to keep container mapping aligned with selected port.
- Jump router Host-header forwarding patch is kept and now verified before starting Jump (fails fast if missing).
- USB mode now validates `adb` and authorized devices, then applies `adb reverse` for Jump HTTP/WS ports.
- `.env` parsing now warns on duplicate keys in root and `mobile-app/.env`, including empty duplicate overrides.
- `lab:mobile:doctor` now reports duplicate `.env` keys, multi-interface host-IP risk, and port scan status for `3000..3010`.

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

## Last Setup Step: LAN Firewall Rules (Physical Device Testing)

Why this is needed:

- Jump QR/download uses host TCP ports (`3000` HTTP, `8081` WS) and API uses `8000`.
- If `ping` works but `http://<host-ip>:3000` or `:8000` fails from phone, inbound TCP is being blocked.
- Allow only your LAN subnet to keep exposure limited.

### Windows (PowerShell, Run as Administrator)

Create rules (LAN-scoped):

```powershell
New-NetFirewallRule -DisplayName "NativePHP LAN 8000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8000 -RemoteAddress 192.168.178.0/24 -Profile Private
New-NetFirewallRule -DisplayName "NativePHP LAN 3000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -RemoteAddress 192.168.178.0/24 -Profile Private
New-NetFirewallRule -DisplayName "NativePHP LAN 8081" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 8081 -RemoteAddress 192.168.178.0/24 -Profile Private
```

Disable for testing:

```powershell
Disable-NetFirewallRule -DisplayName "NativePHP LAN 8000","NativePHP LAN 3000","NativePHP LAN 8081"
```

Enable again:

```powershell
Enable-NetFirewallRule -DisplayName "NativePHP LAN 8000","NativePHP LAN 3000","NativePHP LAN 8081"
```

Check status:

```powershell
Get-NetFirewallRule -DisplayName "NativePHP LAN *" | Format-Table DisplayName,Enabled,Profile,Direction,Action
```

### Linux (UFW)

Enable (replace subnet if needed):

```bash
sudo ufw allow from 192.168.178.0/24 to any port 8000 proto tcp
sudo ufw allow from 192.168.178.0/24 to any port 3000 proto tcp
sudo ufw allow from 192.168.178.0/24 to any port 8081 proto tcp
```

Disable (remove rules):

```bash
sudo ufw delete allow from 192.168.178.0/24 to any port 8000 proto tcp
sudo ufw delete allow from 192.168.178.0/24 to any port 3000 proto tcp
sudo ufw delete allow from 192.168.178.0/24 to any port 8081 proto tcp
```

Check:

```bash
sudo ufw status verbose | grep -E '3000|8000|8081'
```

### macOS (pf anchor)

Enable (replace subnet if needed):

```bash
cat <<'EOF' | sudo pfctl -a nativephp/jump -f -
pass in inet proto tcp from 192.168.178.0/24 to any port {3000,8000,8081}
EOF
sudo pfctl -e
```

Disable:

```bash
sudo pfctl -a nativephp/jump -F rules
```

Check:

```bash
sudo pfctl -a nativephp/jump -s rules
```
