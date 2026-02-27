# NativePHP Mobile Lab - Fresh Device Start Guide (mobile-fresh)

This guide starts from a fresh clone and provides:

1. Container-only Jump testing (no host PHP install required).
2. Full Android native run (host tooling required).

## 0) Prerequisites

- Git
- Node.js + npm
- Docker Desktop/Engine (must be running)
- For Jump testing: NativePHP Jump runtime app on target device/emulator
- For full Android run: Android SDK + `adb`
- Windows only (for full Android run): 7-Zip

## 1) Clone and enter the repo

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo
git clone <your-repo-url> mobile-fresh
cd .\mobile-fresh
```

### Linux (bash)
```bash
cd ~/Programming
git clone <your-repo-url> mobile-fresh
cd mobile-fresh
```

## 2) Create `.env` files

### Windows (PowerShell)
```powershell
Copy-Item .env.example .env
Copy-Item .\mobile-app\.env.example .\mobile-app\.env
```

### Linux (bash)
```bash
cp .env.example .env
cp mobile-app/.env.example mobile-app/.env
```

## 3) Find LAN IP and set API/Jump host

Why this matters:
- `mobile-app/.env` needs `VITE_API_BASE_URL=http://<LAN_IP>:8000/api/v1`
- Root `.env` can pin `NATIVEPHP_HOST_IP=<LAN_IP>` for stable Jump routing

### Windows (PowerShell)
```powershell
$DefaultInterface = Get-NetRoute -AddressFamily IPv4 -DestinationPrefix '0.0.0.0/0' |
  Sort-Object RouteMetric |
  Select-Object -First 1 -ExpandProperty InterfaceIndex

$IP = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $DefaultInterface |
  Where-Object { $_.IPAddress -notlike '169.254*' } |
  Select-Object -First 1 -ExpandProperty IPAddress

$IP

(Get-Content .\.env) -replace '^NATIVEPHP_HOST_IP=.*', "NATIVEPHP_HOST_IP=$IP" | Set-Content .\.env
(Get-Content .\mobile-app\.env) -replace '^VITE_API_BASE_URL=.*', "VITE_API_BASE_URL=http://$IP:8000/api/v1" | Set-Content .\mobile-app\.env

Select-String -Path .\.env -Pattern '^NATIVEPHP_HOST_IP='
Select-String -Path .\mobile-app\.env -Pattern '^VITE_API_BASE_URL='
```

### Linux (bash)
```bash
IFACE=$(ip route | awk '/default/ {print $5; exit}')
IP=$(ip -4 addr show "$IFACE" | awk '/inet /{print $2}' | cut -d/ -f1 | head -n1)

echo "$IP"

sed -i "s|^NATIVEPHP_HOST_IP=.*|NATIVEPHP_HOST_IP=$IP|" .env
sed -i "s|^VITE_API_BASE_URL=.*|VITE_API_BASE_URL=http://$IP:8000/api/v1|" mobile-app/.env

grep '^NATIVEPHP_HOST_IP=' .env
grep '^VITE_API_BASE_URL=' mobile-app/.env
```

## 4) Path A (Recommended): Container-only Jump

Use this if you want to run and test without host `php`.

### 4.1 Start services

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\mobile-fresh
npm run lab:up
npm run lab:mobile:web:up
```

### Linux (bash)
```bash
cd ~/Programming/mobile-fresh
npm run lab:up
npm run lab:mobile:web:up
```

### 4.2 Run doctor

### Windows / Linux
```bash
npm run lab:mobile:doctor
```

### 4.3 Start Jump (LAN, default auto IP)

### Windows / Linux
```bash
npm run lab:mobile:jump:android:docker
# or
npm run lab:mobile:jump:ios:docker
```

What the command prints now:
- selected host IP and source (`--ip`, pinned env, manual, or auto)
- selected Jump port (tries `3000`, then `3001..3010`)
- QR page URL for PC
- phone connectivity URLs

### 4.4 Optional modes

Manual interface/IP selection:
```bash
npm run lab:mobile:jump:android:docker:manual
# or
npm run lab:mobile:jump:ios:docker:manual
```

Android USB fallback (`adb reverse`, uses `127.0.0.1` in QR payload):
```bash
npm run lab:mobile:jump:android:docker:usb
```

### 4.5 Connectivity verification (LAN mode)

Before scanning in Jump app, confirm from phone browser (same Wi-Fi):
- `http://<JUMP_IP>:<JUMP_PORT>/jump/info`
- `http://<JUMP_IP>:<JUMP_PORT>/jump/download`

Expected:
- `/jump/info` returns JSON
- `/jump/download` starts `app.zip` download

If these fail, Jump app scan/download will also fail.

## 5) Path B: Full Android native run (host-native)

Use this if you need full `native:run android`, not just Jump.

### 5.1 Install mobile-app dependencies locally

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\mobile-fresh\mobile-app
& ..\.tools\php83\php.exe ..\.tools\composer.phar install
npm install
& ..\.tools\php83\php.exe artisan key:generate --force
& ..\.tools\php83\php.exe artisan migrate --force
```

### Linux (bash)
```bash
cd ~/Programming/mobile-fresh/mobile-app
composer install
npm install
php artisan key:generate --force
php artisan migrate --force
```

### 5.2 Start services and run doctor

### Windows / Linux
```bash
cd <repo-root>
npm run lab:mobile:web:up
npm run lab:mobile:doctor
```

### 5.3 Run Android app

### Windows / Linux
```bash
npm run lab:mobile:run:android
```

## 6) Web-only preview (no Jump, no native run)

### Windows / Linux
```bash
npm run lab:mobile:web
```

## 7) Logs and shutdown

### Windows / Linux
```bash
npm run lab:logs
npm run lab:down
```

## Notes

- On Windows, local iOS build/package is out of scope; use iOS Jump for validation.
- If IP auto-detect picks the wrong adapter, use manual mode or set `NATIVEPHP_HOST_IP`.
- If Docker is not running, `lab:mobile:*:docker` commands fail.
- For Android USB fallback, device must be authorized in `adb devices`.