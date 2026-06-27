---
title: 'Yammi Audit Log en Laravel: Auditoría Completa en Jobs'
description: 'Aprende a implementar Yammi Audit Log para registrar cambios de modelos incluso cuando ocurren en queued jobs, rastreando el usuario original.'
pubDate: '2026-06-26'
tags: ['laravel', 'auditoría', 'queues', 'seguridad']
---

## Introducción

Una de las mayores complejidades en aplicaciones Laravel modernas es rastrear **quién realmente hizo un cambio** cuando este ocurre de forma asíncrona. Imagina este escenario: un usuario dispara una acción que queued un job, ese job modifica varios modelos en segundo plano, ¿pero cómo sabes quién iniciró esa cadena de cambios?

Aquí es donde **Yammi Audit Log** se convierte en una herramienta invaluable. Este paquete Laravel no solo registra cada cambio en tus modelos, sino que mantiene una trazabilidad completa incluso a través de jobs, identificando el usuario original, la fuente del cambio y una correlation ID que conecta todo.

En este artículo aprenderás cómo implementar Yammi Audit Log desde cero y cómo aprovecharlo para construir un sistema de auditoría robusto en tus aplicaciones Laravel.

## ¿Por Qué Necesitas Auditoría en Jobs?

### El problema de los cambios asíncronos

Cuando trabajas con colas en Laravel, muchas acciones ocurren fuera del contexto original de la request HTTP. Un job puede:

- Procesar datos de lote cargados por un usuario
- Sincronizar información con APIs externas
- Generar reportes que modifican el estado de modelos
- Actualizar estadísticas basadas en eventos

Sin un sistema de auditoría adecuado, pierdes trazabilidad. **¿Quién cambió este registro? ¿Cuándo? ¿Por qué?** Estas preguntas se vuelven imposibles de responder.

### Requisitos regulatorios

En muchas jurisdicciones (GDPR, CCPA, HIPAA), mantener un audit trail completo es un **requisito legal**. No puedes simplemente decir "no sabemos quién lo hizo" cuando un regulador te pregunta.

```php
// Sin Yammi: ¿Cómo rastrear esto?
class ProcessUserDataJob implements ShouldQueue
{
    public function handle()
    {
        User::where('status', 'pending')
            ->update(['status' => 'processed']);
        // ¿Quién hizo esto? ¿Cuándo se originó?
    }
}
```

## Instalación de Yammi Audit Log

Instalar Yammi es tan simple como usar Composer:

```bash
composer require yammi/audit-log
```

Luego, publica la configuración:

```bash
php artisan vendor:publish --provider="Yammi\AuditLog\AuditLogServiceProvider"
```

Esto creará:
- Un archivo de configuración en `config/audit.php`
- Una migración para crear la tabla `audit_logs`

Ejecuta las migraciones:

```bash
php artisan migrate
```

## Configuración Inicial

El archivo `config/audit.php` es el corazón de la configuración:

```php
<?php

return [
    // Modelos a auditar (por defecto, todos si está habilitado)
    'models' => [
        'audit_all' => true,
    ],
    
    // Atributos a excluir de la auditoría
    'ignored_attributes' => [
        'password',
        'remember_token',
        'api_token',
    ],
    
    // Almacenar datos anteriores (antes de cambios)
    'record_old_values' => true,
    
    // Almacenar cambios adicionales de contexto
    'include_correlation_id' => true,
];
```

Para auditar solo algunos modelos específicos, modifica la configuración:

```php
'models' => [
    'audit_all' => false,
    'auditable' => [
        App\Models\User::class,
        App\Models\Post::class,
        App\Models\Payment::class,
    ],
],
```

## Auditar Modelos Específicos

### Usar el trait Auditable

La forma más simple es agregar el trait `Auditable` a tus modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Yammi\AuditLog\Traits\Auditable;

class User extends Model
{
    use Auditable;
    
    protected $fillable = ['name', 'email', 'status'];
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Yammi\AuditLog\Traits\Auditable;

class Post extends Model
{
    use Auditable;
    
