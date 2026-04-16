---
modulo: 5
leccion: 3
title: 'Jobs y Queues — tareas en segundo plano'
description: 'Aprende a ejecutar tareas pesadas en segundo plano con Jobs y Queues en Laravel: envío de emails, procesamiento de imágenes y notificaciones asíncronas.'
duracion: '25 min'
quiz:
  - pregunta: '¿Cuál es el principal beneficio de usar Jobs y Queues en Laravel?'
    opciones:
      - 'Reducir el tamaño del código PHP'
      - 'Ejecutar tareas lentas en segundo plano sin bloquear la respuesta HTTP'
      - 'Mejorar la seguridad de la aplicación'
      - 'Simplificar las consultas a la base de datos'
    correcta: 1
    explicacion: 'Las Queues permiten diferir tareas que consumen tiempo (enviar emails, procesar imágenes, llamadas a APIs externas) para que el usuario reciba una respuesta inmediata mientras el servidor las procesa en segundo plano.'
  - pregunta: '¿Qué comando de Artisan inicia el worker que procesa los jobs de la cola?'
    opciones:
      - 'php artisan queue:start'
      - 'php artisan queue:listen'
      - 'php artisan queue:work'
      - 'php artisan worker:run'
    correcta: 2
    explicacion: 'php artisan queue:work inicia el worker que procesa los jobs. queue:listen también funciona pero recarga el framework en cada job, lo que lo hace más lento. En producción siempre se usa queue:work con Supervisor.'
  - pregunta: '¿Qué método se usa para despachar un Job a la cola en Laravel?'
    opciones:
      - 'Job::run()'
      - 'dispatch(new MiJob())'
      - 'Queue::push(new MiJob())'
      - 'MiJob::execute()'
    correcta: 1
    explicacion: 'La función dispatch() es la forma más común de enviar un Job a la cola. También puedes usar MiJob::dispatch() como método estático, o delay() encadenado para retrasar la ejecución.'
---

## ¿Qué son los Jobs y las Queues?

Cuando un usuario hace una petición a tu aplicación web, espera una respuesta rápida. Sin embargo, algunas tareas son inherentemente lentas: enviar un correo electrónico, redimensionar imágenes, generar un PDF, llamar a una API externa o procesar un archivo CSV grande.

Si realizas esas tareas dentro del ciclo de vida de la petición HTTP, el usuario tendrá que esperar hasta que terminen, lo que genera una mala experiencia. La solución es **diferir** esas tareas.

En Laravel, un **Job** es una clase que encapsula una tarea que puede ejecutarse de forma asíncrona. Una **Queue** (cola) es una lista de jobs pendientes de ejecutarse. Un **Worker** es el proceso en segundo plano que va tomando jobs de la cola y ejecutándolos uno a uno.

## Configurar el driver de cola

Las colas se configuran en `config/queue.php`. El driver por defecto es `sync`, que ejecuta los jobs de forma síncrona (sin cola real). Para usar colas reales, cambia el driver en `.env`:

```bash
# Usar la base de datos como cola (sencillo, bueno para empezar)
QUEUE_CONNECTION=database

# Usar Redis (más rápido, recomendado para producción)
QUEUE_CONNECTION=redis
```

Si usas el driver `database`, necesitas crear la tabla de jobs:

```bash
php artisan queue:table
php artisan migrate
```

Si usas Redis, necesitas el paquete predis:

```bash
composer require predis/predis
```

## Crear un Job

```bash
php artisan make:job EnviarEmailBienvenida
```

Esto crea el archivo `app/Jobs/EnviarEmailBienvenida.php`:

```php
// app/Jobs/EnviarEmailBienvenida.php

namespace App\Jobs;

use App\Mail\BienvenidaMail;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class EnviarEmailBienvenida implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;        // Número de reintentos si falla
    public int $timeout = 60;     // Tiempo máximo de ejecución en segundos

    public function __construct(
        public readonly User $user
    ) {}

    public function handle(): void
    {
        Mail::to($this->user->email)
            ->send(new BienvenidaMail($this->user));
    }

    public function failed(\Throwable $exception): void
    {
        // Se ejecuta si el job falla todos los intentos
        \Log::error("Email de bienvenida falló para usuario {$this->user->id}: {$exception->getMessage()}");
    }
}
```

La interfaz `ShouldQueue` le indica a Laravel que este job debe ir a la cola. Sin ella, se ejecutaría de forma síncrona.

