---
title: 'Queue::forward() en Laravel 13.26: Reencamina Colas sin Modificar Jobs'
description: 'Reencamina trabajos en cola a otra queue o conexión desde un proveedor sin cambiar clases de jobs. Nueva feature de Laravel 13.26.'
pubDate: '2026-08-21'
tags: ['laravel', 'queues', 'jobs', 'laravel-13']
---

## Introducción

Uno de los desafíos más comunes en aplicaciones Laravel con múltiples colas es la necesidad de reencaminar trabajos dinámicamente. Imagina que tu aplicación procesa emails, notificaciones y procesamiento de imágenes en diferentes colas, pero necesitas cambiar estrategias de enrutamiento sin tocar el código de tus jobs.

Laravel 13.26 introduce **Queue::forward()**, una solución elegante que permite reencaminar trabajos a diferentes colas o conexiones desde un proveedor de servicios, sin modificar absolutamente nada en tus clases de jobs.

En este artículo exploraremos cómo funciona, cuándo usarlo y patrones reales para maximizar su potencial.

## ¿Qué es Queue::forward()?

**Queue::forward()** es un método que intercepta trabajos en cola antes de que se ejecuten y los reencamina a otra cola o conexión. La magia está en que ocurre a nivel de configuración, completamente transparente para tus jobs.

```php
// En tu ServiceProvider
use Illuminate\Support\Facades\Queue;

public function boot(): void
{
    Queue::forward('emails', 'high-priority');
}
```

Este ejemplo simple redirige todos los trabajos de la cola `emails` a la cola `high-priority` sin tocar ningún job. Es configuración pura, separada de la lógica de negocio.

## Casos de uso reales

### 1. Separar por entorno

En desarrollo, quizás quieras procesar todos los jobs sincronizadamente, pero en producción usar Redis. Queue::forward() lo permite:

```php
// AppServiceProvider.php
public function boot(): void
{
    if (app()->isProduction()) {
        Queue::forward('emails', connection: 'redis');
        Queue::forward('notifications', connection: 'redis');
        Queue::forward('images', connection: 'redis');
    } else {
        // En desarrollo, usa 'sync' para ejecución inmediata
        Queue::forward('*', connection: 'sync');
    }
}
```

### 2. Priorizar colas dinámicamente

Supón que tienes dos trabajos que compiten por recursos. Durante horas pico, quieres priorizar emails sobre notificaciones:

```php
use Illuminate\Support\Facades\Queue;
use Carbon\Carbon;

public function boot(): void
{
    // Durante horario de oficina, emails con máxima prioridad
    if (Carbon::now()->between('09:00', '18:00')) {
        Queue::forward('notifications', 'emails');
    }
}
```

### 3. Balanceo de carga

Distribuye trabajos entre múltiples conexiones para evitar sobrecargar una sola:

```php
public function boot(): void
{
    // Alterna entre Redis clusters
    Queue::forward('heavy-processing', 'redis-cluster-1');
    Queue::forward('reports', 'redis-cluster-2');
    Queue::forward('backups', 'redis-cluster-3');
}
```

## Sintaxis completa

Queue::forward() acepta varios parámetros:

```php
Queue::forward(
    $queue,              // Cola de origen (string o array)
    $target = null,      // Cola destino (string)
    $connection = null   // Conexión destino (string)
);
```

### Ejemplos avanzados

```php
use Illuminate\Support\Facades\Queue;

public function boot(): void
{
    // Una cola a otra
    Queue::forward('slow-jobs', 'fast-queue');
    
    // Una cola a otra conexión
    Queue::forward('background', connection: 'database');
    
    // Múltiples colas al mismo destino
    Queue::forward(['notifications', 'alerts'], 'urgent');
    
    // Todo lo que no sea especificado a una cola por defecto
    Queue::forward('*', 'default');
}
```

## Casos de uso avanzados

### Reencaminamiento condicional con proveedores personalizados

Si necesitas lógica más compleja, crea un proveedor personalizado:

```php
// app/Providers/DynamicQueueRoutingProvider.php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Queue;
use App\Services\LoadBalancer;

class DynamicQueueRoutingProvider extends ServiceProvider
{
    public function boot(): void
    {
        $loadBalancer = $this->app->make(LoadBalancer::class);
        
        // Obtén la cola destino según carga actual
        $emailQueue = $loadBalancer->getLeastLoadedQueue(['redis-1', 'redis-2']);
        Queue::forward('emails', connection: $emailQueue);
        
        // Prioriza trabajos urgentes
        if ($loadBalancer->isPeakHours()) {
            Queue::forward('reports', 'low-priority');
        } else {
            Queue::forward('reports', 'normal');
        }
    }
}
```

### Múltiples niveles de prioridad

```php
public function boot(): void
{
    // Crítico
    Queue::forward('security-alerts', 'priority-1');
    
    // Alto
    Queue::forward(['payments', 'orders'], 'priority-2');
    
    // Normal
    Queue::forward(['emails', 'notifications'], 'priority-3');
    
    // Bajo
    Queue::forward(['reports', 'analytics'], 'priority-4');
}
```

## Comparación con alternativas

### Sin Queue::forward() (forma antigua)

