---
title: 'Queue-SQL en Laravel: Operaciones Masivas Paralelas'
description: 'Aprende a ejecutar actualizaciones y eliminaciones masivas en Laravel usando colas paralelas con Queue-SQL para no bloquear tu aplicación.'
pubDate: '2026-07-31'
tags: ['laravel', 'queues', 'performance', 'php']
---

## Queue-SQL en Laravel: Operaciones Masivas Paralelas sin Bloqueos

Cuando trabajas con bases de datos grandes en Laravel, las operaciones masivas como actualizaciones o eliminaciones pueden convertirse en un cuello de botella. Si intentas procesar millones de registros en una sola consulta, tu aplicación se congela, los usuarios experimentan timeouts y el servidor se sobrecarga.

**Queue-SQL** es un paquete que transforma estas operaciones costosas en lotes de trabajos encolados que se ejecutan en paralelo. En lugar de una única consulta que bloquea todo, distribuye el trabajo entre múltiples workers que procesan chunks de datos simultáneamente.

En este artículo aprenderás cómo implementar Queue-SQL en tu aplicación Laravel para manejar operaciones masivas de forma elegante y eficiente.

## ¿Por qué necesitas Queue-SQL?

### El problema de las operaciones masivas

Imagina que tienes una tabla `users` con 5 millones de registros y necesitas actualizar todos los registros inactivos durante más de un año:

```php
User::where('last_login', '<', now()->subYear())
    ->update(['status' => 'inactive']);
```

Este código:
- Bloquea la tabla durante segundos o minutos
- Consume memoria RAM excesiva
- Genera un log de transacciones enorme
- Afecta a todas las consultas simultáneas
- Puede causar timeouts en producción

### La solución: distribución en paralelo

Queue-SQL resuelve esto partiendo el trabajo en chunks manejables:

```
5,000,000 registros → 1,000 jobs × 5,000 registros cada uno
```

Cada job se procesa en un worker diferente, en paralelo, sin bloquear tu aplicación.

## Instalación y configuración

### Paso 1: Instalar el paquete

```bash
composer require stephenjude/queue-sql
```

### Paso 2: Publicar la configuración

```bash
php artisan vendor:publish --provider="StephenJude\QueueSQL\QueueSQLServiceProvider"
```

Esto crea el archivo `config/queue-sql.php` donde puedes configurar:

```php
return [
    'chunk_size' => 5000,  // Registros por job
    'queue' => 'default',   // Cola de destino
    'timeout' => 60,        // Segundos por job
];
```

### Paso 3: Configurar colas

Asegúrate de tener colas configuradas en `.env`:

```env
QUEUE_CONNECTION=redis
```

O si prefers base de datos:

```env
QUEUE_CONNECTION=database
```

## Usos prácticos

### Eliminaciones masivas

Necesitas eliminar 2 millones de registros de logs antiguos:

```php
use StephenJude\QueueSQL\Facades\QueueSQL;

// En tu controlador o comando
QueueSQL::delete('logs')
    ->where('created_at', '<', now()->subMonths(6))
    ->dispatch();
```

Queue-SQL automáticamente:
1. Cuenta los registros que cumplen la condición
2. Los divide en chunks de 5000
3. Crea un job para cada chunk
4. Los encola en paralelo
5. Ejecuta los deletes de forma distribuida

### Actualizaciones masivas

Actualizar el estado de usuarios:

```php
QueueSQL::update('users', [
    'status' => 'archived',
    'updated_at' => now(),
])
->where('last_login', '<', now()->subYear())
->dispatch();
```

Con esta sintaxis:
- Procesa en paralelo
- No bloquea la tabla
- Es resumible si falla

### Inserciones masivas desde otra tabla

Migrar datos de una tabla a otra:

```php
QueueSQL::insertFrom('users_archive')
    ->select('id', 'email', 'name', 'created_at')
    ->from('users')
    ->where('status', 'deleted')
    ->dispatch();
```

## Casos de uso avanzados

### Operación con modelo Eloquent

Si prefieres usar Eloquent, crea un comando:

```php
namespace App\Commands;

use Illuminate\Console\Command;
use StephenJude\QueueSQL\Facades\QueueSQL;

class ArchiveInactiveUsers extends Command
{
    protected $signature = 'users:archive';
    protected $description = 'Archive users inactive for 2 years';

    public function handle()
    {
        $this->info('Iniciando archivado de usuarios inactivos...');

        QueueSQL::update('users', [
            'status' => 'archived',
            'archived_at' => now(),
        ])
        ->where('last_login', '<', now()->subYears(2))
        ->onFailure(fn($job) => $this->error("Error en job: {$job->uuid}"))
        ->onSuccess(fn($results) => $this->info("Completado: {$results} registros"))
        ->dispatch();

        $this->info('Jobs encolados. Verifica tu queue worker.');
    }
}
```

Ejecútalo con:

```bash
php artisan users:archive
```

### Procesar con callbacks

Ejecutar lógica personalizada mientras procesas:

```php
QueueSQL::delete('orders')
    ->where('status', 'cancelled')
    ->where('created_at', '<', now()->subMonths(1))
    ->eachChunk(function($records) {
        // $records contiene los IDs que se eliminarán
        Log::info("Eliminando " . count($records) . " órdenes canceladas");
    })
    ->dispatch();
```

## Monitoreo y gestión

### Ver estado de los trabajos

Con Laravel Horizon (si usas Redis):

