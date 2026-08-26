---
title: 'JobReleased en Laravel 13.26: Monitorea Reintentos de Jobs'
description: 'Aprende a usar el evento JobReleased en Laravel 13.26 para monitorear y controlar reintentos automáticos de jobs con ejemplos prácticos.'
pubDate: '2026-08-24'
tags: ['laravel', 'jobs', 'queues', 'events']
---

## Introducción

En Laravel 13.26, el framework introduce un nuevo evento llamado `JobReleased` que se dispara cuando un job falla y es reenviado a la cola para reintentos automáticos. Este evento es fundamental para implementar observabilidad avanzada en tus aplicaciones que dependen de colas, permitiéndote monitorear, registrar y reaccionar a los reintentos de jobs de manera granular.

Hasta ahora, los desarrolladores solo podían monitorizar fallos mediante eventos como `JobFailed` o `JobProcessed`, pero `JobReleased` proporciona una ventana de visibilidad intermedia: justo cuando un job se suelta de nuevo a la cola sin haber fallado definitivamente. Esto es crucial para entender patrones de reintentos, diagnosticar problemas intermitentes y optimizar tu estrategia de manejo de errores.

En este artículo exploraremos qué es `JobReleased`, cómo implementarlo en tus listeners, y cómo aprovecharlo para construir sistemas de monitoreo robustos.

## ¿Qué es el evento JobReleased?

El evento `JobReleased` se dispara en el worker de colas cuando un job genera una excepción que no es de tipo `ShouldNotBeEncrypted`, pero el job aún tiene reintentos disponibles. En lugar de marcarlo como fallido definitivamente, Laravel lo libera nuevamente a la cola con un delay según su configuración.

Este flujo es diferente del evento `JobFailed`, que solo se dispara cuando el job agota todos sus reintentos. Comprender esta distinción es esencial:

- **JobReleased**: Job falló pero será reintentado
- **JobFailed**: Job agotó todos sus reintentos y falló definitivamente

El evento proporciona acceso a información valiosa:
- La excepción que causó el fallo
- El número de intentos realizados
- El nombre de la cola
- El payload del job

## Implementar un Listener para JobReleased

Para comenzar a monitorizar jobs liberados, necesitas crear un listener que responda al evento `JobReleased`. Veamos cómo hacerlo paso a paso.

### Paso 1: Crear el Listener

```bash
php artisan make:listener LogJobRelease --queued
```

Este comando genera un archivo en `app/Listeners/LogJobRelease.php`. Vamos a implementarlo para registrar información útil:

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobReleased;
use Illuminate\Support\Facades\Log;

class LogJobRelease
{
    public function handle(JobReleased $event): void
    {
        Log::warning('Job liberado para reintento', [
            'job' => $event->job->resolveName(),
            'queue' => $event->job->getQueue(),
            'attempts' => $event->job->attempts(),
            'max_tries' => $event->job->maxTries(),
            'exception' => get_class($event->job->getException()),
            'message' => $event->job->getException()->getMessage(),
            'delay' => $event->job->getJobData()['delay'] ?? null,
        ]);
    }
}
```

### Paso 2: Registrar el Listener

En tu archivo `app/Providers/EventServiceProvider.php`, registra el listener:

```php
<?php

namespace App\Providers;

use App\Listeners\LogJobRelease;
use Illuminate\Queue\Events\JobReleased;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        JobReleased::class => [
            LogJobRelease::class,
        ],
    ];
}
```

## Casos de Uso Avanzados

### Alertas Inteligentes para Patrones de Reintento

A veces, un job que se libera una o dos veces es normal (conexión temporal fallida), pero si se libera 5+ veces, indica un problema grave. Implementemos alertas inteligentes:

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobReleased;
use Illuminate\Support\Facades\Log;
use App\Services\AlertService;

class JobRetryAlert
{
    public function __construct(private AlertService $alertService)
    {
    }

    public function handle(JobReleased $event): void
    {
        $attempts = $event->job->attempts();
        $maxTries = $event->job->maxTries();

        // Alerta si el job está próximo a fallar definitivamente
        if ($maxTries && $attempts >= $maxTries - 2) {
            $this->alertService->critical(
                "Job {$event->job->resolveName()} está por fallar definitivamente",
                [
                    'attempts' => $attempts,
                    'max_tries' => $maxTries,
                    'exception' => $event->job->getException()->getMessage(),
                    'queue' => $event->job->getQueue(),
                ]
            );
        }

        // Log para análisis
        Log::info('Job release detected', [
            'job' => $event->job->resolveName(),
            'attempt' => $attempts,
            'max_tries' => $maxTries,
            'remaining_attempts' => $maxTries ? $maxTries - $attempts : '∞',
        ]);
    }
}
```

