---
title: 'Configurar Laravel con Docker y Laravel Sail'
description: 'Aprende a usar Laravel Sail para desarrollar con Docker. Configura MySQL, Redis y otros servicios sin instalar nada en tu máquina local.'
pubDate: '2026-04-09'
tags: ['laravel', 'docker', 'sail', 'configuracion']
---

# Configurar Laravel con Docker y Laravel Sail

Docker cambió la forma en que los equipos de desarrollo gestionan sus entornos. En lugar de que cada desarrollador instale PHP, MySQL y Redis en su máquina con versiones potencialmente diferentes, Docker garantiza que todos trabajen en el mismo entorno, con las mismas versiones, sin el clásico problema de "en mi máquina funciona".

Laravel Sail es la solución oficial de Laravel para trabajar con Docker sin necesidad de ser un experto en contenedores. Abstrae la complejidad de Docker Compose y te ofrece una experiencia sencilla para gestionar todos los servicios que tu aplicación necesita.

## ¿Qué es Laravel Sail?

Laravel Sail es un conjunto de scripts y configuraciones de Docker Compose que el equipo de Laravel mantiene oficialmente. Lo que obtienes con Sail:

- Un contenedor con PHP configurado para Laravel
- Servicios opcionales: MySQL, PostgreSQL, Redis, Meilisearch, Mailpit, Selenium, etc.
- El comando `sail` que reemplaza a `php`, `composer`, `npm` y otros, ejecutándolos dentro del contenedor

La ventaja: no necesitas instalar PHP, MySQL ni Redis en tu máquina. Solo necesitas Docker.

## Requisitos previos

Antes de empezar, instala Docker Desktop:

