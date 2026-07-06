---
title: 'Laravel AI Tasks: Orquestación de IA con Control de Costos'
description: 'Aprende a usar Laravel AI Tasks para ejecutar tareas de IA en colas, rastrear costos en tiempo real y construir dashboards de monitoreo en Laravel.'
pubDate: '2026-07-03'
tags: ['laravel', 'ia', 'queues', 'ai-sdk']
---

## Laravel AI Tasks: Orquestación de IA con Control de Costos

La integración de inteligencia artificial en aplicaciones Laravel se ha vuelto cada vez más accesible, pero con ella surge un desafío crítico: **controlar los costos de las API de IA**. Cuando ejecutas múltiples llamadas a OpenAI, Anthropic o Google AI, los gastos pueden dispararse rápidamente. Por eso nació **Laravel AI Tasks**, un paquete que envuelve el Laravel AI SDK con características de orquestación, logging y control de costos.

En este artículo aprenderás cómo implementar Laravel AI Tasks en tu aplicación, crear tareas reutilizables, ejecutarlas en colas y monitorear gastos en tiempo real.

## ¿Qué es Laravel AI Tasks?

Laravel AI Tasks es un paquete creado por fomvasss que proporciona:

- **Clases de tareas reutilizables** para encapsular lógica de IA
- **Ejecución en colas** para procesar tareas en segundo plano
- **Streaming de respuestas** para experiencias en tiempo real
- **Rastreo automático de costos** con dashboard integrado
- **Logging detallado** de cada interacción con APIs de IA

Es la herramienta ideal si construyes SaaS, plataformas de análisis o cualquier aplicación que necesite IA a escala.

## Instalación y Configuración

Primero, instala el paquete mediante Composer:

```bash
composer require fomvasss/laravel-ai-tasks
```

Publica la configuración y migraciones:

```bash
php artisan vendor:publish --provider="Fomvasss\LaravelAiTasks\ServiceProvider"
php artisan migrate
```

Configura tu API key en el archivo `.env`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=claude-...
```

Actualiza el archivo de configuración `config/ai-tasks.php`:

```php
return [
    'default_provider' => 'openai',
    
    'providers' => [
        'openai' => [
            'driver' => 'openai',
            'key' => env('OPENAI_API_KEY'),
        ],
        'anthropic' => [
            'driver' => 'anthropic',
            'key' => env('ANTHROPIC_API_KEY'),
        ],
    ],
    
    'queue' => env('QUEUE_CONNECTION', 'redis'),
    
    'logging' => [
        'enabled' => true,
        'track_costs' => true,
    ],
];
```

## Crear tu Primera Tarea de IA

Las tareas en Laravel AI Tasks se definen como clases que extienden `AiTask`. Vamos a crear una tarea para resumir artículos:

```bash
php artisan make:ai-task SummarizeArticleTask
```

Esto genera un archivo en `app/AiTasks/SummarizeArticleTask.php`:

```php
<?php

namespace App\AiTasks;

use Fomvasss\LaravelAiTasks\AiTask;
use Illuminate\Contracts\Queue\ShouldQueue;

class SummarizeArticleTask extends AiTask implements ShouldQueue
{
    protected string $model = 'gpt-4o-mini';
    
    protected int $maxTokens = 500;
    
    protected float $temperature = 0.3;
    
    public function __construct(
        protected string $articleContent,
        protected string $language = 'es'
    ) {}
    
    public function prompt(): string
    {
        return <<<PROMPT
            Resumen el siguiente artículo en {$this->language} de forma concisa.
            
            Artículo:
            {$this->articleContent}
            
            Proporciona un resumen de máximo 3 párrafos.
        PROMPT;
    }
    
    public function onSuccess($result): void
    {
        // Procesar resultado exitoso
        logger()->info('Artículo resumido correctamente', [
            'result' => $result,
            'cost' => $this->getCost(),
        ]);
    }
    