```php
// En cada job
namespace App\Jobs;

class SendEmail implements ShouldQueue
{
    // ❌ Acoplado a la cola
    public $queue = 'emails';
    
    public function handle(): void
    {
        // lógica
    }
}

// Si cambias de estrategia, modificas TODOS los jobs
```

### Con Queue::forward() (forma nueva)

```php
// En ServiceProvider (centralizado)
Queue::forward('emails', 'high-priority');

// Jobs sin cambios ❌ Sin acoplamiento
namespace App\Jobs;

class SendEmail implements ShouldQueue
{
    // El job no sabe ni le importa dónde se procesa
    public function handle(): void
    {
        // lógica
    }
}
```

## Monitoreo y debugging

Aunque Queue::forward() es transparente, puedes agregar logs para entender el flujo:

```php
public function boot(): void
{
    Queue::before(function (JobProcessing $event) {
        Log::info("Job {$event->job->getJobId()} iniciando en cola: {$event->job->getQueue()}");
    });
    
    Queue::after(function (JobProcessed $event) {
        Log::info("Job {$event->job->getJobId()} completado");
    });
    
    // Forward con logging
    Queue::forward('slow-jobs', 'optimized', function ($job) {
        Log::channel('queue-routing')->info("Reenviando {$job->resolveName()} a optimized");
    });
}
```

## Limitaciones y consideraciones

### No funciona con todas las conexiones

Queue::forward() funciona mejor con conexiones que soportan dinámicamente configuración de colas:

```php
// ✅ Funciona bien
Queue::forward('emails', connection: 'redis');
Queue::forward('jobs', connection: 'database');

// ⚠️ Limitado (algunos drivers no lo soportan completamente)
Queue::forward('sync', connection: 'sync');
```

### Performance

El reencaminamiento ocurre en tiempo real sin overhead significativo, pero si tienes cientos de rules, considera agruparlas:

```php
// ❌ Innecesariamente específico
Queue::forward('email-welcome', 'high');
Queue::forward('email-reset', 'high');
Queue::forward('email-confirm', 'high');

// ✅ Mejor
Queue::forward(['email-*'], 'high');
```

## Integración con otras features de Laravel

### Con workers supervisados

```php
// supervisor-queue-routing.conf
[program:laravel-queue-high]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/artisan queue:work --queue=high-priority

[program:laravel-queue-normal]
command=php /path/to/artisan queue:work --queue=normal

; Queue::forward() automáticamente enruta a las colas correctas
```

### Con Laravel Horizon

Queue::forward() juega bien con Horizon, que monitorea múltiples colas:

```php
// config/horizon.php
'environments' => [
    'production' => [
        'supervisor-1' => [
            'connection' => 'redis',
            'queue' => 'high-priority', // Horizon sigue los forwards
            'balance' => 'auto',
            'procs' => 10,
        ],
    ],
],
```

## Ejemplo completo: Sistema de notificaciones multi-prioridad

```php
// app/Providers/NotificationQueueProvider.php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Queue;
use App\Models\SystemHealth;

class NotificationQueueProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Obtén estado del sistema
        $health = SystemHealth::current();
        
        // Configura enrutamiento según salud
        if ($health->cpu_usage > 80 || $health->memory_usage > 85) {
            // Sistema bajo estrés: prioriza crítico
            Queue::forward('security', 'critical');
            Queue::forward('payments', 'critical');
            
            // Defer everything else
            Queue::forward('emails', 'deferred');
            Queue::forward('reports', 'deferred');
            Queue::forward('analytics', 'deferred');
        } else {
            // Sistema sano: distribución normal
            Queue::forward('security', 'high');
            Queue::forward('payments', 'high');
            Queue::forward('emails', 'normal');
            Queue::forward('reports', 'low');
            Queue::forward('analytics', 'low');
        }
        
        // Fallback: todo lo demás va a default
        Queue::forward('*', 'default');
    }
}
```

Jobs sin cambios:

```php
namespace App\Jobs;

class SendSecurityAlert implements ShouldQueue
{
    public function __construct(
        private string $alertType,
        private array $details,
    ) {}
    
    public function handle(): void
    {
        // El job no sabe dónde se ejecuta
        // Queue::forward() lo maneja
        Log::critical("Security alert: {$this->alertType}");
    }
}

class GenerateMonthlyReport implements ShouldQueue
{
    public function handle(): void
    {
        // Automáticamente en 'low' si el sistema está estresado
        // O en 'low' en cualquier caso
    }
}
```

## Puntos clave

- **Queue::forward()** reencamina trabajos sin modificar clases de jobs
- **Centralización**: toda la lógica de enrutamiento en un proveedor
- **Dinámico**: funciona con lógica condicional en tiempo real
- **Múltiples niveles**: soporta varios destinos y conexiones
- **Transparencia**: los jobs permanecen desacoplados de la infraestructura
- **Casos de uso**: priorización, balanceo de carga, separación por entorno
- **Integración**: funciona con Horizon y workers supervisados
- **Sin overhead**: reencaminamiento eficiente sin penalización de performance
- **Simplifica arquitectura**: reemplaza configuración hardcodeada en jobs
- **Testing**: facilita cambiar comportamiento sin modificar código de negocio