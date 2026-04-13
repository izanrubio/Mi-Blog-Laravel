---
title: 'Debuggear Apps Laravel en Producción sin Volverse Loco'
description: 'Técnicas avanzadas para debuggear y monitorear aplicaciones Laravel en producción de forma segura, eficiente y sin comprometer el rendimiento'
pubDate: '2026-04-13'
tags: ['laravel', 'debugging', 'producción', 'monitoreo']
---

## Debuggear Aplicaciones Laravel en Producción: Guía Práctica

Cuando tu aplicación Laravel está en producción, los errores no desaparecen: simplemente se vuelven más difíciles de rastrear. A diferencia del entorno local donde puedes ver stack traces completos y usar `dd()` sin restricciones, en producción necesitas herramientas más sofisticadas y seguras.

En este artículo exploraremos técnicas profesionales para debuggear aplicaciones Laravel en vivo sin perder la cordura ni comprometer la experiencia del usuario.

## El Problema del Debugging en Producción

El debugging en producción es fundamentalmente diferente al desarrollo local. Tienes restricciones importantes:

- **No puedes pausar la ejecución** con breakpoints
- **Los usuarios están usando tu aplicación** en tiempo real
- **La información sensible** no puede exponerse públicamente
- **El rendimiento es crítico** – no puedes ralentizar la app
- **Los logs pueden crecer rápidamente** y llenar el disco

Muchos desarrolladores Laravel cometen el error de desactivar completamente los logs en producción o, peor aún, dejar `debug => true` en el archivo `.env`, lo que expone información delicada en los error pages.

## Estrategia 1: Logging Estructurado y Contextual

El primer paso hacia un debugging profesional es implementar un sistema de logging robusto que capture contexto útil sin ser excesivamente verbose.

### Configurar Logging Avanzado

En `config/logging.php`, configura múltiples canales para diferentes tipos de eventos:

```php
'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['single', 'slack'],
        'ignore_exceptions' => false,
    ],
    'single' => [
        'driver' => 'single',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
        'days' => 14,
    ],
    'performance' => [
        'driver' => 'single',
        'path' => storage_path('logs/performance.log'),
        'level' => 'warning',
    ],
    'database' => [
        'driver' => 'single',
        'path' => storage_path('logs/database.log'),
        'level' => 'debug',
    ],
    'slack' => [
        'driver' => 'slack',
        'url' => env('LOG_SLACK_WEBHOOK_URL'),
        'username' => 'Laravel Log',
        'emoji' => ':boom:',
        'level' => 'critical',
    ],
],
```

### Logging con Contexto

