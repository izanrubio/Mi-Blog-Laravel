---
title: 'Composer: qué es y cómo instalarlo para usar Laravel'
description: 'Guía completa sobre Composer, el gestor de dependencias de PHP. Aprende a instalarlo, entender composer.json y gestionar paquetes para tus proyectos Laravel.'
pubDate: '2026-04-16'
tags: ['laravel', 'composer', 'instalacion', 'roadmap']
---

Antes de que existiera Composer, instalar una librería PHP significaba descargar un ZIP, copiarlo en tu proyecto y rezar para que no entrara en conflicto con otra cosa. Hoy Composer resuelve todo eso: descarga, gestiona versiones y configura el autoloading automáticamente. Sin él no puedes instalar Laravel. Con él, instalar Laravel es un único comando.

## Qué es Composer y por qué existe

Composer es el **gestor de dependencias oficial de PHP**, lanzado en 2012. Su trabajo es:

1. Leer qué paquetes necesita tu proyecto.
2. Descargarlos desde [Packagist](https://packagist.org), el repositorio central.
3. Resolver versiones compatibles entre todos los paquetes.
4. Generar el autoloader para que PHP encuentre las clases automáticamente.

Es equivalente a `npm` en JavaScript, `pip` en Python o `cargo` en Rust. Laravel y prácticamente todos los frameworks PHP modernos dependen de él.

## Instalación en Linux

En la mayoría de distribuciones Linux el proceso es el mismo. Primero necesitas PHP instalado:

```bash
php --version
# PHP 8.3.x (cli)
```

Si no lo tienes, en Ubuntu/Debian:

```bash
sudo apt update
sudo apt install php php-cli php-mbstring php-xml php-curl unzip
```

Luego instala Composer globalmente:

```bash
# Descarga el instalador
curl -sS https://getcomposer.org/installer -o composer-setup.php

# Verifica el hash (opcional pero recomendado)
HASH="$(curl -sS https://composer.github.io/installer.sig)"
php -r "if (hash_file('SHA384', 'composer-setup.php') === '$HASH') { echo 'Installer verified'; } else { echo 'Installer corrupt'; unlink('composer-setup.php'); } echo PHP_EOL;"

# Instala el binario globalmente
sudo php composer-setup.php --install-dir=/usr/local/bin --filename=composer

# Verifica la instalación
composer --version
# Composer version 2.x.x
```

## Instalación en macOS

En macOS la forma más limpia es usar Homebrew:

```bash
brew install composer
composer --version
```

Si no tienes Homebrew, puedes usar el mismo método manual de Linux (curl + php installer).

## Instalación en Windows

En Windows la opción más sencilla es usar el instalador oficial:

```bash
# Descarga Composer-Setup.exe desde https://getcomposer.org/download/
# Ejecuta el instalador, selecciona tu ejecutable PHP
# El instalador añade Composer al PATH automáticamente

# Verifica en PowerShell o CMD
composer --version
```

Alternativamente con Scoop:

```bash
scoop install composer
```

O con Chocolatey:

```bash
choco install composer
```

## El archivo composer.json

Este es el corazón de cualquier proyecto PHP. Describe las dependencias y la configuración del proyecto:

```json
{
    "name": "mi-empresa/mi-proyecto",
    "description": "Mi aplicación Laravel",
    "type": "project",
    "require": {
        "php": "^8.2",
        "laravel/framework": "^11.0",
        "guzzlehttp/guzzle": "^7.0"
    },
    "require-dev": {
        "laravel/pint": "^1.0",
        "phpunit/phpunit": "^11.0",
        "fakerphp/faker": "^1.23"
    },
    "autoload": {
        "psr-4": {
            "App\\": "app/",
            "Database\\Factories\\": "database/factories/",
            "Database\\Seeders\\": "database/seeders/"
        }
    },
    "autoload-dev": {
        "psr-4": {
            "Tests\\": "tests/"
        }
    },
    "scripts": {
        "post-update-cmd": [
            "@php artisan vendor:publish --tag=laravel-assets --ansi --force"
        ]
    },
    "minimum-stability": "stable",
    "prefer-stable": true
}
```

### require vs require-dev

La diferencia es crucial para producción:

- **`require`**: paquetes necesarios para que la aplicación funcione. Se instalan siempre.
- **`require-dev`**: paquetes solo necesarios en desarrollo (tests, linters, generadores de código). En producción se excluyen con `--no-dev`.

```bash
# En producción, no instales dependencias de desarrollo
composer install --no-dev --optimize-autoloader
```

## El archivo composer.lock

Cuando ejecutas `composer install` por primera vez, Composer genera `composer.lock`. Este archivo registra las versiones **exactas** de cada paquete instalado, incluyendo las dependencias de las dependencias.

```json
{
    "_readme": [
        "This file is locked, do not edit it manually."
    ],
    "content-hash": "abc123...",
    "packages": [
        {
            "name": "laravel/framework",
            "version": "v11.3.0",
            "source": { ... },
            ...
        }
    ]
}
```

**Regla de oro**: el archivo `composer.lock` debe estar en el control de versiones (git). Así todos los desarrolladores del equipo y los servidores de producción instalarán exactamente las mismas versiones. `composer.json` dice "quiero esta versión o superior", `composer.lock` dice "instala exactamente esta versión".

## Comandos esenciales de Composer

### composer install

Instala las dependencias definidas en `composer.lock`. Úsalo cuando clonas un proyecto existente:

```bash
composer install
```

### composer update

Actualiza los paquetes a las versiones más recientes compatibles con las restricciones de `composer.json` y regenera `composer.lock`:

```bash
# Actualizar todo (úsalo con cuidado)
composer update

# Actualizar solo un paquete específico
composer update laravel/framework
```

### composer require

Añade un nuevo paquete al proyecto, lo instala y actualiza `composer.json` y `composer.lock`:

```bash
# Añadir una dependencia de producción
composer require spatie/laravel-permission

# Añadir una dependencia de desarrollo
composer require --dev laravel/telescope
```

### composer remove

Elimina un paquete:

```bash
composer remove spatie/laravel-permission
```

### composer dump-autoload

Regenera el archivo de autoloading sin instalar ni actualizar paquetes. Necesario cuando añades clases nuevas que no están en los directorios de PSR-4:

```bash
composer dump-autoload
# o más rápido si no necesitas recalcular todo
composer dump-autoload --optimize
```

### composer show

Muestra información sobre los paquetes instalados:

```bash
# Ver todos los paquetes instalados
composer show

# Ver detalles de un paquete específico
composer show laravel/framework
```

## PSR-4 y el autoloading

PSR-4 es el estándar que define cómo mapear namespaces PHP a directorios del filesystem. Laravel lo configura así en su `composer.json`:

```json
"autoload": {
    "psr-4": {
        "App\\": "app/"
    }
}
```

Esto significa que cualquier clase con namespace `App\Something\MiClase` se buscará en `app/Something/MiClase.php`. Gracias a esto puedes escribir:

```php
<?php

use App\Models\Usuario;
use App\Http\Controllers\UsuarioController;
```

Y PHP sabe exactamente dónde encontrar esos archivos sin que tengas que escribir ningún `require` o `include` manualmente.

Si creas clases fuera de los directorios configurados en PSR-4, necesitas ejecutar `composer dump-autoload` para que Composer las registre.

## Instalando Laravel con Composer

Una vez que tienes Composer instalado, crear un proyecto Laravel nuevo es así de simple:

```bash
# Crear un nuevo proyecto Laravel en la carpeta "mi-proyecto"
composer create-project laravel/laravel mi-proyecto

# O usando el instalador de Laravel (lo instala globalmente primero)
composer global require laravel/installer
laravel new mi-proyecto

# Entrar al directorio
cd mi-proyecto

# Iniciar el servidor de desarrollo
php artisan serve
```

El comando `create-project` descarga la plantilla oficial de Laravel, instala todas sus dependencias y configura el autoloading. En cuestión de minutos tienes una aplicación funcional.

## Versiones y restricciones

Composer usa semver (versionado semántico) para las restricciones de versión:

```json
{
    "require": {
        "vendor/paquete": "^2.0",   // >= 2.0.0 y < 3.0.0
        "vendor/otro": "~1.5",      // >= 1.5.0 y < 2.0.0
        "vendor/fijo": "1.2.3",     // exactamente 1.2.3
        "vendor/rango": ">=1.0 <2.0"
    }
}
```

El prefijo `^` es el más común en proyectos Laravel. Permite actualizaciones de parche y menor pero bloquea cambios con ruptura de compatibilidad (major).

## Conclusión

Composer no es un detalle opcional del ecosistema PHP: es la infraestructura sobre la que está construido Laravel. Entender su funcionamiento, los archivos que genera y los comandos básicos te ahorra horas de confusión. Con esto ya puedes instalar Laravel, añadir paquetes y entender qué hace el framework cada vez que ejecutas `composer install` en un proyecto nuevo.
