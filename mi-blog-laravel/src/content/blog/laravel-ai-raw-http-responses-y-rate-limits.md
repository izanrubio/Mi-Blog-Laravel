---
title: 'Laravel AI: Raw HTTP Responses y Rate Limits'
description: 'Accede a respuestas HTTP brutas y límites de tasa en Laravel AI 0.11. Monitorea headers, IDs de solicitud y campos de payload.'
pubDate: '2024-08-25'
tags: ['laravel', 'laravel-ai', 'api', 'rate-limits', 'observability']
---

## Acceso a Respuestas HTTP Brutas en Laravel AI 0.11

Laravel AI SDK continúa evolucionando con mejoras significativas en observabilidad y control. Una de las características más esperadas en la versión 0.11 es la capacidad de acceder a las respuestas HTTP brutas directamente desde el objeto de respuesta, permitiendo a los desarrolladores leer headers críticos como límites de tasa, IDs de solicitud y otros campos del payload que normalmente quedan ocultos en abstracciones de alto nivel.

Esta funcionalidad es especialmente valiosa cuando trabajas con APIs de terceros como OpenAI, Anthropic o Claude, donde los límites de tasa y la monitorización de uso son críticos para mantener aplicaciones estables en producción.

## ¿Por Qué Necesitas Acceso a Respuestas Brutas?

Cuando integras agentes IA en tu aplicación Laravel, muchas variables importantes están fuera de tu control directo. Los proveedores de IA como OpenAI implementan límites de tasa estrictos y devuelven información valiosa en headers HTTP que no siempre se expone en abstracciones de alto nivel.

### Casos de Uso Reales

**Monitoreo de Rate Limits**: Los headers como `x-ratelimit-remaining`, `x-ratelimit-reset` y `x-ratelimit-limit` te permiten implementar lógica defensiva antes de que alcances el límite.

**Tracking de Costos**: El header `openai-organization` y otros identificadores permiten rastrear qué cliente o proyecto generó una solicitud específica.

**Debugging Avanzado**: El header `x-request-id` es invaluable cuando necesitas contactar al soporte técnico con un identificador único de solicitud.

**Optimización de Recursos**: Acceder al payload bruto permite implementar caché más inteligente y decisiones de reintento más informadas.

## Estructura del Objeto Response en Laravel AI 0.11

El objeto response en Laravel AI ahora expone la propiedad `raw`, que contiene la respuesta HTTP completa del proveedor:

```php
use Laravel\AI\Facades\AI;

$response = AI::client('openai')->prompt('¿Cuál es el sentido de la vida?');

// Acceder a la respuesta bruta
$rawResponse = $response->raw;

// Headers críticos
$remaining = $rawResponse->header('x-ratelimit-remaining');
$resetTime = $rawResponse->header('x-ratelimit-reset-requests');
$requestId = $rawResponse->header('x-request-id');

dd([
    'remaining_requests' => $remaining,
    'reset_at' => $resetTime,
    'request_id' => $requestId
]);
```

## Implementar Monitoreo de Rate Limits

Crear un sistema robusto de monitoreo de rate limits requiere capturar y almacenar esta información en cada llamada a la API.

### Crear un Service para Rastrear Rate Limits

```php
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class RateLimitMonitor
{
    public function track(string $provider, $response): void
    {
        $rawResponse = $response->raw;
        
        $rateData = [
            'provider' => $provider,
            'remaining' => $rawResponse->header('x-ratelimit-remaining'),
            'limit' => $rawResponse->header('x-ratelimit-limit-requests'),
            'reset_at' => $rawResponse->header('x-ratelimit-reset-requests'),
            'request_id' => $rawResponse->header('x-request-id'),
            'timestamp' => now(),
        ];

        // Guardar en caché para dashboard en tiempo real
        Cache::put(
            "rate_limit.{$provider}",
            $rateData,
            now()->addHours(1)
        );

        // Registrar si estamos cerca del límite
        $remaining = (int) $rateData['remaining'];
        if ($remaining < 10) {
            Log::warning("Rate limit approaching for {$provider}", $rateData);
        }
    }

    public function getRateLimitStatus(string $provider): ?array
    {
        return Cache::get("rate_limit.{$provider}");
    }

    public function isNearLimit(string $provider, int $threshold = 5): bool
    {
        $status = $this->getRateLimitStatus($provider);
        return $status && (int) $status['remaining'] <= $threshold;
    }
}
```

