---
title: 'Configurar el archivo .env desde cero en Laravel'
description: 'Aprende a configurar el archivo .env de Laravel: base de datos, correo, caché, colas y variables de entorno personalizadas explicadas con ejemplos.'
pubDate: '2024-01-16'
tags: ['laravel', 'configuracion', 'env']
---

# Configurar el archivo .env desde cero en Laravel

El archivo `.env` es uno de los conceptos más importantes en cualquier proyecto Laravel. Es el lugar donde vive toda la configuración sensible y específica del entorno: credenciales de base de datos, claves de API, configuración del correo electrónico y mucho más. En esta guía vamos a recorrer cada variable importante, entender qué hace y cómo usarla correctamente.

## ¿Qué es el archivo .env?

El `.env` es un archivo de texto plano que contiene pares clave-valor de configuración. Sigue el estándar de **DotEnv**, usado por casi todos los frameworks modernos.

Lo más importante que debes entender desde el principio:

- **Nunca subas el `.env` a Git**. Contiene información sensible como contraseñas y claves de API. El archivo `.gitignore` de Laravel ya lo excluye por defecto.
- **Cada entorno tiene su propio `.env`**. Tu máquina local, el servidor de staging y producción tienen configuraciones diferentes.
- **El archivo `.env.example`** es la plantilla pública que sí va en Git. Muestra qué variables existen pero sin los valores reales.

## Variables de aplicación (APP_*)

```php
APP_NAME="Mi Blog Laravel"
APP_ENV=local
APP_KEY=base64:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890AbCd=
APP_DEBUG=true
APP_URL=http://localhost:8000
```

### APP_NAME

El nombre de tu aplicación. Se usa en notificaciones, correos y en la interfaz de Telescope o Horizon si los usas. Pon el nombre real de tu proyecto.

### APP_ENV

Indica el entorno actual. Los valores más comunes son:

- `local`: tu máquina de desarrollo
- `staging`: servidor de pruebas
- `production`: producción

Laravel usa esta variable en algunos lugares para cambiar comportamientos. Por ejemplo, ciertos proveedores de servicios solo se cargan en `local`.

### APP_KEY

Esta es la clave criptográfica que Laravel usa para encriptar datos sensibles: cookies de sesión, tokens de restablecimiento de contraseña, valores encriptados en la base de datos, etc. **Debe ser una cadena aleatoria de 32 caracteres codificada en base64.**

Genera una nueva con:

```php
php artisan key:generate
```

**Si pierdes esta clave o la cambias en producción, todos los datos encriptados quedarán inaccesibles.** Trátala con el mismo cuidado que una contraseña maestra.

### APP_DEBUG

Con `APP_DEBUG=true`, cuando ocurre un error verás una página de error detallada con el stack trace, las variables del entorno y mucha información útil para depurar. Con `APP_DEBUG=false`, solo verás un mensaje genérico de error.

**Regla de oro: en producción siempre `APP_DEBUG=false`.** Mostrar el stack trace en producción es un riesgo de seguridad enorme.

### APP_URL

La URL base de tu aplicación. Se usa para generar URLs absolutas en correos, notificaciones y el helper `url()`.

## Variables de base de datos (DB_*)

```php
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_base_datos
DB_USERNAME=root
DB_PASSWORD=tu_password_seguro
```

### DB_CONNECTION

El driver de base de datos. Las opciones disponibles en Laravel son:

- `mysql`: MySQL y MariaDB
- `pgsql`: PostgreSQL
- `sqlite`: SQLite (un solo archivo, ideal para pruebas)
- `sqlsrv`: Microsoft SQL Server

### DB_HOST

La dirección del servidor de base de datos. En desarrollo local suele ser `127.0.0.1`. Si usas Docker o Sail, puede ser el nombre del servicio (como `mysql`).

Un detalle importante: en macOS, si MySQL está instalado con Homebrew o DBngin, a veces necesitas usar `127.0.0.1` en lugar de `localhost`. Esto se debe a cómo PHP maneja los sockets de Unix.

### Configuración para SQLite

SQLite no necesita servidor. Solo necesitas indicar el path al archivo:

```php
DB_CONNECTION=sqlite
DB_DATABASE=/absolute/path/to/database/database.sqlite
```

O simplemente deja `DB_DATABASE` vacío y Laravel usará `database/database.sqlite` por defecto. Crea el archivo:

```php
touch database/database.sqlite
```

## Variables de correo electrónico (MAIL_*)

