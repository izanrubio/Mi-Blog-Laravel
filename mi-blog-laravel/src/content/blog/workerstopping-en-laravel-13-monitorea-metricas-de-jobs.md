---
title: 'WorkerStopping en Laravel 13: Monitorea Métricas de Jobs'
description: 'Aprende a usar el evento WorkerStopping en Laravel 13.18 para capturar métricas de workers y optimizar el monitoreo de tus colas.'
pubDate: '2026-07-02'
tags: ['laravel', 'queues', 'workers', 'monitoring']
---

## Introducción

Desde la versión 13.18 de Laravel, el framework expone métricas de jobs procesados en el evento `WorkerStopping`, una característica que muchos desarrolladores desconocen pero que es fundamental para monitorear la salud y el rendimiento de tus colas de procesamiento.

Hasta ahora, obtener información sobre cuántos jobs procesó un worker requería implementar soluciones personalizadas complejas. Con esta nueva funcionalidad, tienes acceso directo a datos valiosos que te permiten crear dashboards de monitoreo, alertas inteligentes y auditoría de rendimiento sin configuración adicional.

En este artículo exploraremos cómo aprovechar `WorkerStopping` para construir un sistema robusto de monitoreo de colas, con ejemplos prácticos que puedes implementar inmediatamente.

## Qué es el evento WorkerStopping

El evento `WorkerStopping` se dispara cuando un worker de Laravel finaliza su ejecución. Esto ocurre cuando:

- Se alcanza el límite de iteraciones del worker (`--max-jobs`)
- Se alcanza el límite de tiempo (`--max-time`)
- Se recibe una señal de parada (SIGTERM)
- El worker se detiene gracefully (con la nueva funcionalidad en 13.18)

**Lo nuevo en 13.18** es que ahora tienes acceso a las métricas de jobs procesados directamente en el evento, sin necesidad de implementar contadores manuales.

## Estructura del evento WorkerStopping

El evento contiene información crítica sobre la sesión del worker:

```php
use Illuminate\Queue\Events\WorkerStopping;

class YourListener
{
    public function handle(WorkerStopping $event)
    {
        // Acceso a las métricas
        $jobsProcessed = $event->worker->jobsProcessed;
        $failedJobs = $event->worker->failedJobs;
        $uptime = $event->worker->uptime;
        
        // Información del worker
        $connection = $event->connectionName;
        $queue = $event->queue;
    }
}
```

Las propiedades disponibles incluyen:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `jobsProcessed` | `int` | Total de jobs ejecutados exitosamente |
| `failedJobs` | `int` | Total de jobs que fallaron |
| `uptime` | `int` | Segundos que estuvo activo el worker |
| `connectionName` | `string` | Nombre de la conexión (redis, database, etc) |
| `queue` | `string` | Cola procesada |

## Implementación práctica: Sistema de monitoreo

### Paso 1: Crear un Listener para WorkerStopping

```php
php artisan make:listener CaptureWorkerMetrics
```

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\WorkerStopping;
use App\Models\WorkerMetric;
use Illuminate\Support\Facades\Log;

class CaptureWorkerMetrics
{
    public function handle(WorkerStopping $event)
    {
        $metric = WorkerMetric::create([
            'connection' => $event->connectionName,
            'queue' => $event->queue,
            'jobs_processed' => $event->worker->jobsProcessed,
            'failed_jobs' => $event->worker->failedJobs,
            'uptime_seconds' => $event->worker->uptime,
            'success_rate' => $this->calculateSuccessRate(
                $event->worker->jobsProcessed,
                $event->worker->failedJobs
            ),
            'timestamp' => now(),
        ]);

        Log::info('Worker stopped', [
            'metric_id' => $metric->id,
            'jobs_processed' => $metric->jobs_processed,
            'failed_jobs' => $metric->failed_jobs,
            'success_rate' => $metric->success_rate . '%',
        ]);

        // Alertar si hay demasiados fallos
        if ($metric->failed_jobs > 5) {
            $this->alertHighFailureRate($metric);
        }
    }