    protected $fillable = ['title', 'content', 'published_at'];
}
```

Ahora, cada cambio en estos modelos se registrará automáticamente en la tabla `audit_logs`.

## Rastrear Cambios en Jobs

Este es el punto crucial: **Yammi mantiene el contexto del usuario original incluso cuando cambios ocurren dentro de jobs**.

### Estructura básica del log

Cuando auditas en un job, cada entrada incluye:

- **actor_id**: El usuario que iniciró la acción
- **actor_type**: El tipo de actor (usuario, admin, sistema)
- **action**: create, update, delete
- **model_type**: Clase del modelo modificado
- **model_id**: ID del modelo
- **old_values**: Valores anteriores (si aplica)
- **new_values**: Nuevos valores
- **origin**: Dónde ocurrió (web request, job, console)
- **correlation_id**: ID único que conecta toda la cadena

### Ejemplo práctico: Job con auditoría

```php
<?php

namespace App\Jobs;

use App\Models\Order;
use App\Models\OrderItem;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Yammi\AuditLog\Facades\AuditLog;

class ProcessOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;
    
    public function __construct(
        public Order $order,
        public $userId
    ) {}
    
    public function handle()
    {
        // Yammi detecta automáticamente el contexto
        // pero podemos ser explícitos
        AuditLog::as($this->userId)
                ->withOrigin('job:process_order')
                ->execute(function () {
                    // Estos cambios estarán auditados
                    $this->order->update([
                        'status' => 'processing',
                        'processed_at' => now(),
                    ]);
                    
                    // Los items también se auditan
                    $this->order->items()->update([
                        'status' => 'in_progress',
                    ]);
                });
    }
}
```

### Despachando jobs desde un controlador

```php
<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessOrderJob;
use App\Models\Order;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function process(Request $request, Order $order)
    {
        // Disparar el job, pasando el usuario actual
        ProcessOrderJob::dispatch($order, $request->user()->id);
        
        return response()->json([
            'message' => 'Order processing started',
            'order_id' => $order->id,
        ]);
    }
}
```

Yammi automáticamente registrará:
1. La acción fue iniciada por el usuario autenticado
2. El job que ejecutó los cambios
3. Todos los modelos modificados
4. Una correlation_id que conecta todo

## Consultar el Audit Log

### Modelo AuditLog

Yammi proporciona un modelo `AuditLog` para consultar registros:

```php
<?php

namespace App\Models;

use Yammi\AuditLog\Models\AuditLog;

// Obtener todos los cambios de un usuario
$userChanges = AuditLog::whereActorId($userId)->get();

// Cambios de un modelo específico
$postChanges = AuditLog::forModel(Post::class, $postId)->get();

// Cambios en los últimos 7 días
$recentChanges = AuditLog::where('created_at', '>=', now()->subDays(7))->get();

// Cambios por origen
$jobChanges = AuditLog::where('origin', 'like', 'job:%')->get();
$webChanges = AuditLog::where('origin', 'web')->get();

// Todos los cambios con la misma correlation_id
$correlatedChanges = AuditLog::whereCorrelationId($correlationId)->get();
```

### Crear una relación en tus modelos

Para acceder fácilmente a los logs desde tus modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Yammi\AuditLog\Models\AuditLog;
use Yammi\AuditLog\Traits\Auditable;

class User extends Model
{
    use Auditable;
    
    public function auditLogs()
    {
        return AuditLog::where('model_type', static::class)
                       ->where('model_id', $this->id);
    }
    
    public function changes()
    {
        return $this->auditLogs()->get();
    }
}
```

Uso:

```php
$user = User::find(1);

// Ver todos los cambios de este usuario
foreach ($user->changes() as $log) {
    echo "{$log->action} by {$log->actor_id} at {$log->created_at}\n";
    echo "Old: " . json_encode($log->old_values) . "\n";
    echo "New: " . json_encode($log->new_values) . "\n";
}
```