El trait `SerializesModels` hace que los modelos Eloquent se serialicen correctamente al guardarse en la cola y se recuperen de la base de datos cuando el job se procese.

## Despachar un Job

Desde cualquier parte de tu código (controladores, eventos, comandos), despachas el job así:

```php
// app/Http/Controllers/RegistroController.php

use App\Jobs\EnviarEmailBienvenida;

public function store(Request $request)
{
    $user = User::create($request->validated());

    // El job se envía a la cola y la respuesta HTTP es inmediata
    dispatch(new EnviarEmailBienvenida($user));

    // También puedes usar la sintaxis estática
    EnviarEmailBienvenida::dispatch($user);

    return response()->json(['mensaje' => 'Registro exitoso.'], 201);
}
```

## Retrasar la ejecución

Puedes retrasar un job con el método `delay()`:

```php
// Ejecutar en 10 minutos
dispatch(new EnviarEmailBienvenida($user))->delay(now()->addMinutes(10));

// Ejecutar mañana a las 8:00
dispatch(new RecordatorioJob($user))->delay(now()->addDay()->startOfDay()->addHours(8));
```

## Colas con prioridad

Puedes asignar un job a una cola específica para controlar las prioridades:

```php
// Enviar a la cola "alta-prioridad"
dispatch(new NotificacionUrgente($user))->onQueue('alta-prioridad');

// Enviar a la cola "baja-prioridad"
dispatch(new GenerarReporte($datos))->onQueue('baja-prioridad');
```

Al iniciar el worker, especificas el orden de prioridad:

```bash
# Procesar primero alta-prioridad, luego baja-prioridad
php artisan queue:work --queue=alta-prioridad,baja-prioridad
```

## Iniciar el Worker

Para procesar los jobs, necesitas tener un worker corriendo:

```bash
php artisan queue:work
```

Opciones útiles:

```bash
# Procesar solo un job y salir
php artisan queue:work --once

# Procesar jobs durante máximo 60 segundos
php artisan queue:work --max-time=60

# Especificar el número de intentos
php artisan queue:work --tries=3

# Ver qué está procesando
php artisan queue:work --verbose
```

## Supervisor en producción

En producción, el worker debe mantenerse vivo siempre. Supervisor es un gestor de procesos de Linux que lo hace automáticamente. Instálalo y crea un archivo de configuración:

```bash
sudo apt-get install supervisor
sudo nano /etc/supervisor/conf.d/laravel-worker.conf
```

```ini
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/mi-app/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/mi-app/storage/logs/worker.log
stopwaitsecs=3600
```

Activa la configuración:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start laravel-worker:*
```

## Jobs fallidos

Cuando un job falla todos sus reintentos, se guarda en la tabla `failed_jobs`. Primero crea la tabla:

```bash
php artisan queue:failed-table
php artisan migrate
```

Puedes ver los jobs fallidos y reintentar ejecutarlos:

```bash
# Listar jobs fallidos
php artisan queue:failed

# Reintentar un job fallido específico
php artisan queue:retry 5

# Reintentar todos los jobs fallidos
php artisan queue:retry all

# Eliminar un job fallido
php artisan queue:forget 5

# Eliminar todos los jobs fallidos
php artisan queue:flush
```

## Job Batching

Laravel permite agrupar jobs en un lote y ejecutar acciones cuando todos terminen:

```php
use Illuminate\Bus\Batch;
use Illuminate\Support\Facades\Bus;

$lote = Bus::batch([
    new ProcesarImagen($imagen1),
    new ProcesarImagen($imagen2),
    new ProcesarImagen($imagen3),
])->then(function (Batch $batch) {
    // Todos los jobs del lote han terminado correctamente
    Notification::send($usuario, new ProcesadoCompletado());
})->catch(function (Batch $batch, \Throwable $e) {
    // Algún job ha fallado
    \Log::error('El lote de imágenes falló: ' . $e->getMessage());
})->finally(function (Batch $batch) {
    // Se ejecuta siempre al terminar el lote (con o sin errores)
})->dispatch();
```

Los Jobs y Queues son una pieza fundamental de cualquier aplicación Laravel profesional. Úsalos siempre que tengas una tarea que no necesite completarse de forma síncrona durante la petición HTTP. El resultado es una aplicación más rápida, más resiliente y con mejor experiencia de usuario.
