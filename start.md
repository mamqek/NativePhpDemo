# NativePHP Mobile Lab - Fresh Device Start Guide

This guide starts from a fresh clone and gives two paths:

1. Container-only Jump testing (no host PHP install needed).
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
git clone <your-repo-url> nativephp-mobile-lab
cd .\nativephp-mobile-lab
```

### Linux (bash)
```bash
cd ~/Programming
git clone <your-repo-url> nativephp-mobile-lab
cd nativephp-mobile-lab
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

## 3) Find your LAN IP and set API/Jump host

Why this matters:
- `mobile-app/.env` needs `VITE_API_BASE_URL=http://<LAN_IP>:8000/api/v1`
- Root `.env` can set `NATIVEPHP_HOST_IP=<LAN_IP>` for stable Jump routing

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

## 4) Path A (Recommended for testers): Container-only Jump

Use this if you want to run and test without installing host `php`.

### 4.1 Start services

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\nativephp-mobile-lab
npm run lab:up
npm run lab:mobile:web:up
```

### Linux (bash)
```bash
cd ~/Programming/nativephp-mobile-lab
npm run lab:up
npm run lab:mobile:web:up
```

### 4.2 Start Jump session

### Windows (PowerShell)
```powershell
npm run lab:mobile:jump:android:docker
# or
npm run lab:mobile:jump:ios:docker
```

### Linux (bash)
```bash
npm run lab:mobile:jump:android:docker
# or
npm run lab:mobile:jump:ios:docker
```

## 5) Path B: Full Android native run (host-native build path)

Use this if you need full `native:run android`, not just Jump.

### 5.1 Install mobile-app dependencies locally

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\nativephp-mobile-lab\mobile-app
& ..\.tools\php83\php.exe ..\.tools\composer.phar install
npm install
& ..\.tools\php83\php.exe artisan key:generate --force
& ..\.tools\php83\php.exe artisan migrate --force
```

### Linux (bash)
```bash
cd ~/Programming/nativephp-mobile-lab/mobile-app
composer install
npm install
php artisan key:generate --force
php artisan migrate --force
```

### 5.2 Start services and run doctor

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\nativephp-mobile-lab
npm run lab:mobile:web:up
npm run lab:mobile:doctor
```

### Linux (bash)
```bash
cd ~/Programming/nativephp-mobile-lab
npm run lab:mobile:web:up
npm run lab:mobile:doctor
```

### 5.3 Run Android app

### Windows (PowerShell)
```powershell
npm run lab:mobile:run:android
```

### Linux (bash)
```bash
npm run lab:mobile:run:android
```

## 6) Web-only preview (no Jump, no native run)

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\nativephp-mobile-lab
npm run lab:mobile:web
```

### Linux (bash)
```bash
cd ~/Programming/nativephp-mobile-lab
npm run lab:mobile:web
```

## 7) Logs and shutdown

### Windows (PowerShell)
```powershell
cd c:\Programming\NativePhpDemo\nativephp-mobile-lab
npm run lab:logs
npm run lab:down
```

### Linux (bash)
```bash
cd ~/Programming/nativephp-mobile-lab
npm run lab:logs
npm run lab:down
```

## Notes

- On Windows, local iOS build/package is out of scope; use iOS Jump for validation.
- If IP auto-detect picks the wrong interface, set `NATIVEPHP_HOST_IP` manually in root `.env`.
- If Docker is not running, `lab:mobile:*:docker` commands will fail until Docker starts.
