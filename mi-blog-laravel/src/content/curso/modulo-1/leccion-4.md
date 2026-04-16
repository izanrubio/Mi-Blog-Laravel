---
modulo: 1
leccion: 4
title: 'El archivo .env — configuración básica'
description: 'Entiende el archivo .env de Laravel: qué es, cómo funciona, qué variables contiene y cómo configurar tu entorno de desarrollo correctamente.'
duracion: '12 min'
quiz:
  - pregunta: '¿Por qué el archivo .env NO debe subirse al repositorio de Git?'
    opciones:
      - 'Porque Git no soporta archivos que empiezan con punto'
      - 'Porque contiene credenciales y secretos que varían por entorno y no deben exponerse'
      - 'Porque Laravel lo borra automáticamente al hacer deploy'
      - 'Porque es demasiado grande para Git'
    correcta: 1
    explicacion: 'El archivo .env contiene secretos como contraseñas de bases de datos, claves de API y la APP_KEY. Subirlo al repositorio expondría esas credenciales. Por eso .env está en .gitignore y se usa .env.example como plantilla segura para compartir.'
  - pregunta: '¿Qué variable del .env determina si Laravel muestra errores detallados en el navegador?'
    opciones:
      - 'APP_DEBUG'
      - 'APP_ENV'
      - 'LOG_LEVEL'
      - 'DEBUG_MODE'
    correcta: 0
    explicacion: 'La variable APP_DEBUG controla si Laravel muestra errores detallados. Con APP_DEBUG=true (desarrollo) ves el stack trace completo. Con APP_DEBUG=false (producción) solo se muestra un mensaje genérico de error para no exponer información sensible.'
  - pregunta: '¿Qué función de PHP/Laravel se usa para leer una variable del archivo .env en el código?'
    opciones:
      - 'getenv("VARIABLE")'
      - '$_ENV["VARIABLE"]'
      - 'env("VARIABLE")'
      - 'config("app.variable")'
    correcta: 2
    explicacion: 'La función helper env() de Laravel lee variables del archivo .env. También acepta un segundo argumento como valor por defecto: env("DB_HOST", "127.0.0.1"). En el código de la aplicación es mejor usar config() que lee desde los archivos de config/, que a su vez usan env().'
---

## ¿Qué es el archivo `.env`?

El archivo `.env` (de "environment") es un archivo de **configuración de entorno** que contiene todas las variables que pueden cambiar entre diferentes entornos: desarrollo local, staging y producción. En lugar de escribir credenciales o configuraciones directamente en el código, las colocas aquí.

Esta práctica sigue el principio de **configuración basada en el entorno** (uno de los factores de la metodología *Twelve-Factor App*): el código es el mismo en todos los entornos, solo cambia la configuración.

## ¿Por qué es importante?

Imagina que tu equipo tiene tres entornos:

| Entorno | Base de datos | Mail | Debug |
|---|---|---|---|
| Local | `localhost/mi_app` | MailHog (local) | `true` |
| Staging | `servidor.staging/mi_app` | Mailtrap | `true` |
| Producción | `db.produccion.com/mi_app` | SendGrid | `false` |

Con `.env`, cada desarrollador y cada servidor tiene su propio archivo `.env` con los valores correctos para su entorno. El código PHP nunca cambia; solo cambia la configuración.

## El archivo `.env.example`

Laravel incluye un archivo `.env.example` que es una **plantilla** del `.env` con todos los campos disponibles pero sin los valores secretos. Este archivo sí se sube a Git para que cualquier persona que clone el proyecto sepa qué variables necesita configurar.

```bash
# Al clonar un proyecto existente, siempre haz esto:
cp .env.example .env
php artisan key:generate
```

## Contenido del `.env` de un proyecto nuevo

Veamos el archivo completo y lo que significa cada sección:

```ini
# ── Configuración general de la aplicación ───────────────
APP_NAME=Laravel
APP_ENV=local
APP_KEY=base64:tu_clave_generada_automaticamente=
APP_DEBUG=true
APP_URL=http://localhost
APP_TIMEZONE=UTC
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
```

### Variables de aplicación

| Variable | Descripción |
|---|---|
| `APP_NAME` | Nombre de tu aplicación (aparece en emails, notificaciones) |
| `APP_ENV` | Entorno actual: `local`, `staging` o `production` |
| `APP_KEY` | Clave secreta de cifrado (se genera con `php artisan key:generate`) |
| `APP_DEBUG` | `true` en desarrollo, **siempre `false` en producción** |
| `APP_URL` | URL base de tu aplicación |
| `APP_TIMEZONE` | Zona horaria (p. ej. `Europe/Madrid` o `America/Mexico_City`) |
| `APP_LOCALE` | Idioma por defecto (p. ej. `es` para español) |

### Variables de base de datos

```ini
# ── Base de datos ─────────────────────────────────────────
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=root
DB_PASSWORD=
```

