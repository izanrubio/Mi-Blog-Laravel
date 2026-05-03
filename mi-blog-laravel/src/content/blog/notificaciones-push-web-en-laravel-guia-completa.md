---
title: 'Notificaciones Push Web en Laravel: Guía Completa'
description: 'Implementa notificaciones push web en tu app Laravel. Guía paso a paso con ejemplos, Service Workers y mejores prácticas para usuarios.'
pubDate: '2025-05-01'
tags: ['laravel', 'notificaciones', 'web-push', 'javascript']
---

## Notificaciones Push Web en Laravel: Guía Completa

Las notificaciones push web son una herramienta poderosa para mantener a tus usuarios comprometidos sin que necesiten tener la aplicación abierta en el navegador. En Laravel, implementarlas es más sencillo de lo que parece. En este artículo te mostraré cómo integrar Web Push Notifications en tu aplicación Laravel desde cero.

## ¿Qué son las Web Push Notifications?

Las notificaciones push web son mensajes que se envían directamente al navegador del usuario, incluso cuando tu sitio web no está activo. Funcionan gracias a los Service Workers, un estándar web que permite a los navegadores recibir mensajes en segundo plano.

A diferencia de las notificaciones por email o SMS, las push web son instantáneas y no requieren que el usuario tenga que hacer nada especial: solo debe haber aceptado recibir notificaciones en algún momento.

### Casos de uso comunes

- Alertas de pedidos en tiempo real
- Notificaciones de mensajes nuevos
- Cambios en el estado de una tarea
- Recordatorios urgentes
- Actualizaciones de estado de sistemas

## Requisitos previos

Antes de comenzar, asegúrate de contar con:

- **Laravel 10+** (funciona en cualquier versión moderna)
- **HTTPS habilitado** (obligatorio para Web Push)
- **Un servidor de push** (gratuito y fácil con servicios como Firebase Cloud Messaging)
- **Conocimientos básicos** de Service Workers y JavaScript

## Instalación y configuración inicial

### Paso 1: Crear la tabla de suscriptores

Primero, necesitamos una tabla para almacenar los endpoints de push de nuestros usuarios:

```bash
php artisan make:migration create_push_subscriptions_table
```

En tu archivo de migración:

```php
Schema::create('push_subscriptions', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->text('endpoint');
    $table->text('auth_token');
    $table->text('public_key');
    $table->timestamps();
    
    $table->unique(['user_id', 'endpoint']);
});
```

Ejecuta la migración:

```bash
php artisan migrate
```

### Paso 2: Crear el modelo y relación

```bash
php artisan make:model PushSubscription
```

En el modelo `PushSubscription`:

```php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushSubscription extends Model
{
    protected $fillable = ['endpoint', 'auth_token', 'public_key'];
    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

En tu modelo `User`, agrega la relación:

```php
public function pushSubscriptions(): HasMany
{
    return $this->hasMany(PushSubscription::class);
}
```

### Paso 3: Generar las claves VAPID

Las claves VAPID son necesarias para autenticar tus solicitudes de push. Instala el paquete `web-push-php`:

```bash
composer require minishlink/web-push
```

Genera las claves en tu terminal:

```bash
php artisan tinker
```

Dentro de Tinker:

```php
use Minishlink\WebPush\WebPush;

$vapid = [
    'subject' => 'mailto:tu-email@ejemplo.com',
    'publicKey' => base64_encode(random_bytes(65)),
    'privateKey' => base64_encode(random_bytes(32)),
];

dd($vapid);
```

Copia estas claves en tu archivo `.env`:

```
VAPID_PUBLIC_KEY=tu_clave_publica_aqui
VAPID_PRIVATE_KEY=tu_clave_privada_aqui
VAPID_SUBJECT=mailto:tu-email@ejemplo.com
```

## Implementación del lado del cliente

### Service Worker

Crea un archivo `public/service-worker.js`:

```javascript
// service-worker.js
self.addEventListener('push', (event) => {
    if (!event.data) {
        return;
    }

    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: data.icon || '/images/logo.png',
        badge: data.badge || '/images/badge.png',
        tag: data.tag || 'notificacion',
        requireInteraction: data.requireInteraction || false,
        data: data.data || {},
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    if (event.notification.data.url) {
        event.waitUntil(
            clients.matchAll({ type: 'window' }).then((clientList) => {
                for (let client of clientList) {
                    if (client.url === event.notification.data.url && 'focus' in client) {
                        return client.focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url);
                }
            })
        );
    }
});
```

### Registrar el Service Worker

En tu layout Blade o JavaScript principal:

```javascript
// app.js o similar
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
            console.log('Service Worker registrado:', registration);
        })
        .catch(error => {
            console.error('Error al registrar Service Worker:', error);
        });
}
```

### Solicitar y guardar suscripciones

Crea un componente o JavaScript para solicitar permiso:

```javascript
async function subscribeToPush() {
    if (!('Notification' in window)) {
        alert('Este navegador no soporta notificaciones');
        return;
    }

    if (Notification.permission === 'denied') {
        alert('Has bloqueado las notificaciones');
        return;
    }

    if (Notification.permission === 'granted') {
        await savePushSubscription();
        return;
    }

    // Solicitar permiso
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
        await savePushSubscription();
    }
}

async function savePushSubscription() {
    const registration = await navigator.serviceWorker.ready;
    
    try {
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
                document.querySelector('meta[name="vapid-public-key"]').content
            ),
        });

        // Enviar al servidor
        const response = await fetch('/api/push-subscriptions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
            },
            body: JSON.stringify(subscription),
        });

        if (response.ok) {
            console.log('Suscripción guardada exitosamente');
        }
    } catch (error) {
        console.error('Error al suscribirse:', error);
    }
}

