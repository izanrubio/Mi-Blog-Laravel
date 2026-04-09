---
title: 'Cómo funcionan los Middlewares en Laravel — Guía completa'
description: 'Aprende cómo crear y usar Middlewares en Laravel: tipos de middleware, cómo registrarlos en Laravel 11, middleware de grupos y parámetros de middleware.'
pubDate: '2026-04-09'
tags: ['laravel', 'middleware', 'conceptos', 'http']
---

El middleware es uno de los conceptos más potentes de Laravel. Básicamente es código que se ejecuta antes o después de que una request llegue a tu controlador. Si alguna vez has necesitado verificar si el usuario está autenticado, registrar todas las peticiones o modificar headers de respuesta, el middleware es la herramienta correcta.

## ¿Qué es un middleware?

Imagina el middleware como una serie de capas concéntricas alrededor de tu controlador. La request entra desde fuera, pasa por cada capa (middleware), llega al controlador, y la respuesta vuelve saliendo por esas mismas capas.

```
Request → [Middleware1 → Middleware2 → Middleware3] → Controlador
Response ← [Middleware1 ← Middleware2 ← Middleware3] ← Controlador
```

Cada middleware puede:
- Rechazar la request y devolver una respuesta (sin llegar al controlador)
- Modificar la request antes de pasarla
- Dejar pasar la request sin modificar
- Modificar la respuesta antes de devolverla

## Crear un middleware

```bash
php artisan make:middleware EnsureUserIsActive
```

Esto crea `app/Http/Middleware/EnsureUserIsActive.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Verificar si el usuario está activo
        if ($request->user() && !$request->user()->is_active) {
            // Rechazar la request
            return response()->json([
                'error' => 'Tu cuenta ha sido desactivada'
            ], 403);
            
            // O redirigir a una página
            // return redirect('/account-suspended');
        }

        // Dejar pasar la request al siguiente middleware o controlador
        return $next($request);
    }
}
```

## Middleware before vs after

El momento en que ejecutas tu lógica determina si el middleware actúa antes o después del controlador:

```php
class BeforeMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Código aquí: se ejecuta ANTES del controlador
        $this->doSomethingBefore($request);
        
        return $next($request); // Pasa al siguiente
    }
}

class AfterMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request); // Primero ejecuta el controlador
        
        // Código aquí: se ejecuta DESPUÉS del controlador
        $response->headers->set('X-Custom-Header', 'valor');
        
        return $response;
    }
}

class BeforeAndAfterMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        // Antes
        $startTime = microtime(true);
        
        $response = $next($request);
        
        // Después
        $duration = microtime(true) - $startTime;
        $response->headers->set('X-Response-Time', round($duration * 1000) . 'ms');
        
        return $response;
    }
}
```

## Registrar middlewares en Laravel 11

En Laravel 11, la configuración de middlewares se hace en `bootstrap/app.php`:

```php
// bootstrap/app.php
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\LogRequests;

return Application::configure(basePath: dirname(__DIR__))
    ->withMiddleware(function (Middleware $middleware) {
        
        // Añadir middleware global (corre en todas las requests)
        $middleware->append(LogRequests::class);
        $middleware->prepend(EnsureServerIsHealthy::class); // Al principio del stack
        
        // Añadir a grupo 'web'
        $middleware->web(append: [
            EnsureUserIsActive::class,
        ]);
        
        // Añadir a grupo 'api'
        $middleware->api(append: [
            ThrottleRequests::class . ':api',
        ]);
        
        // Definir alias para usar en rutas
        $middleware->alias([
            'active'    => EnsureUserIsActive::class,
            'log'       => LogRequests::class,
            'admin'     => EnsureUserIsAdmin::class,
        ]);
    })
    ->create();
```

### En Laravel 10 y anteriores