| Variable | Descripción |
|---|---|
| `DB_CONNECTION` | Driver: `mysql`, `pgsql`, `sqlite`, `sqlsrv` |
| `DB_HOST` | Servidor de base de datos |
| `DB_PORT` | Puerto (MySQL: 3306, PostgreSQL: 5432) |
| `DB_DATABASE` | Nombre de la base de datos |
| `DB_USERNAME` | Usuario de la base de datos |
| `DB_PASSWORD` | Contraseña (puede estar vacía en local) |

Para usar **SQLite** (ideal para empezar sin instalar MySQL):

```ini
DB_CONNECTION=sqlite
# Las demás variables DB_ puedes borrarlas o comentarlas
```

Laravel creará automáticamente el archivo `database/database.sqlite`.

### Variables de correo

```ini
# ── Correo electrónico ────────────────────────────────────
MAIL_MAILER=log
MAIL_HOST=127.0.0.1
MAIL_PORT=2525
MAIL_USERNAME=null
MAIL_PASSWORD=null
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

En desarrollo, `MAIL_MAILER=log` hace que todos los emails se guarden en `storage/logs/laravel.log` en lugar de enviarse de verdad. Muy útil para no bombardear a nadie con correos de prueba.

Para producción podrías usar:

```ini
MAIL_MAILER=smtp
MAIL_HOST=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USERNAME=apikey
MAIL_PASSWORD=tu_api_key_de_sendgrid
```

### Variables de caché y sesiones

```ini
# ── Caché ─────────────────────────────────────────────────
CACHE_STORE=database
CACHE_PREFIX=

# ── Sesiones ──────────────────────────────────────────────
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
```

Los drivers más comunes:

| Driver | Cuándo usarlo |
|---|---|
| `file` | Simple, para proyectos pequeños |
| `database` | Almacena en BD, buena opción general |
| `redis` | Alto rendimiento, para proyectos con muchas visitas |
| `array` | Solo en tests (no persiste) |

### Variables de colas de trabajo

```ini
# ── Colas ─────────────────────────────────────────────────
QUEUE_CONNECTION=database
```

Cuando envías emails o procesas imágenes de forma asíncrona, Laravel usa colas. En desarrollo `database` está bien; en producción usa `redis` para mejor rendimiento.

## Cómo leer variables del `.env` en tu código

### Usando la función `env()`

```php
// Leer una variable (no recomendado en el código de la app)
$debug = env('APP_DEBUG');

// Con valor por defecto si la variable no existe
$host = env('DB_HOST', '127.0.0.1');
```

### Usando la función `config()` (recomendada)

La mejor práctica es **no usar `env()` directamente en el código de la aplicación**, sino acceder a las variables a través de los archivos de configuración en `config/`:

```php
// Esto es mejor
$appName = config('app.name');
$dbHost  = config('database.connections.mysql.host');
$debug   = config('app.debug');
```

¿Por qué? Porque Laravel puede cachear los archivos de configuración (`php artisan config:cache`), pero si usas `env()` directamente en el código, esa caché no funcionará correctamente.

## Buenas prácticas con el `.env`

### 1. Nunca subas `.env` a Git

Verifica que `.gitignore` incluye `.env` (viene así por defecto en Laravel):

```
# .gitignore
.env
```

### 2. Documenta las variables en `.env.example`

Cuando añadas una nueva variable al `.env`, agrégala también al `.env.example` sin el valor secreto:

```ini
# .env.example
STRIPE_KEY=
STRIPE_SECRET=
CLOUDINARY_URL=
```

### 3. Usa `APP_DEBUG=false` en producción — siempre

Con `APP_DEBUG=true` en producción, si hay un error, el usuario podría ver rutas de archivos, versiones de paquetes, variables de entorno y más información sensible.

### 4. Configura la zona horaria correctamente

```ini
APP_TIMEZONE=Europe/Madrid
# o
APP_TIMEZONE=America/Mexico_City
APP_TIMEZONE=America/Bogota
APP_TIMEZONE=America/Lima
```

### 5. Regenera la `APP_KEY` al clonar un proyecto

```bash
php artisan key:generate
```

Esta clave se usa para cifrar sesiones, cookies y otros datos. Sin ella, nada funcionará correctamente.

## Ejemplo de `.env` para un blog en español

```ini
APP_NAME="Mi Blog Laravel"
APP_ENV=local
APP_KEY=base64:GENERADA_POR_ARTISAN=
APP_DEBUG=true
APP_URL=http://localhost:8000
APP_TIMEZONE=Europe/Madrid
APP_LOCALE=es
APP_FALLBACK_LOCALE=es

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_blog
DB_USERNAME=root
DB_PASSWORD=

MAIL_MAILER=log
MAIL_FROM_ADDRESS="noreply@miblog.es"
MAIL_FROM_NAME="${APP_NAME}"

CACHE_STORE=file
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
```

Con esta configuración, el blog funcionará en español, guardará los logs de email en archivo y usará MySQL localmente.

En la próxima lección aprenderás a usar **Artisan CLI**, la herramienta de terminal de Laravel que te ahorrará cientos de horas de trabajo.
