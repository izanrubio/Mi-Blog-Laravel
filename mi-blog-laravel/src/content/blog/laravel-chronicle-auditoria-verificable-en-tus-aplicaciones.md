---
title: 'Laravel Chronicle: Auditoría Verificable en tus Aplicaciones'
description: 'Implementa registros de auditoría inmutables con Laravel Chronicle. Aprende a registrar cambios verificables en tu aplicación con ejemplos prácticos.'
pubDate: '2026-05-09'
tags: ['laravel', 'seguridad', 'auditoría', 'base-de-datos']
---

## Laravel Chronicle: Auditoría Verificable en tus Aplicaciones

La auditoría es fundamental en aplicaciones empresariales. Necesitas saber quién hizo qué, cuándo y cómo. Pero hay un problema: los registros de auditoría tradicionales pueden ser modificados, eliminados o alterados. ¿Qué pasa si alguien borra el historial para cubrir sus rastros?

**Laravel Chronicle** resuelve este problema creando un **ledger de auditoría inmutable** que prueba que los datos no han sido tocados. Es como un registro contable a prueba de manipulaciones.

En este artículo, verás cómo implementar auditoría verificable en tus proyectos Laravel, protegiendo tu aplicación contra fraudes y malversaciones internas.

## ¿Qué es Laravel Chronicle?

Laravel Chronicle es un paquete que mantiene un **registro de auditoría en apéndice** (append-only log). Esto significa que:

- **Solo puedes agregar** nuevos registros, nunca modificar o eliminar existentes
- Cada registro incluye un **hash criptográfico** que verifica la integridad
- Puedes **probar legalmente** que un registro no ha sido alterado
- Es perfecto para cumplimiento normativo (GDPR, HIPAA, SOX)

### Casos de uso ideales

- **Fintech**: Transacciones, cambios de saldo, autorizaciones
- **Healthcare**: Acceso a historiales médicos, cambios en prescripciones
- **E-commerce**: Devoluciones, reembolsos, cambios de precios
- **Legal**: Cambios en contratos, acuerdos, versiones
- **Auditoría interna**: Cualquier cambio crítico en tu negocio

## Instalación de Laravel Chronicle

Primero, instala el paquete vía Composer:

```bash
composer require spatie/laravel-chronicle
```

Luego, publica la configuración y las migraciones:

```bash
php artisan vendor:publish --provider="Spatie\Chronicle\ChronicleServiceProvider"
php artisan migrate
```

Esto crea las tablas necesarias para almacenar los eventos del ledger de forma segura.

## Configuración Básica

Abre `config/chronicle.php` y revisa la configuración predeterminada:

```php
return [
    'driver' => env('CHRONICLE_DRIVER', 'database'),
    
    'drivers' => [
        'database' => [
            'connection' => env('DB_CONNECTION', 'mysql'),
        ],
    ],
    
    'table' => 'chronicle_events',
    
    'encrypt' => true,
];
```

**Recomendación**: Siempre activa encriptación (`encrypt: true`) para sensibilidad extra.

## Registrando Eventos de Auditoría

### Forma Básica

La manera más simple de registrar eventos:

```php
use Spatie\Chronicle\Chronicle;

// En tu controlador, servicio o job
Chronicle::record(
    event: 'user.created',
    description: 'Nuevo usuario registrado',
    properties: [
        'user_id' => $user->id,
        'email' => $user->email,
        'ip' => request()->ip(),
    ],
    createdByUserId: auth()->id(),
);
```

### Registrando Cambios en Modelos

Crea un Observer para capturar automáticamente cambios en tus modelos:

```php
namespace App\Observers;

use App\Models\User;
use Spatie\Chronicle\Chronicle;

class UserObserver
{
    public function created(User $user): void
    {
        Chronicle::record(
            event: 'user.created',
            description: "Usuario {$user->email} creado",
            properties: [
                'user_id' => $user->id,
                'email' => $user->email,
                'name' => $user->name,
            ],
            createdByUserId: auth()->id(),
        );
    }

    public function updated(User $user): void
    {
        $changes = $user->getChanges();
        
        Chronicle::record(
            event: 'user.updated',
            description: "Usuario {$user->email} actualizado",
            properties: [
                'user_id' => $user->id,
                'changes' => $changes,
                'original' => $user->getOriginal(),
            ],
            createdByUserId: auth()->id(),
        );
    }

    public function deleted(User $user): void
    {
        Chronicle::record(
            event: 'user.deleted',
            description: "Usuario {$user->email} eliminado",
            properties: [
                'user_id' => $user->id,
                'email' => $user->email,
            ],
            createdByUserId: auth()->id(),
        );
    }
}
```