## Casos de Uso Avanzados

### Auditar cambios condicionalmente

A veces no quieres auditar ciertas acciones:

```php
<?php

use Yammi\AuditLog\Facades\AuditLog;

class User extends Model
{
    use Auditable;
    
    // Excluir ciertos atributos del audit
    protected $auditIgnore = [
        'last_login_at',
        'login_count',
    ];
    
    // O auditar solo ciertos atributos
    protected $auditOnly = [
        'status',
        'role',
        'email',
    ];
}
```

### Agregar contexto personalizado

```php
<?php

AuditLog::as($userId)
        ->withOrigin('api:user_update')
        ->withContext([
            'ip_address' => request()->ip(),
            'user_agent' => request()->header('User-Agent'),
            'endpoint' => request()->path(),
        ])
        ->execute(function () {
            $user->update(['status' => 'active']);
        });
```

### Auditar sin usuario autenticado

Para acciones de sistema o tareas cron:

```php
<?php

AuditLog::asSystem() // O AuditLog::as('system')
        ->withOrigin('scheduler:cleanup_old_records')
        ->execute(function () {
            OldRecord::where('created_at', '<', now()->subYear())->delete();
        });
```

## Dashboard de Auditoría

Crear un dashboard simple para ver los logs:

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Yammi\AuditLog\Models\AuditLog;

class AuditController extends Controller
{
    public function index()
    {
        $logs = AuditLog::latest()
                        ->paginate(50);
        
        return view('audit.index', [
            'logs' => $logs,
        ]);
    }
    
    public function userActivity(User $user)
    {
        $logs = AuditLog::whereActorId($user->id)
                        ->latest()
                        ->paginate(50);
        
        return view('audit.user-activity', [
            'user' => $user,
            'logs' => $logs,
        ]);
    }
    
    public function modelHistory($modelClass, $modelId)
    {
        $logs = AuditLog::where('model_type', $modelClass)
                        ->where('model_id', $modelId)
                        ->latest()
                        ->paginate(50);
        
        return view('audit.model-history', [
            'logs' => $logs,
        ]);
    }
}
```

Vista Blade:

```blade
<table class="table">
    <thead>
        <tr>
            <th>Actor</th>
            <th>Acción</th>
            <th>Modelo</th>
            <th>Origen</th>
            <th>Fecha</th>
            <th>Detalles</th>
        </tr>
    </thead>
    <tbody>
        @foreach($logs as $log)
            <tr>
                <td>
                    @if($log->actor_id)
                        {{ $log->actor->name ?? 'Usuario eliminado' }}
                    @else
                        <span class="badge">Sistema</span>
                    @endif
                </td>
                <td>
                    <span class="badge badge-{{ $log->action }}">
                        {{ ucfirst($log->action) }}
                    </span>
                </td>
                <td>{{ class_basename($log->model_type) }}</td>
                <td><small>{{ $log->origin }}</small></td>
                <td>{{ $log->created_at->diffForHumans() }}</td>
                <td>
                    <button class="btn btn-sm btn-info" 
                            data-toggle="modal" 
                            data-target="#details{{ $log->id }}">
                        Ver
                    </button>
                </td>
            </tr>
        @endforeach
    </tbody>
</table>
```

## Rendimiento y Optimización

### Indexar la tabla de auditoría

Para grandes volúmenes de datos, crea índices:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('actor_id');
            $table->index('model_type');
            $table->index('model_id');
            $table->index('created_at');
            $table->index(['actor_id', 'created_at']);
            $table->index(['model_type', 'model_id']);
        });
    }
};
```

### Archivar logs antiguos

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Yammi\AuditLog\Models\AuditLog;

class ArchiveOldAuditLogs extends Command
{
    protected $signature = 'audit:archive {--days=90}';
    
    public function handle()
    {
        $days = $this->option('days');
        $count = AuditLog::where('created_at', '<', now()->subDays($days))
                         ->delete();
        
        $this->info("Archived {$count} audit logs older than {$days} days");
    }
}