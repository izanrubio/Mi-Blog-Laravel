---
title: 'Cómo instalar Laravel 13 en Windows paso a paso'
description: 'Guía completa para instalar Laravel 13 en Windows usando Composer y PHP. Cubre requisitos, configuración del PATH y primer proyecto.'
pubDate: '2026-04-10'
tags: ['laravel', 'instalacion', 'windows']
---

# Cómo instalar Laravel 13 en Windows paso a paso

Instalar Laravel en Windows puede parecer intimidante la primera vez, especialmente si no tienes experiencia configurando entornos de desarrollo. En esta guía vamos a recorrer cada paso con calma, desde instalar PHP hasta tener tu primera aplicación corriendo en el navegador. No vamos a omitir nada.

## Requisitos previos

Antes de empezar necesitas tener claro qué vas a instalar y por qué:

- **PHP 8.3 o superior**: Laravel 13 requiere PHP 8.3 como mínimo.
- **Composer**: el gestor de dependencias de PHP, es como npm pero para PHP.
- **Una terminal**: PowerShell o CMD funcionan, aunque recomiendo usar Windows Terminal.

No necesitas XAMPP ni WAMP para desarrollar con Laravel moderno. De hecho, te recomiendo evitarlos porque complican más de lo que ayudan.

## Paso 1: Instalar PHP en Windows