Registra el Observer en tu `AppServiceProvider`:

```php
use App\Observers\UserObserver;
use App\Models\User;

public function boot(): void
{
    User::observe(UserObserver::class);
}
```

## Auditoría de Cambios Sensibles en Transacciones

Para eventos críticos como cambios de permisos o dinero, querrás máxima transparencia:

```php
namespace App\Services;

use App\Models\User;
use Spatie\Chronicle\Chronicle;

class PermissionService
{
    public function grantAdminRole(User $user): void
    {
        DB::transaction(function () use ($user) {
            $user->assignRole('admin');
            
            Chronicle::record(
                event: 'user.role_change',
                description: "Rol admin asignado a {$user->email}",
                properties: [
                    'user_id' => $user->id,
                    'role' => 'admin',
                    'reason' => request()->input('reason'),
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ],
                createdByUserId: auth()->id(),
            );
        });
    }

    public function revokeAdminRole(User $user): void
    {
        DB::transaction(function () use ($user) {
            $user->removeRole('admin');
            
            Chronicle::record(
                event: 'user.role_revoked',
                description: "Rol admin revocado de {$user->email}",
                properties: [
                    'user_id' => $user->id,
                    'role' => 'admin',
                    'reason' => request()->input('reason'),
                ],
                createdByUserId: auth()->id(),
            );
        });
    }
}
```

## Consultando el Ledger de Auditoría

### Recuperar Todos los Eventos

```php
use Spatie\Chronicle\Models\ChronicleEvent;

// Obtener todos los eventos
$allEvents = ChronicleEvent::all();

// Con paginación
$events = ChronicleEvent::paginate(50);
```

### Filtrar por Evento

```php
// Eventos de creación de usuarios
$userCreations = ChronicleEvent::where('event', 'user.created')->get();

// Eventos de los últimos 7 días
$recentEvents = ChronicleEvent::where('created_at', '>=', now()->subDays(7))->get();
```

### Filtrar por Usuario

```php
// Eventos creados por un usuario específico
$userActions = ChronicleEvent::where('created_by_user_id', auth()->id())->get();

// Auditoría completa de un usuario
$userAudit = ChronicleEvent::where('properties->user_id', $userId)->get();
```

## Verificar la Integridad del Ledger

Una de las características más poderosas de Chronicle es verificar que los registros no han sido alterados:

```php
use Spatie\Chronicle\Models\ChronicleEvent;

public function verifyChronicleIntegrity(): void
{
    $events = ChronicleEvent::orderBy('id')->get();
    
    foreach ($events as $index => $event) {
        // Cada evento debe tener un hash válido
        $isValid = $event->verifyHash();
        
        if (!$isValid) {
            // ¡Alerta! Este registro fue modificado
            Log::error("Chronicle integrity violation at event {$event->id}");
        }
    }
}
```

Chronicle genera un hash de cada evento que incluye el hash del evento anterior, creando una **cadena inmutable**. Si alguien cambia un registro, su hash no coincidirá.

## Dashboard de Auditoría

Crea un controlador para mostrar el historial de auditoría a administradores:

```php
namespace App\Http\Controllers\Admin;

use Spatie\Chronicle\Models\ChronicleEvent;
use App\Models\User;

class AuditController
{
    public function index()
    {
        $events = ChronicleEvent::with('createdByUser')
            ->latest('id')
            ->paginate(25);
        
        return view('admin.audit.index', compact('events'));
    }

    public function userAudit(User $user)
    {
        $events = ChronicleEvent::where('properties->user_id', $user->id)
            ->orWhere('created_by_user_id', $user->id)
            ->latest('id')
            ->paginate(25);
        
        return view('admin.audit.user', [
            'user' => $user,
            'events' => $events,
        ]);
    }

    public function verifyIntegrity()
    {
        $events = ChronicleEvent::orderBy('id')->get();
        $violations = [];
        
        foreach ($events as $event) {
            if (!$event->verifyHash()) {
                $violations[] = $event->id;
            }
        }
        
        return view('admin.audit.verify', compact('violations'));
    }
}
```

### Vista Blade para el Dashboard

