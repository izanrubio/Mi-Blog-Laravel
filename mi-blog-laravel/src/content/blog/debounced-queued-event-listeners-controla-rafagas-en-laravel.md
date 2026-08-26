---
title: 'Debounced Queued Event Listeners: Controla Ráfagas en Laravel'
description: 'Aprende a usar #[DebounceFor] en event listeners encolados para colapsar eventos repetidos y optimizar tu aplicación Laravel sin perder datos.'
pubDate: '2025-08-22'
tags: ['laravel', 'eventos', 'queues', 'performance', 'php']
---

## Debounced Queued Event Listeners: Controla Ráfagas en Laravel

Uno de los problemas clásicos en aplicaciones Laravel es cuando un evento se dispara múltiples veces en poco tiempo, generando procesamiento innecesario. Imagina un sistema donde cada cambio en un producto dispara un evento que recalcula estadísticas, o una aplicación de análisis en tiempo real que recibe cientos de eventos idénticos por segundo. Esto genera colas masivas y consume recursos innecesarios.

Laravel 13 introduce una solución elegante: el atributo **`#[DebounceFor]`** ahora funciona en event listeners encolados, permitiéndote colapsar ráfagas de eventos idénticos en una única ejecución. Este artículo te enseña cómo implementarlo correctamente.

## ¿Qué es Debouncing y por qué importa?

**Debouncing** es una técnica que agrupa múltiples invocaciones de una función en una sola ejecución, esperando un tiempo determinado antes de actuar. Es especialmente útil cuando:

- Un usuario edita rápidamente un documento (múltiples eventos de cambio)
- Se reciben eventos de sensores o APIs en ráfagas
- Necesitas procesar datos pero quieres evitar duplicados
- Los recursos son limitados y tienes que optimizar

En Laravel, el atributo `#[DebounceFor]` ya existía para listeners síncronos, pero ahora **también funciona con listeners encolados**, ofreciendo mejor rendimiento y control.

## Diferencia entre Debounce Síncrono y en Queues

### Debounce Síncrono (Tradicional)

Collapsa eventos en **memoria**, útil para operaciones rápidas:

```php
use Illuminate\Events\Attributes\DebounceFor;

class EmailChangeListener
{
    #[DebounceFor(seconds: 5)]
    public function handle(UserEmailChanged $event)
    {
        // Se ejecuta solo una vez cada 5 segundos
        // aunque el evento se dispare 100 veces
    }
}
```

**Limitación**: Si tu aplicación se reinicia, pierde el estado del debounce.

### Debounce en Queues (Nuevo)

Collapsa eventos en **almacenamiento distribuido** (Redis, base de datos):

```php
use Illuminate\Events\Attributes\DebounceFor;
use Illuminate\Contracts\Queue\ShouldQueue;

class NotifyUserListener implements ShouldQueue
{
    #[DebounceFor(seconds: 30, debounceId: 'user.{event.userId}')]
    public function handle(UserActivityLogged $event)
    {
        // Se ejecuta una sola vez cada 30 segundos por usuario
        // Los eventos se colapsan en la cola, no en memoria
    }
}
```

La ventaja es que funciona en entornos distribuidos con múltiples workers.

## Implementación Práctica: Sistema de Notificaciones

Veamos un caso real: un e-commerce donde cada compra genera múltiples eventos (pago, inventario, notificación). Sin debouncing, el usuario recibe 3-4 emails simultáneamente.

### Paso 1: Crear el Evento

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderProcessed
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $orderId,
        public int $userId,
        public string $status,
    ) {}
}
```

### Paso 2: Crear el Listener con Debounce

```php
<?php

namespace App\Listeners;

use App\Events\OrderProcessed;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Events\Attributes\DebounceFor;
use Illuminate\Queue\InteractsWithQueue;

class SendOrderNotification implements ShouldQueue
{
    use InteractsWithQueue;

    // Collapsa eventos del mismo usuario en 10 segundos
    #[DebounceFor(seconds: 10, debounceId: 'order.notify.{event.userId}')]
    public function handle(OrderProcessed $event): void
    {
        $user = \App\Models\User::find($event->userId);
        
        \Illuminate\Support\Facades\Mail::to($user->email)->send(
            new \App\Mail\OrderStatusNotification($event)
        );

        \Log::info("Notificación enviada para orden: {$event->orderId}");
    }
}
```

**Nota**: El `debounceId` usa notación `{event.property}` para acceder dinámicamente a propiedades del evento.

### Paso 3: Registrar el Listener

En `EventServiceProvider`:

```php
<?php

namespace App\Providers;

use App\Events\OrderProcessed;
use App\Listeners\SendOrderNotification;
use Illuminate\Foundation\Support\Providers\EventServiceProvider as ServiceProvider;

class EventServiceProvider extends ServiceProvider
{
    protected $listen = [
        OrderProcessed::class => [
            SendOrderNotification::class,
        ],
    ];
}
```

## Parámetros Avanzados del Debounce

El atributo `#[DebounceFor]` acepta varios parámetros:

```php
#[DebounceFor(
    seconds: 30,                    // Tiempo de espera entre ejecuciones
    debounceId: 'user.{event.id}', // ID única del debounce
    maxWait: 120                    // Tiempo máximo antes de ejecutar forzadamente
)]
public function handle(MyEvent $event): void
{
    // ...
}
```

