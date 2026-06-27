---
title: 'Web Search en Agentes IA con Laravel: Búsqueda en Vivo'
description: 'Integra búsqueda web en vivo en tus agentes IA con Laravel. Guía completa con WebSearch tools y dominios de confianza para respuestas actualizadas.'
pubDate: '2026-06-21'
tags: ['laravel', 'ia', 'agentes', 'websearch']
---

## Web Search en Agentes IA con Laravel: Búsqueda en Vivo

Los agentes de IA son herramientas poderosas para automatizar tareas complejas, pero tienen una limitación fundamental: su conocimiento se detiene en la fecha de entrenamiento. Si necesitas que tu agente responda preguntas sobre eventos actuales, precios en tiempo real o información que cambia constantemente, una base de conocimiento estática no es suficiente.

En este artículo, exploraremos cómo integrar búsqueda web en vivo en tus agentes IA dentro de Laravel, permitiendo que accedan a información actualizada mientras mantienen control y seguridad sobre qué dominios pueden consultar.

## El Problema: Conocimiento Obsoleto en Agentes IA

Imagina que has construido un asistente de servicio al cliente que puede responder preguntas sobre tu empresa. Tu base de conocimiento contiene información sobre políticas de envío, horarios, y productos disponibles. Todo funciona bien hasta que:

- Un cliente pregunta: "¿Cuál es el estado actual de mi pedido?"
- Tu agente responde desde la base de conocimiento, pero no tiene acceso a datos en tiempo real
- El cliente queda insatisfecho

O peor aún:

- Un cliente pregunta: "¿Cuánto cuesta el envío a Barcelona hoy?"
- Tu agente no puede acceder a tasas de envío actualizadas
- Proporciona información obsoleta

Aquí es donde entra la búsqueda web: extender los agentes IA con herramientas que les permitan consultar información actualizada en tiempo real.

## Conceptos Clave: Tools en Agentes IA

Un agente IA funciona con "herramientas" (tools) que puede usar para completar tareas. Estas herramientas son funciones que el agente puede llamar cuando las necesita. Las herramientas comunes incluyen:

- **Knowledge Base Tool**: Consulta tu documentación interna
- **Database Tool**: Accede a datos de tu aplicación
- **Web Search Tool**: Busca información en internet
- **API Tool**: Llama endpoints específicos

Las herramientas se definen con un esquema JSON que describe:
- Qué hace la herramienta
- Qué parámetros acepta
- Qué retorna

Cuando el agente necesita resolver una tarea, decide qué herramientas usar y en qué orden.

## Implementar Web Search en Laravel

### Paso 1: Crear la Herramienta de Búsqueda Web

Primero, crearemos una clase que encapsule la lógica de búsqueda web:

```php
<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;

class WebSearchTool
{
    private array $allowedDomains = [
        'wikipedia.org',
        'stackoverflow.com',
        'github.com',
        'laravel.com',
        'php.net',
        'weather.com',
        'news.google.com',
    ];

    public function search(string $query): array
    {
        // Validar que la búsqueda sea segura
        if (strlen($query) > 500) {
            return [
                'error' => 'Consulta demasiado larga',
                'results' => [],
            ];
        }

        try {
            $response = Http::timeout(10)
                ->get('https://api.search.brave.com/res/v1/web/search', [
                    'q' => $query,
                    'count' => 5,
                    'key' => config('services.brave_search.key'),
                ])
                ->json();

            if (!isset($response['web'])) {
                return ['results' => []];
            }

            $filtered = collect($response['web'])
                ->map(fn($result) => [
                    'title' => $result['title'] ?? null,
                    'url' => $result['url'] ?? null,
                    'description' => $result['description'] ?? null,
                ])
                ->filter(fn($item) => $this->isDomainAllowed($item['url']))
                ->take(3)
                ->values()
                ->toArray();

            return [
                'results' => $filtered,
                'query' => $query,
            ];
        } catch (\Exception $e) {
            return [
                'error' => 'No se pudo realizar la búsqueda',
                'results' => [],
            ];
        }
    }

    private function isDomainAllowed(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        
        foreach ($this->allowedDomains as $domain) {
            if (str_ends_with($host, $domain)) {
                return true;
            }
        }

        return false;
    }

    public function getDefinition(): array
    {
        return [
            'name' => 'web_search',
            'description' => 'Busca información actualizada en internet sobre un tema específico',
            'parameters' => [
                'type' => 'object',
                'properties' => [
                    'query' => [
                        'type' => 'string',
                        'description' => 'La consulta de búsqueda (máximo 500 caracteres)',
                    ],
                ],
                'required' => ['query'],
            ],
        ];
    }
}
```