```blade
<!-- resources/views/admin/audit/index.blade.php -->
<div class="audit-container">
    <h2>Registro de Auditoría</h2>
    
    <table class="table">
        <thead>
            <tr>
                <th>Fecha</th>
                <th>Evento</th>
                <th>Descripción</th>
                <th>Usuario</th>
                <th>Detalles</th>
            </tr>
        </thead>
        <tbody>
            @foreach($events as $event)
            <tr>
                <td>{{ $event->created_at->format('d/m/Y H:i') }}</td>
                <td>
                    <span class="badge badge-info">{{ $event->event }}</span>
                </td>
                <td>{{ $event->description }}</td>
                <td>
                    @if($event->createdByUser)
                        {{ $event->createdByUser->name }}
                    @else
                        <em>Sistema</em>
                    @endif
                </td>
                <td>
                    <button class="btn btn-sm btn-secondary" 
                            onclick="showDetails({{ $event->id }})">
                        Ver
                    </button>
                </td>
            </tr>
            @endforeach
        </tbody>
    </table>
    
    {{ $events->links() }}
</div>
```

## Exportar Auditoría para Cumplimiento Normativo

Genera reportes de auditoría para auditorías externas:

```php
namespace App\Services;

use Spatie\Chronicle\Models\ChronicleEvent;
use Carbon\Carbon;

class AuditExportService
{
    public function generateReport(
        Carbon $startDate,
        Carbon $endDate,
        ?string $event = null
    ): array {
        $query = ChronicleEvent::whereBetween('created_at', [$startDate, $endDate]);
        
        if ($event) {
            $query->where('event', $event);
        }
        
        return $query->orderBy('created_at')
                     ->get()
                     ->map(function (ChronicleEvent $event) {
                         return [
                             'timestamp' => $event->created_at->toIso8601String(),
                             'event' => $event->event,
                             'description' => $event->description,
                             'user' => $event->createdByUser?->email ?? 'system',
                             'properties' => $event->properties,
                             'hash' => $event->hash,
                             'previous_hash' => $event->previous_hash,
                         ];
                     })
                     ->toArray();
    }

    public function exportToCSV(array $data, string $filename = 'audit.csv'): string
    {
        $path = storage_path("audit_exports/{$filename}");
        $fp = fopen($path, 'w');
        
        // Headers
        fputcsv($fp, array_keys($data[0]));
        
        foreach ($data as $row) {
            fputcsv($fp, $row);
        }
        
        fclose($fp);
        return $path;
    }
}
```

## Buenas Prácticas con Laravel Chronicle

### 1. Registra el Contexto Completo

Incluye siempre detalles relevantes que ayuden a entender el evento:

```php
Chronicle::record(
    event: 'payment.processed',
    description: 'Pago procesado',
    properties: [
        'order_id' => $order->id,
        'amount' => $order->total,
        'currency' => 'USD',
        'payment_method' => $payment->method,
        'ip_address' => request()->ip(),
        'user_agent' => request()->userAgent(),
        'timestamp' => now()->toDateTimeString(),
    ],
    createdByUserId: auth()->id(),
);
```

### 2. Define Nombres Consistentes

Usa convención `resource.action` para nombrar eventos:

- `user.created`
- `user.updated`
- `user.deleted`
- `order.completed`
- `invoice.generated`

### 3. Protege el Acceso a la Auditoría

Solo administradores deben ver el ledger completo:

```php
Route::middleware(['auth', 'can:view-audit-logs'])
    ->prefix('admin/audit')
    ->group(function () {
        Route::get('/', [AuditController::class, 'index']);
        Route::get('/verify', [AuditController::class, 'verifyIntegrity']);
    });
```

### 4. Realiza Verificaciones Periódicas

Usa un scheduled job para verificar integridad regularmente:

```php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Spatie\Chronicle\Models\ChronicleEvent;
use Illuminate\Support\Facades\Log;

class VerifyChronicleIntegrity extends Command
{
    protected $signature = 'chronicle:verify';

    public function handle()
    {
        $events = ChronicleEvent::orderBy('id')->get();
        $violations = 0;
        
        foreach ($events as $event) {
            if (!$event->verifyHash()) {
                $violations++;
                Log::critical("Chronicle tampering detected at event {$event->id}");
            }
        }
        
        if ($violations === 0) {
            $this->info('✓ Chronicle integrity verified successfully');
        } else {
            $this->error("✗ Found {$violations} integrity violations