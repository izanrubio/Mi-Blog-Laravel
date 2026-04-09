---
title: 'Cómo conectar Laravel a MySQL, PostgreSQL y SQLite'
description: 'Conecta Laravel a diferentes bases de datos: MySQL, PostgreSQL y SQLite. Configuración del .env, drivers y solución de errores de conexión frecuentes.'
pubDate: '2026-04-09'
tags: ['laravel', 'base-de-datos', 'mysql', 'postgresql', 'sqlite']
---

# Cómo conectar Laravel a MySQL, PostgreSQL y SQLite

Uno de los primeros pasos al iniciar un proyecto Laravel es configurar la conexión a la base de datos. Laravel soporta múltiples sistemas gestores de bases de datos y cambiar entre ellos es sorprendentemente sencillo. En esta guía veremos cómo conectar Laravel a MySQL, PostgreSQL y SQLite, los tres drivers más utilizados.

## Cómo funciona la configuración de base de datos en Laravel

Laravel usa dos lugares para la configuración de base de datos:

1. **El archivo `.env`**: donde pones las credenciales específicas del entorno (usuario, contraseña, nombre de la base de datos).
2. **El archivo `config/database.php`**: donde están las opciones de configuración avanzadas para cada driver.

En la práctica, para el 90% de los proyectos solo necesitas tocar el `.env`. El `config/database.php` define los valores por defecto y lee del `.env` usando la función `env()`.

## Conectar Laravel a MySQL

MySQL es el sistema de base de datos más popular en el ecosistema Laravel.

### Crear la base de datos en MySQL

Primero, crea la base de datos que usará tu aplicación. Puedes hacerlo desde la terminal de MySQL o con un cliente gráfico como TablePlus o phpMyAdmin:

```php
// Acceder a MySQL:
mysql -u root -p

// Dentro de MySQL:
CREATE DATABASE mi_proyecto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

// Crear un usuario específico para el proyecto (buena práctica):
CREATE USER 'laravel_user'@'localhost' IDENTIFIED BY 'password_seguro';
GRANT ALL PRIVILEGES ON mi_proyecto.* TO 'laravel_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Configurar el .env para MySQL

```php
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_proyecto
DB_USERNAME=laravel_user
DB_PASSWORD=password_seguro
```

### Opciones adicionales en config/database.php

Si necesitas opciones específicas de MySQL, puedes configurarlas en `config/database.php`:

```php
'mysql' => [
    'driver' => 'mysql',
    'url' => env('DATABASE_URL'),
    'host' => env('DB_HOST', '127.0.0.1'),
    'port' => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE', 'forge'),
    'username' => env('DB_USERNAME', 'forge'),
    'password' => env('DB_PASSWORD', ''),
    'unix_socket' => env('DB_SOCKET', ''),
    'charset' => 'utf8mb4',
    'collation' => 'utf8mb4_unicode_ci',
    'prefix' => '',
    'prefix_indexes' => true,
    'strict' => true,
    'engine' => null,
    'options' => extension_loaded('pdo_mysql') ? array_filter([
        PDO::MYSQL_ATTR_SSL_CA => env('MYSQL_ATTR_SSL_CA'),
    ]) : [],
],
```

### Conectar a MySQL en macOS con socket

En macOS, si instalaste MySQL con Homebrew, puede que necesites usar el socket de Unix en lugar de TCP para conectarte. Esto es porque PHP en Mac a veces no puede conectar a `127.0.0.1` por un conflicto entre IPv4 e IPv6:

```php
// Opción 1: Cambiar el host
DB_HOST=127.0.0.1

// Opción 2: Usar el socket de MySQL
DB_CONNECTION=mysql
DB_SOCKET=/tmp/mysql.sock
DB_DATABASE=mi_proyecto
DB_USERNAME=root
DB_PASSWORD=
```

## Conectar Laravel a PostgreSQL

PostgreSQL es la base de datos relacional más avanzada de código abierto. Es especialmente popular en proyectos que necesitan tipos de datos avanzados como JSON, arrays o datos geoespaciales.

### Instalar el driver de PostgreSQL para PHP

En Ubuntu/Linux:

```php
sudo apt install php8.2-pgsql
```

En macOS con Homebrew (suele venir incluido con `brew install php`):

```php
php -m | grep pgsql
// Si no aparece, instala la extensión
```

### Crear la base de datos en PostgreSQL

```php
// Acceder a PostgreSQL:
sudo -u postgres psql