### Usar el Monitor en Controllers

```php
namespace App\Http\Controllers;

use App\Services\RateLimitMonitor;
use Laravel\AI\Facades\AI;
use Illuminate\Http\Request;

class AIQueryController extends Controller
{
    public function __construct(
        private RateLimitMonitor $rateLimitMonitor
    ) {}

    public function query(Request $request)
    {
        $request->validate([
            'prompt' => 'required|string|max:2000',
        ]);

        // Verificar límite antes de hacer la solicitud
        if ($this->rateLimitMonitor->isNearLimit('openai', threshold: 3)) {
            return response()->json([
                'error' => 'Rate limit nearly exceeded. Please try again later.',
                'status' => $this->rateLimitMonitor->getRateLimitStatus('openai'),
            ], 429);
        }

        try {
            $response = AI::client('openai')
                ->prompt($request->input('prompt'));

            // Rastrear el rate limit después de la solicitud
            $this->rateLimitMonitor->track('openai', $response);

            return response()->json([
                'result' => $response->text,
                'rate_limit' => $this->rateLimitMonitor->getRateLimitStatus('openai'),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to process request',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
```

## Acceder a Campos Específicos del Payload

Además de los headers, el objeto response bruto también permite acceder al payload completo en JSON:

```php
use Laravel\AI\Facades\AI;

$response = AI::client('openai')
    ->prompt('Analiza este texto y proporciona sentimiento')
    ->system('Eres un analizador de sentimientos');

$raw = $response->raw;

// Acceder al body como JSON
$body = $raw->json();

// Información del modelo usado
$model = $body['model'];

// Tokens utilizados (importante para costos)
$usage = $body['usage'];
$inputTokens = $usage['prompt_tokens'];
$outputTokens = $usage['completion_tokens'];
$totalTokens = $usage['total_tokens'];

// Razón de parada
$finishReason = $body['choices'][0]['finish_reason'];

echo "Modelo: {$model}";
echo "Input tokens: {$inputTokens}";
echo "Output tokens: {$outputTokens}";
echo "Razón de parada: {$finishReason}";
```

## Implementar Sistema de Costos en Tiempo Real

Con acceso al payload bruto, puedes rastrear costos de manera precisa:

```php
namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AIUsageTracker
{
    // Precios por 1K tokens (actualizar con precios reales)
    private array $pricing = [
        'gpt-4' => [
            'input' => 0.03,
            'output' => 0.06,
        ],
        'gpt-4-turbo' => [
            'input' => 0.01,
            'output' => 0.03,
        ],
        'gpt-3.5-turbo' => [
            'input' => 0.0005,
            'output' => 0.0015,
        ],
    ];

    public function trackUsage(string $userId, $response): void
    {
        $raw = $response->raw;
        $body = $raw->json();

        $model = $body['model'];
        $usage = $body['usage'];
        $inputTokens = $usage['prompt_tokens'];
        $outputTokens = $usage['completion_tokens'];

        $pricing = $this->pricing[$model] ?? null;
        if (!$pricing) {
            return;
        }

        $inputCost = ($inputTokens / 1000) * $pricing['input'];
        $outputCost = ($outputTokens / 1000) * $pricing['output'];
        $totalCost = $inputCost + $outputCost;

        // Guardar en base de datos
        DB::table('ai_usage_logs')->insert([
            'user_id' => $userId,
            'model' => $model,
            'input_tokens' => $inputTokens,
            'output_tokens' => $outputTokens,
            'input_cost' => $inputCost,
            'output_cost' => $outputCost,
            'total_cost' => $totalCost,
            'request_id' => $raw->header('x-request-id'),
            'created_at' => now(),
        ]);

        // Actualizar caché de uso del usuario
        Cache::increment(
            "user_costs.{$userId}",
            $totalCost,
            now()->addMonth()
        );
    }

    public function getUserCost(string $userId, ?string $period = null): float
    {
        $query = DB::table('ai_usage_logs')
            ->where('user_id', $userId);

        if ($period === 'today') {
            $query->whereDate('created_at', today());
        } elseif ($period === 'month') {
            $query->whereMonth('created_at', now()->month);
        }

        return (float) $query->sum('total_cost');
    }
}
```