    public function onFailure(\Throwable $exception): void
    {
        // Manejar errores
        logger()->error('Error al resumir artículo', [
            'error' => $exception->getMessage(),
        ]);
    }
}
```

## Ejecutar Tareas Síncronamente y en Colas

### Ejecución Síncrona

Para tareas pequeñas y rápidas:

```php
<?php

namespace App\Http\Controllers;

use App\AiTasks\SummarizeArticleTask;

class ArticleController extends Controller
{
    public function summarize()
    {
        $article = "Lorem ipsum dolor sit amet...";
        
        $task = new SummarizeArticleTask($article, 'es');
        $summary = $task->execute();
        
        return response()->json([
            'summary' => $summary,
            'cost' => $task->getCost(),
        ]);
    }
}
```

### Ejecución en Colas

Para tareas que pueden procesarse en background:

```php
<?php

namespace App\Http\Controllers;

use App\AiTasks\SummarizeArticleTask;
use App\Models\Article;

class ArticleController extends Controller
{
    public function summarizeInQueue(Article $article)
    {
        // Despacha la tarea a la cola
        dispatch(new SummarizeArticleTask($article->content, 'es'))
            ->onQueue('ai-tasks')
            ->delay(now()->addMinutes(1));
        
        return response()->json([
            'message' => 'Tarea despachada para procesamiento',
        ]);
    }
}
```

## Streaming de Respuestas

Para obtener respuestas en tiempo real sin esperar a que termine:

```php
<?php

namespace App\AiTasks;

use Fomvasss\LaravelAiTasks\AiTask;

class AnalyzeSentimentTask extends AiTask
{
    protected string $model = 'gpt-4o-mini';
    
    protected bool $stream = true;
    
    public function __construct(protected string $text) {}
    
    public function prompt(): string
    {
        return "Analiza el sentimiento de: {$this->text}";
    }
}
```

En tu controlador:

```php
<?php

use App\AiTasks\AnalyzeSentimentTask;
use Symfony\Component\HttpFoundation\StreamedResponse;

public function analyzeStream()
{
    $task = new AnalyzeSentimentTask("Este producto es excelente!");
    
    return new StreamedResponse(function () use ($task) {
        $task->stream(function (string $chunk) {
            echo $chunk;
            flush();
        });
    });
}
```

## Rastreo y Control de Costos

Laravel AI Tasks calcula automáticamente el costo de cada llamada a API. Accede a estos datos:

```php
<?php

use App\AiTasks\SummarizeArticleTask;
use App\Models\AiTaskLog;

class DashboardController extends Controller
{
    public function costs()
    {
        // Costo total hoy
        $todayCost = AiTaskLog::whereDate('created_at', today())
            ->sum('cost_usd');
        
        // Costo por modelo
        $costByModel = AiTaskLog::select('model')
            ->selectRaw('SUM(cost_usd) as total_cost')
            ->selectRaw('COUNT(*) as executions')
            ->whereDate('created_at', today())
            ->groupBy('model')
            ->get();
        
        // Tareas más caras
        $expensiveTasks = AiTaskLog::orderByDesc('cost_usd')
            ->limit(10)
            ->get();
        
        return view('dashboard.ai-costs', [
            'today_cost' => $todayCost,
            'cost_by_model' => $costByModel,
            'expensive_tasks' => $expensiveTasks,
        ]);
    }
}
```

## Dashboard Integrado

Laravel AI Tasks incluye un dashboard web. Regístralo en tus rutas:

```php
<?php

use Fomvasss\LaravelAiTasks\Http\Controllers\DashboardController;

Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/ai-tasks/dashboard', [DashboardController::class, 'index'])
        ->name('ai-tasks.dashboard');
    
    Route::get('/ai-tasks/logs', [DashboardController::class, 'logs'])
        ->name('ai-tasks.logs');
    
    Route::get('/ai-tasks/costs', [DashboardController::class, 'costs'])
        ->name('ai-tasks.costs');
});
```

Accede a: `http://tu-app.com/ai-tasks/dashboard`

## Tareas Personalizadas Avanzadas

Crea una tarea reutilizable para generar imágenes:

