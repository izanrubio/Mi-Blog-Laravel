---
title: 'USAIGE en Laravel: Monitorea Costos de IA en Tiempo Real'
description: 'Guía completa para implementar USAIGE en Laravel y controlar gastos de APIs de IA. Monitorea tokens, costos USD y uso de proveedores.'
pubDate: '2025-01-15'
tags: ['laravel', 'ia', 'monitoreo', 'costos']
---

## USAIGE en Laravel: Monitorea Costos de IA en Tiempo Real

Las aplicaciones modernas que integran modelos de IA generativa como ChatGPT, Claude o Gemini pueden acumular costos significativos sin una monitorización adecuada. Cada llamada a una API de IA tiene un precio, y sin visibilidad sobre el consumo de tokens, es fácil sorprenderse con facturaciones inesperadas.

**USAIGE** es un paquete Laravel que soluciona este problema de manera elegante: registra automáticamente cada solicitud a APIs de IA, captura métricas de uso (tokens, costos en USD, proveedor utilizado), y proporciona un dashboard integrado para analizar el consumo en tiempo real.

En este artículo, te mostraré cómo implementar USAIGE desde cero, configurarlo correctamente y aprovechar todas sus características para mantener tus costos de IA bajo control.

## ¿Por qué necesitas monitorear costos de IA?

Antes de sumergirse en la implementación, es importante entender el problema que USAIGE resuelve:

### El Desafío del Control de Costos

Los modelos de IA no tienen un precio fijo: cobran por tokens procesados. Si tu aplicación hace 10,000 solicitudes diarias a OpenAI sin supervisión, podrías estar gastando cientos de dólares sin saberlo. Los problemas comunes incluyen:

- **Loops infinitos accidentales**: Un bug que causa solicitudes repetidas
- **Queries ineficientes**: Enviar más datos de los necesarios a la API
- **Falta de auditoría**: No saber qué usuario o feature consume más recursos
- **Sobrecostos silenciosos**: La factura llega pero no sabes de dónde vinieron los gastos

USAIGE registra cada interacción para que tengas trazabilidad completa.

### Casos de Uso Ideales

- Aplicaciones SaaS que ofrecen features de IA a múltiples usuarios
- Sistemas internos que procesan documentos con IA
- APIs que integran busquedas o análisis generativos
- Dashboards de administración que requieren transparencia de costos

## Instalación de USAIGE

El proceso es estándar. Asume que ya tienes un proyecto Laravel 11+ configurado.

```bash
composer require ludovic-guenet/usaige
```

Luego, publica los assets y migraciones:

```bash
php artisan vendor:publish --provider="Usaige\UsaigeServiceProvider"
```

Ejecuta las migraciones para crear las tablas necesarias:

```bash
php artisan migrate
```

USAIGE crea las siguientes tablas:
- `usaige_runs`: registra cada solicitud de IA
- `usaige_tokens`: detalla el uso de tokens por tipo
- `usaige_costs`: almacena datos de costo en USD

## Configuración Básica

Abre el archivo de configuración generado en `config/usaige.php`:

```php
<?php

return [
    'enabled' => env('USAIGE_ENABLED', true),
    
    'providers' => [
        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
            'track' => true,
        ],
        'anthropic' => [
            'api_key' => env('ANTHROPIC_API_KEY'),
            'track' => true,
        ],
    ],
    
    'dashboard' => [
        'enabled' => true,
        'path' => '/usaige',
        'middleware' => ['web', 'auth', 'verified'],
    ],
    
    'retention_days' => 90, // Elimina datos más antiguos automáticamente
];
```

Las variables clave:
- **enabled**: Activa/desactiva el tracking globalmente
- **providers**: Configura cuáles APIs de IA monitorear
- **dashboard**: Habilita el dashboard web y define su URL
- **retention_days**: Cuántos días mantener histórico

## Uso con Laravel AI SDK

USAIGE funciona nativamente con Laravel AI SDK. Cuando usas `Laravel\AI` para hacer solicitudes, USAIGE automáticamente las intercepta y registra.

### Ejemplo Básico

```php
<?php

namespace App\Services;

use Laravel\AI\Facades\AI;

class DocumentAnalyzer
{
    public function analyzeDocument(string $content): string
    {
        $response = AI::using('openai')
            ->asString()
            ->withSystemPrompt('You are a document analyzer.')
            ->prompt("Analyze: $content");
        
        // USAIGE registra automáticamente esta solicitud
        return $response;
    }
}
```

