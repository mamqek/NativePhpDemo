FROM php:8.3-cli-bookworm

WORKDIR /workspace

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        gnupg \
        git \
        rsync \
        unzip \
        zip \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        sqlite3 \
        libsqlite3-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install gd pdo pdo_sqlite zip \
    && npm install -g npm@latest \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY docker/mobile-web/entrypoint.sh /usr/local/bin/mobile-web-entrypoint.sh
RUN chmod +x /usr/local/bin/mobile-web-entrypoint.sh