- **`seconds`**: Tiempo de espera entre eventos
- **`debounceId`**: Clave única para agrupar eventos (soporta dinámicas)
- **`maxWait`**: Si se acumulan eventos por más de `maxWait` segundos, ejecuta igualmente (útil para garantizar procesamiento)

## Caso de Uso: Sincronización de Inventario

En una tienda multi-canal, cada venta en diferentes plataformas genera eventos de actualización de stock:

```php
<?php

namespace App\Listeners;

use App\Events\InventoryUpdated;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Events\Attributes\DebounceFor;

class SyncInventoryToWarehouse implements ShouldQueue
{
    // Agrupa todas las actualizaciones del mismo producto en 15 segundos
    #[DebounceFor(
        seconds: 15,
        debounceId: 'inventory.sync.{event.productId}',
        maxWait: 60 // Si pasan 60 segundos, sincroniza aunque siga habiendo eventos
    )]
    public function handle(InventoryUpdated $event): void
    {
        $product = \App\Models\Product::find($event->productId);
        $currentStock = $product->getCurrentStock();

        // API call a warehouse
        $response = \Http::post('https://warehouse-api.com/sync', [
            'product_id' => $event->productId,
            'quantity'   => $currentStock,
            'timestamp'  => now(),
        ]);

        if ($response->successful()) {
            \Log::info("Inventario sincronizado: {$event->productId}");
        }
    }
}
```

## Debugging y Monitoreo

Para ver qué está pasando con tus debounced listeners, usa Laravel Horizon o Telescope:

```bash
# Ver colas en tiempo real
php artisan horizon

# O inspeccionar en Tinker
php artisan tinker

# Ver jobs en Redis
>>> \Redis::keys('debounce:*')
>>> \Redis::get('debounce:order.notify.123')
```

Alternativamente, añade logging:

```php
public function handle(OrderProcessed $event): void
{
    \Log::debug("Procesando orden con debounce", [
        'order_id' => $event->orderId,
        'user_id'  => $event->userId,
        'queued_at' => now(),
    ]);
    
    // Procesa...
}
```

## Consideraciones de Rendimiento

### Ventajas
- ✅ Reduce carga en base de datos hasta 80-90% en escenarios con ráfagas
- ✅ Funciona en sistemas distribuidos (múltiples workers)
- ✅ No pierdes eventos, solo los agrupas
- ✅ Configurable con `maxWait` para garantizar procesamiento

### Desventajas
- ❌ Introduce latencia (deliberada, por diseño)
- ❌ Requiere Redis o base de datos para estado distribuido
- ❌ El `debounceId` mal diseñado puede causar colisiones

### Cuándo NO usar Debouncing

- Eventos críticos de seguridad (acceso denegado, intentos de fraude)
- Transacciones financieras
- Procesos donde el orden es importante
- Operaciones irreversibles

## Comparativa: Con vs Sin Debouncing

Sin debouncing en un pico de 1000 eventos en 5 segundos:

```
❌ Sin debouncing:
   - 1000 jobs encolados
   - 1000 consultas a BD
   - Tiempo total: ~45 segundos
   - CPU: 95%

✅ Con #[DebounceFor(seconds: 5)]:
   - 10 jobs encolados
   - 10 consultas a BD
   - Tiempo total: ~2 segundos
   - CPU: 15%
```

## Combinar con Otros Atributos

Puedes combinar `#[DebounceFor]` con otros atributos de listeners:

```php
use Illuminate\Events\Attributes\{DebounceFor, Listener};
use Illuminate\Contracts\Queue\ShouldQueue;

#[Listener]
class ProcessPayment implements ShouldQueue
{
    #[DebounceFor(seconds: 5, debounceId: 'payment.{event.userId}')]
    public function handle(PaymentAttempted $event): void
    {
        // Procesa pago debouncido
    }
}
```

## Troubleshooting Común

**Problema**: Los eventos no se están debounceando
```php
// ❌ Mal: No implementa ShouldQueue
class MyListener
{
    #[DebounceFor(seconds: 5)]
    public function handle(MyEvent $event) {}
}

// ✅ Bien: Implementa ShouldQueue
class MyListener implements ShouldQueue
{
    #[DebounceFor(seconds: 5)]
    public function handle(MyEvent $event) {}
}
```

**Problema**: debounceId dinámica no funciona
```php
// ❌ Mal: Typo en la propiedad
#[DebounceFor(debounceId: 'order.{event.userId}')]

// ✅ Bien: Verifica que la propiedad exista en el evento
#[DebounceFor(debounceId: 'order.{event.orderId}')]
```

**Problema**: Necesitas borrar un debounce manualmente
```php
// En Tinker o comando
$cache = \Cache::store('redis');
$cache->forget('debounce:order.notify.123');
```

## Puntos Clave

- **`#[DebounceFor]` en queues collapsa eventos repetidos** sin perder datos, enviando solo uno a la cola
- **`debounceId` dinámico permite agrupar por entidad**: `user.{event.userId}`, `product.{event.productId}`
- **`maxWait` garantiza ejecución incluso si llegan eventos continuamente**
- **Solo funciona en listeners que implementen `ShouldQueue`**
- **Reduce carga de base de datos hasta 90% en picos de eventos**
- **Redis o base de datos es necesario para estado distribuido** (no funciona en memoria entre workers)
- **Ideal para notificaciones, sincronización, análisis no críticos**
- **No usar en eventos de seguridad o transacciones críticas**
- **Combina con logging y Horizon para monitorear comportamiento**
- **El `maxWait` es tu red de seguridad** si los eventos no ceden