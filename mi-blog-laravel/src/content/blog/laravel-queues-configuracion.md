---
title: 'Configurar colas (queues) en Laravel desde cero'
description: 'Aprende a configurar las colas de trabajo en Laravel con database, Redis y otros drivers. Incluye workers, failed jobs y supervisord en producción.'
pubDate: '2024-01-26'
tags: ['laravel', 'queues', 'colas', 'configuracion']
---

# Configurar colas (queues) en Laravel desde cero

Las colas de trabajo son uno de los conceptos más importantes de Laravel para construir aplicaciones de alto rendimiento. La idea es simple: en lugar de hacer que el usuario espere mientras tu aplicación envía un correo, genera un PDF o llama a una API externa, pones esa tarea en una cola y la procesas en segundo plano. El usuario recibe una respuesta inmediata y el trabajo pesado se realiza de forma asíncrona.

En esta guía aprenderemos a configurar colas en Laravel desde cero: drivers disponibles, creación de jobs, workers y configuración para producción con supervisord.

## ¿Cuándo necesitas colas?

Antes de configurar nada, es útil entender cuándo tiene sentido usar colas:

- **Envío de correos electrónicos**: especialmente si envías cientos de correos (newsletters, notificaciones).
- **Procesamiento de imágenes**: redimensionar, comprimir o convertir formatos de imágenes.
- **Generación de PDFs**: operaciones intensivas de CPU.
- **Llamadas a APIs externas**: si la API es lenta o puede fallar.
- **Importación de datos**: procesar archivos CSV o Excel grandes.
- **Notificaciones push**: enviar notificaciones a múltiples dispositivos.

La regla general: si una operación tarda más de un par de segundos o puede fallar, probablemente debería estar en una cola.

## Drivers de cola disponibles

Laravel soporta varios drivers. La variable `QUEUE_CONNECTION` en `.env` determina cuál usar:

```php
// En .env
QUEUE_CONNECTION=sync
```

Los drivers disponibles son:

- **sync**: ejecuta los jobs inmediatamente, sin cola real. Solo para desarrollo.
- **database**: almacena los jobs en una tabla de la base de datos.
- **redis**: almacena los jobs en Redis. El más recomendado en producción.
- **beanstalkd**: alternativa a Redis para colas.
- **sqs**: Amazon SQS, para infraestructura en AWS.
- **null**: descarta todos los jobs (útil en ciertos entornos de testing).

## Configurar colas con el driver database

El driver `database` es el más fácil de configurar porque no requiere instalar nada adicional.

### Crear las tablas necesarias

```php
php artisan queue:table
php artisan migrate
```

Esto crea la tabla `jobs` en tu base de datos. También es buena idea crear la tabla de jobs fallidos:

```php
php artisan make:queue-failed-table
php artisan migrate
```

### Configurar el .env

```php
QUEUE_CONNECTION=database
```

Eso es todo. Ahora los jobs se almacenarán en la tabla `jobs` de tu base de datos.

### Cuándo usar el driver database

Es ideal para:
- Proyectos pequeños o medianos
- Cuando no quieres instalar Redis
- Cuando el volumen de jobs es manejable (cientos, no miles, por hora)

Para aplicaciones con alto volumen de jobs, Redis es mejor porque es mucho más rápido al ser en memoria.

## Configurar colas con Redis

Redis es el driver recomendado para producción por su velocidad y fiabilidad.

### Instalar Redis

En Ubuntu:

```php
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis

// Verificar que está funcionando:
redis-cli ping
// PONG
```

En macOS con Homebrew:

```php
brew install redis
brew services start redis
```

### Instalar el cliente PHP para Redis

```php
composer require predis/predis
// O instalar la extensión phpredis de PHP (más rápida):
// sudo apt install php8.2-redis
```

### Configurar el .env para Redis

```php
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

## Crear un Job

Un job es una clase PHP que representa una tarea que se ejecutará de forma asíncrona. Créalo con Artisan:

```php
php artisan make:job EnviarEmailBienvenida
```

Esto crea `app/Jobs/EnviarEmailBienvenida.php`:

```php
<?php

namespace App\Jobs;

use App\Mail\EmailBienvenida;
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

    // El tiempo máximo de ejecución en segundos
    public int $timeout = 60;

    // Número de reintentos si el job falla
    public int $tries = 3;

    public function __construct(
        protected User $usuario
    ) {}

    public function handle(): void
    {
        Mail::to($this->usuario->email)
            ->send(new EmailBienvenida($this->usuario));
    }

    // Qué hacer si el job falla después de todos los reintentos
    public function failed(\Throwable $exception): void
    {
        // Notificar al administrador, registrar en un sistema de monitoreo, etc.
        \Log::error("Fallo al enviar email de bienvenida a {$this->usuario->email}: " . $exception->getMessage());
    }
}
```

### La interfaz ShouldQueue

Lo que convierte una clase en un job de cola es que implemente la interfaz `ShouldQueue`. Si la eliminas, el job se ejecutará de forma síncrona ignorando el driver de cola.

## Despachar un Job

Para poner un job en la cola, usa el método `dispatch`:

```php
// En un controlador:
use App\Jobs\EnviarEmailBienvenida;

