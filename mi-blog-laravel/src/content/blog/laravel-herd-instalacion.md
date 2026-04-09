---
title: 'Cómo usar Laravel Herd: instalación sin Docker ni configuración'
description: 'Laravel Herd es la forma más rápida de tener un entorno Laravel funcionando en minutos sin Docker. Instálalo en Mac o Windows y empieza a desarrollar.'
pubDate: '2024-01-20'
tags: ['laravel', 'herd', 'instalacion', 'entorno']
---

# Cómo usar Laravel Herd: instalación sin Docker ni configuración

Si alguna vez has pasado una tarde entera intentando configurar un entorno de desarrollo local (instalando PHP, configurando Nginx, manejando versiones, peleando con permisos) y al final del día aún no tienes Laravel funcionando, entonces Laravel Herd fue creado para ti.

Herd es una aplicación nativa para Mac y Windows que instala todo lo que necesitas para desarrollar con Laravel en minutos, sin necesidad de Docker, XAMPP, MAMP ni ninguna otra herramienta de terceros. Y lo mejor: es gratis.

## ¿Qué es Laravel Herd exactamente?

Laravel Herd es una aplicación de escritorio creada y mantenida por el equipo de Laravel (Beyond Code). Incluye:

- **PHP** (múltiples versiones: 8.0, 8.1, 8.2, 8.3)
- **Nginx** como servidor web
- **dnsmasq** para gestionar dominios `.test` localmente
- **Node.js** (en la versión Pro)

La magia de Herd es que funciona con el concepto de **sites**: cualquier carpeta que pongas dentro de tu directorio de Herd (`~/Herd` por defecto) automáticamente se convierte en un sitio web accesible en `http://nombre-carpeta.test`. No tienes que configurar nada más.

## Instalación en Mac

### Paso 1: Descargar Herd