```php
<?php

namespace App\AiTasks;

use Fomvasss\LaravelAiTasks\AiTask;

class GenerateImageTask extends AiTask
{
    protected string $model = 'dall-e-3';
    
    protected string $provider = 'openai';
    
    public function __construct(
        protected string $prompt,
        protected string $size = '1024x1024',
        protected int $quantity = 1
    ) {}
    
    public function execute()
    {
        // Usa directamente el SDK de Laravel AI
        $response = $this->client()->image()
            ->generate([
                'model' => $this->model,
                'prompt' => $this->prompt,
                'size' => $this->size,
                'n' => $this->quantity,
            ]);
        
        return $response;
    }
    
    public function getCost(): float
    {
        // Calcula costo manualmente si es necesario
        return match ($this->size) {
            '1024x1024' => 0.04 * $this->quantity,
            '1024x1792', '1792x1024' => 0.08 * $this->quantity,
            default => 0.02,
        };
    }
}
```

Úsala:

```php
<?php

$task = new GenerateImageTask(
    prompt: "A futuristic AI assistant visualizing data",
    size: "1024x1024",
    quantity: 1
);

$images = $task->execute();

foreach ($images['data'] as $image) {
    logger()->info('Imagen generada', ['url' => $image['url']]);
}
```

## Monitoreo de Límites de Presupuesto

Crea middleware para prevenir sobrecostos:

```php
<?php

namespace App\Services;

use App\Models\AiTaskLog;
use Exception;

class AiCostLimiter
{
    protected float $dailyLimit = 10.00; // $10 diarios
    
    public function checkLimit(): void
    {
        $spent = AiTaskLog::whereDate('created_at', today())
            ->sum('cost_usd');
        
        if ($spent >= $this->dailyLimit) {
            throw new Exception(
                "Límite diario de costos alcanzado: \${$spent}"
            );
        }
    }
    
    public function getRemainingBudget(): float
    {
        $spent = AiTaskLog::whereDate('created_at', today())
            ->sum('cost_usd');
        
        return max(0, $this->dailyLimit - $spent);
    }
}
```

Úsalo en tus controladores:

```php
<?php

public function summarize()
{
    $limiter = app(AiCostLimiter::class);
    $limiter->checkLimit();
    
    $task = new SummarizeArticleTask($article);
    return $task->execute();
}
```

## Integración con Alertas

Configura notificaciones cuando los costos suben:

```php
<?php

namespace App\Listeners;

use App\Models\AiTaskLog;
use App\Notifications\HighAiCostAlert;
use Illuminate\Notifications\Notification;

class MonitorAiCosts
{
    public function handle(AiTaskLog $log)
    {
        $dailyCost = AiTaskLog::whereDate('created_at', today())
            ->sum('cost_usd');
        
        if ($dailyCost >= 5.00) { // Alerta a los $5
            auth()->user()->notify(new HighAiCostAlert($dailyCost));
        }
    }
}
```

## Mejores Prácticas

1. **Usa modelos económicos**: Prefiere `gpt-4o-mini` sobre `gpt-4` para tareas simples
2. **Implementa cachés**: Guarda resultados de IA para evitar llamadas repetidas
3. **Batch processing**: Agrupa múltiples tareas en una sola llamada
4. **Monitorea regularmente**: Revisa el dashboard semanal
5. **Establece límites**: Define presupuestos por usuario y por día

## Puntos Clave

- **Laravel AI Tasks** envuelve el Laravel AI SDK con características empresariales de control de costos
- **Crea tareas reutilizables** extendiendo la clase `AiTask` con lógica encapsulada
- **Ejecuta en colas** para procesar IA en background sin bloquear requests
- **Streaming** permite respuestas en tiempo real sin esperar que termine el procesamiento
- **Rastreo automático de costos** con cálculos por modelo y proveedor
- **Dashboard integrado** para monitorear gastos, logs y ejecuciones
- **Límites de presupuesto** previenen sorpresas en tu factura de APIs
- **Alertas automáticas** notifican cuando los costos exceden umbrales
- Compatible con OpenAI, Anthropic, Google AI y otros proveedores
- Ideal para SaaS y plataformas que monetizan características de IA