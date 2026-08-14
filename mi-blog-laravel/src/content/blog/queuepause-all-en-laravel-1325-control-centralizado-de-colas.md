---
title: 'Queue:pause --all en Laravel 13.25: Control Centralizado de Colas'
description: 'Aprende a pausar todas tus colas Redis simultáneamente en Laravel 13.25 sin detener workers. Ideal para mantenimiento y control de sobrecarga.'
pubDate: '2026-08-13'
tags: ['laravel', 'queues', 'redis', 'devops']
---

## Queue:pause --all en Laravel 13.25: Control Centralizado de Colas

Laravel 13.25 introduce una característica que muchos desarrolladores esperaban: la capacidad de pausar **todas las colas simultáneamente** usando `queue:pause --all`. Esta funcionalidad es especialmente valiosa en entornos de producción donde necesitas controlar el flujo de trabajo sin detener tus workers o interferir con jobs ya en ejecución.

En este artículo, exploraremos cómo funciona esta característica, cuándo utilizarla y cómo integrarla en tu estrategia de operación de aplicaciones Laravel.

## ¿Por Qué Necesitas Pausar Colas?

Antes de Laravel 13.25, pausar colas requería ejecutar múltiples comandos, uno por cada conexión. Esto era tedioso y propenso a errores en entornos complejos con múltiples drivers (Redis, SQS, etc.).

### Casos de Uso Comunes

**Mantenimiento programado**: Cuando necesitas realizar trabajo de fondo sin procesar nuevos jobs:

```bash
php artisan queue:pause --all
# Ejecuta tus tareas de mantenimiento
php artisan queue:resume --all
```

**Gestión de picos de tráfico**: Si tu infraestructura está bajo presión, pausar colas evita que se acumulen jobs inmanejables:

```bash
// En tu comando de monitoreo
if ($serverLoad > 80) {
    \Artisan::call('queue:pause', ['--all' => true]);
}
```

**Despliegues zero-downtime**: Pausar colas durante deploys reduce inconsistencias y estado parcial:

```bash
// En tu script de despliegue
php artisan queue:pause --all
php artisan migrate --force
php artisan deploy:features
php artisan queue:resume --all
```

## Cómo Funciona `queue:pause --all`

Internamente, Laravel utiliza Redis (o tu driver configurado) para almacenar el estado pausado de las colas. Cuando pausas con `--all`, se establecen flags de pausa para cada conexión configurada.

### Estructura de Conexiones

En `config/queue.php`, puedes tener múltiples conexiones:

```php
'connections' => [
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
        'queue' => 'default',
        'retry_after' => 90,
        'block_for' => null,
    ],
    'redis-emails' => [
        'driver' => 'redis',
        'connection' => 'default',
        'queue' => 'emails',
        'retry_after' => 90,
    ],
    'sqs' => [
        'driver' => 'sqs',
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'prefix' => env('SQS_PREFIX', 'https://sqs.us-east-1.amazonaws.com/123456789012'),
        'queue' => env('SQS_QUEUE', 'default'),
        'suffix' => env('SQS_SUFFIX'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],
],
```

Con `queue:pause --all`, todas estas conexiones se pausarán simultáneamente.

## Uso Práctico del Comando

### Pausar Todas las Colas

```bash
php artisan queue:pause --all
```

Este comando genera una salida similar a:

```
Paused jobs for: redis
Paused jobs for: redis-emails
Paused jobs for: sqs
```

### Pausar una Conexión Específica

Si necesitas pausar solo una:

```bash
php artisan queue:pause redis
php artisan queue:pause redis-emails
```

### Reanudar Colas

```bash
# Reanudar todas
php artisan queue:resume --all

# Reanudar una específica
php artisan queue:resume redis
```

### Verificar Estado

```bash
php artisan queue:failed
```

## Implementación Avanzada: Gestor de Pausa Automático

Crea un servicio que gestione pausas automáticas basadas en métricas del sistema:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;

class QueuePauseManager
{
    private const CACHE_KEY = 'queue:auto_pause_active';
    
    public function pauseIfNeeded(): void
    {
        $metrics = $this->getSystemMetrics();
        
        if ($this->shouldPause($metrics)) {
            $this->pauseQueues();
            Cache::put(self::CACHE_KEY, true, now()->addMinutes(5));
        }
    }

    public function resumeIfSafe(): void
    {
        if (!Cache::has(self::CACHE_KEY)) {
            return;
        }

        $metrics = $this->getSystemMetrics();
        
        if ($this->isSafe($metrics)) {
            $this->resumeQueues();
            Cache::forget(self::CACHE_KEY);
        }
    }

    private function getSystemMetrics(): array
    {
        return [
            'cpu' => $this->getCpuUsage(),
            'memory' => $this->getMemoryUsage(),
            'pending_jobs' => $this->getPendingJobsCount(),
        ];
    }

    private function shouldPause(array $metrics): bool
    {
        return $metrics['cpu'] > 85 
            || $metrics['memory'] > 80 
            || $metrics['pending_jobs'] > 10000;
    }

    private function isSafe(array $metrics): bool
    {
        return $metrics['cpu'] < 50 
            && $metrics['memory'] < 60 
            && $metrics['pending_jobs'] < 5000;
    }

    private function pauseQueues(): void
    {
        Artisan::call('queue:pause', ['--all' => true]);
        \Log::info('Colas pausadas automáticamente');
    }

