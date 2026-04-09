---
title: 'Jobs, Queues y Workers en Laravel — Guía completa'
description: 'Aprende a usar Jobs, Queues y Workers en Laravel: crea tu primer job, configura colas con database y Redis, y ejecuta workers en desarrollo y producción.'
pubDate: '2026-04-09'
tags: ['laravel', 'jobs', 'queues', 'workers', 'async']
---

Hay operaciones en tu aplicación que son lentas: enviar emails, generar PDFs, procesar imágenes, llamar a APIs externas. Si las ejecutas en el hilo principal de una request HTTP, el usuario tiene que esperar. La solución son las colas (queues) y los jobs asíncronos.

## ¿Por qué usar colas?

El escenario clásico:

```php
// Sin colas: el usuario espera 5 segundos hasta que el email se envía
public function register(Request $request)
{
    $user = User::create($request->validated());
    
    Mail::to($user)->send(new WelcomeMail($user));  // 2-5 segundos
    
    return redirect('/dashboard');  // El usuario espera todo esto
}

// Con colas: el usuario recibe respuesta inmediata
public function register(Request $request)
{
    $user = User::create($request->validated());
    
    SendWelcomeMail::dispatch($user);  // Se pone en cola, no bloquea
    
    return redirect('/dashboard');  // Respuesta inmediata
}
// El email se envía en segundo plano por el worker
```

## Crear tu primer Job

```bash
php artisan make:job SendWelcomeMail
```

```php
<?php

namespace App\Jobs;

use App\Mail\WelcomeMail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendWelcomeMail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Número de intentos si el job falla
    public int $tries = 3;
    
    // Timeout en segundos
    public int $timeout = 60;
    
    // Backoff entre reintentos
    public int $backoff = 30;

    public function __construct(
        private User $user  // SerializesModels maneja la serialización
    ) {}

    /**
     * El método handle() es donde va la lógica del job
     */
    public function handle(): void
    {
        Mail::to($this->user)->send(new WelcomeMail($this->user));
    }

    /**
     * Se llama cuando el job agota todos sus intentos
     */
    public function failed(\Throwable $exception): void
    {
        \Log::error("No se pudo enviar email de bienvenida a {$this->user->email}", [
            'error' => $exception->getMessage(),
        ]);
        
        // Notificar al equipo, actualizar estado, etc.
    }
}
```

### Por qué implements ShouldQueue

La interfaz `ShouldQueue` le dice a Laravel que este job debe procesarse en cola. Sin ella, `dispatch()` lo ejecutaría de forma síncrona (como si usaras `dispatchSync()`).

## Configurar el driver de cola

En `.env`:

```bash
# Síncrono: no usa cola real, ejecuta el job inmediatamente (para desarrollo)
QUEUE_CONNECTION=sync

# Base de datos: guarda jobs en la tabla 'jobs' (fácil de configurar)
QUEUE_CONNECTION=database

# Redis: alta performance, recomendado para producción
QUEUE_CONNECTION=redis

# Amazon SQS: para aplicaciones en AWS
QUEUE_CONNECTION=sqs
```

### Configurar el driver database

```bash
# Crear la tabla de jobs
php artisan queue:table
php artisan migrate
```

Esto crea la tabla `jobs` donde se guardan los jobs pendientes.

## Despachar jobs

```php
// Despachar inmediatamente a la cola por defecto
SendWelcomeMail::dispatch($user);

// Con delay: procesar después de 10 minutos
SendWelcomeMail::dispatch($user)->delay(now()->addMinutes(10));

// En una cola específica (debes tener workers escuchando esa cola)
SendWelcomeMail::dispatch($user)->onQueue('emails');

// Con una conexión específica
SendWelcomeMail::dispatch($user)->onConnection('redis');

// Despacho condicional
SendWelcomeMail::dispatchIf($user->wants_emails, $user);

// Forma alternativa con helper dispatch()
dispatch(new SendWelcomeMail($user));

// Síncrono (ignorar la cola, ejecutar ahora)
SendWelcomeMail::dispatchSync($user);
```

### Encadenar jobs

```php
// Los jobs se ejecutan en orden, uno después del otro
Bus::chain([
    new CreateThumbnail($video),
    new TranscodeVideo($video),
    new NotifyUploadComplete($video),
])->dispatch();
```

### Batch: grupos de jobs

