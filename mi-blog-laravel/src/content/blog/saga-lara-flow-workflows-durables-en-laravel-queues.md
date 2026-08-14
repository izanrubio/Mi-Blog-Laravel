---
title: 'Saga Lara Flow: Workflows Durables en Laravel Queues'
description: 'Aprende a implementar workflows durables con transacciones compensatorias en Laravel. Ejecuta procesos de larga duración con rollback automático.'
pubDate: '2025-01-15'
tags: ['laravel', 'queues', 'workflows', 'saga-pattern']
---

## Saga Lara Flow: Workflows Durables en Laravel Queues

En el desarrollo de aplicaciones modernas, es común enfrentarse a procesos de negocio complejos que involucran múltiples pasos interdependientes. Desde procesar pedidos hasta orquestar integraciones con servicios externos, estos workflows necesitan ser resilientes, recuperables y capaces de revertir cambios cuando algo falla.

**Saga Lara Flow** es un paquete de Laravel creado por Andriy Karpishyn que implementa el patrón Saga, permitiendo ejecutar procesos de larga duración como métodos PHP reproducibles, con rollback automático cuando un paso falla.

En este artículo, exploraremos cómo funcionan los workflows durables, qué son las transacciones compensatorias y cómo implementar esto en tus aplicaciones Laravel.

## ¿Qué es el patrón Saga?

El patrón Saga es una solución arquitectónica para manejar transacciones distribuidas en sistemas que no pueden usar transacciones ACID tradicionales. En lugar de bloquear recursos como en una base de datos relacional, las sagas ejecutan una serie de pasos locales, cada uno con su propia transacción.

Lo crucial: **cada paso debe tener una compensación** —una acción que revierte el cambio si algo sale mal.

### Ejemplo real: Procesar un pedido

Imagina un proceso de pedido que involucra:

1. Reservar inventario
2. Procesar pago
3. Crear envío
4. Enviar notificación

Si el pago falla en el paso 2, necesitas deshacer la reserva del inventario. Con Saga Lara Flow, esto se maneja automáticamente.

## Instalando Saga Lara Flow

```bash
composer require andriyk/saga-lara-flow
```

Después de instalar, el paquete registra automáticamente sus proveedores de servicios.

## Estructura básica de un Saga

Un Saga en Lara Flow es una clase que define pasos y sus compensaciones. Cada paso es un método que debe retornar un resultado, y cada compensación es un método que revierte cambios.

```php
<?php

namespace App\Sagas;

use Andriyk\SagaLaraFlow\Saga;
use App\Models\Order;

class ProcessOrderSaga extends Saga
{
    protected Order $order;

    public function __construct(Order $order)
    {
        $this->order = $order;
    }

    /**
     * Paso 1: Reservar inventario
     */
    public function reserveInventory(): void
    {
        $this->order->items->each(function ($item) {
            $item->product->decrement('stock', $item->quantity);
            
            // Registrar el cambio para compensación
            $this->addCompensation('revertInventory', [
                'product_id' => $item->product_id,
                'quantity' => $item->quantity
            ]);
        });
    }

    /**
     * Compensación: Restaurar inventario
     */
    public function revertInventory(array $data): void
    {
        Product::find($data['product_id'])
            ->increment('stock', $data['quantity']);
    }

    /**
     * Paso 2: Procesar pago
     */
    public function processPayment(): void
    {
        $payment = Payment::create([
            'order_id' => $this->order->id,
            'amount' => $this->order->total,
            'status' => 'pending'
        ]);

        // Simular procesamiento
        if (!$this->chargeCard($payment)) {
            throw new \Exception('Payment failed');
        }

        $payment->update(['status' => 'completed']);

        // Registrar compensación
        $this->addCompensation('refundPayment', [
            'payment_id' => $payment->id
        ]);
    }

    /**
     * Compensación: Revertir pago
     */
    public function refundPayment(array $data): void
    {
        $payment = Payment::find($data['payment_id']);
        $payment->update(['status' => 'refunded']);
        
        // Llamar a proveedor de pagos para refund
        PaymentGateway::refund($payment->gateway_id);
    }

    /**
     * Paso 3: Crear envío
     */
    public function createShipment(): void
    {
        $shipment = Shipment::create([
            'order_id' => $this->order->id,
            'status' => 'pending'
        ]);

        $this->addCompensation('cancelShipment', [
            'shipment_id' => $shipment->id
        ]);
    }

    /**
     * Compensación: Cancelar envío
     */
    public function cancelShipment(array $data): void
    {
        Shipment::find($data['shipment_id'])
            ->update(['status' => 'cancelled']);
    }

    /**
     * Paso 4: Enviar notificación
     */
    public function notifyCustomer(): void
    {
        Mail::to($this->order->customer->email)
            ->send(new OrderConfirmation($this->order));
    }

    /**
     * Método privado auxiliar
     */
    private function chargeCard(Payment $payment): bool
    {
        // Integración con proveedor de pagos
        return true;
    }
}
```

