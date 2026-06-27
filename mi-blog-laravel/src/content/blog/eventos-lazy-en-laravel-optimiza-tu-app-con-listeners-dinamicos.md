---
title: 'Eventos Lazy en Laravel: Optimiza tu App con Listeners Dinámicos'
description: 'Aprende a usar eventos lazy listeners en Laravel para cargar listeners solo cuando se necesitan y mejorar el rendimiento de tu aplicación.'
pubDate: '2026-06-14'
tags: ['laravel', 'php', 'eventos', 'performance', 'architecture']
---

## Eventos Lazy en Laravel: Optimiza tu App con Listeners Dinámicos

Los eventos en Laravel son poderosos para desacoplar código y mantener arquitecturas limpias. Sin embargo, registrar decenas de listeners en tu Service Provider puede ralentizar significativamente el bootstrap de tu aplicación. Los eventos lazy (listeners perezosos) resuelven este problema cargando listeners solo cuando se necesiten.

## ¿Qué Son los Eventos Lazy en Laravel?

Un evento lazy es un listener que no se registra en el contenedor de servicios hasta que el evento que lo dispara es realmente invocado. Esto significa que si tu evento nunca ocurre en una petición específica, el código del listener nunca se cargará ni ejecutará.

Este patrón es especialmente útil cuando tienes:

- **Múltiples listeners** que solo se ejecutan en circunstancias específicas
- **Operaciones pesadas** en listeners (consultas a BD, llamadas a APIs externas)
- **Listeners condicionados** que dependen de ciertos estados de la aplicación

## Cómo Funcionan los Listeners Tradicionales

Antes de ver los lazy listeners, recordemos cómo registramos listeners normalmente en `EventServiceProvider`:

```php
<?php

namespace App\Providers;

use App\Events\UserRegistered;
use App\Events\OrderCreated;
use App\Listeners\SendWelcomeEmail;
use App\Listeners\UpdateInventory;
use App\Listeners\LogOrderEvent;
use App\Listeners\NotifyAdmins;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        UserRegistered::class => [
            SendWelcomeEmail::class,
        ],
        OrderCreated::class => [
            UpdateInventory::class,
            LogOrderEvent::class,
            NotifyAdmins::class,
        ],
    ];
}
```

Aunque este código se ve limpio, Laravel carga **todos estos listeners en memoria** cuando inicializa la aplicación, aunque solo algunos se ejecuten.

## Introduciendo Listeners Lazy

Los listeners lazy resuelven esto registrándose dinámicamente. Laravel proporciona un método `listen()` que permite registrar listeners con una clase `Closure` que se ejecuta solo cuando se necesita:

```php
<?php

namespace App\Providers;

use App\Events\UserRegistered;
use App\Events\OrderCreated;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Listeners lazy usando closures
        $this->app['events']->listen(
            UserRegistered::class,
            [SendWelcomeEmail::class, 'handle']
        );

        $this->app['events']->listen(
            OrderCreated::class,
            [UpdateInventory::class, 'handle']
        );

        $this->app['events']->listen(
            OrderCreated::class,
            [LogOrderEvent::class, 'handle']
        );

        $this->app['events']->listen(
            OrderCreated::class,
            [NotifyAdmins::class, 'handle']
        );
    }
}
```

Sin embargo, Laravel 13 introduce una forma más elegante usando el método `lazy()`:

```php
<?php

namespace App\Providers;

use App\Events\UserRegistered;
use App\Events\OrderCreated;
use App\Listeners\SendWelcomeEmail;
use App\Listeners\UpdateInventory;
use App\Listeners\LogOrderEvent;
use App\Listeners\NotifyAdmins;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $lazyListeners = [
        UserRegistered::class => [
            SendWelcomeEmail::class,
        ],
        OrderCreated::class => [
            UpdateInventory::class,
            LogOrderEvent::class,
            NotifyAdmins::class,
        ],
    ];

    public function boot(): void
    {
        // Los listeners se cargan solo cuando los eventos se disparan
    }
}
```

## Comparativa de Rendimiento

Veamos la diferencia real con un ejemplo. Imagina una aplicación con 50 listeners registrados, pero en una petición típica solo 3-4 se ejecutan:

### Enfoque Tradicional

```php
class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        // 50 listeners registrados...
        Event1::class => [Listener1::class, Listener2::class],
        Event2::class => [Listener3::class, Listener4::class],
        // ... etc
    ];
}
```

**Memoria usada**: ~2-3 MB adicionales (todos los listeners cargados)  
**Listeners ejecutados**: 3-4  
**Listeners cargados**: 50

### Con Lazy Listeners

```php
class EventServiceProvider extends ServiceProvider
{
    protected $lazyListeners = [
        // 50 listeners registrados, pero como lazy...
        Event1::class => [Listener1::class, Listener2::class],
        Event2::class => [Listener3::class, Listener4::class],
        // ... etc
    ];
}
```

**Memoria usada**: ~0.5 MB (solo se cargan los 3-4 listeners ejecutados)  
**Listeners ejecutados**: 3-4  
**Listeners cargados**: 3-4

## Caso Práctico: Sistema de E-commerce

Desarrollemos un sistema de pedidos que usa extensivamente eventos lazy:

```php
<?php

namespace App\Events;

use App\Models\Order;

class OrderCreated
{
    public function __construct(public Order $order)
    {}
}
```

```php
<?php

namespace App\Listeners;

use App\Events\OrderCreated;

class UpdateInventory
{
    public function handle(OrderCreated $event): void
    {
        // Operación pesada: actualizar inventario
        foreach ($event->order->items as $item) {
            $item->product->decrement('stock', $item->quantity);
        }
    }
}
```

```php
<?php

namespace App\Listeners;

use App\Events\OrderCreated;
use App\Models\Notification;

class LogOrderEvent
{
    public function handle(OrderCreated $event): void
    {
        // Registrar en auditoría
        Notification::create([
            'type' => 'order_created',
            'order_id' => $event->order->id,
            'data' => $event->order->toArray(),
        ]);
    }
}
```

```php
<?php

namespace App\Listeners;

use App\Events\OrderCreated;
use App\Mail\OrderConfirmation;
use Illuminate\Support\Facades\Mail;

class SendOrderConfirmation
{
    public function handle(OrderCreated $event): void
    {
        // Enviar email (operación lenta)
        Mail::to($event->order->customer->email)
            ->queue(new OrderConfirmation($event->order));
    }
}
```

Ahora registramos estos listeners como lazy:

```php
<?php

namespace App\Providers;

use App\Events\OrderCreated;
use App\Listeners\UpdateInventory;
use App\Listeners\LogOrderEvent;
use App\Listeners\SendOrderConfirmation;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $lazyListeners = [
        OrderCreated::class => [
            UpdateInventory::class,
            LogOrderEvent::class,
            SendOrderConfirmation::class,
        ],
    ];

    public function boot(): void
    {
        // Opcional: registrar listeners adicionales
        $this->app['events']->listen(
            OrderCreated::class,
            function (OrderCreated $event) {
                // Lógica inline si es necesario
            }
        );
    }
}
```

## Combinando Lazy Listeners con Colas

Los lazy listeners funcionan especialmente bien con colas. Puedes tener listeners que despachen jobs en background:

```php
<?php

namespace App\Listeners;

use App\Events\OrderCreated;
use App\Jobs\ProcessOrderAnalytics;
use Illuminate\Contracts\Queue\ShouldQueue;

class QueueOrderAnalytics implements ShouldQueue
{
    public function handle(OrderCreated $event): void
    {
        ProcessOrderAnalytics::dispatch($event->order);
    }
}
```

El listener se carga solo cuando el evento `OrderCreated` se dispara, y luego despacha un job que se ejecuta en background sin bloquear la petición.

## Métodos Avanzados de Listeners Lazy

### Listeners Condicionados

A veces quieres que un listener se ejecute solo bajo ciertas condiciones. Puedes hacerlo con closures:

```php
<?php

namespace App\Providers;

use App\Events\UserRegistered;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app['events']->listen(
            UserRegistered::class,
            function (UserRegistered $event) {
                // Solo ejecutar si es un plan premium
                if ($event->user->plan === 'premium') {
                    // Lógica aquí
                }
            }
        );
    }
}
```

