---
title: 'Human-in-the-Loop en Laravel AI: Aprueba Herramientas IA'
description: 'Controla agentes IA con aprobación humana. Aprende a implementar Human-in-the-Loop en Laravel AI SDK para validar acciones críticas.'
pubDate: '2026-08-02'
tags: ['laravel', 'ia', 'agentes', 'seguridad']
---

## Human-in-the-Loop en Laravel AI: Aprueba Herramientas IA

Las aplicaciones impulsadas por agentes de IA son cada vez más comunes, pero con gran poder viene gran responsabilidad. ¿Qué sucede cuando tu agente necesita ejecutar una acción crítica como eliminar datos, transferir dinero o acceder a recursos sensibles? La respuesta es **Human-in-the-Loop**: un patrón que pausa la ejecución de herramientas sensibles para que un humano las apruebe, rechace o edite antes de ejecutarlas.

Laravel AI SDK acaba de añadir esta funcionalidad en su nueva API presentada en Laracon US 2026. En este artículo, aprenderás cómo implementar aprobación humana en tus agentes IA, protegiendo tu aplicación sin sacrificar la automatización.

## ¿Qué es Human-in-the-Loop?

Human-in-the-Loop es un patrón de diseño donde un agente IA pausa antes de ejecutar acciones críticas, permitiendo que un humano:

- **Apruebe** la acción tal como la planificó el agente
- **Rechace** la acción si es inapropiada o peligrosa
- **Edite** los parámetros antes de ejecutarla
- **Cancele** todo el proceso si es necesario

Este patrón es esencial para aplicaciones de producción donde los errores tienen consecuencias reales.

## Configuración Inicial

Primero, asegúrate de tener la última versión de Laravel AI SDK:

```bash
composer require laravel/ai
```

Luego, configura tu proveedor de IA. En este ejemplo usaremos OpenAI:

```env
AI_PROVIDER=openai
AI_MODEL=gpt-4-turbo
OPENAI_API_KEY=sk-...
```

## Definir Herramientas con Human-in-the-Loop

El primer paso es marcar qué herramientas requieren aprobación humana. En Laravel AI SDK, usamos el atributo `#[RequiresApproval]`:

```php
<?php

namespace App\Tools;

use Laravel\AI\Attributes\RequiresApproval;
use Laravel\AI\ToolRegistry;

class DeleteUserAccount
{
    #[RequiresApproval(label: 'Eliminar Cuenta de Usuario')]
    public function execute(int $userId)
    {
        $user = User::findOrFail($userId);
        
        return [
            'status' => 'pending_approval',
            'action' => 'delete_user',
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
            ],
            'message' => "Se eliminará la cuenta de {$user->email}"
        ];
    }
}
```

Registra la herramienta en tu agente:

```php
<?php

namespace App\Agents;

use Laravel\AI\Agent;
use App\Tools\DeleteUserAccount;

class UserManagementAgent extends Agent
{
    public function __construct()
    {
        parent::__construct();
        
        $this->registerTool(new DeleteUserAccount());
    }
}
```

## Implementar el Sistema de Aprobación

Ahora necesitas un controlador que maneje las solicitudes de aprobación. Este es el punto crítico donde un humano interviene:

```php
<?php

namespace App\Http\Controllers;

use App\Models\ToolApproval;
use Illuminate\Http\Request;
use Laravel\AI\Agent;

class ToolApprovalController extends Controller
{
    public function pending()
    {
        $approvals = ToolApproval::where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->get();
            
        return view('approvals.pending', ['approvals' => $approvals]);
    }

    public function show(ToolApproval $approval)
    {
        return view('approvals.show', ['approval' => $approval]);
    }

    public function approve(Request $request, ToolApproval $approval)
    {
        $request->validate([
            'edited_params' => 'nullable|array',
        ]);

        $params = $request->input('edited_params') ?? $approval->tool_params;

        $approval->update([
            'status' => 'approved',
            'approved_by' => auth()->id(),
            'approved_at' => now(),
            'tool_params' => $params,
        ]);

        return redirect()->route('approvals.pending')
            ->with('success', 'Herramienta aprobada');
    }

    public function reject(Request $request, ToolApproval $approval)
    {
        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        $approval->update([
            'status' => 'rejected',
            'rejected_by' => auth()->id(),
            'rejected_at' => now(),
            'rejection_reason' => $request->input('reason'),
        ]);

        return redirect()->route('approvals.pending')
            ->with('success', 'Herramienta rechazada');
    }
}
```

## Modelo para Rastrear Aprobaciones

Crea un modelo para almacenar todas las solicitudes de aprobación:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ToolApproval extends Model
{
    protected $fillable = [
        'tool_name',
        'tool_params',
        'status',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
        'rejection_reason',
        'agent_id',
    ];

    protected $casts = [
        'tool_params' => 'array',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function rejectedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'rejected_by');
    }
}
```

Crea la migración:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tool_approvals', function (Blueprint $table) {
            $table->id();
            $table->string('tool_name');
            $table->json('tool_params');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('rejected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('rejected_at')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->string('agent_id')->nullable();
            $table->timestamps();
            
            $table->index('status');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tool_approvals');
    }
};
```

## Integración con el Agente

Ahora integra el sistema de aprobación en tu agente. Crea un middleware personalizado:

```php
<?php

namespace App\AI\Middleware;

use App\Models\ToolApproval;
use Laravel\AI\ToolCall;
use Closure;

class ApprovalMiddleware
{
    public function handle(ToolCall $toolCall, Closure $next)
    {
        // Verifica si la herramienta requiere aprobación
        if (!$toolCall->requiresApproval()) {
            return $next($toolCall);
        }

        // Crea un registro de aprobación pendiente
        $approval = ToolApproval::create([
            'tool_name' => $toolCall->name(),
            'tool_params' => $toolCall->parameters(),
            'status' => 'pending',
            'agent_id' => $toolCall->agentId(),
        ]);

        // Aquí puedes enviar notificaciones
        \App\Notifications\ToolApprovalNeeded::dispatch($approval);

        // Retorna una respuesta indicando que está en espera
        return [
            'status' => 'awaiting_approval',
            'approval_id' => $approval->id,
            'message' => 'La herramienta está en espera de aprobación humana',
        ];
    }
}
```

Registra el middleware en tu agente:

```php
<?php

namespace App\Agents;

use Laravel\AI\Agent;
use App\AI\Middleware\ApprovalMiddleware;

class UserManagementAgent extends Agent
{
    public function __construct()
    {
        parent::__construct();
        
        $this->middleware(new ApprovalMiddleware());
    }
}
```

## Vista para Revisar Solicitudes

Crea una vista Blade para que los administradores revisen las solicitudes:

```blade
{{-- resources/views/approvals/pending.blade.php --}}

<div class="space-y-4">
    @forelse($approvals as $approval)
        <div class="border rounded-lg p-6 bg-yellow-50">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-bold text-lg">{{ $approval->tool_name }}</h3>
                    <p class="text-gray-600 text-sm">
                        {{ $approval->created_at->diffForHumans() }}
                    </p>
                </div>
                <span class="px-3 py-1 bg-yellow-200 text-yellow-800 rounded-full text-sm">
                    Pendiente
                </span>
            </div>

            <div class="bg-gray-100 p-4 rounded mb-4 font-mono text-sm">
                <strong>Parámetros:</strong>
                <pre>{{ json_encode($approval->tool_params, JSON_PRETTY_PRINT) }}</pre>
            </div>

            <div class="flex gap-2">
                <a href="{{ route('approvals.show', $approval) }}" 
                   class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Revisar
                </a>
            </div>
        </div>
    @empty
        <div class="text-center py-8 text-gray-500">
            No hay solicitudes pendientes
        </div>
    @endforelse
</div>
```

## Procesar Aprobaciones

Crea un comando para procesar las aprobaciones aprobadas:

```php
<?php

namespace App\Console\Commands;

use App\Models\ToolApproval;
use Laravel\AI\Agent;
use Illuminate\Console\Command;

class ProcessApprovedTools extends Command
{
    protected $signature = 'tools:process-approved';
    protected $description = 'Procesa herramientas aprobadas por humanos';

    public function handle()
    {
        $approvals = ToolApproval::where('status', 'approved')
            ->where('executed_at', null)
            ->get();

        foreach ($approvals as $approval) {
            try {
                // Obtén el agente apropiado
                $agent = app()->make(Agent::class);
                
                // Ejecuta la herramienta con los parámetros aprobados
                $result = $agent->executeTool(
                    $approval->tool_name,
                    $approval->tool_params
                );

                $approval->update([
                    'executed_at' => now(),
                    'execution_result' => $result,
                ]);

                $this->info("Herramienta {$approval->tool_name} ejecutada");
            } catch (\Exception $e) {
                $approval->update([
                    'execution_error' => $e->getMessage(),
                ]);
                $this->error("Error ejecutando {$approval->tool_name}: " . $e->getMessage());
            }
        }
    }
}
```

## Notificaciones en Tiempo Real

Envía notificaciones cuando haya nuevas solicitudes:

```php
<?php

namespace App\Notifications;

use App\Models\ToolApproval;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Channels\SlackChannel;

class ToolApprovalNeeded extends Notification
{
    public function __construct(private ToolApproval $approval) {}

    public function via($notifiable)
    {
        return ['database', SlackChannel::class];
    }

    public function toSlack($notifiable)
    {
        return [
            'text' => "Nueva solicitud de aprobación",
            'blocks' => [
                [
                    'type' => 'section',
                    'text' => [
                        'type' => 'mrkdwn',
                        'text' => "*Herramienta:* {$this->approval->tool_name}\n" .
                                "*Estado:* Pendiente de aprobación",
                    ],
                ],
                [
                    'type' => 'actions',
                    'elements' => [
                        [
                            'type' => 'button',
                            'text' => ['type' => 'plain_text', 'text' => 'Revisar'],
                            'url' => route('approvals.show', $this->approval),
                        ],
                    ],
                ],
            ],
        ];
    }
}
```

## Mejores Prácticas

### 1. Define Claramente Qué Requiere Aprobación

No todas las herramientas necesitan aprobación. Sé selectivo:

```php
// Requiere aprobación
#[RequiresApproval]
public function deleteData() { }

// No requiere aprobación
public function fetchData() { }
```

### 2. Timeout para Aprobaciones Pendientes

Implementa un timeout para evitar que solicitudes antiguas bloqueen procesos:

```php
$staleApprovals = ToolApproval::where('status', 'pending')
    ->where('created_at', '<', now()->subHours(24))
    ->update(['status' => 'expired']);
```

### 3. Auditoría Completa

Siempre registra quién aprobó, rechazó o ejecutó:

```php
$approval->update([
    'approved_by' => auth()->id(),
    'approved_at' => now(),
]);

\Log::channel('security')->info('Tool approved', [
    'tool' => $approval->tool_name,
    'approved_by' => auth()->user()->email,
]);
```

### 4. Editar Parámetros de Forma Segura

Cuando permitas editar parámetros, valida siempre:

```php
public function approve(Request $request, ToolApproval $approval)
{
    $params = $request->validate([
        'user_id' => 'required|integer|exists:users,id',
        'reason' => 'required|string|max:500',
    ]);

    // Usa solo los parámetros validados