Sin configuración adicional, USAIGE captura:
- Tokens consumidos (prompt + completion)
- Costo en USD basado en los precios de OpenAI
- Timestamp exacto
- Status de la solicitud (success/error)
- Nombre del provider

### Registrar Metadata Personalizada

Para agregar contexto adicional (quién hizo la solicitud, qué feature usó, etc.), puedes hacer:

```php
<?php

namespace App\Http\Controllers;

use Laravel\AI\Facades\AI;
use Usaige\Facades\Usaige;

class ChatController extends Controller
{
    public function chat(Request $request)
    {
        $user = $request->user();
        
        // Inicia tracking con metadata
        Usaige::withContext([
            'user_id' => $user->id,
            'feature' => 'chat_assistant',
            'model_name' => 'gpt-4-turbo',
        ]);
        
        $response = AI::using('openai')
            ->asString()
            ->prompt($request->input('message'));
        
        // El dashboard mostrará esta información asociada
        return response()->json(['response' => $response]);
    }
}
```

El método `withContext()` permite pasar cualquier dato relevante que después puedas filtrar en el dashboard.

## Accediendo al Dashboard

Una vez configurado, accede a `http://tuapp.local/usaige` (o la ruta que hayas definido).

El dashboard muestra:

### Vista General
- Total de solicitudes en el período
- Tokens consumidos (prompt vs completion)
- Costo total en USD
- Providers más utilizados
- Tendencia temporal (gráficos)

### Detalles de Runs
Cada "run" (solicitud de IA) aparece como una fila con:
- Timestamp
- Provider (OpenAI, Anthropic, etc.)
- Modelo utilizado
- Tokens (prompt/completion)
- Costo USD
- Status (success/failed)
- Metadata personalizada

### Filtros y Búsqueda

```
Filtrar por:
- Rango de fechas
- Proveedor
- Status (success/error)
- Metadata personalizada (user_id, feature, etc.)
```

## Tracking Programático Avanzado

### Manejo de Errores

USAIGE también registra solicitudes fallidas:

```php
<?php

use Usaige\Facades\Usaige;
use Laravel\AI\Facades\AI;

try {
    $response = AI::using('openai')
        ->asString()
        ->prompt('Your message');
} catch (\Exception $e) {
    // USAIGE marca automáticamente como fallida
    // y registra el mensaje de error
    
    Usaige::recordError([
        'exception' => class_basename($e),
        'message' => $e->getMessage(),
    ]);
    
    throw $e;
}
```

### Tracking Manual

Si no usas Laravel AI SDK sino llamas directamente a clientes HTTP:

```php
<?php

use Usaige\Facades\Usaige;

$response = Http::withToken(config('openai.api_key'))
    ->post('https://api.openai.com/v1/chat/completions', [
        'model' => 'gpt-4',
        'messages' => [['role' => 'user', 'content' => 'Hello']],
    ])
    ->json();

// Registra manualmente
Usaige::record([
    'provider' => 'openai',
    'model' => 'gpt-4',
    'tokens_prompt' => $response['usage']['prompt_tokens'],
    'tokens_completion' => $response['usage']['completion_tokens'],
    'cost_usd' => calculateCost($response['usage']),
    'status' => 'success',
    'metadata' => [
        'user_id' => auth()->id(),
        'feature' => 'email_generation',
    ],
]);
```

## Alerts y Notificaciones

Configura alertas cuando el gasto diario supere un límite:

```php
<?php

namespace App\Services;

use Usaige\Events\CostThresholdExceeded;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;

class UsaigeListener
{
    public function handle(CostThresholdExceeded $event)
    {
        // El gasto diario superó el límite configurado
        
        Mail::to('admin@example.com')
            ->send(new \App\Mail\HighAICostAlert(
                daily_cost: $event->dailyCost,
                threshold: config('usaige.daily_cost_limit'),
            ));
    }
}
```

Registra el listener en `app/Providers/EventServiceProvider.php`:

```php
protected $listen = [
    \Usaige\Events\CostThresholdExceeded::class => [
        \App\Listeners\UsaigeListener::class,
    ],
];
```

## Exportación y Reportes

El dashboard permite descargar datos en CSV para análisis externo:

```php
<?php

use Usaige\Models\Run;

// Desde tu controlador o command
$runs = Run::whereBetween('created_at', [$from, $to])
    ->where('status', 'success')
    ->get(['provider', 'model', 'tokens_prompt', 'tokens_completion', 'cost_usd']);

// Exportar a CSV
$csv = $runs->map(fn($run) => [
    $run->provider,
    $run->model,
    $run->tokens_prompt,
    $run->tokens_completion,
    $run->cost_usd,
])->toArray();

// Usar Maatwebsite Excel u otra librería
```

