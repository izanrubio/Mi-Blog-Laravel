---
title: 'Laravel Horizon: gestión de colas Redis en producción'
description: 'Aprende a instalar y configurar Laravel Horizon para monitorizar y gestionar colas Redis en producción. Dashboard, supervisores, métricas y manejo de jobs fallidos.'
pubDate: '2026-04-16'
tags: ['laravel', 'queues', 'optimizacion', 'roadmap']
---

Las colas en Laravel son una herramienta fundamental para mover tareas lentas fuera del ciclo de la petición HTTP: enviar emails, procesar imágenes, generar reportes, llamar a APIs externas. Cuando usas Redis como driver de colas (la opción más potente), **Laravel Horizon** es el panel de control que necesitas para gestionar y monitorizar todo ese trabajo en background.

## ¿Qué es Horizon y por qué Redis?

Laravel tiene soporte para varios drivers de colas: database, Redis, Beanstalkd, Amazon SQS. Redis es el más usado en producción porque es extremadamente rápido (opera en memoria), soporta colas con prioridades, es fiable y tiene excelente soporte en cualquier servidor.

**Laravel Horizon** es el panel de administración oficial para colas Redis. Proporciona:

- Dashboard en tiempo real con métricas de jobs
- Visualización de jobs en cola, procesando y fallidos
- Configuración declarativa de workers (supervisores)
- Balanceo automático de procesos según la carga
- Alertas cuando las colas superan un umbral
- Reintentos de jobs fallidos

Sin Horizon, gestionar workers de colas en producción es tedioso. Con Horizon, tienes visibilidad total.

## Requisitos previos

Antes de instalar Horizon necesitas:

- Laravel 10 o superior
- Redis instalado y funcionando
- La extensión `phpredis` o el paquete `predis/predis`
- Variables de entorno configuradas para Redis

```bash
# Verificar que Redis está corriendo
redis-cli ping
# PONG

# Instalar predis si no tienes la extensión phpredis
composer require predis/predis
```

En tu `.env`:

```ini
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

## Instalar Horizon

```bash
composer require laravel/horizon
php artisan horizon:install
```

El comando `horizon:install` publica:
- El archivo de configuración `config/horizon.php`
- Los assets del dashboard en `public/vendor/horizon`
- El `HorizonServiceProvider` en `app/Providers`

Después, ejecuta las migraciones (Horizon necesita una tabla para jobs fallidos):

```bash
php artisan migrate
```

## Configuración: config/horizon.php

Este es el archivo más importante. Vamos a ver las partes clave:

```php
// config/horizon.php
return [
    'domain'  => env('HORIZON_DOMAIN'),
    'path'    => env('HORIZON_PATH', 'horizon'),
    'use'     => 'default',
    'prefix'  => env('HORIZON_PREFIX', 'horizon:'),

    // Tiempo máximo de espera para que un job complete al hacer pausa
    'waits' => [
        'redis:default' => 60,
    ],

    // Número de segundos antes de que Horizon notifique sobre workers lentos
    'trim' => [
        'recent'        => 60,
        'pending'       => 60,
        'completed'     => 60,
        'recent_failed' => 10080,
        'failed'        => 10080,
        'monitored'     => 10080,
    ],

    'silenced' => [
        // Jobs que no quieres que aparezcan en el dashboard
    ],

    'metrics' => [
        'trim_snapshots' => [
            'job'   => 24,
            'queue' => 24,
        ],
    ],

    'fast_termination' => false,

    'memory_limit' => 64,

    'environments' => [
        'production' => [
            'supervisor-1' => [
                'connection'   => 'redis',
                'queue'        => ['default'],
                'balance'      => 'auto',
                'autoScalingStrategy' => 'time',
                'minProcesses' => 1,
                'maxProcesses' => 10,
                'balanceMaxShift'    => 1,
                'balanceCooldown'    => 3,
                'tries'        => 3,
                'timeout'      => 60,
                'nice'         => 0,
            ],
        ],

        'local' => [
            'supervisor-1' => [
                'connection'   => 'redis',
                'queue'        => ['default'],
                'balance'      => 'simple',
                'minProcesses' => 1,
                'maxProcesses' => 3,
                'tries'        => 1,
                'timeout'      => 60,
            ],
        ],
    ],
];
```

## Supervisores: el corazón de Horizon

Los supervisores son grupos de workers que Horizon gestiona. Cada supervisor tiene su configuración:

- **connection**: el driver de cola (`redis`)
- **queue**: lista de colas que procesa este supervisor (en orden de prioridad)
- **balance**: estrategia de balanceo (`simple`, `auto`, `false`)
- **minProcesses/maxProcesses**: número mínimo y máximo de workers
- **tries**: número de reintentos antes de marcar el job como fallido
- **timeout**: segundos antes de matar un job que lleva demasiado tiempo

### Múltiples supervisores para diferentes prioridades

```php
'environments' => [
    'production' => [
        // Workers para emails urgentes (alta prioridad)
        'supervisor-emails' => [
            'connection'   => 'redis',
            'queue'        => ['emails-urgentes', 'emails'],
            'balance'      => 'auto',
            'minProcesses' => 2,
            'maxProcesses' => 8,
            'tries'        => 3,
            'timeout'      => 30,
        ],

        // Workers para procesamiento de imágenes (requiere más memoria)
        'supervisor-media' => [
            'connection'   => 'redis',
            'queue'        => ['media'],
            'balance'      => 'simple',
            'minProcesses' => 1,
            'maxProcesses' => 4,
            'tries'        => 2,
            'timeout'      => 300,
        ],

        // Workers para tareas de bajo peso general
        'supervisor-default' => [
            'connection'   => 'redis',
            'queue'        => ['default', 'low'],
            'balance'      => 'auto',
            'minProcesses' => 1,
            'maxProcesses' => 5,
            'tries'        => 3,
            'timeout'      => 60,
        ],
    ],
],
```

Para que un job use una cola específica:

```php
// app/Jobs/ProcesarImagen.php
class ProcesarImagen implements ShouldQueue
{
    public $queue = 'media';
    public $timeout = 300;
    public $tries = 2;

