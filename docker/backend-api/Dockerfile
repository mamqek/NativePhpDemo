FROM php:8.3-cli-bookworm

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
        zip \
        libzip-dev \
        sqlite3 \
        libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/backend-api/entrypoint.sh /usr/local/bin/backend-entrypoint.sh
RUN chmod +x /usr/local/bin/backend-entrypoint.sh
