---
title: 'Queue::totalSize() en Laravel 13.31: Monitorea Tamaño de Colas'
description: 'Aprende a usar Queue::totalSize() para contar jobs en tiempo real. Guía completa con ejemplos prácticos de monitoreo de colas en Laravel 13.31.'
pubDate: '2025-01-15'
tags: ['laravel', 'queues', 'monitoring', 'laravel-13']
---

## Queue::totalSize() en Laravel 13.31: Monitorea el Tamaño de tus Colas

Las colas (queues) son uno de los pilares fundamentales de cualquier aplicación Laravel moderna. Permiten procesar tareas pesadas de forma asincrónica, mejorando significativamente la experiencia del usuario. Sin embargo, **monitorear el estado de las colas siempre ha sido un desafío**. En Laravel 13.31, Taylor Otwell introdujo `Queue::totalSize()`, un método que simplifica enormemente la tarea de contar jobs en una conexión específica.

En este artículo veremos cómo implementar y aprovechar este nuevo método para crear sistemas de monitoreo robustos.

## ¿Qué es Queue::totalSize()?

`Queue::totalSize()` es un método de la clase `Queue` que devuelve el **número total de jobs pendientes en una conexión de colas**. A diferencia de intentar contar jobs manualmente accediendo a Redis o a la base de datos, este método proporciona una forma elegante y consistente de obtener esta métrica.

### Sintaxis básica

```php
use Illuminate\Support\Facades\Queue;

// Obtener el tamaño total de la cola por defecto
$totalJobs = Queue::totalSize();

// Obtener el tamaño de una cola específica
$totalJobs = Queue::connection('redis')->totalSize();
```

El método es simple pero poderoso. Devuelve un entero que representa el número exacto de jobs en espera.

## Casos de uso prácticos

### 1. Dashboard de monitoreo en tiempo real

Una de las aplicaciones más comunes es crear un dashboard que muestre el estado de tus colas:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Queue;

class QueueMonitorController extends Controller
{
    public function dashboard()
    {
        $queueStats = [
            'default' => Queue::connection('default')->totalSize(),
            'emails' => Queue::connection('emails')->totalSize(),
            'reports' => Queue::connection('reports')->totalSize(),
            'notifications' => Queue::connection('notifications')->totalSize(),
        ];

        return view('queue-monitor', [
            'stats' => $queueStats,
            'totalJobs' => array_sum($queueStats),
        ]);
    }
}
```

En tu vista Blade, puedes mostrar esta información:

```blade
<div class="grid grid-cols-4 gap-4">
    @foreach($stats as $queue => $count)
        <div class="bg-white p-6 rounded-lg shadow">
            <h3 class="text-gray-600 text-sm font-semibold">{{ $queue }}</h3>
            <p class="text-3xl font-bold text-blue-600">{{ $count }}</p>
        </div>
    @endforeach
</div>

<div class="mt-4 p-4 bg-blue-50 rounded-lg">
    <p class="text-lg">Total de jobs pendientes: <strong>{{ $totalJobs }}</strong></p>
</div>
```

### 2. Alertas automáticas cuando la cola crece demasiado

Puedes crear un comando artisan que verifique periódicamente el tamaño de las colas y dispare alertas:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Queue;
use App\Models\Alert;

class MonitorQueueHealth extends Command
{
    protected $signature = 'queue:monitor-health';
    protected $description = 'Monitorea la salud de las colas y genera alertas';

    public function handle()
    {
        $thresholds = [
            'default' => 1000,
            'emails' => 500,
            'reports' => 100,
            'notifications' => 750,
        ];

        foreach ($thresholds as $queue => $limit) {
            $size = Queue::connection($queue)->totalSize();

            if ($size > $limit) {
                Alert::create([
                    'type' => 'queue_overflow',
                    'queue' => $queue,
                    'current_size' => $size,
                    'threshold' => $limit,
                    'severity' => $this->calculateSeverity($size, $limit),
                ]);

                $this->warn("⚠️  Cola '{$queue}' excedió límite: {$size}/{$limit}");
            } else {
                $this->info("✓ Cola '{$queue}' dentro de límites: {$size}/{$limit}");
            }
        }
    }

    private function calculateSeverity($current, $limit): string
    {
        $ratio = $current / $limit;

        if ($ratio > 2) return 'critical';
        if ($ratio > 1.5) return 'warning';
        return 'info';
    }
}
```

Luego, programa este comando en tu `schedule`:

```php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    $schedule->command('queue:monitor-health')
        ->everyMinute()
        ->withoutOverlapping()
        ->onFailure(function () {
            // Notificar si el comando falla
        });
}
```

### 3. Gestión inteligente de workers

Con `totalSize()`, puedes crear un sistema que escale automáticamente el número de workers según la carga:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Process;

class QueueScaler
{
    public function scale(): void
    {
        $size = Queue::totalSize();
        $currentWorkers = $this->getCurrentWorkerCount();

        // Si hay demasiados jobs, inicia más workers
        if ($size > 500 && $currentWorkers < 5) {
            $this->spawnWorkers($currentWorkers, 5);
            logger("Escalando: iniciados workers adicionales");
        }

        // Si hay pocos jobs, reduce workers
        if ($size < 50 && $currentWorkers > 1) {
            $this->stopWorkers($currentWorkers, 1);
            logger("Reduciendo: detenidos workers innecesarios");
        }
    }

    private function spawnWorkers(int $current, int $target): void
    {
        for ($i = $current; $i < $target; $i++) {
            Process::start([
                'php', 'artisan', 'queue:work',
                '--queue=default,emails,reports',
                '--timeout=60',
                '--memory=256'
            ]);
        }
    }