## Mejores Prácticas

### 1. Implementa Rate Limiting

Protege tu aplicación de gastos descontrolados:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Usaige\Facades\Usaige;

class AICostLimiter
{
    public function handle($request, Closure $next)
    {
        $user = $request->user();
        $todayCost = Usaige::getUserCostToday($user->id);
        
        if ($todayCost > $user->ai_monthly_budget / 30) {
            abort(429, 'You have reached your daily AI cost limit.');
        }
        
        return $next($request);
    }
}
```

### 2. Cachea Respuestas Costosas

Si es posible, reutiliza resultados previos:

```php
<?php

use Illuminate\Support\Facades\Cache;
use Laravel\AI\Facades\AI;

$cacheKey = 'ai_analysis_' . md5($input);

$result = Cache::remember($cacheKey, now()->addDay(), function () use ($input) {
    return AI::using('openai')
        ->asString()
        ->prompt($input);
});
```

### 3. Monitorea por Usuario

Identifica quién consume más recursos:

```php
<?php

use Usaige\Models\Run;

$topUsers = Run::where('status', 'success')
    ->whereYear('created_at', now()->year)
    ->whereMonth('created_at', now()->month)
    ->groupBy('metadata->user_id')
    ->selectRaw('metadata->user_id as user_id, SUM(cost_usd) as total_cost, COUNT(*) as requests')
    ->orderByDesc('total_cost')
    ->limit(10)
    ->get();

foreach ($topUsers as $usage) {
    echo "User {$usage['user_id']}: \${$usage['total_cost']} ({$usage['requests']} requests)";
}
```

### 4. Limpiar Datos Antiguos

Aunque USAIGE limpia automáticamente según `retention_days`, puedes hacerlo manualmente:

```bash
php artisan usaige:cleanup --days=60
```

## Integración con Otras Herramientas

### Con Laravel Horizon

Si usas queues con Redis, monitorea también trabajos asincronos:

```php
<?php

namespace App\Jobs;

use Laravel\AI\Facades\AI;
use Usaige\Facades\Usaige;

class ProcessDocumentWithAI implements ShouldQueue
{
    public function handle()
    {
        Usaige::withContext([
            'job_id' => $this->job->getJobId(),
            'feature' => 'document_processing',
        ]);
        
        $result = AI::using('openai')->asString()->prompt(...);
    }
}
```

### Con Telescope

USAIGE complementa Laravel Telescope para visibilidad completa de solicitudes HTTP y uso de IA.

## Troubleshooting

### El dashboard no aparece

Verifica que:
1. Las migraciones se ejecutaron: `php artisan migrate:status`
2. La ruta está registrada en `routes/web.php`
3. Pasas los middlewares de autenticación

### No se registran solicitudes

Revisa:
1. `USAIGE_ENABLED=true` en `.env`
2. El provider está configurado en `config/usaige.php`
3. Usas `Laravel\AI` o llamadas manuales a `Usaige::record()`

### Datos históricos desaparecieron

Verifica `retention_days`. Aquí está configurado para 90 días por defecto. Ajusta si necesitas más histórico:

```php
'retention_days' => env('USAIGE_RETENTION_DAYS', 180),
```

## Conclusión

USAIGE es una herramienta esencial para cualquier aplicación Laravel que integre APIs de IA. Proporciona visibilidad completa sobre costos, facilita auditoría y permite optimización basada en datos reales.

Implementarlo desde el inicio evita sorpresas presupuestarias y te da control granular sobre cómo tu aplicación utiliza recursos de IA. Combinado con rate limiting, cacheo y monitoreo por usuario, puedes construir sistemas de IA escalables y económicamente sostenibles.

### Puntos Clave

- **USAIGE registra automáticamente** cada solicitud a APIs de IA sin configuración compleja
- **Dashboard integrado** muestra costos, tokens y tendencias en tiempo real
- **Metadata personalizada** permite filtrar gasto por usuario, feature o contexto
- **Alertas configurables** evitan sobrecostos mediante notificaciones
- **Integración nativa** con Laravel AI SDK y soporte para tracking manual
- **Retención automática** de datos configurable para optimizar almacenamiento
- **Rate limiting** por usuario previene gastos descontrolados
- **Exportación de reportes** facilita anál