Ve a [https://windows.php.net/download/](https://windows.php.net/download/) y descarga la versión **Thread Safe** de PHP 8.3 o superior en formato ZIP.

Una vez descargado:

1. Crea la carpeta `C:\php` y extrae el contenido del ZIP ahí.
2. Dentro de esa carpeta verás un archivo llamado `php.ini-development`. Cópialo y renómbralo a `php.ini`.
3. Abre `php.ini` con un editor de texto y busca las siguientes líneas. Quita el `;` del inicio para activarlas:

```php
; Descomenta estas líneas en php.ini
extension=curl
extension=fileinfo
extension=mbstring
extension=openssl
extension=pdo_mysql
extension=pdo_sqlite
extension=sqlite3
extension=zip
```

Guarda el archivo.

### Agregar PHP al PATH de Windows

Para que puedas ejecutar `php` desde cualquier carpeta en la terminal, necesitas agregar PHP al PATH del sistema:

1. Busca "variables de entorno" en el menú de inicio de Windows.
2. Haz clic en "Variables de entorno...".
3. En la sección "Variables del sistema", busca `Path` y haz doble clic.
4. Haz clic en "Nuevo" y escribe `C:\php`.
5. Acepta todos los diálogos.

Abre una nueva terminal (importante: **nueva** terminal, no la que tenías abierta) y verifica que PHP funciona:

```php
// En la terminal, no es código PHP sino un comando:
// php --version
// Deberías ver algo como:
// PHP 8.2.x (cli)
```

Si ves el número de versión, PHP está correctamente instalado.

## Paso 2: Instalar Composer

Composer es el gestor de dependencias de PHP y es indispensable para trabajar con Laravel.

Descarga el instalador oficial desde [https://getcomposer.org/Composer-Setup.exe](https://getcomposer.org/Composer-Setup.exe) y ejecútalo. El instalador detectará automáticamente tu instalación de PHP en `C:\php\php.exe`.

Durante la instalación, el asistente te preguntará si quieres instalar Composer globalmente. Elige que sí. Esto agrega Composer al PATH automáticamente.

Verifica la instalación:

```php
// composer --version
// Composer version 2.x.x
```

## Paso 3: Crear tu primer proyecto Laravel

Ahora viene la parte divertida. Navega a la carpeta donde quieres guardar tus proyectos (por ejemplo, `C:\proyectos`) y ejecuta:

```php
composer create-project laravel/laravel mi-primer-proyecto
```

Composer descargará Laravel y todas sus dependencias. Esto puede tardar un par de minutos dependiendo de tu conexión. Al terminar, tendrás una carpeta `mi-primer-proyecto` con toda la estructura de Laravel.

Entra a la carpeta:

```php
// cd mi-primer-proyecto
```

## Paso 4: Configurar el archivo .env

Laravel usa un archivo `.env` para almacenar la configuración del entorno. Cuando creas el proyecto con Composer, este archivo se genera automáticamente a partir de `.env.example`.

Abre el archivo `.env` con tu editor. Las variables más importantes al inicio son:

```php
APP_NAME=MiPrimerProyecto
APP_ENV=local
APP_KEY=base64:... // Esta se genera automáticamente
APP_DEBUG=true
APP_URL=http://localhost:8000
```

Si por algún motivo el `APP_KEY` está vacío, genera uno con:

```php
// php artisan key:generate
```

Para conectar a una base de datos (no es obligatorio para empezar), configura estas variables:

```php
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_base_de_datos
DB_USERNAME=root
DB_PASSWORD=tu_password
```

## Paso 5: Levantar el servidor de desarrollo

Laravel incluye un servidor de desarrollo que puedes usar directamente sin necesitar Nginx ni Apache:

```php
php artisan serve
```

Verás en la terminal algo como:

```
INFO  Server running on [http://127.0.0.1:8000].
```

Abre tu navegador en `http://localhost:8000` y deberías ver la página de bienvenida de Laravel. ¡Felicidades, Laravel está funcionando!

## Solución de problemas comunes en Windows

### Error: "php" no se reconoce como comando interno

Este error significa que PHP no está en el PATH. Revisa el Paso 1 y asegúrate de haber abierto una **nueva** terminal después de modificar las variables de entorno.

### Error: OpenSSL extension not loaded

Abre tu `php.ini` y verifica que `extension=openssl` no tiene el `;` al principio. También verifica que en `C:\php\ext\` existe el archivo `php_openssl.dll`.

Además, busca esta línea en `php.ini` y ajústala:

```php
; Busca y descomenta esta línea, apuntando a tu carpeta de extensiones
extension_dir = "C:/php/ext"
```

### Error: Class "PDO" not found

Esto indica que las extensiones de base de datos no están cargadas. Asegúrate de haber descomentado `extension=pdo_mysql` y `extension=pdo_sqlite` en tu `php.ini`.

### Error de Composer: "Minimum stability"

A veces Composer se queja de versiones inestables. Asegúrate de estar usando el comando correcto:

```php
composer create-project laravel/laravel nombre-proyecto --prefer-dist
```

### Error: "The stream or file could not be opened"

Este es un error de permisos en la carpeta `storage`. Aunque es menos común en Windows, puedes solucionarlo ejecutando la terminal como administrador o verificando que la carpeta `storage/logs` existe y tiene permisos de escritura.

## Estructura del proyecto que acabas de crear

Una vez dentro del proyecto, la estructura de carpetas más importante es:

```php
mi-primer-proyecto/
├── app/           // Tu código: Modelos, Controladores, etc.
│   ├── Http/
│   │   └── Controllers/
│   └── Models/
├── config/        // Archivos de configuración
├── database/      // Migraciones y seeders
├── public/        // La carpeta pública (aquí apunta el servidor web)
├── resources/     // Vistas Blade, CSS, JavaScript
├── routes/        // Definición de rutas (web.php, api.php)
├── storage/       // Logs, caché, archivos subidos
├── .env           // Configuración del entorno (NO subir a git)
└── artisan        // La herramienta de línea de comandos de Laravel
```

## Comandos útiles para empezar

Una vez que tienes Laravel funcionando, estos son los comandos que más vas a usar al principio:

```php
// Ver todas las rutas registradas
php artisan route:list

// Crear un controlador
php artisan make:controller ProductoController

// Crear un modelo con su migración
php artisan make:model Producto -m

// Ejecutar las migraciones
php artisan migrate

// Abrir la consola interactiva de Laravel (Tinker)
php artisan tinker

// Limpiar la caché de configuración
php artisan config:clear

// Limpiar la caché de rutas
php artisan route:clear
```

## Siguiente paso: Laravel Herd como alternativa

Si encuentras que la configuración manual de PHP en Windows te da muchos problemas, existe **Laravel Herd para Windows** ([herd.laravel.com](https://herd.laravel.com)). Es una aplicación que instala PHP, Nginx y todo lo necesario en un solo clic, sin tocar el PATH ni ninguna configuración del sistema.

Es especialmente útil si trabajas con varios proyectos al mismo tiempo, porque gestiona automáticamente los dominios locales (por ejemplo, `mi-proyecto.test`).

## Conclusión

Instalar Laravel en Windows requiere paciencia la primera vez, pero una vez que tienes PHP y Composer funcionando correctamente, crear nuevos proyectos es tan simple como ejecutar `composer create-project`. Lo más importante es verificar cada paso antes de continuar al siguiente, especialmente la configuración del PATH y las extensiones de PHP.

Si sigues teniendo problemas después de revisar esta guía, los canales de Discord de Laravel y los foros de Laracasts son excelentes recursos donde la comunidad responde rápido.
