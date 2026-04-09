---
title: 'SQLSTATE error de conexión a base de datos en Laravel'
description: 'Soluciona el error SQLSTATE[HY000] en Laravel: credenciales incorrectas, servicio MySQL apagado, host incorrecto y otros problemas de conexión.'
pubDate: '2024-02-03'
tags: ['laravel', 'errores', 'base-de-datos', 'mysql']
---

# SQLSTATE error de conexión a base de datos en Laravel

Pocos errores en Laravel son tan frustrantes como los de conexión a base de datos. Aparecen en el momento más inoportuno y el mensaje de error suele ser críptico para alguien que no está familiarizado con los códigos SQLSTATE. En esta guía vamos a ver los errores SQLSTATE más comunes, qué significan exactamente y cómo solucionarlos.

## Entendiendo los códigos SQLSTATE

Los errores SQLSTATE son códigos estandarizados que PDO (la capa de abstracción de base de datos de PHP) usa para comunicar errores. Tienen la forma `SQLSTATE[XXXXX]` seguido de un mensaje más descriptivo.

Los más comunes en Laravel son:

- `SQLSTATE[HY000] [2002]` — No se puede conectar (servidor apagado, host incorrecto)
- `SQLSTATE[HY000] [1045]` — Acceso denegado (credenciales incorrectas)
- `SQLSTATE[HY000] [1049]` — Base de datos desconocida (la BD no existe)
- `SQLSTATE[42S02]` — Tabla no encontrada
- `SQLSTATE[23000]` — Violación de integridad (duplicate key, foreign key)

Veamos cada uno en detalle.

## Error SQLSTATE[HY000] [2002]: Connection refused / No such file or directory

Este es el error más común y significa que PHP no puede conectarse al servidor de base de datos. Las causas posibles son:

### Causa 1: MySQL no está corriendo

```php
SQLSTATE[HY000] [2002] Connection refused
```

Verifica si MySQL está corriendo:

```php
// En Ubuntu/Linux:
sudo systemctl status mysql

// Si está parado, inícialo:
sudo systemctl start mysql

// Para que arranque automáticamente al iniciar el servidor:
sudo systemctl enable mysql
```

En macOS:

```php
// Con Homebrew:
brew services list | grep mysql
brew services start mysql

// Con MySQL.app: ábrelo y activa el servicio desde la interfaz
```

### Causa 2: El host en el .env es incorrecto

```php
// Verifica estas líneas en tu .env:
DB_HOST=127.0.0.1
DB_PORT=3306
```

En macOS, especialmente con MySQL instalado mediante Homebrew o DBngin, a veces el problema es que PHP intenta conectar por socket de Unix cuando usas `localhost`, pero el socket no está donde PHP lo busca. Usa `127.0.0.1` (IP) en lugar de `localhost` para forzar la conexión TCP:

```php
DB_HOST=127.0.0.1  // Fuerza conexión TCP
// En lugar de:
DB_HOST=localhost   // Puede intentar conexión por socket
```

### Causa 3: El puerto es incorrecto

Si MySQL está corriendo en un puerto diferente al estándar (3306):

```php
// Verifica en qué puerto está MySQL:
sudo netstat -tlnp | grep mysql
// O:
sudo ss -tlnp | grep mysql

// Ajusta el puerto en .env:
DB_PORT=3307  // Si está en 3307
```

### Causa 4: Con Laravel Sail/Docker, el host es incorrecto

Dentro de los contenedores Docker, `127.0.0.1` no apunta al servicio MySQL del host, sino al propio contenedor. Debes usar el nombre del servicio definido en `docker-compose.yml`:

```php
// En .env cuando usas Sail:
DB_HOST=mysql  // No 127.0.0.1
```

## Error SQLSTATE[HY000] [1045]: Access denied for user

```php
SQLSTATE[HY000] [1045] Access denied for user 'root'@'localhost' (using password: YES)
```

Este error significa que el usuario y/o la contraseña son incorrectos.

### Solución 1: Verificar las credenciales

Primero, intenta conectarte manualmente desde la terminal para verificar que las credenciales son correctas:

```php
mysql -u tu_usuario -p -h 127.0.0.1
// Introduce la contraseña cuando te la pida
// Si puedes conectar, las credenciales son correctas
```

### Solución 2: Limpiar la caché de configuración

Una causa muy común que se pasa por alto: tienes credenciales correctas en el `.env`, pero la caché de configuración tiene las credenciales antiguas:

```php
php artisan config:clear
php artisan cache:clear
```

Después de limpiar la caché, vuelve a intentar la conexión.

### Solución 3: El usuario no existe o no tiene permisos

```php
// Conéctate como root:
sudo mysql -u root

// Verifica que el usuario existe:
SELECT user, host FROM mysql.user;

// Si no existe, créalo:
CREATE USER 'mi_usuario'@'localhost' IDENTIFIED BY 'mi_password';
GRANT ALL PRIVILEGES ON mi_base_de_datos.* TO 'mi_usuario'@'localhost';
FLUSH PRIVILEGES;
```

Nota el `@'localhost'` vs `@'127.0.0.1'`: en MySQL, `localhost` y `127.0.0.1` son tratados como hosts diferentes. Si tu aplicación conecta por `127.0.0.1`, el usuario debe tener permisos para `'usuario'@'127.0.0.1'`:

```php
GRANT ALL PRIVILEGES ON mi_base_de_datos.* TO 'mi_usuario'@'127.0.0.1';
FLUSH PRIVILEGES;
```

### Solución 4: Cambiar la contraseña del usuario

```php
// En MySQL:
ALTER USER 'mi_usuario'@'localhost' IDENTIFIED BY 'nueva_password';
FLUSH PRIVILEGES;
```