    private function stopWorkers(int $current, int $target): void
    {
        $diff = $current - $target;
        for ($i = 0; $i < $diff; $i++) {
            Process::run('pkill -f "queue:work" -n');
        }
    }

    private function getCurrentWorkerCount(): int
    {
        $result = Process::run('pgrep -f "queue:work" | wc -l');
        return (int) $result->output();
    }
}
```

### 4. API endpoint para monitoreo externo

Expón el estado de tus colas a través de una API pública que puedas consultar desde herramientas de monitoreo externas:

```php
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Support\Facades\Queue;
use Illuminate\Http\JsonResponse;

class QueueStatsController extends Controller
{
    public function stats(): JsonResponse
    {
        $queues = ['default', 'emails', 'reports', 'notifications'];
        $stats = [];
        $totalSize = 0;

        foreach ($queues as $queue) {
            $size = Queue::connection($queue)->totalSize();
            $stats[$queue] = [
                'size' => $size,
                'percentage' => 0, // Calcular si tienes máximos
                'healthy' => $size < 1000,
            ];
            $totalSize += $size;
        }

        return response()->json([
            'timestamp' => now()->toIso8601String(),
            'total_jobs' => $totalSize,
            'queues' => $stats,
            'healthy' => $totalSize < 5000,
            'worker_status' => $this->getWorkerStatus(),
        ]);
    }

    private function getWorkerStatus(): string
    {
        // Implementar lógica para verificar estado de workers
        return 'running';
    }
}
```

Luego, registra esta ruta en tu `routes/api.php`:

```php
Route::middleware('auth:api')->get('/queue/stats', [QueueStatsController::class, 'stats']);
```

## Diferencias con otros métodos de monitoreo

### Antes: Acceso directo a Redis

```php
// Método antiguo - directo a Redis
$size = Cache::store('redis')->connection()->command('llen', ['queues:default']);
```

**Problemas:**
- Acoplado a Redis
- No funciona si cambias de driver
- Poca legibilidad
- Propenso a errores

### Ahora: Queue::totalSize()

```php
// Método nuevo - agnóstico del driver
$size = Queue::totalSize();
```

**Ventajas:**
- Funciona con cualquier driver (Redis, Database, SQS, etc.)
- API clara y consistente
- Mantenible y legible
- Respeta la abstracción de Laravel

## Limitaciones importantes

### 1. Performance en colas muy grandes

En Redis, `totalSize()` usa el comando `LLEN`, que es O(1). Sin embargo, en conexiones de base de datos, puede ser más lento:

```php
// Optimizar para bases de datos grandes
$size = DB::table('jobs')
    ->where('queue', 'default')
    ->count(); // Considera índices
```

### 2. No incluye failed jobs

`totalSize()` solo cuenta jobs pendientes. Para incluir failed jobs:

```php
$pendingJobs = Queue::totalSize();
$failedJobs = DB::table('failed_jobs')->count();
$totalJobs = $pendingJobs + $failedJobs;
```

## Monitoreo con Laravel Horizon

Si usas **Laravel Horizon**, `totalSize()` se complementa perfectamente con su dashboard:

```php
// En Horizon, ya tienes visualización automática
// Pero puedes enriquecerla con tus propios datos
public function enrichHorizonMetrics()
{
    $metrics = [
        'queue_size' => Queue::totalSize(),
        'processes' => Horizon::processes(),
        'failed_jobs' => DB::table('failed_jobs')->count(),
    ];

    return $metrics;
}
```

## Mejores prácticas

### ✅ Hazlo

```php
// Cachear el resultado para evitar múltiples consultas
$queueSize = Cache::remember('queue_size', 30, function () {
    return Queue::totalSize();
});
```

### ❌ Evita

```php
// No consultes constantemente en un loop
foreach (range(1, 100) as $i) {
    $size = Queue::totalSize(); // ❌ Ineficiente
}
```

### ✅ Mejor

```php
// Hazlo una sola vez
$size = Queue::totalSize();
foreach (range(1, 100) as $i) {
    // Usa $size aquí
}
```

## Conclusión

`Queue::totalSize()` en Laravel 13.31 es un método simple pero revolucionario para monitoreo de colas. Transforma lo que antes era complejo y acoplado a Redis en una línea de código limpia y agnóstica.

Ya sea que estés construyendo un dashboard de monitoreo, implementando alertas automáticas, escalando workers dinámicamente o exponiendo métricas a través de APIs, este método te proporciona la base sólida que necesitas.

La clave está en **usar esta métrica de forma inteligente**: cachear cuando sea necesario, considerar los umbrales apropiados para tu aplicación, y combinarla con otras herramientas de monitoreo como Horizon y tus propios alertas.

## Puntos clave

- **Queue::totalSize()** devuelve el número exacto de jobs en una conexión de colas
- Funciona con cualquier driver (Redis, Database, SQS), no solo Redis
- Es O(1) en Redis, pero puede ser más lento en bases de datos grandes
- Ideal para crear dashboards, alertas automáticas y sistemas de escalado
- Siempre cachea el resultado si lo consultas frecuentemente
- No incluye failed jobs; consulta la tabla `failed_jobs` por separado
- Complementa perfectamente con Laravel Horizon para monitoreo completo
- Evita consultarlo múltiples veces en loops; cálculalo una sola vez
- Usa esta métrica para tomar decisiones sobre escalado de workers
- Expón las métricas a través de APIs para monitoreo externo