### Paso 2: Configurar las Variables de Entorno

Añade tus credenciales de API en `.env`:

```env
BRAVE_SEARCH_KEY=tu_clave_api_aqui
AI_ALLOWED_DOMAINS=wikipedia.org,stackoverflow.com,github.com,laravel.com,php.net
AI_MAX_SEARCH_RESULTS=3
AI_SEARCH_TIMEOUT=10
```

### Paso 3: Crear el Agente IA con Herramienta de Búsqueda

Ahora crearemos un agente que pueda usar la herramienta de búsqueda:

```php
<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\Http;

class AIAgent
{
    private WebSearchTool $webSearchTool;
    private string $apiKey;
    private string $model = 'gpt-4o-mini';

    public function __construct()
    {
        $this->webSearchTool = new WebSearchTool();
        $this->apiKey = config('services.openai.api_key');
    }

    public function chat(string $message, array $context = []): string
    {
        $messages = $this->buildMessages($message, $context);
        $tools = $this->getAvailableTools();

        $response = Http::withToken($this->apiKey)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $this->model,
                'messages' => $messages,
                'tools' => $tools,
                'tool_choice' => 'auto',
                'max_tokens' => 4096,
            ])
            ->json();

        return $this->processResponse($response, $messages);
    }

    private function buildMessages(string $message, array $context): array
    {
        $systemMessage = "Eres un asistente útil y preciso. Tienes acceso a una herramienta de búsqueda web. "
            . "Úsala cuando necesites información actualizada o que cambia frecuentemente. "
            . "Siempre cita tus fuentes cuando uses resultados de búsqueda.";

        $messages = [
            [
                'role' => 'system',
                'content' => $systemMessage,
            ],
        ];

        if (!empty($context)) {
            $messages[] = [
                'role' => 'user',
                'content' => "Contexto: " . json_encode($context),
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $message,
        ];

        return $messages;
    }

    private function getAvailableTools(): array
    {
        return [
            [
                'type' => 'function',
                'function' => $this->webSearchTool->getDefinition(),
            ],
        ];
    }

    private function processResponse(array $response, array &$messages): string
    {
        $assistantMessage = $response['choices'][0]['message'];
        $messages[] = $assistantMessage;

        // Verificar si el modelo quiere usar una herramienta
        if ($assistantMessage['role'] === 'assistant' 
            && isset($assistantMessage['tool_calls'])) {
            
            foreach ($assistantMessage['tool_calls'] as $toolCall) {
                if ($toolCall['function']['name'] === 'web_search') {
                    $args = json_decode($toolCall['function']['arguments'], true);
                    $searchResult = $this->webSearchTool->search($args['query']);
                    
                    // Agregar resultado a los mensajes
                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $toolCall['id'],
                        'content' => json_encode($searchResult),
                    ];
                }
            }

            // Hacer otra llamada con los resultados de la búsqueda
            $finalResponse = Http::withToken($this->apiKey)
                ->post('https://api.openai.com/v1/chat/completions', [
                    'model' => $this->model,
                    'messages' => $messages,
                    'max_tokens' => 2048,
                ])
                ->json();

            return $finalResponse['choices'][0]['message']['content'];
        }

        return $assistantMessage['content'] ?? '';
    }
}
```

### Paso 4: Usar el Agente en tu Controlador

```php
<?php

namespace App\Http\Controllers;

use App\Services\AI\AIAgent;
use Illuminate\Http\Request;

class ChatController extends Controller
{
    private AIAgent $agent;

    public function __construct(AIAgent $agent)
    {
        $this->agent = $agent;
    }

    public function ask(Request $request)
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'context' => 'nullable|array',
        ]);

        $response = $this->agent->chat(
            $validated['message'],
            $validated['context'] ?? []
        );

        return response()->json([
            'response' => $response,
            'timestamp' => now(),
        ]);
    }
}
```

