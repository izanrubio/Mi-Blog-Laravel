---
title: 'Vigilance en Laravel: Monitorea Queues, Commands y Schedulers'
description: 'Vigilance es un dashboard self-hosted para monitorear colas, comandos y tareas programadas en Laravel. Guía completa con ejemplos.'
pubDate: '2026-06-20'
tags: ['laravel', 'queues', 'monitoring', 'scheduler', 'commands']
---

## Vigilance en Laravel: Monitorea Queues, Commands y Schedulers

Si trabajas con aplicaciones Laravel en producción, sabes que monitorear la salud de tus colas, comandos Artisan y tareas programadas es crítico. El problema es que no siempre tienes herramientas claras para ver qué está pasando en segundo plano. **Vigilance** es un dashboard self-hosted que soluciona exactamente esto, proporcionando visibilidad completa sobre el ciclo de vida de jobs, comandos y scheduled tasks.

En este artículo, exploraremos cómo instalar, configurar y usar Vigilance en tus proyectos Laravel para obtener monitoreo profesional sin depender de servicios externos.

## ¿Qué es Vigilance?

Vigilance es un paquete Laravel que registra el ciclo de vida completo de:

- **Jobs en colas**: Seguimiento desde que se envían hasta que se completan o fallan
- **Comandos Artisan**: Ejecución manual de cualquier comando
- **Tareas programadas**: Monitoreo de todos los scheduled tasks

Lo interesante es que funciona con **cualquier driver de colas** (Redis, database, sync, SQS, etc.) y ofrece controles específicos para producción como muestreo (sampling) y despacho manual de tareas.

## Por qué usar Vigilance

Antes de Vigilance, tus opciones eran limitadas:

1. **Laravel Horizon**: Excelente pero solo para Redis
2. **Logs manuales**: Tedioso y poco visual
3. **Servicios externos**: Costo adicional y dependencia de terceros

Vigilance te da:
- Dashboard limpio y funcional
- Funcionamiento con cualquier driver
- Self-hosted (control total)
- Capacidad de despachar jobs manualmente
- Muestreo inteligente para no saturar la BD

## Instalación de Vigilance

El proceso es muy sencillo. Primero, instala el paquete vía Composer:

```bash
composer require laravel/vigilance
```

Luego, publica los assets y migraciones:

```bash
php artisan vendor:publish --provider="Laravel\Vigilance\VigilanceServiceProvider"
php artisan migrate
```

Esto creará las tablas necesarias para almacenar los registros de jobs, comandos y scheduled tasks.

## Configuración básica

El archivo de configuración se publica en `config/vigilance.php`. Aquí está la estructura típica:

```php
<?php

return [
    'enabled' => env('VIGILANCE_ENABLED', true),

    'path' => 'vigilance',

    'middleware' => ['web', 'auth'],

    'database' => [
        'connection' => env('DB_CONNECTION', 'default'),
        'table_prefix' => 'vigilance_',
    ],

    'sampling' => [
        'enabled' => env('VIGILANCE_SAMPLING_ENABLED', true),
        'percentage' => env('VIGILANCE_SAMPLING_PERCENTAGE', 100),
    ],

    'retention' => [
        'days' => env('VIGILANCE_RETENTION_DAYS', 7),
    ],
];
```

Explicación de las opciones principales:

- **enabled**: Activa o desactiva Vigilance globalmente
- **path**: Ruta donde acceder al dashboard (ej: `/vigilance`)
- **middleware**: Middlewares que protegen el acceso (recomendado autenticación)
- **sampling**: En producción, puedes registrar solo un porcentaje para no saturar BD
- **retention**: Cuántos días mantener los registros

## Configurar Vigilance en tu aplicación

Una vez instalado, Vigilance captura automáticamente jobs y comandos. Sin embargo, necesitas asegurar que tus ServiceProviders estén correctamente configurados.

En `app/Providers/AppServiceProvider.php`, añade:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Laravel\Vigilance\Vigilance;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            Vigilance::sample(10); // Registra solo el 10% en producción
        }
    }
}
```

La método `sample()` es crucial en producción. Si registras todo, la base de datos crecerá exponencialmente. Con muestreo al 10%, obtienes visibilidad sin sobrecargar.

## Trabajar con Jobs

Cuando despaches un job, Vigilance lo registra automáticamente:

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ProcessPodcast implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $podcastId,
        public string $episodeId,
    ) {}

    public function handle(): void
    {
        // Procesar el podcast
        sleep(2);
    }
}
```

