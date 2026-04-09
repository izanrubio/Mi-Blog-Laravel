---
title: 'Cómo leer y entender el log de Laravel (laravel.log)'
description: 'Aprende a leer el archivo laravel.log: niveles de log, estructura de stack trace, cómo interpretar errores y configurar los logs en Laravel correctamente.'
pubDate: '2026-04-09'
tags: ['laravel', 'debug', 'logs', 'herramientas']
---

El archivo `storage/logs/laravel.log` es la fuente de verdad cuando algo falla en tu aplicación. Saber leerlo correctamente te ahorra horas de debugging. Muchos desarrolladores juniors lo abren, ven cientos de líneas de texto críptico y lo cierran sin entender nada. Vamos a cambiar eso.

## Dónde está el log

```
storage/
└── logs/
    ├── laravel.log          # Canal 'single': un solo archivo
    ├── laravel-2024-03-11.log  # Canal 'daily': un archivo por día
    └── laravel-2024-03-10.log
```

La configuración del canal de logs está en `config/logging.php` y se controla con la variable `LOG_CHANNEL` en `.env`:

```bash
# .env
LOG_CHANNEL=daily   # Un archivo por día (recomendado en producción)
LOG_CHANNEL=single  # Un solo archivo (crece indefinidamente)
LOG_CHANNEL=stderr  # Salida estándar (para Docker/Kubernetes)
```

## Estructura de una entrada de log

Una entrada típica en el log se ve así:

```
[2024-03-11 14:23:45] local.ERROR: Attempt to read property "title" on null
{"exception":"[object] (Error(code: 0): Attempt to read property \"title\" on null at /var/www/html/mi-app/app/Http/Controllers/PostController.php:45)
[stacktrace]
#0 /var/www/html/mi-app/vendor/laravel/framework/src/Illuminate/Routing/Controller.php(54): App\\Http\\Controllers\\PostController->show(null)
#1 /var/www/html/mi-app/vendor/laravel/framework/src/Illuminate/Routing/ControllerDispatcher.php(43): Illuminate\\Routing\\Controller->callAction('show', Array)
#2 ...
"}
```

Vamos parte por parte:

### La primera línea

```
[2024-03-11 14:23:45] local.ERROR: Attempt to read property "title" on null
```

- `[2024-03-11 14:23:45]`: **timestamp** de cuándo ocurrió el error
- `local`: el **entorno** (local, production, staging)
- `ERROR`: el **nivel de log**
- `Attempt to read property "title" on null`: el **mensaje del error**

### El stack trace

Las líneas `#0`, `#1`, `#2`... son el **stack trace**: la pila de llamadas que llevaron al error. Se lee **de abajo hacia arriba** para entender cómo llegaste al error, pero el error real está en las primeras líneas (las de tu código, no las del framework).

```
#0 app/Http/Controllers/PostController.php:45   ← TU código (línea 45)
#1 vendor/laravel/.../Controller.php:54         ← Framework llamó tu método
#2 vendor/laravel/.../ControllerDispatcher.php  ← Framework (ignorar)
```

Siempre busca la primera línea que apunta a `app/` (tu código), no a `vendor/` (el framework). Esa es donde está el problema.

## Los niveles de log (de mayor a menor severidad)

Laravel sigue el estándar PSR-3 con estos niveles:

```php
\Log::emergency('El servidor está caído');    // Nivel 0 - Más grave
\Log::alert('Base de datos no responde');     // Nivel 1
\Log::critical('Componente crítico fallido'); // Nivel 2
\Log::error('Error en el procesamiento');     // Nivel 3
\Log::warning('Valor inesperado recibido');   // Nivel 4
\Log::notice('Evento inusual pero normal');   // Nivel 5
\Log::info('Usuario inició sesión');          // Nivel 6
\Log::debug('Variable X tiene valor Y');      // Nivel 7 - Menos grave
```

En producción, normalmente quieres capturar desde `error` hacia arriba. En desarrollo, desde `debug`.

Configura el nivel mínimo en `.env`:

```bash
LOG_LEVEL=debug    # En desarrollo: captura todo
LOG_LEVEL=error    # En producción: solo errores graves
```

## Agregar tus propios logs

