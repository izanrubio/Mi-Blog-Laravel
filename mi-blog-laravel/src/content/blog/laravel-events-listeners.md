---
title: 'Events y Listeners en Laravel — Para qué sirven y cómo usarlos'
description: 'Aprende a usar el sistema de Events y Listeners de Laravel para desacoplar tu código. Crea eventos personalizados, listeners y usa el Event Bus correctamente.'
pubDate: '2024-03-25'
tags: ['laravel', 'eventos', 'listeners', 'arquitectura']
---

El sistema de eventos de Laravel implementa el patrón Observer y es una de las herramientas más útiles para mantener el código desacoplado. En lugar de que un controlador llame directamente a 5 servicios diferentes, dispara un evento y cada servicio escucha de forma independiente. El controlador no sabe ni le importa qué pasa después.

## El problema que resuelven los eventos

Sin eventos, un controlador de registro puede verse así:

```php
public function register(Request $request)
{
    $user = User::create($request->validated());
    
    // El controlador tiene que saber de todo esto:
    Mail::to($user)->send(new WelcomeMail($user));
    $this->analyticsService->trackRegistration($user);
    $this->subscriptionService->addToFreeTrialList($user);
    $this->slackService->notifyTeam("Nuevo usuario: {$user->email}");
    $this->crmService->syncUserToCrm($user);
    
    return redirect('/dashboard');
}
```

Con eventos:

```php
public function register(Request $request)
{
    $user = User::create($request->validated());
    
    // El controlador solo dispara el evento, no sabe qué pasa después
    UserRegistered::dispatch($user);
    
    return redirect('/dashboard');
}
// Cada listener maneja su propia responsabilidad de forma independiente
```

## Crear un Event

```bash
php artisan make:event UserRegistered
```

```php
<?php

namespace App\Events;

use App\Models\User;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class UserRegistered
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly User $user,          // El modelo del usuario
        public readonly string $referralCode = '', // Datos adicionales del evento
        public readonly string $registrationSource = 'web',
    ) {}
}
```

Los eventos son simples contenedores de datos. Su trabajo es transportar información del lugar donde ocurre algo a los listeners que reaccionan.

## Crear Listeners

```bash
php artisan make:listener SendWelcomeEmail --event=UserRegistered
php artisan make:listener TrackRegistrationInAnalytics --event=UserRegistered
php artisan make:listener SyncUserToCrm --event=UserRegistered
```

```php
<?php

namespace App\Listeners;

use App\Events\UserRegistered;
use App\Mail\WelcomeMail;
use Illuminate\Support\Facades\Mail;

class SendWelcomeEmail
{
    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeMail($event->user));
    }
}
```

```php
class TrackRegistrationInAnalytics
{
    public function __construct(
        private AnalyticsService $analytics
    ) {}

    public function handle(UserRegistered $event): void
    {
        $this->analytics->track('user_registered', [
            'user_id' => $event->user->id,
            'source'  => $event->registrationSource,
        ]);
    }
}
```

## Disparar eventos

```php
// Forma 1: Método estático dispatch() en la clase del evento
UserRegistered::dispatch($user);
UserRegistered::dispatch($user, referralCode: 'REF123', registrationSource: 'api');

// Forma 2: Helper event()
event(new UserRegistered($user));

// Forma 3: Facade Event::dispatch()
use Illuminate\Support\Facades\Event;
Event::dispatch(new UserRegistered($user));

// Disparar condicionalmente
UserRegistered::dispatchIf($user->wants_welcome_email, $user);
UserRegistered::dispatchUnless($user->is_test_account, $user);
```

## Registrar Events y Listeners

### Auto-discovery (Laravel 11 por defecto)

En Laravel 11, los listeners se descubren automáticamente si están en `App\Listeners`. No necesitas registrarlos manualmente.

```php
// Si tu listener sigue la convención, no necesitas hacer nada más.
// Laravel lo encuentra automáticamente.
```

### Registro manual (Laravel 10 y anteriores, o para más control)

```php
// app/Providers/EventServiceProvider.php

protected $listen = [
    UserRegistered::class => [
        SendWelcomeEmail::class,
        TrackRegistrationInAnalytics::class,
        SyncUserToCrm::class,
        NotifyTeamOnSlack::class,
    ],
    
    OrderCompleted::class => [
        SendOrderConfirmation::class,
        UpdateInventory::class,
        GenerateInvoice::class,
    ],
    
    PostPublished::class => [
        NotifyFollowers::class,
        InvalidateCache::class,
    ],
];
```