## Middleware para Auditar Solicitudes

Crear middleware que capture automáticamente información de rate limits:

```php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AuditAIRequests
{
    public function handle(Request $request, Closure $next)
    {
        $start = microtime(true);
        $response = $next($request);
        $duration = microtime(true) - $start;

        if ($request->route()?->getName() === 'ai.query') {
            Log::channel('ai')->info('AI Query Executed', [
                'user_id' => auth()->id(),
                'duration_ms' => round($duration * 1000, 2),
                'timestamp' => now(),
                'path' => $request->path(),
            ]);
        }

        return $response;
    }
}
```

## Manejo de Errores y Reintentos Inteligentes

Usa información del response bruto para implementar reintentos más inteligentes:

```php
namespace App\Services;

use Laravel\AI\Facades\AI;
use Illuminate\Support\Facades\Log;

class SmartRetryAI
{
    public function queryWithRetry(string $prompt, int $maxRetries = 3): ?string
    {
        $attempt = 0;
        $lastException = null;

        while ($attempt < $maxRetries) {
            try {
                $response = AI::client('openai')->prompt($prompt);
                $raw = $response->raw;

                // Éxito
                if ($raw->status() === 200) {
                    return $response->text;
                }

                // Rate limit: esperar más
                if ($raw->status() === 429) {
                    $resetTime = $raw->header('retry-after') ?? 60;
                    Log::info("Rate limited. Waiting {$resetTime}s");
                    sleep((int) $resetTime);
                    $attempt++;
                    continue;
                }

                // Error del servidor: reintentar
                if ($raw->status() >= 500) {
                    $attempt++;
                    sleep(2 ** $attempt); // Exponential backoff
                    continue;
                }

                // Otro error: no reintentar
                throw new \Exception("API Error: {$raw->status()}");

            } catch (\Exception $e) {
                $lastException = $e;
                $attempt++;
                if ($attempt < $maxRetries) {
                    sleep(2 ** $attempt);
                }
            }
        }

        Log::error("Failed after {$maxRetries} attempts", [
            'error' => $lastException?->getMessage(),
        ]);

        return null;
    }
}
```

## Dashboard de Monitoreo

Crea una ruta para visualizar el estado actual:

```php
namespace App\Http\Controllers;

use App\Services\RateLimitMonitor;
use App\Services\AIUsageTracker;

class AIMonitoringController extends Controller
{
    public function __construct(
        private RateLimitMonitor $rateLimitMonitor,
        private AIUsageTracker $usageTracker
    ) {}

    public function dashboard()
    {
        return response()->json([
            'rate_limits' => [
                'openai' => $this->rateLimitMonitor->getRateLimitStatus('openai'),
                'anthropic' => $this->rateLimitMonitor->getRateLimitStatus('anthropic'),
            ],
            'current_user_cost_today' => $this->usageTracker->getUserCost(
                auth()->id(),
                'today'
            ),
            'current_user_cost_month' => $this->usageTracker->getUserCost(
                auth()->id(),
                'month'
            ),
            'warnings' => [
                'openai_near_limit' => $this->rateLimitMonitor->isNearLimit('openai'),
                'anthropic_near_limit' => $this->rateLimitMonitor->isNearLimit('anthropic'),
            ],
        ]);
    }
}
```

## Migración para Rastreo de Uso

```php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ai_usage_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();
            $table->string('model');
            $table->integer('input_tokens');
            $table->integer('output_tokens');
            $table->decimal('input_cost', 10, 6);
            $table->decimal('output_cost', 10, 6);
            $table->decimal('total_cost', 10, 6);
            $table->string('request_id')->nullable();
            $table->timestamps();
            
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_usage_logs');
    }
};
```

## Conclusión

El acceso a respuestas HTTP brutas en Laravel AI 0.11 es un cambio fundamental que permite a los desarrolladores construir aplicaciones IA más robustas y observables. Al integrar monitoreo de rate limits, rastreo de costos y reintentos inteligentes, puedes mantener tus aplicaciones en producción funcionando de manera confiable incluso ante limitaciones de los proveedores de IA.

La clave está en capturar esta información sistemáticamente, almacenarla de manera efectiva y actuar sobre ella de manera