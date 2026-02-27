#!/bin/sh
set -eu

cd /workspace/mobile-app

if [ ! -f .env ]; then
    cp .env.example .env
fi

if [ ! -f database/database.sqlite ]; then
    mkdir -p database
    touch database/database.sqlite
fi

# Named volumes can start empty, so ensure Laravel writable paths exist.
mkdir -p storage/framework/cache
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/logs
mkdir -p bootstrap/cache

composer install --no-interaction --prefer-dist
npm install

# NativePHP Jump router should forward Host header so proxied HTML emits same-origin asset URLs.
ROUTER_PATH="/workspace/mobile-app/vendor/nativephp/mobile/resources/jump/router.php"
if [ -f "$ROUTER_PATH" ]; then
    sed -i "s/'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host'/'connection', 'keep-alive', 'transfer-encoding', 'upgrade'/g" "$ROUTER_PATH"
fi

if ! grep -q "^APP_KEY=base64:" .env; then
    php artisan key:generate --force --no-interaction
fi

php artisan migrate --force --no-interaction

php artisan serve --host=0.0.0.0 --port=8080 >/tmp/mobile-app-serve.log 2>&1 &

exec npm run dev -- --host 0.0.0.0 --port=5173
