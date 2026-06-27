---
title: 'Route Metadata en Laravel 13: Añade Datos a tus Rutas'
description: 'Domina Route Metadata en Laravel 13 para enriquecer tus rutas con datos personalizados y metainformación sin contaminar controladores.'
pubDate: '2025-06-25'
tags: ['laravel', 'routing', 'metadata', 'laravel-13']
---

## Route Metadata en Laravel 13: Añade Datos a tus Rutas

Laravel 13.17 introduce una característica poderosa que muchos desarrolladores han estado esperando: **Route Metadata Support**. Esta funcionalidad te permite asociar datos personalizados directamente a tus rutas, lo que abre un mundo de posibilidades para organizar mejor tu código, crear middlewares más inteligentes y construir sistemas de autorización más granulares.

En este artículo exploraremos cómo usar Route Metadata, casos de uso reales y patrones que mejorarán significativamente la arquitectura de tus aplicaciones Laravel.

## ¿Qué es Route Metadata?

Route Metadata es simplemente **información adicional que asocias a una ruta** sin que afecte su comportamiento directo. Piensa en ello como "etiquetas" o "propiedades" que puedes leer en middlewares, controladores o listeners para tomar decisiones dinámicas.

Antes de Laravel 13.17, si necesitabas asociar información a una ruta, debías recurrir a:

- Constantes en controladores
- Arrays de configuración separados
- Parámetros en middlewares
- Convenciones de nombres

Con Route Metadata, todo es de **primera clase** y centralizado.

## Sintaxis Básica de Route Metadata

La sintaxis es elegante y directa. Usas el método `->metadata()` en tus rutas:

```php
// routes/web.php
Route::get('/dashboard', [DashboardController::class, 'index'])
    ->name('dashboard')
    ->metadata('module', 'analytics')
    ->metadata('requires-mfa', true);

Route::post('/users', [UserController::class, 'store'])
    ->metadata([
        'module' => 'user-management',
        'audit' => true,
        'rate-limit' => 100,
    ]);
```

También puedes usar arrays para asignar múltiples metadatos de una vez:

```php
Route::delete('/users/{id}', [UserController::class, 'destroy'])
    ->middleware('admin')
    ->metadata([
        'module' => 'user-management',
        'action' => 'delete-user',
        'requires-audit' => true,
        'api-documented' => true,
    ]);
```

## Accediendo a Route Metadata

Una vez que hayas definido metadatos, accederás a ellos a través del objeto `Route` actual:

### En Middlewares

Los middlewares son **el lugar ideal** para aprovechar Route Metadata:

```php
// app/Http/Middleware/AuditingMiddleware.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AuditingMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        
        if ($route && $route->metadata('requires-audit')) {
            // Registrar la acción en un log de auditoría
            \App\Models\AuditLog::create([
                'user_id' => auth()->id(),
                'action' => $route->metadata('action'),
                'module' => $route->metadata('module'),
                'ip_address' => $request->ip(),
                'timestamp' => now(),
            ]);
        }

        return $next($request);
    }
}
```

Luego registra este middleware en `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->append(AuditingMiddleware::class);
})
```

### En Controladores

También puedes acceder a metadatos dentro de tus controladores:

```php
// app/Http/Controllers/UserController.php
namespace App\Http\Controllers;

use Illuminate\Http\Request;

class UserController extends Controller
{
    public function destroy(Request $request, $id)
    {
        $route = $request->route();
        $module = $route->metadata('module');
        $action = $route->metadata('action');

        // Usar la información en la lógica de negocio
        $user = User::findOrFail($id);
        $user->delete();

        return redirect()->route('users.index')
            ->with('success', "Usuario eliminado desde módulo: $module");
    }
}
```

### En Event Listeners

Puedes acceder a metadatos incluso desde listeners de eventos:

```php
// app/Listeners/LogUserAction.php
namespace App\Listeners;

use Illuminate\Http\Request;

class LogUserAction
{
    public function __construct(private Request $request) {}

    public function handle($event)
    {
        $route = $this->request->route();
        
        if ($route?->metadata('requires-audit')) {
            Log::channel('audit')->info('User action', [
                'user_id' => auth()->id(),
                'action' => $route->metadata('action'),
                'module' => $route->metadata('module'),
                'data' => $event->data,
            ]);
        }
    }
}
```