    private function calculateSuccessRate(int $successful, int $failed): float
    {
        $total = $successful + $failed;
        
        if ($total === 0) {
            return 100.0;
        }

        return round(($successful / $total) * 100, 2);
    }

    private function alertHighFailureRate(WorkerMetric $metric): void
    {
        // Enviar notificación a Slack, email, etc
        \Illuminate\Support\Facades\Notification::route('slack', 
            config('services.slack.webhook')
        )->notify(new \App\Notifications\HighWorkerFailureRate($metric));
    }
}
```

### Paso 2: Crear el modelo WorkerMetric

```php
php artisan make:model WorkerMetric -m
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkerMetric extends Model
{
    protected $fillable = [
        'connection',
        'queue',
        'jobs_processed',
        'failed_jobs',
        'uptime_seconds',
        'success_rate',
        'timestamp',
    ];

    protected $casts = [
        'timestamp' => 'datetime',
        'success_rate' => 'float',
        'jobs_processed' => 'integer',
        'failed_jobs' => 'integer',
        'uptime_seconds' => 'integer',
    ];

    // Scope para análisis
    public function scopeByConnection($query, string $connection)
    {
        return $query->where('connection', $connection);
    }

    public function scopeLastHour($query)
    {
        return $query->where('timestamp', '>=', now()->subHour());
    }

    public function scopeWithHighFailureRate($query, float $threshold = 10)
    {
        return $query->where('success_rate', '<', 100 - $threshold);
    }
}
```

Migración:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('worker_metrics', function (Blueprint $table) {
            $table->id();
            $table->string('connection');
            $table->string('queue');
            $table->integer('jobs_processed')->default(0);
            $table->integer('failed_jobs')->default(0);
            $table->integer('uptime_seconds');
            $table->decimal('success_rate', 5, 2);
            $table->timestamp('timestamp');
            $table->timestamps();

            $table->index(['connection', 'queue', 'timestamp']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('worker_metrics');
    }
};
```

### Paso 3: Registrar el Listener

En `app/Providers/EventServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;
use Illuminate\Queue\Events\WorkerStopping;
use App\Listeners\CaptureWorkerMetrics;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        WorkerStopping::class => [
            CaptureWorkerMetrics::class,
        ],
    ];

    public function boot(): void
    {
        parent::boot();
    }
}
```

## Casos de uso avanzados

### Dashboard de monitoreo en tiempo real

```php
<?php

namespace App\Http\Controllers;

use App\Models\WorkerMetric;
use Illuminate\View\View;

class WorkerMetricsController extends Controller
{
    public function dashboard(): View
    {
        $metrics = WorkerMetric::lastHour()
            ->orderByDesc('timestamp')
            ->get()
            ->groupBy('connection');

        $summary = [
            'total_jobs_processed' => WorkerMetric::lastHour()
                ->sum('jobs_processed'),
            'total_failed' => WorkerMetric::lastHour()
                ->sum('failed_jobs'),
            'average_success_rate' => WorkerMetric::lastHour()
                ->avg('success_rate'),
            'high_failure_connections' => WorkerMetric::lastHour()
                ->withHighFailureRate(5)
                ->distinct('connection')
                ->pluck('connection'),
        ];

        return view('workers.dashboard', compact('metrics', 'summary'));
    }

    public function connectionDetails(string $connection): View
    {
        $stats = WorkerMetric::byConnection($connection)
            ->lastHour()
            ->get();

        $aggregated = [
            'total_processed' => $stats->sum('jobs_processed'),
            'total_failed' => $stats->sum('failed_jobs'),
            'avg_uptime' => $stats->avg('uptime_seconds'),
            'worker_count' => $stats->count(),
            'avg_success_rate' => $stats->avg('success_rate'),
        ];

        return view('workers.connection-details', compact('connection', 'aggregated', 'stats'));
    }
}
```

### Alertas automáticas con Notifications