## Configurar Dominios de Confianza

La seguridad es crítica cuando permites que tus agentes accedan a internet. Implementa una lista blanca robusta:

```php
<?php

namespace App\Services\AI;

class DomainWhitelist
{
    private array $trustedDomains;
    private array $blockedPatterns;

    public function __construct()
    {
        $this->trustedDomains = config('ai.trusted_domains', [
            'wikipedia.org',
            'laravel.com',
            'stackoverflow.com',
        ]);

        $this->blockedPatterns = [
            '/localhost/',
            '/127\.0\.0\.1/',
            '/internal\.company\.net/',
            '/admin\./i',
            '/private\./i',
        ];
    }

    public function isAllowed(string $url): bool
    {
        $host = parse_url($url, PHP_URL_HOST);
        
        if (!$host) {
            return false;
        }

        // Verificar patrones bloqueados
        foreach ($this->blockedPatterns as $pattern) {
            if (preg_match($pattern, $host)) {
                return false;
            }
        }

        // Verificar lista blanca
        foreach ($this->trustedDomains as $domain) {
            if (str_ends_with($host, $domain)) {
                return true;
            }
        }

        return false;
    }

    public function addDomain(string $domain): void
    {
        if (!in_array($domain, $this->trustedDomains)) {
            $this->trustedDomains[] = $domain;
        }
    }

    public function removeDomain(string $domain): void
    {
        $this->trustedDomains = array_filter(
            $this->trustedDomains,
            fn($d) => $d !== $domain
        );
    }
}
```

## Monitoreo y Rate Limiting

Implementa controles para evitar abusos:

```php
<?php

namespace App\Services\AI;

use Illuminate\Support\Facades\RateLimiter;

class SearchRateLimiter
{
    public function allowSearch(string $userId, string $query): bool
    {
        $key = "ai-search:{$userId}";
        
        // Máximo 10 búsquedas por minuto por usuario
        return RateLimiter::attempt(
            $key,
            $perMinute = 10,
            fn() => true
        );
    }

    public function logSearch(string $userId, string $query, array $results): void
    {
        \DB::table('ai_search_logs')->insert([
            'user_id' => $userId,
            'query' => $query,
            'results_count' => count($results),
            'created_at' => now(),
        ]);
    }
}
```

## Mejores Prácticas

### Caché de Resultados

```php
public function search(string $query): array
{
    return \Cache::remember(
        "websearch:{$query}",
        minutes: 60,
        callback: fn() => $this->performSearch($query)
    );
}
```

### Manejo de Errores

```php
try {
    $response = $this->agent->chat($message);
} catch (\Throwable $e) {
    \Log::error('AI Agent Error', [
        'message' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
    ]);
    
    return response()->json([
        'error' => 'El agente no pudo procesar tu solicitud',
    ], 500);
}
```

### Testing

```php
<?php

namespace Tests\Feature;

use App\Services\AI\WebSearchTool;
use Tests\TestCase;

class WebSearchToolTest extends TestCase
{
    public function test_filters_results_by_allowed_domains()
    {
        $tool = new WebSearchTool();
        $results = $tool->search('Laravel database');
        
        foreach ($results['results'] as $result) {
            $this->assertTrue($tool->isDomainAllowed($result['url']));
        }
    }

    public function test_limits_query_length()
    {
        $tool = new WebSearchTool();
        $longQuery = str_repeat('a', 600);
        
        $results = $tool->search($longQuery);
        
        $this->assertArrayHasKey('error', $results);
    }
}
```

## Casos de Uso Reales

1. **Soporte al Cliente**: Agentes que buscan información de soporte actualizada
2. **Análisis de Precios**: Comparar precios en tiempo real
3. **Noticias y Tendencias**: Proporcionar información sobre eventos actuales
4. **Monitoreo de Competencia**: Seguimiento de cambios en sitios competidores
5. **Investigación Técnica**: Buscar soluciones a problemas de programación

## Puntos Clave

- Los agentes