## Casos de Uso Prácticos

### 1. Sistema de Auditoría Automática

```php
// routes/web.php
Route::group(['middleware' => 'audit'], function () {
    Route::patch('/users/{id}', [UserController::class, 'update'])
        ->metadata([
            'audit' => true,
            'action' => 'update-user',
            'module' => 'user-management',
        ]);

    Route::post('/products', [ProductController::class, 'store'])
        ->metadata([
            'audit' => true,
            'action' => 'create-product',
            'module' => 'inventory',
        ]);
});

// app/Http/Middleware/AuditingMiddleware.php
class AuditingMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        if ($request->route()?->metadata('audit') && $response->status() === 200) {
            AuditLog::create([
                'user_id' => auth()->id(),
                'action' => $request->route()->metadata('action'),
                'module' => $request->route()->metadata('module'),
                'method' => $request->method(),
                'url' => $request->path(),
                'status' => $response->status(),
            ]);
        }

        return $response;
    }
}
```

### 2. Control de Acceso Basado en Módulos

```php
// routes/api.php
Route::group(['prefix' => 'api', 'middleware' => 'module-access'], function () {
    Route::get('/reports', [ReportController::class, 'index'])
        ->metadata('module', 'analytics')
        ->metadata('permission', 'reports.view');

    Route::post('/exports', [ExportController::class, 'store'])
        ->metadata('module', 'analytics')
        ->metadata('permission', 'exports.create');
});

// app/Http/Middleware/ModuleAccessMiddleware.php
class ModuleAccessMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        
        if ($module = $route?->metadata('module')) {
            $permission = $route->metadata('permission');
            
            if (!auth()->user()->hasModuleAccess($module) || 
                ($permission && !auth()->user()->can($permission))) {
                abort(403, "No tienes acceso al módulo: $module");
            }
        }

        return $next($request);
    }
}
```

### 3. Documentación de API Automática

```php
// routes/api.php
Route::get('/api/products', [ProductController::class, 'index'])
    ->metadata([
        'doc' => true,
        'description' => 'Obtiene el listado de productos',
        'response' => 'ProductCollection',
        'rate-limit' => 60,
    ]);

Route::post('/api/products', [ProductController::class, 'store'])
    ->metadata([
        'doc' => true,
        'description' => 'Crea un nuevo producto',
        'body' => 'ProductStoreRequest',
        'response' => 'ProductResource',
        'rate-limit' => 30,
    ]);

// app/Console/Commands/GenerateApiDocs.php
class GenerateApiDocs extends Command
{
    public function handle()
    {
        $documentation = [];

        foreach (Route::getRoutes() as $route) {
            if ($route->metadata('doc')) {
                $documentation[] = [
                    'method' => implode('|', $route->methods()),
                    'path' => $route->uri,
                    'description' => $route->metadata('description'),
                    'request' => $route->metadata('body'),
                    'response' => $route->metadata('response'),
                    'rate_limit' => $route->metadata('rate-limit'),
                ];
            }
        }

        File::put(
            base_path('docs/api.json'),
            json_encode($documentation, JSON_PRETTY_PRINT)
        );

        $this->info('Documentación de API generada exitosamente');
    }
}
```

### 4. Rate Limiting Inteligente

```php
// routes/api.php
Route::get('/api/public-data', [DataController::class, 'public'])
    ->metadata('rate-limit', 1000) // 1000 requests por hora
    ->withoutMiddleware('throttle');

Route::get('/api/premium-data', [DataController::class, 'premium'])
    ->middleware('auth:sanctum')
    ->metadata('rate-limit', 10000);

// app/Http/Middleware/SmartRateLimitMiddleware.php
class SmartRateLimitMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        
        if ($limit = $route?->metadata('rate-limit')) {
            $user = auth()->user();
            $key = $user ? "user:{$user->id}" : "ip:{$request->ip()}";
            
            $current = Cache::get($key, 0);
            
            if ($current >= $limit) {
                return response()->json([
                    'error' => 'Rate limit exceeded',
                ], 429);
            }

            Cache::put($key, $current + 1, now()->addHour());
        }

        return $next($request);
    }
}
```