```php
use Illuminate\Support\Facades\Log;

// Log simple
Log::info('Usuario creado', ['user_id' => $user->id]);

// Log con contexto adicional
Log::error('Fallo al procesar pago', [
    'order_id'  => $order->id,
    'user_id'   => $order->user_id,
    'amount'    => $order->total,
    'exception' => $e->getMessage(),
]);

// Log con datos de debug
Log::debug('Query ejecutada', [
    'sql'      => $query->toSql(),
    'bindings' => $query->getBindings(),
]);
```

El contexto (segundo argumento) se guarda como JSON en el log, facilitando el parseo automatizado.

## Ver el log en tiempo real

```bash
# Ver las últimas 100 líneas y seguir en tiempo real
tail -f storage/logs/laravel.log

# Ver solo las líneas de error
tail -f storage/logs/laravel.log | grep "ERROR"

# Ver el log de hoy (canal daily)
tail -f storage/logs/laravel-$(date +%Y-%m-%d).log

# Ver los últimos errores sin seguimiento en tiempo real
tail -n 200 storage/logs/laravel.log | grep -A 20 "ERROR"
```

El comando `tail -f` es tu mejor amigo en desarrollo: ve el log mientras haces peticiones y ves los errores en tiempo real.

## Configurar canales de log en config/logging.php

```php
// config/logging.php

return [
    'default' => env('LOG_CHANNEL', 'stack'),
    
    'channels' => [
        // Canal stack: combina múltiples canales
        'stack' => [
            'driver'            => 'stack',
            'channels'          => ['daily', 'slack'],
            'ignore_exceptions' => false,
        ],
        
        // Canal daily: un archivo por día
        'daily' => [
            'driver' => 'daily',
            'path'   => storage_path('logs/laravel.log'),
            'level'  => env('LOG_LEVEL', 'debug'),
            'days'   => 14,  // Mantener 14 días de logs
        ],
        
        // Canal para errores en Slack
        'slack' => [
            'driver'   => 'slack',
            'url'      => env('LOG_SLACK_WEBHOOK_URL'),
            'username' => 'Laravel Log',
            'emoji'    => ':boom:',
            'level'    => env('LOG_LEVEL', 'critical'),
        ],
        
        // Canal personalizado para tu aplicación
        'payments' => [
            'driver' => 'daily',
            'path'   => storage_path('logs/payments.log'),
            'level'  => 'debug',
            'days'   => 30,
        ],
    ],
];
```

### Usar un canal específico

```php
// Escribir en el canal 'payments' en lugar del default
Log::channel('payments')->info('Pago procesado', ['amount' => 99.99]);

// Escribir en múltiples canales
Log::stack(['daily', 'slack'])->critical('Error crítico en producción');
```

## Interpretar errores comunes en el log

### Error de base de datos

```
SQLSTATE[42S02]: Base table or view not found: 1146 Table 'mydb.posts' doesn't exist
```
→ La tabla no existe. ¿Ejecutaste las migraciones? `php artisan migrate`

### Error de binding

```
Illuminate\Contracts\Container\BindingResolutionException: Target class [App\Services\MyService] does not exist.
```
→ El Service Container intenta resolver una clase que no existe. Verifica el namespace.

### Error de Blade

```
ErrorException: Undefined variable $user (View: /resources/views/profile.blade.php)
```
→ Estás usando `$user` en la vista pero no lo estás pasando desde el controlador.

## Herramientas alternativas

Para proyectos más grandes, considera estas alternativas al archivo de log:

- **Laravel Telescope:** Dashboard web para debuggear requests, queries, jobs y más
- **Sentry:** Plataforma de monitorización de errores con alertas y agrupación
- **Papertrail / Logtail:** Servicios de agregación de logs con búsqueda

```bash
# Instalar Telescope en desarrollo
composer require laravel/telescope --dev
php artisan telescope:install
php artisan migrate
```

Accede a `tu-app.test/telescope` para ver un dashboard completo.

## Conclusión

El `laravel.log` es tu primera línea de defensa ante errores. Aprende a buscar la primera línea de `app/` en el stack trace (no `vendor/`), entiende los niveles de log para filtrar el ruido, y usa `Log::` con contexto rico para que tus propios mensajes sean informativos. Con `tail -f` y estos conocimientos, la mayoría de errores se resuelven en minutos.