### Listeners Wildcards Lazy

También puedes usar wildcards para capturar múltiples eventos:

```php
<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app['events']->listen('order.*', function ($event, $data) {
            // Se ejecuta para order.created, order.shipped, etc.
            \Log::info('Order event: ' . $event);
        });
    }
}
```

## Diferencias Entre Métodos de Registro

```php
<?php

// Método 1: Propiedad $listen (carga todos en bootstrap)
protected $listen = [
    OrderCreated::class => [UpdateInventory::class],
];

// Método 2: Propiedad $lazyListeners (carga solo si se dispara)
protected $lazyListeners = [
    OrderCreated::class => [UpdateInventory::class],
];

// Método 3: Boot method con listen() (carga solo si se dispara)
public function boot(): void
{
    $this->app['events']->listen(
        OrderCreated::class,
        [UpdateInventory::class, 'handle']
    );
}

// Método 4: Boot method con closure (carga solo si se dispara)
public function boot(): void
{
    $this->app['events']->listen(
        OrderCreated::class,
        function (OrderCreated $event) {
            // Lógica inline
        }
    );
}
```

## Debuqueando Listeners Lazy

Cuando trabajes con listeners lazy, puede ser útil verificar cuáles se están ejecutando. Usa Laravel Telescope o agrega logs:

```php
<?php

namespace App\Listeners;

use App\Events\OrderCreated;
use Illuminate\Support\Facades\Log;

class DebugOrderListener
{
    public function handle(OrderCreated $event): void
    {
        Log::info('Order listener executed', [
            'order_id' => $event->order->id,
            'listener' => self::class,
        ]);
    }
}
```

En producción, puedes monitorear con Laravel Telescope:

```
php artisan tinker

>>> Event::fake();
>>> event(new OrderCreated($order));
>>> Event::assertDispatched(OrderCreated::class);
```

## Mejores Prácticas

### ✅ Hazlo

- Usa lazy listeners para listeners que no se ejecutan en cada petición
- Agrupa listeners relacionados en archivos dedicados
- Documenta qué eventos dispara tu código
- Usa type hints completos en tus listeners

### ❌ Evítalo

- No mezcles listeners lazy y tradicionales sin razón clara
- No hagas listeners lazy si se ejecutan en casi todas las peticiones
- No registres lógica crítica en listeners pesados sin monitoreo
- No olvides manejar excepciones en listeners

## Integración con Testing

Cuando testees eventos con listeners lazy, asegúrate de que se disparan correctamente:

```php
<?php

namespace Tests\Feature;

use App\Events\OrderCreated;
use App\Models\Order;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class OrderEventTest extends TestCase
{
    public function test_order_created_event_dispatches_listeners(): void
    {
        Event::fake();

        $order = Order::factory()->create();
        event(new OrderCreated($order));

        Event::assertDispatched(OrderCreated::class);
    }

    public function test_specific_listener_is_called(): void
    {
        $this->expectsJob(\App\Jobs\ProcessOrderAnalytics::class);

        $order = Order::factory()->create();
        event(new OrderCreated($order));
    }
}
```

## Conclusión

Los eventos lazy en Laravel son una herramienta poderosa para optimizar el rendimiento de aplicaciones grandes con múltiples listeners. Al cargar código solo cuando es necesario, reduces el tiempo de bootstrap, mejoras la memoria utilizada y mantienen tu aplicación más ágil.

La clave está en identificar cuáles de tus listeners se ejecutan ocasionalmente y convertirlos a lazy. Con Laravel 13, esta optimización es más accesible que nunca.

## Puntos Clave

- Los listeners lazy cargan código solo cuando el evento se dispara
- Reducen significativamente el uso de memoria en aplicaciones con muchos listeners
- Se registran usando `$lazyListeners` o `$this->app['events']->listen()`
- Funcionan perfectamente con jobs en cola y operaciones asincrónicas
- Son ideales para listeners que se ejecutan ocasionalmente
- Mantienen el mismo nivel de features que los listeners tradicionales
- Facilitan la escalabilidad de aplicaciones grandes
- Mejoran el tiempo de bootstrap de tu aplicación