Ve a [herd.laravel.com](https://herd.laravel.com) y descarga la versión para macOS. El archivo descargado es un `.dmg` estándar.

### Paso 2: Instalar la aplicación

Abre el `.dmg` descargado y arrastra la aplicación Herd a tu carpeta de Aplicaciones. Luego ábrela.

La primera vez que abras Herd, te pedirá permisos de administrador para:
- Instalar los componentes del sistema (PHP, Nginx, dnsmasq)
- Configurar el DNS local para que los dominios `.test` funcionen
- Agregar los binarios de PHP al PATH de tu terminal

Acepta todos los permisos. Esta es la única vez que necesitarás permisos de administrador.

### Paso 3: Verificar la instalación

Una vez instalado, abre una nueva terminal y verifica:

```php
php --version
// PHP 8.3.x (cli)

herd --version
// Laravel Herd 1.x.x
```

Herd agrega automáticamente PHP y sus herramientas al PATH, incluyendo Composer:

```php
composer --version
// Composer version 2.x.x
```

## Instalación en Windows

El proceso en Windows es similar:

1. Descarga el instalador `.exe` desde [herd.laravel.com](https://herd.laravel.com).
2. Ejecuta el instalador con permisos de administrador.
3. Herd se instala y configura automáticamente.

Windows Herd usa diferentes mecanismos para los dominios `.test`, pero el resultado es el mismo: accedes a tus proyectos en `http://nombre-proyecto.test` sin configuración manual.

## Cómo funcionan los sites en Herd

Por defecto, Herd monitorea la carpeta `~/Herd`. Cualquier subcarpeta dentro de esa carpeta se convierte automáticamente en un sitio web.

Ejemplo:

```php
~/Herd/
├── mi-blog/          → http://mi-blog.test
├── tienda-online/    → http://tienda-online.test
└── api-rest/         → http://api-rest.test
```

No necesitas reiniciar Nginx, no necesitas agregar entradas al `/etc/hosts`, no necesitas hacer nada. Simplemente crea la carpeta y accede al dominio en tu navegador.

### Crear un nuevo proyecto Laravel con Herd

```php
cd ~/Herd
composer create-project laravel/laravel mi-nuevo-proyecto
```

Ahora abre tu navegador en `http://mi-nuevo-proyecto.test` y verás la página de bienvenida de Laravel.

### Agregar carpetas adicionales como sites

Si ya tienes proyectos en otras ubicaciones, puedes agregar esas carpetas a Herd:

1. Abre la interfaz de Herd (el icono en la barra de menú).
2. Ve a la sección "Sites" o "Paths".
3. Agrega la ruta a la carpeta que contiene tus proyectos.

Por ejemplo, si tus proyectos están en `~/Documents/proyectos`, agregar esa ruta hará que todos los subdirectorios sean accesibles como sitios web.

## Gestión de versiones de PHP

Una de las características más útiles de Herd es la gestión de múltiples versiones de PHP. Puedes tener diferentes proyectos usando versiones distintas de PHP sin conflictos.

### Cambiar la versión de PHP globalmente

```php
herd php:use 8.2
// o desde la interfaz gráfica de Herd
```

### Cambiar la versión de PHP por proyecto

Puedes especificar qué versión de PHP usa cada proyecto individual:

1. En la interfaz de Herd, ve a "Sites".
2. Selecciona el proyecto.
3. Elige la versión de PHP deseada.

O desde la terminal:

```php
herd isolate 8.1
// Esto crea un archivo .herd-version en el directorio actual
```

Esto es tremendamente útil cuando mantienes proyectos con diferentes requisitos de PHP.

## Gestión de bases de datos con Herd

Herd no incluye un servidor de base de datos (eso sería Docker), pero se integra muy bien con herramientas externas.

### DBngin (recomendado para Mac)

[DBngin](https://dbngin.com) es una aplicación gratuita para Mac que te permite levantar instancias de MySQL, PostgreSQL y Redis con un solo clic. No requiere instalación de dependencias ni configuración.

```php
// Una vez que DBngin tiene MySQL corriendo, configura tu .env:
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_proyecto
DB_USERNAME=root
DB_PASSWORD=
```

### Usar SQLite (la opción más simple)

Para proyectos de desarrollo donde no necesitas un servidor de base de datos completo, SQLite es perfecta:

```php
// En .env
DB_CONNECTION=sqlite
```

```php
touch database/database.sqlite
php artisan migrate
```

SQLite no requiere ningún servidor externo.

### TablePlus para gestionar bases de datos

[TablePlus](https://tableplus.com) es el cliente de base de datos más popular entre los desarrolladores Laravel. Tiene soporte para MySQL, PostgreSQL, SQLite, Redis y muchas otras. La versión gratuita es suficiente para la mayoría de proyectos de desarrollo.

## HTTPS local con Herd

Herd puede generar certificados SSL locales para que tus sitios funcionen con HTTPS:

```php
herd secure mi-proyecto
// Ahora http://mi-proyecto.test también funciona en https://mi-proyecto.test
```

Esto instala un certificado autofirmado que el navegador reconoce como válido (Herd instala la CA raíz en el sistema).

Para desactivar HTTPS:

```php
herd unsecure mi-proyecto
```

## Servicios adicionales en Herd

Además de Nginx y PHP, Herd Pro incluye servicios adicionales:

- **Mailpit**: para capturar correos en desarrollo (no los envía, los muestra en una interfaz web)
- **Redis**: para caché, sesiones y colas
- **MinIO**: compatible con S3 para pruebas de almacenamiento de archivos
- **Meilisearch**: motor de búsqueda compatible con Laravel Scout

Estos servicios se gestionan desde la interfaz gráfica de Herd.

## Comandos útiles de Herd

```php
// Ver todos los sitios disponibles
herd sites

// Ver los logs de Nginx
herd log:nginx

// Ver los logs de PHP
herd log:php

// Reiniciar los servicios
herd restart

// Detener todos los servicios
herd stop

// Iniciar los servicios
herd start

// Abrir el directorio de sites en el Finder
herd open
```

## Herd vs Otras opciones: ¿cuándo usar cada una?

### Usar Herd cuando...

- Quieres empezar a desarrollar lo antes posible sin perder tiempo en configuración.
- Trabajas principalmente en Mac o Windows.
- No necesitas servicios muy específicos o configuraciones de red complejas.
- Eres nuevo en Laravel o en el desarrollo web y quieres concentrarte en aprender el framework.

### Usar Laravel Sail (Docker) cuando...

- Tu equipo usa diferentes sistemas operativos y necesitas un entorno idéntico para todos.
- El proyecto tiene dependencias muy específicas (versiones exactas de MySQL, Redis, etc.).
- Necesitas replicar exactamente el entorno de producción.
- Ya tienes experiencia con Docker y te sientes cómodo con él.

### Usar Homebrew/apt (instalación manual) cuando...

- Quieres control total sobre cada componente del entorno.
- Desarrollas en Linux.
- Tienes necesidades muy específicas que ninguna herramienta de abstracción cubre.

## Herd Pro: ¿vale la pena?

Herd tiene una versión gratuita y una versión Pro de pago (alrededor de $99/año). Las diferencias principales:

| Característica | Herd Free | Herd Pro |
|---|---|---|
| PHP (múltiples versiones) | Si | Si |
| Nginx | Si | Si |
| Sites ilimitados | Si | Si |
| Dominios .test | Si | Si |
| HTTPS local | Si | Si |
| Redis | No | Si |
| Mailpit | No | Si |
| MinIO | No | Si |
| Meilisearch | No | Si |
| Node.js gestionado | No | Si |
| Dumps/debugging | No | Si |

Para la mayoría de proyectos personales y trabajo freelance, la versión gratuita es más que suficiente. La versión Pro es especialmente útil si trabajas en equipos o si necesitas los servicios adicionales sin querer instalarlos por separado.

## Conclusión

Laravel Herd ha cambiado la forma en que los desarrolladores configuran sus entornos locales. Lo que antes requería una tarde de configuración ahora toma menos de 5 minutos. Si estás empezando con Laravel o simplemente quieres simplificar tu workflow, Herd es la opción más recomendable en este momento.

La filosofía detrás de Herd es correcta: los desarrolladores deberían dedicar su tiempo a construir aplicaciones, no a configurar entornos. Y en ese sentido, Herd cumple exactamente lo que promete.