class RegistroController extends Controller
{
    public function store(Request $request): RedirectResponse
    {
        $usuario = User::create($request->validated());

        // Despachar el job a la cola (se ejecuta en segundo plano)
        EnviarEmailBienvenida::dispatch($usuario);

        return redirect()->route('dashboard')
            ->with('success', 'Registro completado. Recibirás un email de bienvenida pronto.');
    }
}
```

### Opciones al despachar

```php
// Retrasar la ejecución del job (útil para recordatorios)
EnviarEmailBienvenida::dispatch($usuario)->delay(now()->addMinutes(10));

// Especificar en qué cola ir (puedes tener múltiples colas con distintas prioridades)
EnviarEmailBienvenida::dispatch($usuario)->onQueue('emails');

// Despachar solo si una condición se cumple
EnviarEmailBienvenida::dispatchIf($usuario->email_verificado, $usuario);

// Despachar una sola vez aunque se llame múltiples veces (de-duplicación)
EnviarEmailBienvenida::dispatch($usuario)->onQueue('emails');
```

### Jobs encadenados

Puedes encadenar jobs para que se ejecuten en secuencia:

```php
use Illuminate\Support\Facades\Bus;

Bus::chain([
    new ProcesarPago($pedido),
    new EnviarConfirmacion($pedido),
    new ActualizarInventario($pedido),
])->dispatch();
```

Si cualquier job en la cadena falla, los siguientes no se ejecutan.

## Ejecutar el worker de cola

Los jobs no se procesan solos. Necesitas un **worker** que esté leyendo la cola y ejecutando los jobs:

```php
php artisan queue:work
```

Este comando queda corriendo y procesando jobs continuamente. Para especificar el driver y la cola:

```php
php artisan queue:work redis --queue=emails,default
```

### Opciones importantes del worker

```php
// Procesar solo un job y salir
php artisan queue:work --once

// Establecer el tiempo máximo de ejecución por job
php artisan queue:work --timeout=60

// Número de segundos a esperar entre jobs cuando la cola está vacía
php artisan queue:work --sleep=3

// Detener el worker si un job usa más de X MB de memoria
php artisan queue:work --memory=128
```

### queue:work vs queue:listen

Existe también `php artisan queue:listen`, pero es más lento porque carga el framework de nuevo para cada job. `queue:work` carga el framework una vez y procesa múltiples jobs, por lo que es mucho más eficiente.

**Importante**: si cambias código en tu aplicación, necesitas reiniciar el worker para que coja los cambios:

```php
php artisan queue:restart
```

## Gestionar jobs fallidos

Si un job lanza una excepción, Laravel lo reintenta el número de veces configurado en `$tries`. Si agota todos los intentos, el job se mueve a la tabla `failed_jobs`.

### Ver los jobs fallidos

```php
php artisan queue:failed
```

### Reintentar un job fallido

```php
// Reintentar todos los jobs fallidos
php artisan queue:retry all

// Reintentar un job específico por su ID
php artisan queue:retry 5
```

### Limpiar los jobs fallidos

```php
php artisan queue:flush
```

### Inspeccionar un job fallido desde Tinker

```php
php artisan tinker

$job = DB::table('failed_jobs')->latest()->first();
echo $job->payload; // El payload JSON del job
echo $job->exception; // El stack trace de la excepción
```

## Configurar supervisord en producción

En producción, el worker debe estar siempre corriendo. Si el servidor se reinicia o el proceso muere, supervisord lo reinicia automáticamente.

Instala supervisord:

```php
sudo apt install supervisor
```

Crea un archivo de configuración:

```php
sudo nano /etc/supervisor/conf.d/laravel-worker.conf
```

Con este contenido:

```php
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/mi-proyecto/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/mi-proyecto/storage/logs/worker.log
stopwaitsecs=3600
```

Algunos parámetros importantes:

- `numprocs=2`: ejecuta 2 workers en paralelo. Aumenta este número si el volumen de jobs es alto.
- `user=www-data`: el usuario que ejecuta el proceso (debe ser el mismo usuario del servidor web).
- `--max-time=3600`: detiene el worker después de 1 hora para evitar memory leaks. Supervisord lo reinicia automáticamente.

Activa la configuración:

```php
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start laravel-worker:*

// Verificar que está corriendo:
sudo supervisorctl status
```

## Colas en desarrollo con QUEUE_CONNECTION=sync

Durante el desarrollo, puedes usar `QUEUE_CONNECTION=sync` para que los jobs se ejecuten inmediatamente sin necesidad de un worker. Esto simplifica el debugging porque los errores aparecen directamente en la respuesta HTTP.

```php
// .env en desarrollo
QUEUE_CONNECTION=sync
```

Con esta configuración, `EnviarEmailBienvenida::dispatch($usuario)` ejecuta el job de forma síncrona, como si fuera una llamada de función normal.

## Monitoreo con Laravel Horizon

Si usas Redis, [Laravel Horizon](https://laravel.com/docs/horizon) es una herramienta oficial que proporciona una interfaz web para monitorear tus colas en tiempo real:

```php
composer require laravel/horizon
php artisan horizon:install
php artisan horizon
```

Accede a `http://tu-app.com/horizon` para ver el estado de tus colas, el throughput, los jobs fallidos y mucho más.

## Conclusión

Las colas en Laravel son una herramienta poderosa que puede transformar la experiencia de usuario de tu aplicación. La clave está en identificar qué operaciones pueden diferirse al background y encapsularlas en jobs bien diseñados.

Para empezar, el driver `database` con `QUEUE_CONNECTION=database` es más que suficiente. Cuando la aplicación crezca y el volumen de jobs aumente, migra a Redis. Y siempre, siempre, configura supervisord en producción para garantizar que los workers estén corriendo.
