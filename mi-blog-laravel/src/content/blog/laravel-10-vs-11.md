---
title: 'Laravel 10 vs Laravel 11 — Qué cambió y qué debes saber'
description: 'Compara Laravel 10 y Laravel 11: nuevas funcionalidades, cambios de estructura, deprecated features y cómo migrar tu proyecto a Laravel 11 correctamente.'
pubDate: '2024-04-02'
tags: ['laravel', 'laravel-11', 'actualizacion', 'comparativa']
---

Laravel 11 se lanzó en marzo de 2024 y trajo cambios estructurales significativos. Si vienes de Laravel 10, algunas cosas se verán muy diferentes. Si estás empezando, entender estos cambios te ayudará a no confundirte con tutoriales desactualizados. Vamos a los cambios más importantes.

## El cambio más grande: estructura de la aplicación simplificada

Laravel 11 simplificó radicalmente la estructura del directorio `app/`. Desaparecieron varios archivos que antes eran estándar.

### Lo que desapareció en Laravel 11

```
# Laravel 10 tenía estos archivos:
app/Http/Kernel.php           ← ELIMINADO
app/Http/Middleware/           ← Middlewares built-in eliminados
    Authenticate.php
    EncryptCookies.php
    PreventRequestsDuringMaintenance.php
    RedirectIfAuthenticated.php
    TrimStrings.php
    TrustHosts.php
    TrustProxies.php
    ValidatePostSize.php
    VerifyCsrfToken.php
app/Console/Kernel.php        ← ELIMINADO
app/Exceptions/Handler.php    ← ELIMINADO (parcialmente)
app/Providers/
    AuthServiceProvider.php   ← ELIMINADO
    BroadcastServiceProvider.php ← ELIMINADO
    EventServiceProvider.php  ← ELIMINADO
    RouteServiceProvider.php  ← ELIMINADO
```

### Todo se centraliza en bootstrap/app.php

En Laravel 11, la configuración que antes estaba esparcida en varios archivos ahora está en un solo lugar:

```php
// bootstrap/app.php en Laravel 11
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Configurar middlewares (antes en Kernel.php)
        $middleware->web(append: [
            \App\Http\Middleware\MyWebMiddleware::class,
        ]);
        
        $middleware->alias([
            'admin' => \App\Http\Middleware\EnsureUserIsAdmin::class,
        ]);
        
        $middleware->trustProxies(at: '*');
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Configurar excepciones (antes en Handler.php)
        $exceptions->render(function (ModelNotFoundException $e, Request $request) {
            if ($request->expectsJson()) {
                return response()->json(['error' => 'Not found'], 404);
            }
        });
    })
    ->create();
```

### Los providers en bootstrap/providers.php

Los Service Providers ahora se registran en un archivo separado:

```php
// bootstrap/providers.php
return [
    App\Providers\AppServiceProvider::class,
];
```

Solo el `AppServiceProvider` viene por defecto. Los providers para auth, broadcasting y events fueron absorbidos por el framework internamente.

## SQLite como base de datos por defecto

Laravel 11 usa SQLite como base de datos por defecto en desarrollo:

```bash
# .env por defecto en Laravel 11
DB_CONNECTION=sqlite
# DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD ya no son necesarios para SQLite
```

Esto simplifica el setup inicial. Para cambiar a MySQL:

```bash
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_base_datos
DB_USERNAME=root
DB_PASSWORD=
```

## PHP 8.2 como versión mínima

Laravel 11 requiere PHP 8.2 como mínimo. Esto permite usar características modernas:

```php
// Enums (PHP 8.1+)
enum Status: string
{
    case Active   = 'active';
    case Inactive = 'inactive';
    case Pending  = 'pending';
}

// Readonly classes (PHP 8.2+)
readonly class CreateUserDTO
{
    public function __construct(
        public string $name,
        public string $email,
        public string $password,
    ) {}
}

// Intersection types (PHP 8.1+)
function process(Iterator&Countable $collection): void
{
    // ...
}
```

## Nuevos comandos Artisan

Laravel 11 añadió varios comandos nuevos:

```bash
# Nuevo: crear una clase específica
php artisan make:class App/Services/PaymentService

# Nuevo: crear un enum
php artisan make:enum OrderStatus

# Nuevo: crear una interfaz
php artisan make:interface PaymentGateway

# Nuevo: crear un trait
php artisan make:trait HasUuid

# Ver todas las rutas de la API
php artisan route:list --path=api

# Health check route (configurada en withRouting)
# GET /up → devuelve 200 si la app funciona
```

## La ruta /up para health checks

```php
// bootstrap/app.php
->withRouting(
    health: '/up',  // Laravel registra esta ruta automáticamente
)
```

Esta ruta devuelve un 200 cuando la aplicación está funcionando, útil para balanceadores de carga, Kubernetes, y servicios de monitorización.

## Comandos de consola simplificados

Los comandos ahora pueden definirse directamente en `routes/console.php`:

```php
// routes/console.php
use Illuminate\Support\Facades\Schedule;

// Comandos inline (sin crear una clase)
Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Scheduling directamente aquí
Schedule::command('emails:send')->daily();
Schedule::job(new ProcessOrders())->hourly();
```

En Laravel 10, el scheduler vivía en `app/Console/Kernel.php`. Ahora está en `routes/console.php`.

## Lazy loading por defecto en desarrollo

Laravel 11 tiene lazy loading de relaciones Eloquent desactivado en testing y habilitado en producción (el comportamiento por defecto). Para activar la detección de lazy loading en desarrollo:

```php
// app/Providers/AppServiceProvider.php
public function boot(): void
{
    Model::preventLazyLoading(!app()->isProduction());
    Model::preventSilentlyDiscardingAttributes(!app()->isProduction());
    Model::preventAccessingMissingAttributes(!app()->isProduction());
}
```

## Cómo migrar de Laravel 10 a 11

La guía oficial recomienda este proceso:

```bash
# 1. Actualizar composer.json
# "laravel/framework": "^11.0"
# "php": "^8.2"

composer update

# 2. Los archivos eliminados siguen funcionando si los tienes
# (Laravel tiene compatibilidad hacia atrás)
# Pero puedes limpiarlos gradualmente

# 3. Si tienes Kernel.php, sigue funcionando
# Laravel 11 detecta si existe y lo usa

# 4. Para actualizar la estructura (opcional)
php artisan install:api   # Si necesitas api routes
php artisan install:broadcasting  # Para broadcasting
```

No es necesario migrar todo de golpe. Laravel 11 es compatible con la estructura de Laravel 10.

## ¿Debo actualizar?

Si tienes un proyecto en producción con Laravel 10: no es urgente. Laravel 10 tiene soporte hasta agosto de 2025. Planifica la migración para cuando tengas tiempo de testearla bien.

Si estás empezando un proyecto nuevo: usa Laravel 11 directamente. La estructura simplificada es más limpia.

```bash
# Crear nuevo proyecto con Laravel 11
composer create-project laravel/laravel mi-proyecto
# O
laravel new mi-proyecto
```

## Conclusión

Laravel 11 simplificó la estructura de los proyectos eliminando archivos que el framework puede manejar internamente. El cambio más importante es `bootstrap/app.php` como punto central de configuración en lugar de múltiples Kernels y Providers. Si vienes de Laravel 10, el código existente sigue funcionando. La migración es opcional a corto plazo pero recomendable para proyectos nuevos.