    // ...
}

// O al despachar
ProcesarImagen::dispatch($imagen)->onQueue('media');
```

## Ejecutar Horizon

```bash
php artisan horizon
```

Horizon muestra los logs en tiempo real en la terminal. Para detenerlo de forma ordenada (espera a que los jobs activos terminen):

```bash
php artisan horizon:terminate
```

## El Dashboard

Accede al dashboard en `http://tu-dominio.com/horizon`. Por defecto solo es accesible en entorno local. Para producción, configura la autorización en el `HorizonServiceProvider`:

```php
// app/Providers/HorizonServiceProvider.php
use Laravel\Horizon\Horizon;

protected function gate(): void
{
    Gate::define('viewHorizon', function (User $user) {
        return in_array($user->email, [
            'admin@tudominio.com',
            'devops@tudominio.com',
        ]);
    });
}
```

El dashboard muestra:
- **Jobs por segundo** en tiempo real
- **Jobs completados** en los últimos minutos/horas
- **Jobs fallidos** con trazas de error completas
- **Tiempo promedio de ejecución** por job
- **Estado de los supervisores** y número de procesos activos

## Monitorizar colas específicas

Puedes configurar Horizon para que envíe notificaciones cuando una cola supera cierto número de jobs pendientes:

```php
// app/Providers/HorizonServiceProvider.php
use Laravel\Horizon\Horizon;

public function boot(): void
{
    parent::boot();

    // Notificar si cualquier cola supera 300 jobs pendientes
    Horizon::routeMailNotificationsTo('admin@tudominio.com');
    Horizon::routeSlackNotificationsTo(env('SLACK_WEBHOOK_URL'), '#horizon-alerts');

    // Umbrales por cola
    Horizon::night();
}
```

## Etiquetas para monitorizar jobs

Horizon permite etiquetar jobs para filtrarlos y monitorizar objetos específicos:

```php
// En tu job
class NotificarUsuario implements ShouldQueue
{
    public function __construct(protected User $user)
    {
    }

    public function tags(): array
    {
        return [
            'notificacion',
            'usuario:' . $this->user->id,
        ];
    }

    // ...
}
```

Después puedes buscar en el dashboard todos los jobs relacionados con `usuario:42`, por ejemplo.

## Pausar y reanudar Horizon

En situaciones de emergencia (deploy, mantenimiento) puedes pausar Horizon sin perder jobs:

```bash
# Pausar (los jobs quedan en cola, los workers terminan el actual y esperan)
php artisan horizon:pause

# Pausar un supervisor específico
php artisan horizon:pause-supervisor supervisor-media

# Reanudar
php artisan horizon:continue

# Reanudar un supervisor específico
php artisan horizon:continue-supervisor supervisor-media

# Ver el estado actual
php artisan horizon:status
```

## Jobs fallidos: reintento y limpieza

Cuando un job falla todas sus reintentos, se guarda en la tabla `failed_jobs`. Horizon proporciona una interfaz visual para gestionarlos.

Por línea de comandos:

```bash
# Ver todos los jobs fallidos
php artisan queue:failed

# Reintentar un job específico por UUID
php artisan queue:retry abc-123-def-456

# Reintentar todos los fallidos
php artisan queue:retry all

# Eliminar un job fallido
php artisan horizon:forget abc-123-def-456

# Limpiar todos los jobs fallidos
php artisan horizon:clear
```

También puedes manejar el fallo en el propio job:

```php
class EnviarEmail implements ShouldQueue
{
    public $tries = 3;
    public $backoff = [10, 30, 60]; // Espera entre reintentos en segundos

    public function failed(\Throwable $exception): void
    {
        // Notificar al admin cuando el job falla definitivamente
        \Log::error('Job EnviarEmail falló definitivamente', [
            'exception' => $exception->getMessage(),
            'user_id'   => $this->user->id,
        ]);
    }
}
```

## Desplegar Horizon en producción con Supervisor

En producción, Horizon debe ejecutarse como un servicio que se reinicie automáticamente si falla. La herramienta estándar para esto es **Supervisor** (el gestor de procesos de Linux, no confundir con los supervisores de Horizon).

Crea el archivo de configuración:

```ini
; /etc/supervisor/conf.d/horizon.conf
[program:horizon]
process_name=%(program_name)s
command=php /var/www/html/artisan horizon
autostart=true
autorestart=true
user=www-data
redirect_stderr=true
stdout_logfile=/var/log/horizon.log
stopwaitsecs=3600
```

Activa y arranca el proceso:

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start horizon
```

### Reiniciar Horizon en el deploy

Cuando despliega código nuevo, debes reiniciar Horizon para que los workers carguen los nuevos cambios. Añade esto a tu script de deploy:

```bash
php artisan horizon:terminate
```

Supervisor detectará que Horizon se ha detenido y lo reiniciará automáticamente con el nuevo código.

Si usas **Laravel Forge**, el servidor ya incluye Supervisor configurado y puedes gestionar el daemon de Horizon directamente desde el panel.

## Conclusión

Laravel Horizon transforma la gestión de colas de una tarea compleja en algo completamente manejable. El dashboard en tiempo real, la configuración declarativa de workers y las herramientas para gestionar jobs fallidos hacen que mantener colas en producción sea mucho menos estresante. Si tu aplicación usa colas Redis (y debería si procesa tareas pesadas), Horizon no es opcional: es imprescindible.
