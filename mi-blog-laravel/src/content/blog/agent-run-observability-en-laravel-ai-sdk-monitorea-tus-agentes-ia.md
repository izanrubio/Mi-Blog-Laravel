---
title: 'Agent Run Observability en Laravel AI SDK: Monitorea tus Agentes IA'
description: 'Aprende a monitorear agentes IA en Laravel con eventos de ejecución, llamadas a herramientas y failover automático en el AI SDK 0.11'
pubDate: '2026-08-23'
tags: ['laravel', 'ai', 'observability', 'events']
---

## Agent Run Observability en Laravel AI SDK: Monitorea tus Agentes IA

Los agentes de IA están revolucionando cómo automatizamos tareas en Laravel, pero sin visibilidad sobre lo que están haciendo, es imposible depurar problemas, optimizar costos o garantizar que funcionan correctamente. El Laravel AI SDK 0.11 introduce **Agent Run Observability**, permitiéndote observar cada paso que ejecuta tu agente IA con eventos granulares, búsqueda de herramientas alojadas y failover automático entre proveedores.

En este artículo aprenderás a implementar observabilidad completa en tus agentes IA y cómo usar esta información para debugging, logging y optimización en producción.

## ¿Qué es Agent Run Observability?

**Agent Run Observability** es la capacidad de escuchar y registrar cada evento que ocurre durante la ejecución de un agente IA. Esto incluye:

- **Pasos del agente** (agent steps): cada decisión que toma
- **Llamadas a herramientas** (tool calls): cuando el agente invoca funciones externas
- **Eventos de finalización**: cuándo termina la ejecución
- **Mensajes del modelo**: qué comunica el LLM en cada momento

Sin esta visibilidad, trabajar con agentes IA es como navegar a ciegas. No sabes si tu agente está tomando las decisiones correctas, qué herramientas está usando o dónde está fallando.

## Configuración Básica del AI SDK

Primero, asegúrate de tener instalado el Laravel AI SDK 0.11 o superior:

```bash
composer require laravel/ai:^0.11
```

Luego, configura tu proveedor IA en el archivo `.env`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

En `config/ai.php`, registra tus proveedores:

```php
return [
    'default' => env('AI_DRIVER', 'openai'),
    
    'drivers' => [
        'openai' => [
            'api_key' => env('OPENAI_API_KEY'),
        ],
        'anthropic' => [
            'api_key' => env('ANTHROPIC_API_KEY'),
        ],
    ],
];
```

## Escuchando Eventos de Ejecución del Agente

El verdadero poder de la observabilidad viene de los eventos. Registra listeners para capturar cada momento importante:

```php
use Laravel\AI\Events\AgentStepStarted;
use Laravel\AI\Events\AgentStepFinished;
use Laravel\AI\Events\ToolCallStarted;
use Laravel\AI\Events\ToolCallFinished;
use Laravel\AI\Events\AgentFinished;

// En tu EventServiceProvider
public function boot()
{
    Event::listen(AgentStepStarted::class, function (AgentStepStarted $event) {
        \Log::info('Agent step started', [
            'agent_id' => $event->run->id,
            'step' => $event->step,
            'iteration' => $event->iteration,
        ]);
    });

    Event::listen(ToolCallStarted::class, function (ToolCallStarted $event) {
        \Log::info('Tool call started', [
            'tool' => $event->toolName,
            'arguments' => $event->arguments,
        ]);
    });

    Event::listen(ToolCallFinished::class, function (ToolCallFinished $event) {
        \Log::info('Tool call finished', [
            'tool' => $event->toolName,
            'result' => $event->result,
            'duration_ms' => $event->duration,
        ]);
    });

    Event::listen(AgentFinished::class, function (AgentFinished $event) {
        \Log::info('Agent finished', [
            'agent_id' => $event->run->id,
            'steps' => $event->run->steps,
            'total_duration' => $event->run->duration,
        ]);
    });
}
```

## Crear un Agente con Herramientas Observables

Aquí te muestro cómo crear un agente práctico que podemos monitorear completamente:

