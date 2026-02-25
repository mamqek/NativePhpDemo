#!/bin/sh
set -eu

cd /workspace/backend-api

if [ ! -f .env ]; then
    cp .env.example .env
fi

if [ ! -f database/database.sqlite ]; then
    mkdir -p database
    touch database/database.sqlite
fi

composer install --no-interaction --prefer-dist

if ! grep -q "^APP_KEY=base64:" .env; then
    php artisan key:generate --force --no-interaction
fi

php artisan migrate --seed --force --no-interaction
php artisan storage:link --no-interaction || true

exec php artisan serve --host=0.0.0.0 --port=8000