```php
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=tu_usuario_mailtrap
MAIL_PASSWORD=tu_password_mailtrap
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="noreply@miapp.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### MAIL_MAILER

El driver de correo. Los más usados:

- `smtp`: servidor SMTP estándar (Mailtrap, Gmail, etc.)
- `mailgun`: servicio Mailgun
- `ses`: Amazon SES
- `log`: escribe los correos en el log (ideal para desarrollo sin configurar SMTP)
- `array`: no envía nada, solo almacena en memoria (para tests)

Para desarrollo, usa `MAIL_MAILER=log` y verás los correos en `storage/logs/laravel.log`. No necesitas configurar nada más.

Para un entorno más realista en desarrollo, usa [Mailtrap](https://mailtrap.io) o [Mailpit](https://github.com/axllent/mailpit) (que viene incluido en Laravel Sail).

### MAIL_FROM_ADDRESS y MAIL_FROM_NAME

El correo y nombre que aparece como remitente en todos los correos que envíe tu aplicación. Observa que `MAIL_FROM_NAME` usa `${APP_NAME}` para referirse al valor de otra variable `.env`.

## Variables de caché y sesión

```php
CACHE_STORE=file
SESSION_DRIVER=file
SESSION_LIFETIME=120
```

### CACHE_STORE

El driver de caché. Los más comunes:

- `file`: almacena la caché en archivos en `storage/framework/cache` (por defecto)
- `database`: almacena la caché en la base de datos
- `redis`: almacena en Redis (muy rápido, recomendado en producción)
- `memcached`: alternativa a Redis
- `array`: solo en memoria, se pierde al terminar el proceso (útil para tests)

### SESSION_DRIVER

Similar a `CACHE_STORE`. En desarrollo `file` funciona bien. En producción con múltiples servidores, usa `database` o `redis` para que la sesión sea compartida entre servidores.

### SESSION_LIFETIME

Tiempo en minutos antes de que la sesión expire. El valor por defecto es 120 (2 horas).

## Variables de colas (QUEUE_*)

```php
QUEUE_CONNECTION=sync
```

- `sync`: ejecuta los jobs inmediatamente (sin cola real). Perfecto para desarrollo.
- `database`: almacena los jobs en la base de datos (requiere la migración de la tabla `jobs`)
- `redis`: almacena los jobs en Redis (recomendado en producción)
- `beanstalkd`: alternativa a Redis para colas

## Variables de Redis

```php
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

Si usas Redis para caché, sesiones o colas, configura estas variables. `REDIS_PASSWORD=null` significa que no hay contraseña (común en desarrollo local).

## Cómo usar variables del .env en el código

Para acceder a las variables de entorno en tu código PHP, usa el helper `env()`:

```php
// En cualquier archivo PHP de Laravel
$debug = env('APP_DEBUG', false);
$dbName = env('DB_DATABASE');
$apiKey = env('MI_API_KEY', 'valor_por_defecto');
```

El segundo parámetro es un valor por defecto que se usa si la variable no existe en el `.env`.

Sin embargo, **en archivos de configuración** (`config/*.php`) siempre usa `env()`. Pero en el resto del código (controladores, servicios, etc.), usa el helper `config()`:

```php
// En config/services.php
return [
    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
    ],
];

// En un controlador o servicio, usa config() en lugar de env()
$stripeKey = config('services.stripe.key');
```

¿Por qué? Porque `config:cache` serializa todos los archivos de configuración en un solo archivo PHP. Después de ejecutar este comando, `env()` ya no funciona correctamente fuera de los archivos de config.

## Variables de entorno personalizadas

Puedes agregar tus propias variables al `.env`:

```php
// En .env
STRIPE_KEY=pk_test_abcdefghijklmnop
STRIPE_SECRET=sk_test_abcdefghijklmnop
OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz
```

Y acceder a ellas en el código:

```php
$stripeKey = env('STRIPE_KEY');
```

## El problema de config:cache

Este es uno de los errores más confusos para los desarrolladores que están empezando. Si ejecutas:

```php
php artisan config:cache
```

Laravel compila todos los archivos `config/*.php` en un solo archivo en caché. A partir de ese momento, **`env()` devuelve `null` en cualquier lugar que no sea un archivo de configuración**.

Si estás en desarrollo y has ejecutado este comando, limpia la caché:

```php
php artisan config:clear
// o
php artisan optimize:clear  // limpia todo
```

En producción, ejecutar `config:cache` es una buena práctica porque mejora el rendimiento. Pero asegúrate de que todos los `env()` estén solo en los archivos `config/*.php`.

## Verificar la configuración desde Tinker

Para verificar que tu configuración está correcta sin necesidad de crear código de prueba, usa Tinker:

```php
php artisan tinker
```

Dentro de Tinker:

```php
// Verificar la conexión a la base de datos
DB::connection()->getPdo();
// Si funciona, verás el objeto PDO

// Ver el valor de una variable de configuración
config('database.default');
// "mysql"

// Ver el valor de una variable de entorno
env('APP_NAME');
// "Mi Blog Laravel"
```

## Diferencias entre entornos

Una configuración recomendada para cada entorno:

```php
// Desarrollo local (.env)
APP_ENV=local
APP_DEBUG=true
CACHE_STORE=file
QUEUE_CONNECTION=sync
MAIL_MAILER=log

// Producción (.env en el servidor)
APP_ENV=production
APP_DEBUG=false
CACHE_STORE=redis
QUEUE_CONNECTION=redis
MAIL_MAILER=ses
```

## Conclusión

El archivo `.env` puede parecer abrumador al principio por la cantidad de variables, pero en la práctica solo necesitas configurar un subconjunto pequeño para cada proyecto. Para empezar, las variables de `APP_*` y `DB_*` son suficientes. El resto las vas configurando según las necesidades de tu aplicación.

Recuerda: nunca subas el `.env` a Git, siempre mantén el `.env.example` actualizado con todas las variables (sin valores reales) para que otros desarrolladores del equipo sepan qué necesitan configurar.