```php
// app/Http/Kernel.php

// Middleware globales
protected $middleware = [
    \App\Http\Middleware\TrustProxies::class,
    \Illuminate\Http\Middleware\HandleCors::class,
    \App\Http\Middleware\LogRequests::class,
];

// Grupos de middleware
protected $middlewareGroups = [
    'web' => [
        \App\Http\Middleware\EncryptCookies::class,
        // ...
        \App\Http\Middleware\EnsureUserIsActive::class,
    ],
    'api' => [
        \Illuminate\Routing\Middleware\ThrottleRequests::class . ':api',
        // ...
    ],
];

// Middleware nombrados (para usar en rutas)
protected $middlewareAliases = [
    'auth'   => \App\Http\Middleware\Authenticate::class,
    'active' => \App\Http\Middleware\EnsureUserIsActive::class,
    'admin'  => \App\Http\Middleware\EnsureUserIsAdmin::class,
];
```

## Aplicar middleware a rutas

```php
// routes/web.php

// Middleware en una ruta individual
Route::get('/profile', [ProfileController::class, 'show'])
     ->middleware('auth');

// Múltiples middlewares
Route::get('/admin/dashboard', [AdminController::class, 'index'])
     ->middleware(['auth', 'active', 'admin']);

// Middleware en un grupo de rutas
Route::middleware(['auth', 'active'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'show']);
    Route::resource('posts', PostController::class);
});

// Middleware en controlador (en el constructor)
class AdminController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
        $this->middleware('admin');
        
        // Solo en algunos métodos
        $this->middleware('admin')->only(['create', 'store', 'destroy']);
        
        // Excepto en algunos métodos
        $this->middleware('auth')->except(['index', 'show']);
    }
}
```

## Middleware con parámetros

Los middlewares pueden aceptar parámetros de configuración:

```php
// Middleware que acepta parámetros
class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        
        if (!$user || !$user->hasAnyRole($roles)) {
            return response()->json(['error' => 'Acceso denegado'], 403);
        }

        return $next($request);
    }
}
```

Y en las rutas se pasan así:

```php
// Un rol requerido
Route::get('/admin', [AdminController::class, 'index'])
     ->middleware('role:admin');

// Múltiples roles (cualquiera es válido)
Route::get('/reports', [ReportController::class, 'index'])
     ->middleware('role:admin,manager,analyst');

// Así llega al middleware: $roles = ['admin', 'manager', 'analyst']
```

## Ejemplos prácticos de middlewares reales

### Log de todas las requests

```php
class LogRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);
        
        // Solo loguear en producción
        if (app()->environment('production')) {
            Log::info('HTTP Request', [
                'method'      => $request->method(),
                'url'         => $request->fullUrl(),
                'status'      => $response->status(),
                'user_id'     => $request->user()?->id,
                'ip'          => $request->ip(),
                'duration_ms' => round((microtime(true) - LARAVEL_START) * 1000),
            ]);
        }
        
        return $response;
    }
}
```

### Restricción de acceso por IP

```php
class RestrictByIp
{
    private array $allowedIps = [
        '192.168.1.0/24',
        '10.0.0.1',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $clientIp = $request->ip();
        
        $isAllowed = collect($this->allowedIps)->contains(
            fn($ip) => $request->is($ip) || str_starts_with($clientIp, explode('/', $ip)[0])
        );
        
        if (!$isAllowed) {
            abort(403, 'Acceso no permitido desde esta IP');
        }

        return $next($request);
    }
}
```

### Forzar JSON en rutas de API

```php
class ForceJsonResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        // Asegura que las respuestas de error también sean JSON
        $request->headers->set('Accept', 'application/json');
        
        return $next($request);
    }
}
```

## Conclusión

Los middlewares son el mecanismo de Laravel para aplicar lógica transversal a múltiples rutas sin duplicar código en cada controlador. Úsalos para autenticación, autorización, logging, throttling, modificación de headers y cualquier lógica que aplique a un conjunto de rutas. Crea siempre middlewares con nombres descriptivos y regístralos con alias cortos para mantener las rutas legibles.
