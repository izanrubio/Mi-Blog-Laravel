---
title: 'Laravel Quota: Controla el Uso de Recursos con Presupuestos'
description: 'Aprende a implementar límites de uso en Laravel con Laravel Quota. Controla cuotas por período, evita abuso y monetiza APIs eficientemente.'
pubDate: '2025-01-15'
tags: ['laravel', 'quota', 'rate-limiting', 'api', 'seguridad']
---

## Laravel Quota: Controla el Uso de Recursos con Presupuestos Inteligentes

En aplicaciones modernas, especialmente en SaaS y APIs públicas, es fundamental controlar cuántos recursos consume cada usuario. Laravel Quota es un paquete que te permite definir y enforcar límites de uso acumulativo en períodos de calendario, brindando una forma elegante y fluida de implementar presupuestos.

A diferencia del rate limiting tradicional que limita por número de requests en un período corto, Laravel Quota rastrea el uso acumulativo (llamadas de API, GB descargados, operaciones de base de datos, etc.) y lo restablece automáticamente en períodos específicos: cada hora, día, semana o mes.

### ¿Por qué necesitas Laravel Quota?

Imagina estos escenarios comunes:

- **API SaaS**: "Los usuarios del plan Free pueden hacer 1000 llamadas al mes"
- **Descarga de datos**: "Máximo 10 GB por semana"
- **Recursos computacionales**: "50 minutos de procesamiento por día"
- **Monetización**: "El plan Pro incluye 5000 transacciones mensuales"

Sin una solución centralizada, terminarías implementando lógica custom en múltiples lugares, lo que es propenso a errores y difícil de mantener.

### Instalación y Configuración Inicial

Comienza instalando el paquete:

```bash
composer require laravel-quota/laravel-quota
```

Luego publica la configuración:

```bash
php artisan vendor:publish --provider="LaravelQuota\ServiceProvider"
```

Esto crea un archivo de configuración en `config/quota.php`:

```php
return [
    'storage' => env('QUOTA_STORAGE', 'cache'),
    'prefix' => 'quota_',
    'default_period' => 'month',
];
```

Puedes usar `cache` (más rápido, en memoria) o `database` (persiste entre reinicios) como storage backend.

### Definir Cuotas en tu Aplicación

#### Opción 1: Trait en Modelos

La forma más común es agregar el trait `HasQuotas` a tu modelo `User`:

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use LaravelQuota\Traits\HasQuotas;

class User extends Authenticatable
{
    use HasQuotas;

    // resto del modelo
}
```

#### Opción 2: Definir Cuotas en un Service Provider

En `app/Providers/AppServiceProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use LaravelQuota\Facades\Quota;

class AppServiceProvider extends ServiceProvider
{
    public function boot()
    {
        Quota::define('api_calls', [
            'limit' => 1000,
            'period' => 'month',
        ]);

        Quota::define('file_downloads', [
            'limit' => 10 * 1024, // 10 GB en MB
            'period' => 'week',
        ]);

        Quota::define('db_queries', [
            'limit' => 100000,
            'period' => 'day',
        ]);
    }
}
```

### Rastrear Uso en tu Código

Una vez definida una cuota, rastrear el uso es trivial:

```php
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use LaravelQuota\Facades\Quota;

class DataController extends Controller
{
    public function export(Request $request)
    {
        $user = $request->user();
        $fileSize = 256; // MB

        // Verificar si hay cuota disponible
        if (!Quota::check('file_downloads', $user, $fileSize)) {
            return response()->json([
                'error' => 'Límite de descarga alcanzado',
                'remaining' => Quota::remaining('file_downloads', $user),
            ], 429);
        }

        // Consumir la cuota
        Quota::consume('file_downloads', $user, $fileSize);

        // Generar y devolver archivo
        return response()->download('exports/data.zip');
    }
}
```

### Middleware para Proteger Rutas

Crea un middleware personalizado para validar cuotas automáticamente:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use LaravelQuota\Facades\Quota;

class CheckApiQuota
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return $next($request);
        }

        // Validar cuota antes de procesar
        if (!Quota::check('api_calls', $user, 1)) {
            return response()->json([
                'error' => 'Cuota de API alcanzada',
                'reset_date' => Quota::resetDate('api_calls', $user),
            ], 429);
        }

        // Consumir después de validación exitosa
        $response = $next($request);

        if ($response->status() < 400) {
            Quota::consume('api_calls', $user, 1);
        }

        // Agregar headers informativos
        return $response
            ->header('X-Quota-Limit', Quota::limit('api_calls', $user))
            ->header('X-Quota-Used', Quota::usage('api_calls', $user))
            ->header('X-Quota-Remaining', Quota::remaining('api_calls', $user))
            ->header('X-Quota-Reset', Quota::resetDate('api_calls', $user));
    }
}
```

Registra el middleware en `app/Http/Kernel.php`:

```php
protected $routeMiddleware = [
    // ...
    'api.quota' => \App\Http\Middleware\CheckApiQuota::class,
];
```

Y úsalo en tus rutas:

```php
Route::middleware(['api', 'auth:sanctum', 'api.quota'])->group(function () {
    Route::post('/data/export', [DataController::class, 'export']);
    Route::post('/analysis/process', [AnalysisController::class, 'process']);
});
```

### Casos de Uso Avanzados

#### Cuotas Dinámicas por Plan

```php
<?php

namespace App\Services;

use LaravelQuota\Facades\Quota;

class QuotaService
{
    public function initializeQuotasForUser($user)
    {
        $limits = match ($user->plan) {
            'free' => [
                'api_calls' => 100,
                'file_downloads' => 1024,
            ],
            'pro' => [
                'api_calls' => 10000,
                'file_downloads' => 100 * 1024,
            ],
            'enterprise' => [
                'api_calls' => PHP_INT_MAX,
                'file_downloads' => PHP_INT_MAX,
            ],
        };

        foreach ($limits as $quota => $limit) {
            Quota::define($quota, [
                'limit' => $limit,
                'period' => 'month',
                'user_id' => $user->id,
            ]);
        }
    }
}
```