```php
use Laravel\AI\Agent;
use Laravel\AI\Tool;

// En un controlador o service
public function createResearchAgent()
{
    $agent = Agent::make('research-agent')
        ->using('openai')
        ->withModel('gpt-4')
        ->withInstructions(
            'You are a research assistant. ' .
            'Search for information, analyze it, and provide comprehensive reports.'
        )
        ->withTools([
            Tool::define('search_knowledge_base')
                ->description('Search our internal knowledge base')
                ->parameter('query', 'string', 'Search query')
                ->callable(function (string $query) {
                    \Log::info("KB Search: {$query}");
                    // Busca en tu base de datos o API
                    return \App\Models\KnowledgeBase::search($query)->get();
                }),

            Tool::define('fetch_external_data')
                ->description('Fetch data from external APIs')
                ->parameter('endpoint', 'string', 'API endpoint')
                ->callable(function (string $endpoint) {
                    \Log::info("External API: {$endpoint}");
                    return \Http::get($endpoint)->json();
                }),

            Tool::define('generate_summary')
                ->description('Generate a summary from collected data')
                ->parameter('data', 'string', 'Data to summarize')
                ->callable(function (string $data) {
                    \Log::info("Generating summary");
                    return \Str::limit($data, 200);
                }),
        ]);

    return $agent;
}
```

## Ejecutar el Agente y Capturar Eventos

```php
use Laravel\AI\Facades\AI;

// En un comando o job
public function executeResearch(string $topic)
{
    $agent = $this->createResearchAgent();

    try {
        $result = $agent->run("Research the latest trends in {$topic}");

        \Log::info('Research completed', [
            'topic' => $topic,
            'result' => $result->content,
        ]);

        return $result;
    } catch (\Exception $e) {
        \Log::error('Agent failed', [
            'error' => $e->getMessage(),
            'topic' => $topic,
        ]);

        throw $e;
    }
}
```

## Búsqueda de Herramientas Alojadas

Una característica nueva en el AI SDK 0.11 es la **búsqueda de herramientas alojadas**. Esto permite que los modelos descubran automáticamente herramientas disponibles sin declararlas manualmente:

```php
$agent = Agent::make('smart-agent')
    ->using('openai')
    ->withModel('gpt-4')
    ->withHostedTools('https://your-api.com/tools')
    ->withInstructions(
        'Use available tools to complete tasks. ' .
        'Tools are discoverable at runtime.'
    );

// OpenAI y Anthropic descubrirán automáticamente:
// - POST /tools (lista de herramientas disponibles)
// - POST /tools/{name}/execute (ejecuta una herramienta)
```

## Implementar Failover Automático

El failover entre proveedores es crítico en producción. El AI SDK 0.11 lo simplifica:

```php
$agent = Agent::make('resilient-agent')
    ->using(['openai', 'anthropic']) // Orden de fallback
    ->withModel('gpt-4')
    ->withInstructions('Complete the task using available providers.')
    ->onProviderFailure(function ($failedProvider, $exception) {
        \Log::warning("Provider failed: {$failedProvider}", [
            'error' => $exception->getMessage(),
        ]);
    });

// Si OpenAI falla, automáticamente intenta Anthropic
$result = $agent->run("Your task here");
```

## Logging Avanzado con Middleware de Observabilidad

Crea middleware personalizado para capturar métricas detalladas:

```php
namespace App\Middleware;

use Laravel\AI\Events\AgentStepStarted;
use Laravel\AI\Events\ToolCallStarted;

class AgentObservabilityMiddleware
{
    private $agentMetrics = [];

    public function __construct()
    {
        $this->registerListeners();
    }

    private function registerListeners()
    {
        \Event::listen(AgentStepStarted::class, function ($event) {
            $runId = $event->run->id;
            
            if (!isset($this->agentMetrics[$runId])) {
                $this->agentMetrics[$runId] = [
                    'start_time' => microtime(true),
                    'steps' => [],
                    'tools_used' => [],
                ];
            }

            $this->agentMetrics[$runId]['steps'][] = [
                'number' => $event->iteration,
                'timestamp' => now(),
            ];
        });

        \Event::listen(ToolCallStarted::class, function ($event) {
            $runId = $event->run->id;
            
            if (isset($this->agentMetrics[$runId])) {
                if (!isset($this->agentMetrics[$runId]['tools_used'][$event->toolName])) {
                    $this->agentMetrics[$runId]['tools_used'][$event->toolName] = 0;
                }
                $this->agentMetrics[$runId]['tools_used'][$event->toolName]++;
            }
        });
    }

    public function getMetrics($runId)
    {
        return $this->agentMetrics[$runId] ?? null;
    }
}
```

## Almacenar Ejecuciones para Auditoría

Es crucial guardar un registro de cada ejecución de agente para auditoría y debugging:

```php
// Crear modelo para registrar ejecuciones
php artisan make:model AgentRun -m

// En la migración
Schema::create('agent_runs', function (Blueprint $table) {
    $table->id();
    $table->uuid('run_id')->unique();
    $table->string('agent_name');
    $table->string('model');
    $table->json('instructions');
    $table->json('tools_used')->nullable();
    $table->longText('input');
    $table->longText('output')->nullable();
    $table->integer('total_steps');
    $table->integer('duration_ms');
    $table->string('status')->default('pending'); // pending, completed, failed
    $table->text('error')->nullable();
    $table->timestamps();
});

// Listener para guardar automáticamente
class SaveAgentRun
{
    public function handle(AgentFinished $event)
    {
        \App\Models\AgentRun::create([
            'run_id' => $event->run->id,
            'agent_name' => $event->run->agent,
            'model' => $event->run->model,
            'tools_used' => $event->run->getToolsUsed(),
            'output' => $event->run->output,
            'total_steps' => count($event->run->steps),
            'duration_ms' => $event->run->duration,
            'status' => 'completed',
        ]);
    }
}
```

## Dashboard de Observabilidad

Crea una ruta para visualizar las ejecuciones:

```php
// routes/web.php
Route::get('/agent-runs', function () {
    $runs = \App\Models\AgentRun::latest()
        ->paginate(15);

    return view('agent-runs.index', [
        'runs' => $runs,
        'totalDuration' => $runs->sum('duration_ms'),
        'successRate' => $runs->where('status', 'completed')->count() / $runs->count(),
    ]);
});

// resources/views/agent-runs/index.blade.php
@foreach ($runs as $run)
    <tr>
        <td>{{ $run->run_id }}</td>
        <td>{{ $run->agent_name }}</td>
        <td>{{ $run->model }}</td>
        <td>{{ $run->total_steps }} pasos</td>
        <td>{{ $run->duration_ms }}ms</td>
        <td>
            <span class="badge badge-{{ $run->status === 'completed' ? 'success' : 'danger' }}">
                {{ $run->status }}
            </span>
        </td>
    </tr>
@endforeach
```

## Mejores Prácticas de Observabilidad

### 1. **Usa IDs de Correlación**

```php
$correlationId = \Str::uuid();

\Log::withContext([
    'correlation_id' => $correlationId,
]);

$agent->run($task);
```

### 2. **Monitorea Costos de API**

```php
Event::listen(AgentFinished::class, function ($event) {
    $cost = $event->run->tokensUsed * 0.002; // Precio por token
    
    \Log::info('Agent cost', ['cost' => $cost]);
});
```

### 3. **Implementa Rate Limiting**

```php
Event::listen(ToolCallStarted::class, function ($event) {
    \Cache::remember(
        "tool:{$event->toolName}",
        60,
        fn () => 0
    );

    if (\Cache::increment("tool:{$event->toolName}") > 100) {
        throw new \Exception('Rate limit exceeded');
    }
});
```

### 4. **Usa Structured Logging**

```php
\Log::info('Agent execution', [
    'run_id' => $event->run->id,
    'agent' => $event->run->agent,
    'model' => $event->run->model,
    'steps' => $event->run->steps,
    'duration' => $event->run->duration,
    'status' => 'completed',
]);
```

## Conclusión

Agent Run Observability en el Laravel AI SDK 0.11 transforma cómo trabajas con agentes IA. Al escuchar eventos granulares, registrar métricas y implementar failover automático, puedes construir sistemas IA robustos, confiables y auditables.

La combinación de eventos de ejecución, búsqueda de herramientas alojadas y failover automático entre proveedores hace que sea mucho más fácil construir agentes IA resilientes en Laravel. Implementa estos patrones desde el inicio de tu proyecto para evitar problemas de visibilidad más adelante.

## Puntos Clave

- **Agent Run Observability** permite monitorear cada paso y herramienta que usa tu agente IA
- Los eventos granulares (`AgentStepStarted`, `ToolCallStarted`, `AgentFinished`) son esenciales para debugging y auditoría
- La **búsqueda de herramientas alojadas** simplifica la integración de APIs externas con auto-discovery
- El **failover automático** entre proveedores (OpenAI, Anthropic) mejora la resiliencia sin código adicional
- Implementa logging estructurado y almacenamiento de ejecuciones para auditoría en producción
- Monitorea costos, rate limits y métricas de desempeño usando listeners de eventos
- Un dashboard de observabilidad es crítico para visualizar y diagnost