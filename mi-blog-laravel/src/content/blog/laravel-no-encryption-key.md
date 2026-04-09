---
title: 'No application encryption key has been specified en Laravel'
description: 'Error No encryption key en Laravel: cómo generar la APP_KEY con php artisan key:generate y configurarla correctamente en producción y desarrollo.'
pubDate: '2024-02-23'
tags: ['laravel', 'errores', 'configuracion', 'seguridad']
---

Si acabas de clonar un proyecto Laravel o configurar un servidor nuevo, hay muchas probabilidades de que te hayas topado con este error: `No application encryption key has been specified`. Es uno de los primeros errores que encuentran los desarrolladores junior y tiene una solución muy simple, aunque vale la pena entender por qué existe.

## ¿Qué es la APP_KEY y para qué sirve?

La `APP_KEY` es una clave criptográfica de 32 caracteres que Laravel usa para todas sus operaciones de cifrado y firmado. Sin ella, varias cosas dejan de funcionar:

- **Sesiones:** Los datos de sesión se cifran con esta clave
- **Cookies:** Las cookies se firman para detectar manipulaciones
- **Datos cifrados:** Si usas `encrypt()` / `decrypt()` en el código
- **Password reset tokens:** Los tokens se generan usando esta clave

Si la clave no está definida, Laravel lanza una excepción antes de que tu aplicación pueda hacer nada útil.

## La solución inmediata

```bash
php artisan key:generate
```

Este comando genera una nueva clave aleatoria y la escribe automáticamente en tu archivo `.env`:

```
APP_KEY=base64:TuClaveGeneradaAquiDe32Caracteres=
```

Después de ejecutarlo, recarga la página y el error habrá desaparecido.

## El problema de raíz: falta el archivo .env

Normalmente este error no ocurre en un proyecto ya configurado, sino cuando acabas de clonar un repositorio. Los proyectos Laravel incluyen un archivo `.env.example` en el repositorio, pero el archivo `.env` real está en el `.gitignore` (y no debe estar en Git, como veremos después).

El flujo correcto al clonar un proyecto es:

```bash
# 1. Clonar el repositorio
git clone https://github.com/tuusuario/tu-proyecto.git
cd tu-proyecto

# 2. Instalar dependencias
composer install

# 3. Crear el archivo .env a partir del ejemplo
cp .env.example .env

# 4. Generar la APP_KEY
php artisan key:generate

# 5. Configurar la base de datos en .env y migrar
php artisan migrate
```

Si saltas el paso 3 (copiar `.env.example`), no tendrás archivo `.env` y Laravel no tendrá ninguna configuración, incluyendo la `APP_KEY`.

## ¿Por qué no commitear el .env a Git?

Esta es una regla de seguridad fundamental, no solo una convención. Tu archivo `.env` contiene:

```
APP_KEY=base64:ClaveUltraSecreta...
DB_PASSWORD=miPasswordDeBaseDeDatos
MAIL_PASSWORD=passwordDelServidorDeCorreo
AWS_SECRET_ACCESS_KEY=miClaveDeAmazon
STRIPE_SECRET=sk_live_...
```

Si commiteas esto a un repositorio público (o incluso privado que luego se expone), cualquiera que acceda al repo tiene acceso completo a tu aplicación, base de datos y servicios externos. Es una brecha de seguridad crítica.

Tu `.gitignore` debería siempre tener esto:

```
.env
.env.*.local
```

Y el `.env.example` debe tener todas las variables necesarias pero sin valores sensibles:

```bash
APP_NAME=Laravel
APP_ENV=local
APP_KEY=          # ← vacío, se genera localmente
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_de_tu_bd
DB_USERNAME=root
DB_PASSWORD=      # ← vacío
```

## Configurar APP_KEY en producción

En producción, la mejor práctica es **no tener un archivo `.env`** en el servidor. En su lugar, configura las variables de entorno directamente en el sistema.

### En servidores con panel de control (cPanel, Forge, etc.)

La mayoría de los paneles de hosting moderno tienen una sección para definir variables de entorno. Simplemente añade:

```
APP_KEY=base64:TuClaveDeProduccion...
```

### En servicios como Railway, Render, Heroku

Usan variables de entorno del sistema. Las defines en su dashboard o CLI:

```bash
# Heroku
heroku config:set APP_KEY=base64:TuClave...

# Railway
railway variables set APP_KEY=base64:TuClave...
```

### Generar la clave sin escribirla en .env

Si quieres generar la clave para copiarla manualmente sin que se escriba en el `.env`:

```bash
php artisan key:generate --show
```

Esto muestra la clave en pantalla sin modificar ningún archivo.

### El flag --force

En algunos entornos, `key:generate` puede ser cauteloso y pedirte confirmación si ya existe una clave. Para entornos CI/CD donde no hay interacción humana:

```bash
php artisan key:generate --force
```

**Atención:** Regenerar la `APP_KEY` en un sistema con usuarios activos invalidará todas las sesiones y descifrará datos incorrectamente. Solo hazlo cuando sea necesario y avisa a los usuarios.

## ¿Qué pasa si cambias la APP_KEY en producción?

Si tienes usuarios con sesiones activas y cambias la clave, sus sesiones se invalidan (se cierran). Si tienes datos cifrados en la base de datos con la clave anterior (usando la columna `encrypted`), esos datos ya no podrán descifrarse.

En la mayoría de las aplicaciones esto solo significa que todos los usuarios tienen que volver a iniciar sesión. Pero si tienes datos cifrados importantes, debes migrardos antes de cambiar la clave.

## Verificar que la clave está correctamente configurada

```php
// En tinker puedes verificar
php artisan tinker

>>> config('app.key')
=> "base64:TuClaveAqui..."

>>> encrypt('test')
=> "eyJpdiI6..."  // Si esto funciona, la clave está bien
```

## Conclusión

El error `No application encryption key` es trivial de resolver pero importante de entender. La `APP_KEY` es el secreto más crítico de tu aplicación Laravel. Genérala con `key:generate`, jamás la commitees a Git, y en producción configúrala como variable de entorno del sistema. Con estas tres reglas, nunca más tendrás este problema.