    private function resumeQueues(): void
    {
        Artisan::call('queue:resume', ['--all' => true]);
        \Log::info('Colas reanudadas automáticamente');
    }

    private function getCpuUsage(): float
    {
        // Implementación específica de tu infraestructura
        return 0.0;
    }

    private function getMemoryUsage(): float
    {
        return (memory_get_usage(true) / 1024 / 1024) / 
               (ini_get('memory_limit') / 1024 / 1024) * 100;
    }

    private function getPendingJobsCount(): int
    {
        // Contar jobs pendientes en Redis
        return 0;
    }
}
```

## Job Listener para Detectar Pausa

Crea un comando que verifique regularmente si las colas están pausadas:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Queue\QueueManager;

class MonitorQueueStatus extends Command
{
    protected $signature = 'queue:monitor';
    
    protected $description = 'Monitorea el estado de las colas';

    public function handle(QueueManager $queueManager)
    {
        while (true) {
            $connections = config('queue.connections');
            
            foreach (array_keys($connections) as $connection) {
                $manager = $queueManager->connection($connection);
                
                // Verificar si está pausada
                if ($manager->isPaused()) {
                    $this->line("<info>✓</info> {$connection} - PAUSADA");
                } else {
                    $this->line("<fg=green>✓</> {$connection} - ACTIVA");
                }
            }
            
            sleep(10);
        }
    }
}
```

## Integración con Horizon

Si usas Laravel Horizon, la pausa se respeta automáticamente:

```bash
# Horizon detectará la pausa y no procesará jobs
php artisan horizon

# En otra terminal
php artisan queue:pause --all

# Horizon mostrará la pausa en su dashboard
```

## Testing de Pausas de Colas

Escribe tests que verifiquen el comportamiento con colas pausadas:

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueuePauseTest extends TestCase
{
    public function test_pause_all_pauses_all_connections(): void
    {
        Queue::fake();
        
        \Artisan::call('queue:pause', ['--all' => true]);
        
        $this->assertTrue(
            \Cache::has('laravel_queue_paused:redis')
        );
    }

    public function test_jobs_not_processed_when_paused(): void
    {
        \Artisan::call('queue:pause', ['--all' => true]);
        
        Queue::push(\App\Jobs\ProcessEmail::class);
        
        \Artisan::call('queue:work', [
            '--once' => true,
            '--stop-when-empty' => true,
        ]);
        
        // El job no se debe haber procesado
        $this->assertTrue(Queue::hasFailed());
    }

    public function test_resume_all_resumes_all_connections(): void
    {
        \Artisan::call('queue:pause', ['--all' => true]);
        \Artisan::call('queue:resume', ['--all' => true]);
        
        $this->assertFalse(
            \Cache::has('laravel_queue_paused:redis')
        );
    }
}
```

## Mejor Práctica: Dashboard de Control

Crea un endpoint que permita controlar pausas desde tu panel de administración:

```php
<?php

namespace App\Http\Controllers\Admin;

use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;

class QueueController extends Controller
{
    public function pauseAll()
    {
        $this->authorize('pause-queues');
        
        Artisan::call('queue:pause', ['--all' => true]);
        
        return response()->json([
            'message' => 'Todas las colas han sido pausadas',
            'timestamp' => now(),
            'user' => Auth::user()->email,
        ]);
    }

    public function resumeAll()
    {
        $this->authorize('pause-queues');
        
        Artisan::call('queue:resume', ['--all' => true]);
        
        return response()->json([
            'message' => 'Todas las colas han sido reanudadas',
            'timestamp' => now(),
            'user' => Auth::user()->email,
        ]);
    }

    public function status()
    {
        $connections = config('queue.connections');
        $status = [];
        
        foreach (array_keys($connections) as $connection) {
            $manager = \Queue::connection($connection);
            $status[$connection] = [
                'paused' => $manager->isPaused(),
                'driver' => $connections[$connection]['driver'],
            ];
        }
        
        return response()->json($status);
    }
}
```

## Monitoreo con Logging

Registra todos los cambios de estado de las colas:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

class QueueStateLogger
{
    public static function logPause(string $connection): void
    {
        Log::channel('queues')->warning('Queue paused', [
            'connection' => $connection,
            'timestamp' => now(),
            'user' => auth()->user()?->email ?? 'system',
        ]);
    }

    public static function logResume(string $connection): void
    {
        Log::channel('queues')->info('Queue resumed', [
            'connection' => $connection,
            'timestamp' => now(),
            'user' => auth()->user()?->email ?? 'system',
        ]);
    }
}
```

## Puntos Clave

- ✅ `queue:pause --all` pausa todas las conexiones configuradas simultáneamente
- ✅ Las colas pausadas no procesan jobs nuevos pero respetan delays y retries
- ✅ Ideal para mantenimiento, deploys y gestión de picos de tráfico
- ✅ Compatible con todos los drivers (Redis, SQS, Database, etc.)
- ✅ Los workers continúan corriendo, solo evitan procesar jobs
- ✅ Implementa monitoreo automático combinando métricas del sistema
- ✅ Registra siempre quién pausó/reanudó para auditoría
- ✅ Crea tests que verifiquen el comportamiento con pausas
- ✅ Integración perfecta con Laravel Horizon y dashboards personalizados
- ✅ La pausa se almacena en Redis para consistencia distribuida