### Registrar Métricas en tu Sistema de Observabilidad

Si usas un servicio como DataDog, New Relic o similar, puedes registrar métricas en tiempo real:

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobReleased;
use Illuminate\Support\Facades\Metrics; // Asumiendo un facade personalizado

class JobReleaseMetrics
{
    public function handle(JobReleased $event): void
    {
        $jobName = $event->job->resolveName();
        $queue = $event->job->getQueue() ?? 'default';
        $exception = get_class($event->job->getException());

        // Registrar métrica de contador
        Metrics::counter('job.released', 1, [
            'job_name' => $jobName,
            'queue' => $queue,
            'exception_type' => $exception,
        ]);

        // Registrar intento actual
        Metrics::gauge('job.attempt', $event->job->attempts(), [
            'job_name' => $jobName,
        ]);

        // Registrar el tipo de excepción para patrones
        $this->recordExceptionPattern($jobName, $exception);
    }

    private function recordExceptionPattern(string $jobName, string $exception): void
    {
        $cacheKey = "job_exception_pattern:{$jobName}:{$exception}";
        cache()->increment($cacheKey, 1, 3600); // Contador por hora
    }
}
```

### Reintentos Inteligentes con Exponential Backoff

Si deseas implementar estrategias de backoff más complejas, puedes reaccionar al evento `JobReleased`:

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobReleased;
use Illuminate\Queue\Jobs\Job;

class SmartJobRetryBackoff
{
    public function handle(JobReleased $event): void
    {
        $job = $event->job;
        $attempts = $job->attempts();
        
        // Calcular delay exponencial: 2^(intentos-1) * 30 segundos
        $delay = 30 * (2 ** ($attempts - 1));
        
        // Limitar a máximo 30 minutos
        $delay = min($delay, 1800);
        
        // Actualizar el job con el nuevo delay
        $this->updateJobDelay($job, $delay);
        
        // Log del backoff aplicado
        \Log::info("Backoff exponencial aplicado a {$job->resolveName()}", [
            'attempts' => $attempts,
            'delay_seconds' => $delay,
            'delay_human' => $this->formatSeconds($delay),
        ]);
    }

    private function updateJobDelay(Job $job, int $delaySeconds): void
    {
        // Nota: Esto es ilustrativo. El delay real se gestiona
        // en el decorador #[Delay] o en el release() del job
        $jobData = $job->getJobData();
        $jobData['delay'] = $delaySeconds;
        // Actualizar en la cola si es necesario
    }

    private function formatSeconds(int $seconds): string
    {
        if ($seconds < 60) {
            return "{$seconds}s";
        } elseif ($seconds < 3600) {
            return intval($seconds / 60) . "m";
        }
        return intval($seconds / 3600) . "h";
    }
}
```

## Integración con Laravel Horizon

Si usas **Laravel Horizon** para monitorizar tus colas, puedes combinar `JobReleased` con el dashboard de Horizon para visibilidad completa:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Exception;