// Crear la base de datos:
CREATE DATABASE mi_proyecto;

// Crear el usuario:
CREATE USER laravel_user WITH PASSWORD 'password_seguro';
GRANT ALL PRIVILEGES ON DATABASE mi_proyecto TO laravel_user;

// En PostgreSQL 15+, también necesitas:
\c mi_proyecto
GRANT ALL ON SCHEMA public TO laravel_user;

\q
```

### Configurar el .env para PostgreSQL

```php
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=mi_proyecto
DB_USERNAME=laravel_user
DB_PASSWORD=password_seguro
```

### Diferencias importantes entre MySQL y PostgreSQL en Laravel

Las migraciones de Laravel funcionan casi igual con ambos, pero hay algunas diferencias a tener en cuenta:

```php
// En MySQL, los strings por defecto son case-insensitive
// En PostgreSQL, son case-sensitive por defecto

// Para búsquedas case-insensitive en PostgreSQL, usa ilike:
$resultados = Producto::where('nombre', 'ilike', '%laravel%')->get();

// En MySQL:
$resultados = Producto::where('nombre', 'like', '%laravel%')->get();
```

También, PostgreSQL maneja los tipos JSON de forma nativa y más eficiente:

```php
// Crear una columna JSON (funciona igual en ambos)
Schema::create('configuraciones', function (Blueprint $table) {
    $table->id();
    $table->json('opciones');
    $table->timestamps();
});

// Consultar dentro de JSON en PostgreSQL
$usuarios = Usuario::whereJsonContains('preferencias->notificaciones', true)->get();
```

## Conectar Laravel a SQLite

SQLite es una base de datos en un solo archivo. No requiere servidor y es perfecta para:

- Desarrollo local cuando no quieres instalar MySQL
- Aplicaciones pequeñas o de escritorio
- Tests automatizados (base de datos en memoria, muy rápida)
- Prototipos rápidos

### Configurar el .env para SQLite

```php
DB_CONNECTION=sqlite
// Dejar las otras variables DB_* vacías o comentarlas
// DB_HOST=
// DB_PORT=
// DB_DATABASE=
// DB_USERNAME=
// DB_PASSWORD=
```

Por defecto, Laravel buscará el archivo de base de datos en `database/database.sqlite`. Créalo:

```php
touch database/database.sqlite
```

### Especificar una ruta personalizada para SQLite

```php
DB_CONNECTION=sqlite
DB_DATABASE=/ruta/absoluta/a/mi-base-de-datos.sqlite
```

O en la configuración de PHP para obtener la ruta absoluta automáticamente:

```php
// config/database.php
'sqlite' => [
    'driver' => 'sqlite',
    'url' => env('DATABASE_URL'),
    'database' => env('DB_DATABASE', database_path('database.sqlite')),
    'prefix' => '',
    'foreign_key_constraints' => env('DB_FOREIGN_KEYS', true),
],
```

### SQLite para tests

Para tests, puedes usar una base de datos SQLite en memoria que se crea y destruye automáticamente:

```php
// phpunit.xml
<env name="DB_CONNECTION" value="sqlite"/>
<env name="DB_DATABASE" value=":memory:"/>
```

Esto hace que tus tests sean extremadamente rápidos porque no hay I/O de disco.

## Ejecutar las migraciones

Una vez configurada la base de datos, ejecuta las migraciones:

```php
php artisan migrate
```

Para resetear toda la base de datos y ejecutar las migraciones desde cero (útil en desarrollo):

```php
php artisan migrate:fresh
```

Con datos de prueba:

```php
php artisan migrate:fresh --seed
```

## Verificar la conexión desde Tinker

La mejor forma de verificar que la conexión funciona correctamente es con Tinker, la consola REPL de Laravel:

```php
php artisan tinker
```

Dentro de Tinker:

```php
// Verificar la conexión a la base de datos
DB::connection()->getPdo();
// Si funciona, verás un objeto PDO. Si falla, verás el error.