### 5. Autenticación Multifactor Condicional

```php
// routes/web.php
Route::group(['middleware' => 'mfa-check'], function () {
    Route::get('/settings', [SettingsController::class, 'index'])
        ->metadata('requires-mfa', true)
        ->metadata('risk-level', 'medium');

    Route::delete('/account', [AccountController::class, 'destroy'])
        ->metadata('requires-mfa', true)
        ->metadata('risk-level', 'high');

    Route::get('/analytics/sensitive', [AnalyticsController::class, 'sensitive'])
        ->metadata('requires-mfa', false)
        ->metadata('risk-level', 'low');
});

// app/Http/Middleware/MfaCheckMiddleware.php
class MfaCheckMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->route()?->metadata('requires-mfa')) {
            if (!session()->has('mfa-verified-at')) {
                return redirect()->route('mfa.verify')
                    ->with('intended', url()->current());
            }

            // Verificar que la verificación siga siendo válida (últimas 2 horas)
            if (now()->diffInHours(session('mfa-verified-at')) > 2) {
                session()->forget('mfa-verified-at');
                return redirect()->route('mfa.verify');
            }
        }

        return $next($request);
    }
}
```

## Validación de Metadatos

Es una buena práctica validar que los metadatos tengan los valores esperados:

```php
// app/Http/Middleware/ValidateMetadata.php
class ValidateMetadata
{
    protected array $validModules = ['user-management', 'analytics', 'inventory'];
    protected array $validActions = ['create', 'read', 'update', 'delete'];

    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        
        if ($module = $route?->metadata('module')) {
            if (!in_array($module, $this->validModules)) {
                throw new InvalidArgumentException(
                    "Módulo inválido en ruta: {$route->uri}"
                );
            }
        }

        return $next($request);
    }
}
```

## Mejores Prácticas

### 1. Mantén Metadatos Simples

Evita metadatos demasiado complejos. Usa arrays anidados con moderación:

```php
// ✅ Bien
->metadata('module', 'analytics')
->metadata('permission', 'reports.view')

// ❌ Evita
->metadata('complex-data', [
    'nested' => [
        'deeply' => [
            'structures' => 'are-hard-to-maintain'
        ]
    ]
])
```

### 2. Define Constantes para Metadatos Recurrentes

```php
// app/Support/RouteMetadata.php
class RouteMetadata
{
    const MODULES = [
        'ANALYTICS' => 'analytics',
        'USER_MANAGEMENT' => 'user-management',
        'INVENTORY' => 'inventory',
    ];

    const ACTIONS = [
        'CREATE' => 'create',
        'READ' => 'read',
        'UPDATE' => 'update',
        'DELETE' => 'delete',
    ];

    const RISK_LEVELS = [
        'LOW' => 'low',
        'MEDIUM' => 'medium',
        'HIGH' => 'high',
    ];
}

// En tus rutas
Route::post('/users', [UserController::class, 'store'])
    ->metadata('module', RouteMetadata::MODULES['USER_MANAGEMENT'])
    ->metadata('action', RouteMetadata::ACTIONS['CREATE']);
```

### 3. Documenta tus Metadatos

```php
/**
 * POST /api/users
 * 
 * Metadata:
 * - module: Identificador del módulo funcional
 * - action: Tipo de acción (create, update, delete)
 * - audit: Si se debe registrar en auditoría
 * - requires-mfa: Si requiere autenticación multifactor
 */
Route::post('/users', [UserController::class, 'store'])
    ->metadata('module', 'user-management')
    ->metadata('action', 'create')
    ->metadata('audit', true)
    ->metadata('requires-mfa', true);
```

## Depuración de Route Metadata

Usa el comando `route:list` de Artisan para visualizar tus rutas y sus metadatos:

```bash
php artisan route:list
```

Para una inspección más profunda, crea un comando personalizado:

```php
// app/Console/Commands/DebugRouteMetadata.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Route;

class DebugRouteMetadata extends Command
{
    protected $signature = 'route:metadata {--module= : Filtrar por módulo}';

    public function handle()