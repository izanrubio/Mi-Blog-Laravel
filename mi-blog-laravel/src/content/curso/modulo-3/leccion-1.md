---
modulo: 3
leccion: 1
title: 'Configurar la base de datos'
description: 'Aprende a conectar Laravel con MySQL, PostgreSQL y SQLite configurando correctamente el archivo .env y database.php.'
duracion: '12 min'
quiz:
  - pregunta: '¿En qué archivo de Laravel se configuran las credenciales de la base de datos?'
    opciones:
      - 'config/app.php'
      - 'config/database.php'
      - '.env'
      - 'bootstrap/app.php'
    correcta: 2
    explicacion: 'Las credenciales de la base de datos se definen en el archivo .env, que es leído por config/database.php a través de la función env().'
  - pregunta: '¿Cuál es el driver de base de datos que usa Laravel por defecto en instalaciones nuevas?'
    opciones:
      - 'pgsql'
      - 'sqlite'
      - 'mysql'
      - 'sqlsrv'
    correcta: 1
    explicacion: 'Desde Laravel 11, la configuración por defecto usa SQLite para facilitar el inicio rápido sin necesidad de servidor de base de datos.'
  - pregunta: '¿Qué comando de Artisan permite verificar la conexión a la base de datos?'
    opciones:
      - 'php artisan db:ping'
      - 'php artisan migrate:status'
      - 'php artisan db:show'
      - 'php artisan config:check'
    correcta: 2
    explicacion: 'El comando php artisan db:show muestra información detallada sobre la conexión activa y las tablas existentes en la base de datos.'
---

## Configurar la base de datos en Laravel

Una de las primeras tareas al iniciar un proyecto con Laravel es conectarlo a una base de datos. Laravel soporta varios motores: MySQL, PostgreSQL, SQLite y SQL Server. La configuración es sencilla y se centraliza en dos lugares: el archivo `.env` y el archivo `config/database.php`.

## El archivo .env

El archivo `.env` se encuentra en la raíz del proyecto y contiene variables de entorno específicas de cada instalación. Nunca debe subirse al repositorio (ya está en `.gitignore` por defecto). Aquí se definen las credenciales de la base de datos:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_blog
DB_USERNAME=root
DB_PASSWORD=secreto
```

Cada variable tiene un propósito claro:

- `DB_CONNECTION`: el driver a usar (`mysql`, `pgsql`, `sqlite`, `sqlsrv`)
- `DB_HOST`: la dirección del servidor de base de datos
- `DB_PORT`: el puerto (3306 para MySQL, 5432 para PostgreSQL)
- `DB_DATABASE`: el nombre de la base de datos
- `DB_USERNAME` y `DB_PASSWORD`: las credenciales de acceso

## El archivo config/database.php

Este archivo lee las variables del `.env` mediante la función `env()` y define los parámetros de cada conexión disponible. No es necesario modificarlo directamente en la mayoría de los casos, pero es útil conocerlo:

```php
'connections' => [

    'sqlite' => [
        'driver'   => 'sqlite',
        'database' => env('DB_DATABASE', database_path('database.sqlite')),
        'prefix'   => '',
    ],

    'mysql' => [
        'driver'      => 'mysql',
        'host'        => env('DB_HOST', '127.0.0.1'),
        'port'        => env('DB_PORT', '3306'),
        'database'    => env('DB_DATABASE', 'laravel'),
        'username'    => env('DB_USERNAME', 'root'),
        'password'    => env('DB_PASSWORD', ''),
        'charset'     => 'utf8mb4',
        'collation'   => 'utf8mb4_unicode_ci',
        'prefix'      => '',
        'strict'      => true,
        'engine'      => null,
    ],

    'pgsql' => [
        'driver'   => 'pgsql',
        'host'     => env('DB_HOST', '127.0.0.1'),
        'port'     => env('DB_PORT', '5432'),
        'database' => env('DB_DATABASE', 'laravel'),
        'username' => env('DB_USERNAME', 'postgres'),
        'password' => env('DB_PASSWORD', ''),
        'charset'  => 'utf8',
        'prefix'   => '',
        'schema'   => 'public',
    ],

],
```

## Configurar MySQL

MySQL es el motor más popular en proyectos Laravel. Para usarlo, necesitas tenerlo instalado y crear la base de datos primero:

```sql
CREATE DATABASE mi_blog CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Luego actualiza el `.env`:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_blog
DB_USERNAME=tu_usuario
DB_PASSWORD=tu_contraseña
```

El charset `utf8mb4` es importante porque soporta emojis y caracteres especiales. Evita usar `utf8` a secas en MySQL, ya que es una implementación incompleta.

## Configurar PostgreSQL

PostgreSQL es una excelente alternativa a MySQL, especialmente para proyectos que necesitan funciones avanzadas como JSON nativo, búsqueda de texto completo o transacciones más robustas:

```bash
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=mi_blog
DB_USERNAME=postgres
DB_PASSWORD=tu_contraseña
```

Crea la base de datos en PostgreSQL así:

```sql
CREATE DATABASE mi_blog;
```

## Configurar SQLite

SQLite es ideal para desarrollo local, pruebas o proyectos pequeños porque no requiere servidor. Laravel 11 lo usa por defecto:

```bash
DB_CONNECTION=sqlite
DB_DATABASE=/ruta/absoluta/al/proyecto/database/database.sqlite
```

También puedes dejar la variable `DB_DATABASE` vacía si usas la ruta por defecto, o crear el archivo manualmente:

```bash
touch database/database.sqlite
```

## Verificar la conexión

Una vez configurado el `.env`, puedes verificar que Laravel conecta correctamente con la base de datos usando Artisan:

```bash
php artisan db:show
```

Este comando muestra el driver, la base de datos, el host, el puerto y un listado de las tablas existentes. Si hay un error de conexión, verás un mensaje descriptivo.

También puedes usar Tinker para probar directamente:

```bash
php artisan tinker
```

```php
DB::connection()->getPdo();
```

Si no lanza ninguna excepción, la conexión es exitosa.

## Limpiar la caché de configuración

Laravel cachea la configuración para mejorar el rendimiento. Si modificas el `.env` y los cambios no se reflejan, debes limpiar la caché:

```bash
php artisan config:clear
php artisan config:cache
```

En desarrollo es recomendable no cachear la configuración, ya que cada cambio en el `.env` requeriría limpiarla manualmente.

## Múltiples conexiones

Laravel permite definir y usar múltiples conexiones de base de datos en un mismo proyecto. Puedes especificar la conexión al hacer consultas:

```php
$usuarios = DB::connection('mysql')->table('users')->get();
$reportes  = DB::connection('pgsql')->table('reportes')->get();
```

También puedes definir la conexión en el modelo:

```php
class Reporte extends Model
{
    protected $connection = 'pgsql';
}
```

Esto es útil en sistemas que leen datos de diferentes fuentes o que mantienen bases de datos separadas por módulo o tenancy.

## Buenas prácticas

- Nunca subas el archivo `.env` al repositorio. Sube solo el `.env.example` con valores vacíos o de ejemplo.
- Usa contraseñas fuertes incluso en entornos de desarrollo.
- En producción, considera usar variables de entorno del sistema operativo en lugar del archivo `.env`.
- Siempre usa `utf8mb4` en MySQL para evitar problemas con caracteres especiales.
- Crea la base de datos antes de ejecutar las migraciones.

Con la base de datos correctamente configurada, el siguiente paso es crear las tablas mediante migraciones, que veremos en la próxima lección.
