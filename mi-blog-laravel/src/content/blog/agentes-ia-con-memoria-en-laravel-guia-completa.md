---
title: 'Agentes IA con Memoria en Laravel: Guía Completa'
description: 'Crea agentes IA persistentes en Laravel que recuerden conversaciones. Implementa memoria conversacional, contexto y estado con patrones escalables.'
pubDate: '2025-04-18'
tags: ['laravel', 'ia', 'agentes', 'memoria', 'diseño']
---

## Agentes IA con Memoria en Laravel: Implementa Conversaciones Persistentes

Los agentes de inteligencia artificial están revolucionando cómo interactuamos con nuestras aplicaciones. Sin embargo, un problema crítico emerge rápidamente: **los agentes olvidan**. Un usuario pregunta sobre su pedido número 1042, realiza un seguimiento con "¿puedo devolverlo?", y el agente no tiene contexto. Esto destruye la experiencia del usuario.

En este artículo aprenderás a construir agentes IA con memoria persistente en Laravel, manteniendo el contexto conversacional entre interacciones. Exploraremos patrones de diseño, almacenamiento de estado y mejores prácticas para producción.

## El Problema: Agentes Amnésicos

Los modelos de IA como GPT no tienen memoria inherente. Cada solicitud es independiente. Para un usuario final, esto se traduce en:

- Preguntas que requieren reexplicación constantemente
- Pérdida de contexto entre turnos de conversación
- Incapacidad para acceder a datos históricos o preferencias
- Experiencia frustrada y poco natural

La solución es implementar un **sistema de memoria conversacional** que almacene contexto entre interacciones.

## Arquitectura de Memoria Conversacional

Necesitamos tres componentes principales:

1. **Almacenamiento de Conversaciones**: Persistencia de mensajes e historiales
2. **Recuperación de Contexto**: Obtener información relevante rápidamente
3. **Gestión de Estado**: Mantener el estado del agente entre solicitudes

### Estructura Base del Modelo

Comencemos con una estructura de base de datos para almacenar conversaciones:

```php
// database/migrations/2025_04_18_create_conversations_table.php
Schema::create('conversations', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('agent_type')->default('default');
    $table->json('metadata')->nullable();
    $table->timestamp('last_activity_at');
    $table->timestamps();
    $table->index(['user_id', 'created_at']);
});

Schema::create('conversation_messages', function (Blueprint $table) {
    $table->id();
    $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
    $table->enum('role', ['user', 'assistant', 'system']);
    $table->longText('content');
    $table->json('context')->nullable();
    $table->integer('tokens')->nullable();
    $table->timestamps();
    $table->index(['conversation_id', 'created_at']);
});

Schema::create('agent_memories', function (Blueprint $table) {
    $table->id();
    $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
    $table->string('key');
    $table->json('value');
    $table->timestamp('expires_at')->nullable();
    $table->timestamps();
    $table->unique(['conversation_id', 'key']);
});
```

## Modelos Eloquent para Conversaciones

```php
// app/Models/Conversation.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Conversation extends Model
{
    protected $fillable = ['user_id', 'agent_type', 'metadata'];
    protected $casts = ['metadata' => 'array'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(ConversationMessage::class)
            ->orderBy('created_at', 'asc');
    }

    public function memories(): HasMany
    {
        return $this->hasMany(AgentMemory::class);
    }

    public function addMessage(
        string $role,
        string $content,
        ?array $context = null
    ): ConversationMessage {
        return $this->messages()->create([
            'role' => $role,
            'content' => $content,
            'context' => $context,
        ]);
    }

    public function getRecentMessages(int $limit = 10): array
    {
        return $this->messages()
            ->latest('created_at')
            ->limit($limit)
            ->get()
            ->map(fn ($msg) => [
                'role' => $msg->role,
                'content' => $msg->content,
            ])
            ->reverse()
            ->values()
            ->all();
    }

    public function rememberData(string $key, mixed $value, ?int $expiresInMinutes = null): void
    {
        $this->memories()->updateOrCreate(
            ['key' => $key],
            [
                'value' => $value,
                'expires_at' => $expiresInMinutes 
                    ? now()->addMinutes($expiresInMinutes)
                    : null,
            ]
        );
    }

    public function recall(string $key): mixed
    {
        $memory = $this->memories()
            ->where('key', $key)
            ->where(function ($query) {
                $query->whereNull('expires_at')
                    ->orWhere('expires_at', '>', now());
            })
            ->first();

        return $memory?->value;
    }

    public function updateActivity(): void
    {
        $this->update(['last_activity_at' => now()]);
    }
}
```