En lugar de `Log::info('Algo pasó')`, incluye contexto que sea útil para debuggear:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $userId = Auth::id();
        $requestId = $request->header('X-Request-ID') ?? uniqid();
        
        Log::info('Iniciando creación de orden', [
            'user_id' => $userId,
            'request_id' => $requestId,
            'items_count' => $request->items->count(),
            'total_amount' => $request->total,
            'timestamp' => now()->toIso8601String(),
        ]);

        try {
            $order = Order::create($request->validated());
            
            Log::info('Orden creada exitosamente', [
                'user_id' => $userId,
                'order_id' => $order->id,
                'request_id' => $requestId,
            ]);

            return response()->json($order);
        } catch (\Exception $e) {
            Log::error('Error al crear orden', [
                'user_id' => $userId,
                'request_id' => $requestId,
                'error' => $e->getMessage(),
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json(
                ['message' => 'Error procesando la orden'],
                500
            );
        }
    }
}
```

## Estrategia 2: Custom Exception Reporting

El exception handler es tu primer línea de defensa. Personalízalo para capturar información crítica y enviarla a servicios especializados.

### Configurar Exception Handler

En `app/Exceptions/Handler.php`:

```php
<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontReport = [
        NotFoundHttpException::class,
        ValidationException::class,
    ];

    public function register(): void
    {
        $this->reportable(function (Throwable $e) {
            // Enviar a Sentry, Rollbar, etc.
            if ($this->shouldReport($e)) {
                $this->reportToErrorService($e);
            }
        });

        // Handler específico para query exceptions
        $this->reportable(function (QueryException $e) {
            $this->logDatabaseError($e);
        });
    }

    private function reportToErrorService(Throwable $e): void
    {
        if (!app()->environment('production')) {
            return;
        }

        try {
            \Sentry\captureException($e);
        } catch (\Exception $ex) {
            // Fallback si Sentry falla
            \Log::critical('Error enviando a Sentry', [
                'original_exception' => $e->getMessage(),
                'sentry_error' => $ex->getMessage(),
            ]);
        }
    }

    private function logDatabaseError(QueryException $e): void
    {
        \Log::channel('database')->error('Database Error', [
            'message' => $e->getMessage(),
            'query' => $e->getSql(),
            'bindings' => $e->getBindings(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ]);
    }
}
```

## Estrategia 3: Monitoring de Queries Lentas

Las queries lenta son una causa común de problemas en producción. Implementa detección automática.

### Registrar Queries Lentas

En `app/Providers/AppServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // En producción, solo grabar queries muy lentas
        $slowQueryThreshold = app()->environment('production') ? 1000 : 100; // ms

        DB::listen(function (QueryExecuted $query) use ($slowQueryThreshold) {
            if ($query->time >= $slowQueryThreshold) {
                Log::channel('performance')->warning(
                    'Slow Query Detected',
                    [
                        'query' => $query->sql,
                        'bindings' => $query->bindings,
                        'time_ms' => $query->time,
                        'connection' => $query->connectionName,
                        'threshold_ms' => $slowQueryThreshold,
                    ]
                );
            }
        });
    }
}
```

## Estrategia 4: Debugging Remoto con Xdebug en Producción

Para depuraciones más profundas, puedes usar Xdebug remotamente, pero con precaución extrema.

### Configuración Segura de Xdebug

```php
// config/xdebug.php
return [
    'enabled' => env('XDEBUG_ENABLED', false),
    'remote_host' => env('XDEBUG_REMOTE_HOST', '127.0.0.1'),
    'remote_port' => env('XDEBUG_REMOTE_PORT', 9003),
    // Solo activar para IPs específicas
    'allowed_ips' => explode(',', env('XDEBUG_ALLOWED_IPS', '127.0.0.1')),
];
```

En `php.ini` (producción):

```ini
; SOLO si realmente lo necesitas
[xdebug]
xdebug.mode = debug
xdebug.discover_client_host = off
xdebug.client_host = your-dev-machine-ip
xdebug.client_port = 9003
xdebug.start_with_request = trigger
; Muy importante: solo activar por request
xdebug.trigger_value = "debug-token-secreto"
```

Luego desde el cliente:

```bash
# Solo si tienes el trigger token
curl -H "XDEBUG_TRIGGER: debug-token-secreto" https://tu-app.com/endpoint
```

## Estrategia 5: Monitoreo con Herramientas Profesionales

Para aplicaciones serias, invierte en herramientas especializadas:

### Integración con Sentry

```php
// config/sentry.php
return [
    'dsn' => env('SENTRY_LARAVEL_DSN'),
    'environment' => env('APP_ENV'),
    'release' => env('APP_VERSION'),
    'traces_sample_rate' => env('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    'profiles_sample_rate' => env('SENTRY_PROFILES_SAMPLE_RATE', 0.1),
];
```

En tu `.env`:

```env
SENTRY_LARAVEL_DSN=https://your-key@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.05
```

Sentry automáticamente capturará:
- Excepciones no manejadas
- Errores de performance
- Transacciones HTTP
- Interacciones del usuario

## Estrategia 6: Request Debugging Seguro

Crea un middleware que capture información de request solo cuando sea necesario.

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DebugRequest
{
    private $debugTokens = [];

    public function __construct()
    {
        $this->debugTokens = explode(',', env('DEBUG_TOKENS', ''));
    }

    public function handle(Request $request, Closure $next)
    {
        $debugToken = $request->header('X-Debug-Token');
        
        if (
            in_array($debugToken, $this->debugTokens) &&
            app()->environment('production')
        ) {
            Log::info('Debug Request', [
                'method' => $request->getMethod(),
                'path' => $request->getPath(),
                'query' => $request->query(),
                'headers' => $request->headers->all(),
                'user_agent' => $request->userAgent(),
                'ip' => $request->ip(),
            ]);
        }

        return $next($request);
    }
}
```

## Estrategia 7: Health Checks y Monitoring

Implementa endpoints específicos para monitorear la salud de tu aplicación:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class HealthController extends Controller
{
    public function check()
    {
        $checks = [
            'database' => $this->checkDatabase(),
            'cache' => $this->checkCache(),
            'storage' => $this->checkStorage(),
            'queue' => $this->checkQueue(),
        ];

        $healthy = collect($checks)->every(fn($check) => $check['status'] === 'ok');

        return response()->json(
            [
                'status' => $healthy ? 'healthy' : 'unhealthy',
                'checks' => $checks,
                'timestamp' => now()->toIso8601String(),
            ],
            $healthy ? 200 : 503
        );
    }

    private function checkDatabase(): array
    {
        try {
            DB::connection()->getPdo();
            return ['status' => 'ok'];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkCache(): array
    {
        try {
            Cache::put('health_check', true, 1);
            return ['status' => 'ok'];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkStorage(): array
    {
        try {
            $disk = \Storage::disk('local');
            $disk->put('health_check.txt', 'ok');
            $disk->delete('health_check.txt');
            return ['status' => 'ok'];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }

    private function checkQueue(): array
    {
        try {
            $failed = \DB::table('failed_jobs')->count();
            return [
                'status' => $failed < 10 ? 'ok' : 'warning',
                'failed_jobs' => $failed,
            ];
        } catch (\Exception $e) {
            return [
                'status' => 'error',
                'message' => $e->getMessage(),
            ];
        }
    }
}
```

Registra en `routes/web.php`:

```php
Route::get('/health', [HealthController::class, 'check']);
```

## Mejores Prácticas Esenciales

### 1. Nunca Expones Información Sensible

```php
// ❌ Malo - expone rutas internas
Log::error('Error', ['exception' => $e->getTraceAsString()]);

// ✅ Bueno - información genérica para el usuario
return response()->json(
    ['message' => 'Algo salió mal. ID: ' . $requestId],
    500
);
```

### 2. Usa Request IDs Únicos

```php
// Middleware
class AddRequestId
{
    public function handle(Request $request, Closure $next)
    {
        $requestId = $request->header('X-Request-ID') ?? uniqid();
        
        \Log::shareContext([
            'request_id' => $requestId,
        ]);

        return $next($request);
    }
}
```

### 3. Implementa Rate Limiting en Endpoints de Debug

```php
Route::get('/debug/info', function () {
    // ...
})->middleware('throttle:10,1'); // 10 requests por minuto
```

## Conclusión

El debugging en producción requiere una estrategia diferente a la del desarrollo local. La clave está en implementar logging contextual, exception handling robusto, monitoring continuo y usar herramientas profesionales que te permitan investigar problemas sin exponiendo información sensible ni ralentizar la