## Ejecutando un Saga

Una vez definido el Saga, ejecutarlo es simple:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Sagas\ProcessOrderSaga;
use Andriyk\SagaLaraFlow\Facades\SagaOrchestrator;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        try {
            SagaOrchestrator::execute(
                new ProcessOrderSaga($order)
            );

            return response()->json([
                'message' => 'Order processed successfully',
                'order' => $order
            ], 201);

        } catch (\Exception $e) {
            // El saga detecta el error y ejecuta compensaciones automáticamente
            return response()->json([
                'error' => 'Order processing failed',
                'message' => $e->getMessage()
            ], 422);
        }
    }
}
```

## Sagas Asíncronos con Queues

Para procesos de larga duración, es mejor ejecutar sagas de forma asíncrona usando las colas de Laravel:

```php
<?php

namespace App\Jobs;

use App\Models\Order;
use App\Sagas\ProcessOrderSaga;
use Andriyk\SagaLaraFlow\Facades\SagaOrchestrator;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected int $orderId;

    public function __construct(int $orderId)
    {
        $this->orderId = $orderId;
    }

    public function handle(): void
    {
        $order = Order::findOrFail($this->orderId);

        SagaOrchestrator::execute(
            new ProcessOrderSaga($order)
        );
    }

    public function failed(\Throwable $exception): void
    {
        $order = Order::find($this->orderId);
        
        // Registrar error en la base de datos
        $order->update(['status' => 'failed']);
        
        // Notificar al equipo
        Log::error('Order processing failed', [
            'order_id' => $this->orderId,
            'error' => $exception->getMessage()
        ]);
    }
}
```

Despacharlo desde tu controlador:

```php
public function store(Request $request)
{
    $order = Order::create($request->validated());
    
    ProcessOrderJob::dispatch($order->id);

    return response()->json([
        'message' => 'Order submitted for processing',
        'order' => $order
    ], 202); // Accepted - procesamiento en background
}
```

## Manejo avanzado de compensaciones

Algunas veces necesitas más control sobre cuándo y cómo ejecutar compensaciones. Saga Lara Flow permite esto:

```php
<?php

namespace App\Sagas;

use Andriyk\SagaLaraFlow\Saga;

class AdvancedOrderSaga extends Saga
{
    /**
     * Paso con lógica condicional
     */
    public function processPaymentWithRetry(): void
    {
        $maxRetries = 3;
        $attempt = 0;

        do {
            try {
                $payment = $this->attemptPayment();
                
                $this->addCompensation('refundPayment', [
                    'payment_id' => $payment->id
                ]);
                
                break;
                
            } catch (\Exception $e) {
                $attempt++;
                
                if ($attempt >= $maxRetries) {
                    throw $e;
                }
                
                sleep(2 ** $attempt); // Exponential backoff
            }
        } while ($attempt < $maxRetries);
    }

    /**
     * Compensaciones con lógica personalizada
     */
    public function refundPayment(array $data): void
    {
        $payment = Payment::find($data['payment_id']);
        
        // Solo refundar si ya fue procesado
        if ($payment->status !== 'completed') {
            return;
        }

        PaymentGateway::refund($payment->gateway_id);
        $payment->update(['status' => 'refunded']);
    }