// Ver información de la conexión
DB::connection()->getDatabaseName();
// "mi_proyecto"

// Ejecutar una consulta directa
DB::select('SELECT VERSION()');
// [{"VERSION()":"8.0.35"}]  <- MySQL
// O para PostgreSQL:
DB::select('SELECT version()');

// Verificar que las tablas existen
DB::select('SHOW TABLES');  // MySQL
// SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';  // PostgreSQL
```

## Múltiples conexiones de base de datos

Laravel permite trabajar con múltiples bases de datos al mismo tiempo. Esto es útil cuando tienes, por ejemplo, una base de datos de lectura y otra de escritura, o cuando integras datos de sistemas legados.

Configura las conexiones adicionales en el `.env`:

```php
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=mi_proyecto

DB_SECONDARY_CONNECTION=pgsql
DB_SECONDARY_HOST=192.168.1.100
DB_SECONDARY_DATABASE=datos_externos
DB_SECONDARY_USERNAME=usuario
DB_SECONDARY_PASSWORD=password
```

Y en `config/database.php`:

```php
'connections' => [
    'mysql' => [
        'driver' => 'mysql',
        'host' => env('DB_HOST'),
        'database' => env('DB_DATABASE'),
        // ...
    ],
    'secundaria' => [
        'driver' => env('DB_SECONDARY_CONNECTION', 'pgsql'),
        'host' => env('DB_SECONDARY_HOST'),
        'database' => env('DB_SECONDARY_DATABASE'),
        'username' => env('DB_SECONDARY_USERNAME'),
        'password' => env('DB_SECONDARY_PASSWORD'),
        // ...
    ],
],
```

En tu código, especifica qué conexión usar:

```php
// En un modelo Eloquent:
class DatoExterno extends Model
{
    protected $connection = 'secundaria';
}

// Con el Query Builder:
$datos = DB::connection('secundaria')
    ->table('clientes')
    ->where('activo', true)
    ->get();
```

## Errores comunes de conexión

### SQLSTATE[HY000] [2002] Connection refused

MySQL no está corriendo. Inícialo:

```php
// Ubuntu/Linux:
sudo systemctl start mysql

// macOS con Homebrew:
brew services start mysql

// macOS con DBngin: ábrelo y activa el servicio
```

### SQLSTATE[HY000] [1045] Access denied for user

Credenciales incorrectas. Verifica el `DB_USERNAME` y `DB_PASSWORD` en tu `.env`. También verifica que el usuario tiene permisos para acceder a la base de datos:

```php
// En MySQL:
SHOW GRANTS FOR 'laravel_user'@'localhost';
```

### SQLSTATE[HY000] [1049] Unknown database

La base de datos no existe. Créala manualmente o asegúrate de que el nombre en `DB_DATABASE` es correcto.

### Class 'PDO' not found

La extensión PDO o el driver específico no está instalado:

```php
// Verificar extensiones de PHP:
php -m | grep pdo

// Instalar en Ubuntu:
sudo apt install php8.2-mysql    // Para MySQL
sudo apt install php8.2-pgsql   // Para PostgreSQL
sudo apt install php8.2-sqlite3 // Para SQLite
```

Después de instalar las extensiones, reinicia PHP-FPM si lo usas:

```php
sudo systemctl restart php8.2-fpm
```

## Conclusión

La configuración de base de datos en Laravel es muy sencilla gracias al archivo `.env`. Lo más importante es tener el driver correcto instalado en PHP y las credenciales correctas en el `.env`. Una vez configurada, usa `php artisan tinker` para verificar la conexión antes de ejecutar las migraciones.

Para proyectos de desarrollo que arrancan rápido, SQLite es tu mejor amigo. Para producción, MySQL o PostgreSQL son la elección estándar dependiendo de tus necesidades específicas.