```php
// app/Models/ConversationMessage.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConversationMessage extends Model
{
    protected $fillable = ['conversation_id', 'role', 'content', 'context', 'tokens'];
    protected $casts = ['context' => 'array'];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function toApiFormat(): array
    {
        return [
            'role' => $this->role,
            'content' => $this->content,
        ];
    }
}
```

## Servicio de Agente IA con Memoria

Ahora crearemos el servicio central que gestiona la inteligencia artificial y la memoria:

```php
// app/Services/AIAgentService.php
namespace App\Services;

use App\Models\Conversation;
use OpenAI\Client;
use Illuminate\Support\Collection;

class AIAgentService
{
    public function __construct(
        private Client $openaiClient,
        private int $maxContextMessages = 15,
        private int $maxTokens = 2000,
    ) {}

    public function processMessage(
        Conversation $conversation,
        string $userMessage,
        ?array $tools = null
    ): string {
        // Guardar mensaje del usuario
        $conversation->addMessage('user', $userMessage);
        $conversation->updateActivity();

        // Construir contexto conversacional
        $messages = $this->buildContextMessages($conversation);

        // Construir instrucciones del sistema
        $systemPrompt = $this->buildSystemPrompt($conversation);

        // Llamar a OpenAI con contexto
        $response = $this->openaiClient->chat()->create([
            'model' => config('services.openai.model', 'gpt-4-turbo'),
            'messages' => array_merge(
                [['role' => 'system', 'content' => $systemPrompt]],
                $messages
            ),
            'max_tokens' => $this->maxTokens,
            'temperature' => 0.7,
            'tools' => $tools,
        ]);

        $assistantMessage = $response->choices[0]->message->content;

        // Guardar respuesta del asistente
        $conversation->addMessage('assistant', $assistantMessage);

        // Analizar y almacenar información importante
        $this->extractAndStoreMemories($conversation, $userMessage, $assistantMessage);

        return $assistantMessage;
    }

    private function buildContextMessages(Conversation $conversation): array
    {
        $recentMessages = $conversation->messages()
            ->latest('created_at')
            ->limit($this->maxContextMessages)
            ->get()
            ->reverse()
            ->values();

        return $recentMessages->map(fn ($msg) => [
            'role' => $msg->role,
            'content' => $msg->content,
        ])->all();
    }

    private function buildSystemPrompt(Conversation $conversation): string
    {
        $userInfo = $conversation->user;
        $savedMemories = $this->formatMemoriesForPrompt($conversation);

        $basePrompt = <<<PROMPT
Eres un asistente útil, amable y profesional. 
Tu objetivo es ayudar al usuario de manera precisa y eficiente.

Información del usuario:
- Nombre: {$userInfo->name}
- Email: {$userInfo->email}

Contexto previamente recordado:
{$savedMemories}

Sigue estas directrices:
1. Sé conciso pero completo
2. Si no sabes algo, admítelo
3. Usa el contexto previo para proporcionar respuestas más personalizadas
4. Mantén un tono profesional pero amable
PROMPT;

        return $basePrompt;
    }

    private function formatMemoriesForPrompt(Conversation $conversation): string
    {
        $memories = $conversation->memories()
            ->whereNull('expires_at')
            ->orWhere('expires_at', '>', now())
            ->get();

        if ($memories->isEmpty()) {
            return "No hay información previa almacenada.";
        }

        return $memories->map(function ($memory) {
            $value = is_array($memory->value) 
                ? json_encode($memory->value)
                : $memory->value;
            return "- {$memory->key}: {$value}";
        })->join("\n");
    }

    private function extractAndStoreMemories(
        Conversation $conversation,
        string $userMessage,
        string $assistantMessage
    ): void {
        // Extraer información importante usando patrones
        $this->extractOrderInfo($conversation, $userMessage);
        $this->extractPreferences($conversation, $userMessage);
        $this->extractDataPoints($conversation, $assistantMessage);
    }

    private function extractOrderInfo(Conversation $conversation, string $message): void
    {
        if (preg_match('/order\s*#?(\d{4,})/i', $message, $matches)) {
            $conversation->rememberData('current_order_id', $matches[1], 1440);
        }
    }

    private function extractPreferences(Conversation $conversation, string $message): void
    {
        if (preg_match('/prefer|like|want|need/i', $message)) {
            $preferences = $conversation->recall('preferences') ?? [];
            $preferences[] = [
                'mentioned_at' => now(),
                'context' => substr($message, 0, 200),
            ];
            $conversation->rememberData('preferences', $preferences);
        }
    }

    private function extractDataPoints(Conversation $conversation, string $message): void
    {
        // Extraer nombres, locaciones, fechas, etc.
        $conversation->rememberData(
            'last_assistant_response_length',
            strlen($message)
        );
    }

    public function getConversationHistory(Conversation $conversation): Collection
    {
        return $conversation->messages()
            ->orderBy('created_at', 'asc')
            ->get();
    }

    public function createNewConversation(
        int $userId,
        string $agentType = 'default'
    ): Conversation {
        return Conversation::create([
            'user_id' => $userId,
            'agent_type' => $agentType,
            'last_activity_at' => now(),
        ]);
    }
}
```