```php
use Illuminate\Bus\Batch;
use Illuminate\Support\Facades\Bus;

$batch = Bus::batch([
    new ImportUserJob($chunk1),
    new ImportUserJob($chunk2),
    new ImportUserJob($chunk3),
])->then(function (Batch $batch) {
    // Todos los jobs completados
    \Log::info("Importación completa: {$batch->processedJobs()} usuarios");
})->catch(function (Batch $batch, \Throwable $e) {
    // Al menos un job falló
    \Log::error("Error en importación masiva: " . $e->getMessage());
})->finally(function (Batch $batch) {
    // Siempre se ejecuta al final
})->dispatch();

// Ver el progreso del batch
$progress = $batch->progress(); // 0-100
```

## Ejecutar el worker

El worker es el proceso que escucha la cola y ejecuta los jobs:

```bash
# Escuchar la cola por defecto
php artisan queue:work

# Escuchar una cola específica
php artisan queue:work --queue=emails

# Escuchar múltiples colas en orden de prioridad
php artisan queue:work --queue=high,default,low

# Procesar solo un job y parar (útil para debugging)
php artisan queue:work --once

# Con conexión específica
php artisan queue:work redis

# Con opciones de control
php artisan queue:work \
    --tries=3 \
    --timeout=60 \
    --sleep=3 \   # Segundos de espera cuando la cola está vacía
    --verbose
```

### Diferencia entre queue:work y queue:listen

```bash
# queue:work: recomendado para producción
# Carga el código una vez, muy eficiente
# PERO: necesitas reiniciarlo cuando despliegas código nuevo
php artisan queue:work

# queue:listen: para desarrollo
# Recarga el código en cada job
# Más lento pero útil cuando estás cambiando código frecuentemente
php artisan queue:listen
```

### Reiniciar workers en producción

Después de cada despliegue, debes reiniciar los workers para que carguen el código nuevo:

```bash
# Señaliza a los workers que terminen el job actual y paren
php artisan queue:restart

# Los workers se reinician automáticamente si usas Supervisor
```

## Supervisor: mantener los workers corriendo

En producción, los workers deben sobrevivir reinicios del servidor. Para eso se usa `supervisor`:

```ini
; /etc/supervisor/conf.d/laravel-worker.conf
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/html/mi-app/artisan queue:work redis --sleep=3 --tries=3 --timeout=60
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4           ; Número de workers en paralelo
redirect_stderr=true
stdout_logfile=/var/www/html/mi-app/storage/logs/worker.log
stopwaitsecs=3600
```

```bash
# Comandos de supervisor
supervisorctl reread
supervisorctl update
supervisorctl start laravel-worker:*
supervisorctl restart laravel-worker:*
```

## Horizon: panel de control para Redis

Si usas Redis como driver, Laravel Horizon añade un dashboard web para monitorizar las colas:

```bash
composer require laravel/horizon
php artisan horizon:install
php artisan migrate
```

```php
// config/horizon.php: configurar los workers
'environments' => [
    'production' => [
        'supervisor-1' => [
            'maxProcesses' => 10,
            'balanceMaxShift' => 1,
            'balanceCooldown' => 3,
        ],
    ],
],
```

```bash
# Iniciar Horizon (reemplaza a queue:work cuando lo usas)
php artisan horizon

# Acceder al dashboard
# http://tu-app.com/horizon
```

Horizon te muestra: jobs procesados por minuto, jobs fallidos, tiempo de respuesta de cada cola, y gráficas históricas.

## Prioridad de colas

Puedes tener múltiples colas con diferentes prioridades:

```php
// Jobs de alta prioridad
ProcessPayment::dispatch($order)->onQueue('high');

// Jobs normales
SendNewsletter::dispatch($campaign)->onQueue('default');

// Jobs de baja prioridad (reportes, exportaciones)
GenerateMonthlyReport::dispatch()->onQueue('low');

// El worker procesa 'high' antes que 'default', y este antes que 'low'
// php artisan queue:work --queue=high,default,low
```

## Conclusión

Las colas en Laravel son el mecanismo para mover operaciones lentas fuera del ciclo de vida de una request. El patrón es simple: crear un job con `make:job`, implementar la lógica en `handle()`, despachar con `dispatch()`, y mantener un worker corriendo con Supervisor. Para producción con Redis, usa Laravel Horizon para tener visibilidad completa de lo que pasa en tus colas.