```php
<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Slack\SlackMessage;
use App\Models\WorkerMetric;

class HighWorkerFailureRate extends Notification
{
    public function __construct(private WorkerMetric $metric) {}

    public function via($notifiable): array
    {
        return ['slack'];
    }

    public function toSlack($notifiable): SlackMessage
    {
        return (new SlackMessage)
            ->error()
            ->content('⚠️ High Worker Failure Rate Detected')
            ->attachment(function ($attachment) {
                $attachment
                    ->title($this->metric->connection . ':' . $this->metric->queue)
                    ->fields([
                        'Failed Jobs' => $this->metric->failed_jobs,
                        'Success Rate' => $this->metric->success_rate . '%',
                        'Total Processed' => $this->metric->jobs_processed,
                        'Uptime' => $this->formatUptime($this->metric->uptime_seconds),
                    ]);
            });
    }

    private function formatUptime(int $seconds): string
    {
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        
        return "{$hours}h {$minutes}m";
    }
}
```

## Graceful Shutdown en Laravel 13.18

La nueva funcionalidad de parada graceful permite que el worker termine limpiamente:

```php
// Iniciar worker con parada graceful
php artisan queue:work --max-jobs=1000 --max-time=3600

// En producción (Supervisor)
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /home/laravel/app/artisan queue:work redis \
    --max-jobs=1000 \
    --max-time=3600 \
    --tries=3
numprocs=4
```

Cuando el worker se detiene gracefully, captura todas sus métricas antes de finalizar, garantizando que no pierdes datos de monitoreo.

## Testing de WorkerStopping

```php
<?php

namespace Tests\Feature;

use Illuminate\Queue\Events\WorkerStopping;
use Tests\TestCase;
use App\Models\WorkerMetric;

class WorkerMetricsTest extends TestCase
{
    public function test_worker_stopping_event_captures_metrics()
    {
        $workerMock = new \stdClass();
        $workerMock->jobsProcessed = 150;
        $workerMock->failedJobs = 2;
        $workerMock->uptime = 3600;

        $event = new WorkerStopping($workerMock, 'redis', 'default');

        event($event);

        $this->assertDatabaseHas('worker_metrics', [
            'connection' => 'redis',
            'queue' => 'default',
            'jobs_processed' => 150,
            'failed_jobs' => 2,
        ]);
    }

    public function test_success_rate_calculation()
    {
        $metric = WorkerMetric::create([
            'connection' => 'redis',
            'queue' => 'default',
            'jobs_processed' => 95,
            'failed_jobs' => 5,
            'uptime_seconds' => 1800,
            'success_rate' => 95.0,
        ]);

        $this->assertEquals(95.0, $metric->success_rate);
    }
}
```

## Optimizaciones y mejores prácticas

1. **Limpieza de datos históricos**: Implementa un comando para limpiar métricas antiguas
2. **Índices de base de datos**: Asegúrate de indexar por timestamp y connection
3. **Caché de resúmenes**: Almacena datos agregados en caché para dashboards
4. **Alertas inteligentes**: No alertes por cada worker, agrupa por umbrales

```php
// Comando para limpiar métricas antiguas
php artisan make:command CleanOldWorkerMetrics
```

```php
<?php

namespace App\Console\Commands;

use App\Models\WorkerMetric;
use Illuminate\Console\Command;

class CleanOldWorkerMetrics extends Command
{
    protected $signature = 'metrics:clean {--days=7}';

    public function handle()
    {
        $days = $this->option('days');
        
        $deleted = WorkerMetric::where('timestamp', '<', 
            now()->subDays($days)
        )->delete();

        $this->info("Deleted {$deleted} old metrics");
    }
}
```

## Puntos clave

- **WorkerStopping** expone `jobsProcessed`, `failedJobs` y `uptime` directamente en Laravel 13.18+
- Crea listeners para capturar automáticamente métricas sin configuración manual
- Almacena métricas en base de datos para análisis histórico y dashboards
- Implementa alertas basadas en tasas de éxeso para detectar problemas rápidamente
- Graceful shutdown garantiza que todas las métricas se capturen correctamente
- Agrupa datos por conexión y cola para monitoreo multi-worker efectivo
- Usa indexes en base de datos para queries rápidas en dashboards
- Limpia datos históricos regularmente para mantener rendimiento
- Integra con Slack, email o sistemas de alertas para notificaciones proactivas
- Testing con mocks es simple gracias a la estructura clara del evento