class ProcessPayment implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function __construct(private int $paymentId)
    {
    }

    public function handle(): void
    {
        try {
            // Simulación de procesamiento
            if (rand(1, 3) === 1) {
                throw new Exception('Timeout conectando a payment gateway');
            }
            
            // Procesar pago...
        } catch (Exception $e) {
            // Liberar el job con delay para reintento
            $this->release(delay: 60 * $this->attempts());
        }
    }

    public function maxTries(): int
    {
        return 5; // Máximo 5 reintentos
    }
}
```

En Horizon verás el flujo completo: JobReleased → reintentos → JobFailed (si agota intentos).

## Debugging de JobReleased

Para diagnosticar problemas con jobs que se liberan continuamente, crea un comando artisan útil:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

class ShowJobReleaseStats extends Command
{
    protected $signature = 'job:release-stats {--job= : Filtrar por nombre de job}';
    protected $description = 'Mostrar estadísticas de liberación de jobs';

    public function handle(): void
    {
        $pattern = 'job_exception_pattern:' . ($this->option('job') ?? '*');
        
        $keys = Cache::getStore()->connection()->keys($pattern);
        
        if (empty($keys)) {
            $this->info('No hay datos de liberación de jobs registrados.');
            return;
        }

        $this->info('📊 Estadísticas de liberación de jobs:');
        $this->newLine();

        $table = [];
        foreach ($keys as $key) {
            $parts = explode(':', $key);
            $jobName = $parts[1] ?? 'unknown';
            $exception = $parts[2] ?? 'unknown';
            $count = Cache::get($key, 0);

            $table[] = [
                'job' => class_basename($jobName),
                'exception' => class_basename($exception),
                'releases' => $count,
            ];
        }

        usort($table, fn($a, $b) => $b['releases'] <=> $a['releases']);
        
        $this->table(
            ['Job', 'Excepción', 'Liberaciones'],
            $table
        );
    }
}
```

Úsalo así:

```bash
php artisan job:release-stats
php artisan job:release-stats --job=ProcessPayment
```

## Mejores Prácticas

### 1. No Sobrecargues los Listeners

Los listeners de `JobReleased` se ejecutan en el worker. Mantén la lógica ligera:

```php
// ✅ BUENO: Operación rápida
public function handle(JobReleased $event): void
{
    Log::info('Job released', ['job' => $event->job->resolveName()]);
}

// ❌ MALO: Operación pesada bloqueante
public function handle(JobReleased $event): void
{
    // NO hacer queries lentas aquí
    $user = User::where('email', 'admin@example.com')->first();
    Mail::send(...); // NO enviar emails síncronamente
}
```

### 2. Usa Listeners en Cola (Queued Listeners)

Si tu listener requiere operaciones pesadas, hazlo cola:

```php
<?php

namespace App\Listeners;

use Illuminate\Queue\Events\JobReleased;
use Illuminate\Contracts\Queue\ShouldQueue;

class ProcessJobReleaseAnalytics implements ShouldQueue
{
    public function handle(JobReleased $event): void
    {
        // Esta lógica se ejecutará en una cola separada
        $this->analyzeReleasePattern($event->job);
    }
}
```

Registra como queued:

```php
protected $listen = [
    JobReleased::class => [
        ProcessJobReleaseAnalytics::class, // Se ejecuta en cola
    ],
];
```

### 3. Filtra por Job Específicos

No necesitas procesar todos los jobs:

```php
public function handle(JobReleased $event): void
{
    $jobName = $event->job->resolveName();
    
    // Solo procesar jobs críticos
    $criticalJobs = [
        'App\Jobs\ProcessPayment',
        'App\Jobs\SendInvoice',
    ];
    
    if (!in_array($jobName, $criticalJobs)) {
        return;
    }
    
    // Procesar...
}
```

## Conclusión

El evento `JobReleased` en Laravel 13.26 es una herramienta poderosa para construir sistemas de colas más observables y resilientes. Te permite detectar patrones problemáticos, alertar sobre jobs próximos a fallar y comprender mejor el comportamiento de tu aplicación bajo presión.

Implementar listeners para `JobReleased` es relativamente simple, pero el valor que aporta en términos de visibilidad y capacidad de reacción es inmediato. Especialmente en aplicaciones críticas donde los fallos de jobs afectan directamente a tus usuarios, este evento es indispensable.

Combina `JobReleased` con herramientas como **Horizon**, **Telescope**, y tus sistemas de observabilidad existentes para obtener una imagen completa del ciclo de vida de tus jobs.

## Puntos clave

- **JobReleased vs JobFailed**: JobReleased se dispara cuando un job falla pero será reintentado; JobFailed solo cuando agota intentos
- **Información disponible**: El evento proporciona acceso a la excepción, número de intentos, nombre del job y de la cola
- **Listeners eficientes**: Mantén la lógica en JobReleased ligera; usa listeners encolados si necesitas operaciones pesadas
- **Observabilidad integrada**: Combina JobReleased con métricas, alertas y logging estructurado para máxima visibilidad
- **Debugging avanzado**: Crea