Para despachar el job:

```php
use App\Jobs\ProcessPodcast;

// Despachar a la cola
ProcessPodcast::dispatch('podcast-123', 'episode-456');

// Despachar en el futuro
ProcessPodcast::dispatch('podcast-123', 'episode-456')
    ->delay(now()->addMinutes(10));

// Despachar a una cola específica
ProcessPodcast::dispatch('podcast-123', 'episode-456')
    ->onQueue('high-priority');
```

Vigilance capturará automáticamente:
- Cuándo fue despachado
- Cuándo comenzó la ejecución
- Cuándo se completó
- Si falló, el error exacto

## Monitorear Scheduled Tasks

Para que Vigilance registre tareas programadas, configúralas normalmente en `app/Console/Kernel.php`:

```php
<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        // Tarea simple
        $schedule->command('emails:send')
            ->hourly()
            ->name('Send Emails');

        // Tarea con callback
        $schedule->call(function () {
            \App\Models\User::where('inactive', true)
                ->delete();
        })
            ->daily()
            ->name('Delete Inactive Users');

        // Comando personalizado
        $schedule->command('reports:generate')
            ->dailyAt('2:00')
            ->name('Generate Daily Reports');
    }
}
```

Vigilance registrará automáticamente cada ejecución, permitiéndote ver:
- Hora de inicio y fin
- Duración
- Si tuvo errores
- Output del comando

## Acceder al Dashboard

Una vez configurado, accede al dashboard en:

```
https://tuapp.com/vigilance
```

El dashboard te mostrará:

1. **Jobs Table**: Todos los jobs despachados con su estado
2. **Commands Table**: Comandos Artisan ejecutados
3. **Scheduled Tasks**: Ejecuciones de tareas programadas

Puedes filtrar por estado (pending, running, completed, failed) y ver detalles de cada ejecución.

## Despacho Manual de Jobs

Una característica poderosa de Vigilance es que **puedes despachar jobs desde el dashboard**:

1. Ve a la sección "Manual Dispatch"
2. Selecciona la clase del job
3. Proporciona los parámetros (si los requiere)
4. Haz clic en "Dispatch"

Esto es útil para:
- Pruebas rápidas en producción
- Re-ejecutar jobs que fallaron
- Testing de escenarios específicos

## Ejemplo completo: Aplicación con Vigilance

Vamos a crear una aplicación pequeña que use Vigilance:

```php
<?php
// app/Jobs/SendNewsletterEmail.php

namespace App\Jobs;

use App\Models\Newsletter;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

class SendNewsletterEmail implements ShouldQueue
{
    use Queueable;

    public $tries = 3;
    public $backoff = [60, 120, 300]; // Reintentos

    public function __construct(
        public Newsletter $newsletter,
    ) {
        $this->onQueue('newsletters');
    }

    public function handle(): void
    {
        $newsletter->subscribers->each(function ($subscriber) {
            Mail::to($subscriber->email)
                ->queue(new \App\Mail\NewsletterMail($this->newsletter));
        });

        $this->newsletter->update(['sent_at' => now()]);
    }

    public function failed(\Throwable $exception): void
    {
        logger()->error('Newsletter failed', [
            'newsletter_id' => $this->newsletter->id,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

Comando para despachar:

```php
<?php
// app/Console/Commands/SendNewsletter.php

namespace App\Console\Commands;

use App\Jobs\SendNewsletterEmail;
use App\Models\Newsletter;
use Illuminate\Console\Command;

class SendNewsletter extends Command
{
    protected $signature = 'newsletter:send {newsletter_id?}';
    protected $description = 'Send newsletter to all subscribers';