    private function attemptPayment(): Payment
    {
        // Lógica de intento de pago
        return Payment::create([]);
    }
}
```

## Rastreando el estado del Saga

Para aplicaciones en producción, es importante monitorear el progreso y estado de tus sagas:

```php
<?php

namespace App\Services;

use Andriyk\SagaLaraFlow\Facades\SagaOrchestrator;

class SagaMonitor
{
    /**
     * Registrar cada paso completado
     */
    public function logStepCompletion(string $sagaName, string $step, $result): void
    {
        SagaHistory::create([
            'saga_name' => $sagaName,
            'step' => $step,
            'status' => 'completed',
            'result' => json_encode($result),
            'completed_at' => now()
        ]);
    }

    /**
     * Registrar compensaciones ejecutadas
     */
    public function logCompensation(string $sagaName, string $method, array $data): void
    {
        SagaHistory::create([
            'saga_name' => $sagaName,
            'step' => $method,
            'status' => 'compensated',
            'data' => json_encode($data),
            'compensated_at' => now()
        ]);
    }

    /**
     * Obtener historial de un saga
     */
    public function getHistory(int $orderId)
    {
        return SagaHistory::where('order_id', $orderId)
            ->orderBy('created_at')
            ->get();
    }
}
```

## Comparación: Saga vs Transacciones tradicionales

| Aspecto | Transacciones ACID | Saga Pattern |
|--------|-------------------|--------------|
| **Consistencia** | Fuerte | Eventual |
| **Bloqueos** | Sí, pueden ser lentos | No, optimista |
| **Rollback automático** | Sí | Manual (compensaciones) |
| **Sistemas distribuidos** | Limitado | Diseñado para ello |
| **Complejidad** | Baja | Media-Alta |

## Mejores prácticas

### 1. Idempotencia

Cada paso debe ser idempotente —ejecutarlo múltiples veces debe producir el mismo resultado:

```php
public function reserveInventory(): void
{
    // ❌ Malo: Sin verificación
    $this->order->items->each(function ($item) {
        $item->product->decrement('stock', $item->quantity);
    });

    // ✅ Bueno: Verificar si ya se procesó
    $this->order->items->each(function ($item) {
        if ($item->reserved_at === null) {
            $item->product->decrement('stock', $item->quantity);
            $item->update(['reserved_at' => now()]);
        }
    });
}
```

### 2. Información de contexto

Almacena datos necesarios para compensación:

```php
$this->addCompensation('refundPayment', [
    'payment_id' => $payment->id,
    'amount' => $payment->amount,
    'gateway_id' => $payment->gateway_id,
    'timestamp' => now()->timestamp
]);
```

### 3. Logging y monitoreo

Registra cada paso para debugging:

```php
public function processPayment(): void
{
    Log::info('Processing payment', [
        'order_id' => $this->order->id,
        'amount' => $this->order->total
    ]);

    try {
        // Lógica...
    } catch (\Exception $e) {
        Log::error('Payment failed', [
            'order_id' => $this->order->id,
            'error' => $e->getMessage()
        ]);
        throw $e;
    }
}
```

## Casos de uso ideales

- **E-commerce**: Procesamiento de pedidos complejos
- **Fintech**: Transferencias de dinero entre cuentas
- **Microservicios**: Orquestación entre servicios independientes
- **Workflow de negocio**: Procesos multi-paso que requieren rollback

## Puntos clave

- **Saga Lara Flow implementa el patrón Saga** para workflows durables en Laravel Queues
- **Las compensaciones son acciones que revierten cambios** cuando un paso falla
- **Cada paso debe ser idempotente** para evitar duplicación
- **Los sagas asíncronos** permiten procesos de larga duración sin bloquear
- **El patrón Saga es ideal para sistemas distribuidos** donde ACID no es posible
- **Registra historial y compensaciones** para auditoría y debugging
- **La ejecución automática de compensaciones** evita inconsistencias de datos
- **Funciona perfectamente con Laravel Queues** para procesamiento en background