## Controlador para Interacciones del Agente

```php
// app/Http/Controllers/AIAgentController.php
namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Services\AIAgentService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AIAgentController extends Controller
{
    public function __construct(private AIAgentService $agentService) {}

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'conversation_id' => 'nullable|integer|exists:conversations,id',
        ]);

        $conversation = $validated['conversation_id']
            ? Conversation::findOrFail($validated['conversation_id'])
            : $this->agentService->createNewConversation($request->user()->id);

        try {
            $response = $this->agentService->processMessage(
                $conversation,
                $validated['message']
            );

            return response()->json([
                'success' => true,
                'conversation_id' => $conversation->id,
                'message' => $response,
                'memories' => $conversation->memories()
                    ->get()
                    ->mapWithKeys(fn ($m) => [$m->key => $m->value])
                    ->all(),
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function show(Conversation $conversation): JsonResponse
    {
        $this->authorize('view', $conversation);

        return response()->json([
            'conversation_id' => $conversation->id,
            'created_at' => $conversation->created_at,
            'messages' => $conversation->getRecentMessages(50),
            'memories' => $conversation->memories()
                ->get()
                ->mapWithKeys(fn ($m) => [$m->key => $m->value])
                ->all(),
        ]);
    }

    public function destroy(Conversation $conversation): JsonResponse
    {
        $this->authorize('delete', $conversation);
        $conversation->delete();

        return response()->json(['success' => true]);
    }
}
```

## Limpiar Memorias Expiradas

Es importante eliminar memorias expiradas periódicamente:

```php
// app/Console/Commands/PruneExpiredMemories.php
namespace App\Console\Commands;

use App\Models\AgentMemory;
use Illuminate\Console\Command;

class PruneExpiredMemories extends Command
{
    protected $signature = 'agent:prune-memories';
    protected $description = 'Elimina memorias de agente expiradas';

    public function handle(): int
    {
        $deleted = AgentMemory::where('expires_at', '<', now())->delete();

        $this->info("Se eliminaron {$deleted} memorias expiradas.");
        return self::SUCCESS;
    }
}
```

Agregua a `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('agent:prune-memories')->hourly();
}
```

## Mejores Prácticas y Consideraciones

### Rate Limiting

Protege tu API contra abuso:

```php
// routes/api.php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/agent/message', [AIAgentController::class, 'store'])
        ->middleware('throttle