    public function handle(): void
    {
        $query = Newsletter::where('sent_at', null);

        if ($newsletter_id = $this->argument('newsletter_id')) {
            $query->where('id', $newsletter_id);
        }

        $newsletters = $query->get();

        foreach ($newsletters as $newsletter) {
            SendNewsletterEmail::dispatch($newsletter);
            $this->line("Newsletter {$newsletter->id} dispatched");
        }

        $this->info('Done!');
    }
}
```

Scheduler:

```php
<?php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule): void
{
    $schedule->command('newsletter:send')
        ->daily()
        ->at('09:00')
        ->name('Send Daily Newsletters')
        ->emailOutputTo('admin@example.com')
        ->onFailure(function () {
            // Notificación si falla
        });
}
```

Ahora, Vigilance capturará:
- Cada job despachado
- La ejecución del comando
- El resultado de la tarea programada

## Optimización en Producción

### Muestreo estratégico

```php
// app/Providers/AppServiceProvider.php

public function boot(): void
{
    if ($this->app->isProduction()) {
        // Registrar solo errores en producción
        Vigilance::sampleErrors();
        
        // O un porcentaje específico
        Vigilance::sample(5); // 5%
    }
}
```

### Limpieza automática

Vigilance incluye un comando para limpiar registros antiguos:

```bash
php artisan vigilance:cleanup
```

Agrégalo a tu scheduler:

```php
$schedule->command('vigilance:cleanup')
    ->daily()
    ->at('03:00');
```

### Base de datos dedicada

Para aplicaciones de alto volumen, considera usar una BD separada:

```php
// config/vigilance.php
'database' => [
    'connection' => 'monitoring', // Conexión separada
],
```

## Análisis de datos

Puedes consultar los datos de Vigilance programáticamente:

```php
<?php

use Laravel\Vigilance\Models\MonitoredJob;

// Jobs recientes
$recentJobs = MonitoredJob::latest()
    ->limit(10)
    ->get();

// Jobs fallidos
$failedJobs = MonitoredJob::where('status', 'failed')
    ->where('created_at', '>', now()->subDay())
    ->get();

// Duración promedio
$avgDuration = MonitoredJob::where('job_class', ProcessPodcast::class)
    ->average('duration_seconds');
```

Esto es útil para dashboards personalizados o alertas.

## Troubleshooting común

### Dashboard no aparece
Verifica que Vigilance esté habilitado en `.env`:
```
VIGILANCE_ENABLED=true
```

### No se registran jobs
Asegúrate de que tus jobs implementen `ShouldQueue`:
```php
class MyJob implements ShouldQueue
{
    use Queueable;
}
```

### Tabla de Vigilance crece demasiado
Aumenta la retención o reduce el muestreo:
```env
VIGILANCE_SAMPLING_PERCENTAGE=5
VIGILANCE_RETENTION_DAYS=3
```

## Comparativa con otras soluciones

| Característica | Vigilance | Horizon | Logs |
|---|---|---|---|
| Self-hosted | ✅ | ✅ | ✅ |
| Cualquier driver | ✅ | ❌ (Redis) | ❌ |
| Dashboard | ✅ | ✅ | ❌ |
| Muestreo | ✅ | ❌ | ❌ |
| Despacho manual | ✅ | ❌ | ❌ |
| Sin dependencias | ✅ | ❌ (Redis) | ✅ |

## Conclusión

Vigilance es una herramienta poderosa para cualquier equipo de desarrollo Laravel que necesite visibilidad sobre sus operaciones en background. Su capacidad de funcionar con cualquier driver de colas, control fino de muestreo y facilidad de instalación lo hacen ideal tanto para startups como para aplicaciones empresariales.

La combinación de un dashboard intuitivo, despacho manual de jobs y análisis de datos la convierte en una solución completa para monitoreo en producción. Si actualmente uses logs manuales o no tengas forma de ver qué está pasando en tus colas, Vigilance es exactamente lo que necesitas.

## Puntos clave

- **Vigilance** es un dashboard self-hosted para monitorear jobs, comandos y scheduled tasks en Laravel
- Funciona con **cualquier driver de colas** (Redis, database, SQS, etc.)
- Incluye **muestreo inteligente** para no saturar la base de datos en producción
- Permite **despacho manual** de jobs desde el dashboard
- La instalación es sencilla: `composer require laravel/vigilance`
- Ofrece **retención configurable** para limpiar datos antiguos automáticamente
- Es ideal para debugging en producción sin servicios externos costosos
- Captura automáticamente duración, errores y estado de ejecución
- Puedes consultar los datos programáticamente para análisis personalizados
- Requiere **autenticación** en el dashboard (configurable en `config/vigilance.php`)