#### Monitorear Consumo en Dashboard

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use LaravelQuota\Facades\Quota;

class UsageController extends Controller
{
    public function dashboard(Request $request)
    {
        $user = $request->user();

        return view('usage.dashboard', [
            'api_calls' => [
                'used' => Quota::usage('api_calls', $user),
                'limit' => Quota::limit('api_calls', $user),
                'remaining' => Quota::remaining('api_calls', $user),
                'reset_date' => Quota::resetDate('api_calls', $user),
            ],
            'file_downloads' => [
                'used' => Quota::usage('file_downloads', $user),
                'limit' => Quota::limit('file_downloads', $user),
                'remaining' => Quota::remaining('file_downloads', $user),
                'reset_date' => Quota::resetDate('file_downloads', $user),
            ],
        ]);
    }
}
```

En Blade:

```blade
<div class="quota-card">
    <h3>Llamadas API</h3>
    <div class="progress">
        <div class="bar" style="width: {{ ($api_calls['used'] / $api_calls['limit']) * 100 }}%"></div>
    </div>
    <p>{{ $api_calls['used'] }} / {{ $api_calls['limit'] }} usadas</p>
    <p class="reset-date">Se reinicia: {{ $api_calls['reset_date']->format('d/m/Y') }}</p>
</div>
```

#### Alertas cuando la Cuota se Agota

```php
<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use LaravelQuota\Events\QuotaExceeded;
use App\Notifications\QuotaLimitWarning;

class HandleQuotaExceeded implements ShouldQueue
{
    public function handle(QuotaExceeded $event)
    {
        $user = $event->user;
        $quota = $event->quota;
        $remaining = $event->remaining;

        if ($remaining <= 0) {
            $user->notify(new QuotaLimitWarning($quota));
        }

        // Log para monitoreo
        \Log::warning('Quota exceeded', [
            'user_id' => $user->id,
            'quota' => $quota,
            'remaining' => $remaining,
        ]);
    }
}
```

### Almacenamiento en Caché vs Base de Datos

#### Con Caché (Predeterminado - Más Rápido)

```php
// config/quota.php
'storage' => 'cache',
```

Ventajas: Acceso muy rápido, ideal para APIs de alto rendimiento.
Desventajas: No persiste si se reinicia el servidor.

#### Con Base de Datos (Más Confiable)

```bash
php artisan migrate
```

```php
// config/quota.php
'storage' => 'database',
```

Crea una tabla para almacenar histórico:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('quotas', function (Blueprint $table) {
            $table->id();
            $table->morphs('quotable'); // user_id, team_id, etc
            $table->string('quota_name');
            $table->integer('used')->default(0);
            $table->integer('limit');
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->timestamps();

            $table->unique(['quotable_type', 'quotable_id', 'quota_name', 'period_start']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('quotas');
    }
};
```

### Mejores Prácticas

#### 1. Usa Períodos Apropiados

```php
// Para APIs públicas: límite por minuto + por día
'rate_limit' => ['limit' => 60, 'period' => 'minute'],
'daily_api_calls' => ['limit' => 10000, 'period' => 'day'],

// Para datos: límite por mes
'api_calls' => ['limit' => 100000, 'period' => 'month'],

// Para recursos: límite por hora
'concurrent_jobs' => ['limit' => 10, 'period' => 'hour'],
```

#### 2. Proporciona Información Clara

```php
// Headers de respuesta informativos
$response->header('X-Quota-Limit', $limit);
$response->header('X-Quota-Used', $used);
$response->header('X-Quota-Remaining', $remaining);
$response->header('X-Quota-Reset', $resetDate);
$response->header('Retry-After', $secondsUntilReset);
```

#### 3. Registra Intentos de Exceso

```php
Quota::onExceeded(function ($user, $quota) {
    \Log::warning('Quota exceeded', [
        'user_id' => $user->id,
        'quota' => $quota,
        'timestamp' => now(),
    ]);
});
```

#### 4. Proporciona Forma de Aumentar Cuota

```php
if ($user->remaining('api_calls') < 100) {
    // Sugerir upgrade
    return response()->json([
        'warning' => 'Te acercas al límite',
        'upgrade_url' => route('upgrade-plan'),
    ]);
}
```

### Debugging

Para inspeccionar el estado de las cuotas:

```php
// En tinker o comandos
$user = User::find(1);

Quota::usage('api_calls', $user); // 850
Quota::remaining('api_calls', $user); // 150
Quota::limit('api_calls', $user); // 1000
Quota::resetDate('api_calls', $user); // Carbon instance
Quota::percentageUsed('api_calls', $user); // 85
```

## Puntos Clave

- **Laravel Quota** centraliza la gestión de límites de uso acumulativo en períodos de calendario
- Soporta múltiples backends de almacenamiento: caché (rápido) y base de datos (persistente)
- La API fluida hace sencillo verificar, consumir y monitorear cuotas: `Quota::check()`, `Quota::consume()`, `Quota::remaining()`
- Los middlewares automatizan la validación en rutas protegidas sin repetir código
- Ideal para SaaS, APIs públicas, y cualquier aplicación con planes limitados
- Combina con eventos para alertas y auditoría cuando se alcancen límites
- Proporciona siempre headers informativos sobre cuota en respuestas de API para mejor UX
- Permite cuotas dinámicas basadas en el plan del usuario o equipo
- Usa caché para máximo rendimiento; base de datos si necesitas histórico permanente