```bash
php artisan horizon
```

Accede a `http://localhost:8000/horizon` para ver:
- Jobs en proceso
- Jobs completados
- Tasas de throughput
- Errores

### Cancelar operaciones en progreso

Si necesitas detener una operación:

```bash
# Pausar el worker (se completarán los jobs actuales)
php artisan queue:pause

# Reanudar
php artisan queue:continue

# Limpiar jobs fallidos
php artisan queue:flush
```

### Configurar reintentos

En `config/queue.php`:

```php
'failed' => [
    'driver' => env('QUEUE_FAILED_DRIVER', 'database'),
    'database' => env('DB_CONNECTION', 'mysql'),
    'table' => 'failed_jobs',
],

'connections' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
        'queue' => env('REDIS_QUEUE', 'default'),
        'retry_after' => 90,  // Reintentar después de 90 segundos
        'timeout' => 30,      // Timeout por job
    ],
],
```

## Optimizaciones recomendadas

### 1. Ajustar el tamaño de chunks

Para operaciones muy rápidas (updates simples), aumenta el chunk:

```php
QueueSQL::update('users', ['verified' => true])
    ->where('email_verified_at', '!=', null)
    ->chunkSize(10000)  // 10k en lugar de 5k
    ->dispatch();
```

Para operaciones complejas (con triggers, foreign keys), reduce:

```php
QueueSQL::delete('posts')
    ->where('draft', true)
    ->chunkSize(1000)  // 1k para ser más seguro
    ->dispatch();
```

### 2. Usar múltiples workers

En producción, inicia varios workers para paralelismo real:

```bash
# Terminal 1
php artisan queue:work --queue=default

# Terminal 2
php artisan queue:work --queue=default

# Terminal 3
php artisan queue:work --queue=default

# O usa un supervisor para mantenerlos vivos
```

### 3. Limitar concurrencia en base de datos

Si tu DB tiene límites de conexiones:

```php
// En tu .env
DB_POOL_MIN=5
DB_POOL_MAX=10

// O en config/database.php
'mysql' => [
    'driver' => 'mysql',
    'connections' => [
        'pool' => [
            'min' => 5,
            'max' => 10,
        ],
    ],
],
```

### 4. Monitorear performance

Registra métricas de tus operaciones:

```php
use StephenJude\QueueSQL\Facades\QueueSQL;

QueueSQL::update('logs', ['archived' => true])
    ->where('created_at', '<', now()->subMonths(3))
    ->onSuccess(function($results) {
        \Log::channel('queue')->info('Archivado completado', [
            'records' => $results,
            'duration' => $results->duration ?? 'N/A',
        ]);
    })
    ->dispatch();
```

## Alternativas y comparativas

### Queue-SQL vs métodos tradicionales

| Método | Bloqueante | Escalable | Fácil implementar |
|--------|-----------|----------|-------------------|
| Update directo | ✅ Sí | ❌ No | ✅ Sí |
| Foreach + save | ❌ No | ❌ No | ✅ Sí |
| Queue manual | ❌ No | ✅ Sí | ❌ No |
| **Queue-SQL** | ❌ No | ✅ Sí | ✅ Sí |

### Cuándo usar Queue-SQL

✅ **Úsalo cuando:**
- Necesitas actualizar/eliminar 100k+ registros
- No puedes permitir bloqueos en producción
- Tienes workers configurados y escalables
- Necesitas resumibilidad ante fallos

❌ **No lo uses para:**
- Operaciones <10k registros (usa update directo)
- Transacciones ACID complejas entre tablas
- Datos que requieren consistencia inmediata

## Solución de problemas comunes

### Error: "Queue connection not configured"

```php
// Solución: Asegúrate de que QUEUE_CONNECTION esté en .env
QUEUE_CONNECTION=redis  // o database, sync, etc.

// Y que el worker esté corriendo
php artisan queue:work
```

### Jobs se quedan en "reserved"

```php
// El timeout es muy corto para la operación
// Aumenta en config/queue.php o por job:

QueueSQL::delete('big_table')
    ->timeout(300)  // 5 minutos
    ->dispatch();
```

### Memory leak en workers

```php
// Inicia workers con límite de memoria
php artisan queue:work --max-jobs=1000 --max-memory=512
```

## Conclusión

Queue-SQL es una herramienta invaluable para aplicaciones Laravel que necesitan manejar operaciones masivas sin sacrificar rendimiento o disponibilidad. Al distribuir el trabajo en paralelo, transformas operaciones que tomarían minutos de bloqueo en procesamiento distribuido y no invasivo.

La clave está en elegir el tamaño de chunks adecuado, monitorear el progreso y escalar tus workers según la carga. Con Queue-SQL, tus migraciones de datos, limpieza de registros antiguos y actualizaciones en lote se vuelven predecibles y confiables.

## Puntos clave

- **Queue-SQL divide operaciones masivas** en chunks procesados por jobs paralelos
- **No bloquea tu aplicación** porque cada chunk se ejecuta en un worker separado
- **Configurable en tamaño** de chunks según la complejidad de la operación
- **Resumible ante fallos** con reintentos automáticos
- **Compatible con Redis y bases de datos** como backends de colas
- **Ideal para 100k+ registros** en operaciones de actualización, eliminación e inserción
- **Monitoreable con Horizon** para rastrear progreso en tiempo real
- **Require workers corriendo** en background (no funciona con queue sync)