// Helper para convertir la clave VAPID
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
}
```

En tu Blade, agrega la clave VAPID pública:

```blade
<meta name="vapid-public-key" content="{{ config('app.vapid_public_key') }}">
```

## Endpoints del servidor

### Guardar suscripciones

Crea el controlador:

```bash
php artisan make:controller PushNotificationController
```

```php
namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class PushNotificationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'endpoint' => 'required|string|unique_for:push_subscriptions,endpoint',
            'keys' => 'required|array',
            'keys.auth' => 'required|string',
            'keys.p256dh' => 'required|string',
        ]);

        $request->user()->pushSubscriptions()->create([
            'endpoint' => $validated['endpoint'],
            'auth_token' => $validated['keys']['auth'],
            'public_key' => $validated['keys']['p256dh'],
        ]);

        return response()->json(['message' => 'Suscripción guardada'], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->user()->pushSubscriptions()
            ->where('endpoint', $request->input('endpoint'))
            ->delete();

        return response()->json(['message' => 'Suscripción eliminada']);
    }
}
```

### Rutas

En `routes/api.php`:

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/push-subscriptions', [PushNotificationController::class, 'store']);
    Route::delete('/push-subscriptions', [PushNotificationController::class, 'destroy']);
});
```

## Envío de notificaciones

### Crear un Job para enviar notificaciones

```bash
php artisan make:job SendPushNotification
```

```php
namespace App\Jobs;

use App\Models\PushSubscription;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Minishlink\WebPush\WebPush;
use Minishlink\WebPush\Subscription;

class SendPushNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private array $payload,
        private ?int $userId = null,
    ) {}

    public function handle(): void
    {
        $webPush = new WebPush([
            'VAPID' => [
                'subject' => config('app.vapid_subject'),
                'publicKey' => config('app.vapid_public_key'),
                'privateKey' => config('app.vapid_private_key'),
            ],
        ]);

        $query = PushSubscription::query();

        if ($this->userId) {
            $query->where('user_id', $this->userId);
        }

        foreach ($query->get() as $subscription) {
            $pushSubscription = Subscription::create([
                'endpoint' => $subscription->endpoint,
                'publicKey' => $subscription->public_key,
                'authToken' => $subscription->auth_token,
            ]);

            $webPush->sendOneNotification(
                $pushSubscription,
                json_encode($this->payload)
            );
        }

        foreach ($webPush->flush() as $report) {
            $endpoint = $report->getRequest()->getUri()->__toString();

            if (!$report->isSuccess()) {
                // Eliminar suscripción inválida
                PushSubscription::where('endpoint', $endpoint)->delete();
            }
        }
    }
}
```

### Usar el Job

En cualquier lugar de tu aplicación:

```php
use App\Jobs\SendPushNotification;

// Enviar a un usuario específico
dispatch(new SendPushNotification(
    payload: [
        'title' => 'Nuevo pedido',
        'body' => 'Tu pedido #123 ha sido confirmado',
        'icon' => '/images/logo.png',
        'badge' => '/images/badge.png',
        'tag' => 'order-123',
        'data' => [
            'url' => '/orders/123',
            'orderId' => 123,
        ],
    ],
    userId: auth()->id(),
));

// Enviar a todos
dispatch(new SendPushNotification(
    payload: [
        'title' => 'Mantenimiento',
        'body' => 'Sistema en mantenimiento el sábado',
    ],
));
```

## Ejemplo práctico: Notificar cambios de estado

```php
// En tu modelo Order
namespace App\Models;

use App\Jobs\SendPushNotification;

class Order extends Model
{
    protected static function booted(): void
    {
        static::updated(function (self $order) {
            if ($order->isDirty('status')) {
                dispatch(new SendPushNotification(
                    payload: [
                        'title' => 'Actualización de pedido',
                        'body' => 'Tu pedido está ' . $order->status,
                        'tag' => 'order-' . $order->id,
                        'requireInteraction' => $order->status === 'failed',
                        'data' => [
                            'url' => "/orders/{$order->id}",
                            'orderId' => $order->id,
                            'status' => $order->status,
                        ],
                    ],
                    userId: $order->user_id,
                ));
            }
        });
    }
}
```

## Mejores prácticas

### Gestión de errores

Siempre manejar suscripciones inválidas:

```php
try {
    $webPush->sendOneNotification($subscription, json_encode($payload));
} catch (\Exception $e) {
    // Loguear el error
    Log::error('Error al enviar push: ' . $e->getMessage());
    
    // Eliminar suscripción si es inválida
    if (strpos($e->getMessage(), 'invalid') !== false) {
        PushSubscription::where('endpoint', $subscription->getEndpoint())->delete();
    }
}
```

### Limitar frecuencia

Evita saturar a los usuarios:

```php
// En tu modelo
public function canReceiveNotification(): bool
{
    $lastNotification = $this->notifications()
        ->latest('created_at')
        ->first();

    return !$lastNotification || 
           $lastNotification->created_at->diffInMinutes(now()) >= 5;
}
```

### Personalización según preferencias

```php
public function sendNotificationIfAllowed(array $payload): void
{
    if (!$this->notifications_enabled || !$this->shouldReceiveNotification()) {
        return;
    }

    dispatch(new SendPushNotification($payload, $this->id));
}
```

## Conclusión

Las notificaciones push web son una forma excelente de mantener a tus usuarios informados y comprometidos. Con Laravel, la implementación es directa y escalable. Recuerda siempre:

1. **Usar HTTPS** en producción (obligatorio)
2. **Respetar las preferencias** del usuario
3. **Probar en múlt