- **Mac**: [Docker Desktop para Mac](https://www.docker.com/products/docker-desktop/)
- **Windows**: [Docker Desktop para Windows](https://www.docker.com/products/docker-desktop/) (requiere WSL2)
- **Linux**: Docker Engine + Docker Compose

Verifica que Docker está funcionando:

```php
docker --version
// Docker version 24.x.x
docker-compose --version
// Docker Compose version 2.x.x
```

## Opción 1: Crear un nuevo proyecto con Sail desde cero

La forma más sencilla es crear el proyecto con Sail ya incluido. Si tienes PHP y Composer instalados localmente:

```php
composer create-project laravel/laravel mi-proyecto
cd mi-proyecto
composer require laravel/sail --dev
php artisan sail:install
```

El comando `sail:install` te preguntará qué servicios quieres incluir:

```
Which services would you like to install? [mysql]:
  [0] mysql
  [1] pgsql
  [2] mariadb
  [3] redis
  [4] memcached
  [5] meilisearch
  [6] typesense
  [7] minio
  [8] mailpit
  [9] selenium
  [10] soketi
```

Para una aplicación web típica, selecciona `mysql` y `redis`. Puedes seleccionar múltiples con comas: `0,3,8` para MySQL, Redis y Mailpit.

### Si no tienes PHP instalado localmente

Si tu objetivo es precisamente no instalar nada, puedes crear el proyecto usando Docker directamente:

```php
docker run --rm \
    -u "$(id -u):$(id -g)" \
    -v "$(pwd)":/var/www/html \
    -w /var/www/html \
    laravelsail/php83-composer:latest \
    composer create-project laravel/laravel mi-proyecto
```

Este comando usa la imagen de Docker de Sail para ejecutar Composer sin instalarlo localmente.

## Opción 2: Agregar Sail a un proyecto existente

```php
composer require laravel/sail --dev
php artisan sail:install
```

Eso es todo. Sail agrega el archivo `docker-compose.yml` a tu proyecto con los servicios que seleccionaste.

## Entendiendo el docker-compose.yml generado

Cuando instalas Sail con MySQL y Redis, el `docker-compose.yml` generado se ve así:

```php
// docker-compose.yml (simplificado)
services:
    laravel.test:
        build:
            context: ./vendor/laravel/sail/runtimes/8.3
            dockerfile: Dockerfile
        ports:
            - '${APP_PORT:-80}:80'
        environment:
            APP_ENV: '${APP_ENV}'
            DB_HOST: mysql
            REDIS_HOST: redis
        volumes:
            - '.:/var/www/html'
        depends_on:
            - mysql
            - redis

    mysql:
        image: 'mysql/mysql-server:8.0'
        ports:
            - '${FORWARD_DB_PORT:-3306}:3306'
        environment:
            MYSQL_ROOT_PASSWORD: '${DB_PASSWORD}'
            MYSQL_DATABASE: '${DB_DATABASE}'
        volumes:
            - 'sail-mysql:/var/lib/mysql'

    redis:
        image: 'redis:alpine'
        ports:
            - '${FORWARD_REDIS_PORT:-6379}:6379'
        volumes:
            - 'sail-redis:/data'
```

Observa que el contenedor de PHP (`laravel.test`) usa `mysql` como `DB_HOST`. Esto es porque dentro de la red Docker de Compose, los servicios se comunican por nombre, no por `127.0.0.1`.

## Configurar el .env para Sail

Actualiza tu `.env` para que coincida con la configuración de Docker:

```php
APP_PORT=80

DB_CONNECTION=mysql
DB_HOST=mysql          // Nombre del servicio en docker-compose.yml
DB_PORT=3306
DB_DATABASE=mi_proyecto
DB_USERNAME=sail
DB_PASSWORD=password

REDIS_HOST=redis       // Nombre del servicio
REDIS_PORT=6379

CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

## Levantar los contenedores

```php
./vendor/bin/sail up
```

La primera vez, Docker descargará todas las imágenes necesarias. Esto puede tardar varios minutos. Las siguientes veces, los contenedores arrancan en segundos.

Para levantarlos en modo "detached" (en segundo plano):

```php
./vendor/bin/sail up -d
```

Verifica que los contenedores están corriendo:

```php
./vendor/bin/sail ps
// O con Docker directamente:
docker ps
```

Para detener los contenedores:

```php
./vendor/bin/sail down
```

## Crear el alias "sail"

Escribir `./vendor/bin/sail` cada vez es tedioso. Crea un alias en tu shell:

```php
// Para bash, agrega en ~/.bashrc:
alias sail='[ -f sail ] && sh sail || sh vendor/bin/sail'

// Para zsh, agrega en ~/.zshrc:
alias sail='[ -f sail ] && sh sail || sh vendor/bin/sail'

// Recarga el archivo de configuración:
source ~/.bashrc  // o source ~/.zshrc
```

Ahora puedes usar simplemente `sail up`, `sail down`, etc.

## Ejecutar comandos con Sail

La clave de Sail es que reemplaza todos los comandos locales por sus equivalentes dentro del contenedor:

```php
// En lugar de "php artisan ...", usa:
sail artisan migrate
sail artisan make:controller ProductoController
sail artisan tinker

// En lugar de "composer ...", usa:
sail composer require spatie/laravel-permission
sail composer install

// En lugar de "npm ...", usa:
sail npm install
sail npm run dev
sail npm run build

// Ejecutar PHP directamente:
sail php --version
sail php -m  // ver extensiones

// Acceder al shell del contenedor:
sail shell
// O con usuario root:
sail root-shell
```

## Ejecutar las migraciones

Una vez que los contenedores están corriendo:

```php
sail artisan migrate
```

Para un fresh install con seeders:

```php
sail artisan migrate:fresh --seed
```

## Personalizar el docker-compose.yml

Puedes modificar `docker-compose.yml` según tus necesidades. Por ejemplo, para agregar PostgreSQL:

```php
// Agrega esto al docker-compose.yml
pgsql:
    image: 'postgres:15'
    ports:
        - '${FORWARD_DB_PORT:-5432}:5432'
    environment:
        PGPASSWORD: '${DB_PASSWORD:-secret}'
        POSTGRES_DB: '${DB_DATABASE}'
        POSTGRES_USER: '${DB_USERNAME}'
        POSTGRES_PASSWORD: '${DB_PASSWORD:-secret}'
    volumes:
        - 'sail-pgsql:/var/lib/postgresql/data'
    healthcheck:
        test: ["CMD", "pg_isready", "-q", "-d", "${DB_DATABASE}", "-U", "${DB_USERNAME}"]
        retries: 3
        timeout: 5s
```

## Acceder a los servicios desde herramientas externas

Los puertos de los servicios están mapeados al host. Puedes conectarte a MySQL con TablePlus o cualquier cliente de base de datos:

- **Host**: `127.0.0.1`
- **Puerto**: `3306` (o el que está en `FORWARD_DB_PORT`)
- **Usuario**: el valor de `DB_USERNAME` en tu `.env`
- **Contraseña**: el valor de `DB_PASSWORD`

Lo mismo para Redis (puerto 6379) y otros servicios.

## Problemas comunes con Sail

### Error: "bind: address already in use"

Hay un proceso en tu máquina usando el mismo puerto (por ejemplo, MySQL local en el puerto 3306). Tienes dos opciones:

Detener el servicio local:

```php
// En Linux/Mac:
sudo systemctl stop mysql
// En Mac con Homebrew:
brew services stop mysql
```

O cambiar el puerto en el `.env`:

```php
FORWARD_DB_PORT=3307
```

### Los contenedores tardan mucho en arrancar en Mac

En Mac, Docker Desktop usa una capa de virtualización que puede hacer que el acceso a archivos sea más lento. Para mejorarlo, activa la opción "VirtioFS" en Docker Desktop > Settings > General.

### Permisos de archivos incorrectos en Linux

Si los archivos creados desde el contenedor tienen el usuario `root` en tu host, configura el `WWWUSER` y `WWWGROUP`:

```php
// En .env
WWWUSER=1000
WWWGROUP=1000
```

Puedes obtener tu UID y GID con `id -u` y `id -g` respectivamente.

## Sail vs Herd vs Instalación manual

| Criterio | Sail (Docker) | Herd | Instalación manual |
|---|---|---|---|
| Tiempo de setup inicial | 10-15 min | 2-3 min | 20-30 min |
| Consistencia entre equipos | Excelente | Buena | Variable |
| Consumo de recursos | Alto | Bajo | Bajo |
| Flexibilidad | Alta | Media | Muy alta |
| Curva de aprendizaje | Media | Baja | Alta |
| Funciona en Linux | Si | No | Si |

## Conclusión

Laravel Sail es la solución ideal cuando trabajas en equipo o cuando quieres garantizar que todos los desarrolladores usan exactamente el mismo entorno. La curva de aprendizaje inicial de Docker se compensa enormemente con la consistencia que proporciona a largo plazo.

Si eres el único desarrollador en tu proyecto y priorizas la simplicidad y el rendimiento, Laravel Herd puede ser una mejor opción. Pero si tu aplicación crece y el equipo también, Sail y Docker son la elección correcta.