## Error SQLSTATE[HY000] [1049]: Unknown database

```php
SQLSTATE[HY000] [1049] Unknown database 'mi_base_de_datos'
```

La base de datos que especificaste en `DB_DATABASE` no existe. Créala:

```php
// En MySQL:
CREATE DATABASE mi_base_de_datos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

O verifica el nombre correcto en el `.env`:

```php
// Si la base de datos se llama "mi_proyecto_db" pero escribiste "mi_proyecto":
DB_DATABASE=mi_proyecto_db  // Nombre exacto de la base de datos
```

## Error SQLSTATE[42S02]: Table not found

```php
SQLSTATE[42S02]: Base table or view not found: 1146 Table 'mi_bd.products' doesn't exist
```

La tabla no existe. Esto suele ocurrir porque:

1. No has ejecutado las migraciones
2. Ejecutaste las migraciones en una base de datos diferente
3. Alguien borró la tabla manualmente

Solución:

```php
// Ejecutar las migraciones pendientes:
php artisan migrate

// Ver el estado de las migraciones:
php artisan migrate:status

// Si necesitas recrear todo desde cero (en desarrollo):
php artisan migrate:fresh --seed
```

## Error SQLSTATE[23000]: Integrity constraint violation

```php
SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry 'valor' for key 'PRIMARY'
```

Estás intentando insertar un valor que ya existe en una columna con restricción de unicidad (PRIMARY KEY o UNIQUE).

En Laravel, esto suele ocurrir cuando:

- Ejecutas seeders más de una vez sin limpiar los datos previos
- Intentas crear un registro con un email que ya existe

```php
// En lugar de crear y fallar, usa firstOrCreate:
$usuario = User::firstOrCreate(
    ['email' => 'usuario@ejemplo.com'],
    ['name' => 'Juan', 'password' => bcrypt('password')]
);

// O updateOrCreate para actualizar si existe:
$usuario = User::updateOrCreate(
    ['email' => 'usuario@ejemplo.com'],
    ['name' => 'Juan García']
);
```

## Metodología de diagnóstico

Cuando encuentres un error de conexión, sigue estos pasos en orden:

### Paso 1: Limpia la caché de configuración

```php
php artisan config:clear
```

Este es siempre el primer paso. La caché puede tener valores desactualizados.

### Paso 2: Verifica el .env

Abre `.env` y verifica que cada valor es correcto. Un error tipográfico en la contraseña es más común de lo que parece.

### Paso 3: Verifica que MySQL está corriendo

```php
// Linux:
sudo systemctl status mysql

// macOS:
brew services list
```

### Paso 4: Prueba la conexión desde la terminal

```php
mysql -u tu_usuario -p -h 127.0.0.1 nombre_base_datos
```

Si este comando funciona, la configuración de MySQL es correcta y el problema es en Laravel (probablemente la caché).

### Paso 5: Verifica la conexión desde Tinker

```php
php artisan tinker
```

Dentro de Tinker:

```php
// Verificar la conexión
DB::connection()->getPdo();

// Si hay error, verás el mensaje completo
// Si funciona, verás el objeto PDO

// Ver qué configuración está usando Laravel actualmente:
config('database.connections.mysql');
// Esto muestra todos los parámetros de conexión que Laravel está usando
```

### Paso 6: Añadir logging de errores temporalmente

Si aún no puedes identificar el problema, añade logging temporal:

```php
// En AppServiceProvider::boot() o en una ruta de prueba:
try {
    DB::connection()->getPdo();
    echo "Conexión exitosa a: " . DB::connection()->getDatabaseName();
} catch (\Exception $e) {
    echo "Error de conexión: " . $e->getMessage();
}
```

## Problema específico: conexión por socket en macOS

En macOS con MySQL instalado vía Homebrew, PHP puede intentar conectar por socket de Unix en lugar de TCP. El socket suele estar en `/tmp/mysql.sock` con Homebrew y en `/var/run/mysqld/mysqld.sock` en Linux.

Si tienes el error `[2002] No such file or directory`, puede que sea el socket:

```php
// Opción 1: forzar TCP con 127.0.0.1
DB_HOST=127.0.0.1

// Opción 2: especificar el socket directamente
// En config/database.php:
'mysql' => [
    'driver' => 'mysql',
    'unix_socket' => env('DB_SOCKET', '/tmp/mysql.sock'),
    // ... resto de la configuración
],

// Y en .env:
DB_SOCKET=/tmp/mysql.sock
```

Puedes encontrar la ubicación del socket ejecutando:

```php
mysql -u root -e "SHOW VARIABLES LIKE 'socket';"
```

## Configuración en Docker/Sail

Si usas Laravel Sail, recuerda que la conexión de base de datos se hace entre contenedores, no entre tu máquina y un servicio local:

```php
// .env correcto para Sail:
DB_CONNECTION=mysql
DB_HOST=mysql          // Nombre del servicio en docker-compose.yml
DB_PORT=3306
DB_DATABASE=laravel
DB_USERNAME=sail
DB_PASSWORD=password
```

Si intentas conectarte con `127.0.0.1` dentro del contenedor, estarás intentando conectar al contenedor mismo, no al servicio MySQL.

## Conclusión

Los errores SQLSTATE en Laravel tienen siempre una causa identificable. El proceso de diagnóstico es sistemático: primero limpia la caché de configuración, luego verifica que el servidor de base de datos está corriendo, después confirma las credenciales conectándote directamente con MySQL desde la terminal, y finalmente usa Tinker para verificar la conexión desde Laravel.

La clave está en no asumir nada: verifica cada componente de la cadena de conexión por separado hasta encontrar dónde está la rotura.
