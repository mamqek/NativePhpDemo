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

composer install --no-interaction --prefer-dist
npm install

if ! grep -q "^APP_KEY=base64:" .env; then
    php artisan key:generate --force --no-interaction
fi

php artisan migrate --force --no-interaction

php artisan serve --host=0.0.0.0 --port=8080 >/tmp/mobile-app-serve.log 2>&1 &

exec npm run dev -- --host 0.0.0.0 --port=5173