### Generar listeners desde EventServiceProvider

Después de definir el mapa de eventos y listeners, puedes generar todas las clases:

```bash
php artisan event:generate
```

## Listeners asíncronos (con cola)

Si un listener hace algo lento (enviar email, llamar API), puede ejecutarse en cola de forma asíncrona implementando `ShouldQueue`:

```php
<?php

namespace App\Listeners;

use App\Events\UserRegistered;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;

class SendWelcomeEmail implements ShouldQueue
{
    use InteractsWithQueue;

    // Cola específica para este listener
    public string $queue = 'emails';
    
    // Delay antes de ejecutarse
    public int $delay = 30; // 30 segundos después del evento
    
    // Intentos si falla
    public int $tries = 3;

    public function handle(UserRegistered $event): void
    {
        Mail::to($event->user)->send(new WelcomeMail($event->user));
    }
    
    public function failed(UserRegistered $event, \Throwable $exception): void
    {
        \Log::error("Fallo al enviar email de bienvenida", [
            'user_id' => $event->user->id,
            'error'   => $exception->getMessage(),
        ]);
    }
}
```

La mezcla de listeners síncronos y asíncronos es perfecta: algunos pueden ejecutarse inmediatamente (actualizar caché, cambiar estado en BD) y otros en background (enviar emails, llamar APIs).

## Ejemplo completo: evento de pedido completado

```php
// Event
class OrderCompleted
{
    use Dispatchable, SerializesModels;
    
    public function __construct(
        public readonly Order $order
    ) {}
}

// Listener síncrono: importante hacerlo inmediatamente
class UpdateInventory
{
    public function handle(OrderCompleted $event): void
    {
        foreach ($event->order->items as $item) {
            $item->product->decrement('stock', $item->quantity);
        }
    }
}

// Listener asíncrono: puede esperar
class SendOrderConfirmationEmail implements ShouldQueue
{
    public string $queue = 'emails';
    
    public function handle(OrderCompleted $event): void
    {
        Mail::to($event->order->user)
            ->send(new OrderConfirmationMail($event->order));
    }
}

// Listener asíncrono: proceso lento
class GenerateInvoicePdf implements ShouldQueue
{
    public string $queue = 'low';
    
    public function handle(OrderCompleted $event): void
    {
        $pdf = PDF::loadView('invoices.template', ['order' => $event->order]);
        Storage::put("invoices/order-{$event->order->id}.pdf", $pdf->output());
        
        $event->order->update(['invoice_generated' => true]);
    }
}

// En el controlador: una sola línea dispara todo
public function completeOrder(Order $order)
{
    $order->update(['status' => 'completed', 'completed_at' => now()]);
    
    OrderCompleted::dispatch($order);
    
    return response()->json(['message' => 'Pedido completado']);
}
```

## Eventos del modelo Eloquent

Eloquent dispara eventos automáticamente en el ciclo de vida de los modelos:

```php
// Observer: maneja todos los eventos de un modelo
class PostObserver
{
    public function created(Post $post): void
    {
        // Después de crear un post
        Cache::tags('posts')->flush();
    }

    public function updated(Post $post): void
    {
        // Después de actualizar
        if ($post->wasChanged('slug')) {
            $this->handleSlugChange($post);
        }
    }

    public function deleting(Post $post): void
    {
        // ANTES de eliminar (puede cancelar la operación)
        if ($post->is_featured) {
            throw new \Exception('No se puede eliminar un post destacado');
        }
    }

    public function deleted(Post $post): void
    {
        // Después de eliminar
        Storage::delete($post->image_path);
    }
}

// Registrar el observer
// En AppServiceProvider::boot()
Post::observe(PostObserver::class);
```

## Conclusión

Los eventos y listeners son el mecanismo de Laravel para aplicar el principio Open/Closed: tu controlador está cerrado a modificación (no necesitas tocarlo para añadir nueva lógica) pero abierto a extensión (añades nuevos listeners). Cuando tu controlador de registro necesite hacer algo más, solo añades un listener. Sin tocar el controlador. El código de cada responsabilidad vive en su propia clase. Eso es código mantenible.
