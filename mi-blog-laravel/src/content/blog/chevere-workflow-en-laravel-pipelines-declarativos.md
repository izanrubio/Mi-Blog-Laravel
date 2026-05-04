---
title: 'Chevere Workflow en Laravel: Pipelines Declarativos'
description: 'Crea flujos de trabajo complejos y paralelos en Laravel con Chevere Workflow. Manejo de dependencias, ejecución asíncrona y lógica condicional.'
pubDate: '2025-05-04'
tags: ['laravel', 'workflows', 'asincronía', 'php']
---

## Chevere Workflow en Laravel: Construye Pipelines Declarativos sin Complejidad

En aplicaciones modernas, es común necesitar ejecutar procesos complejos con múltiples pasos, dependencias entre ellos, y ejecución paralela. Laravel proporciona herramientas como Jobs y Queues, pero cuando tus flujos se vuelven muy complejos, mantenerlos se convierte en un dolor de cabeza.

**Chevere Workflow** es un motor de flujos de trabajo PHP que permite definir pipelines declarativamente, manejando automáticamente resolución de dependencias, ejecución paralela y lógica condicional. En este artículo aprenderás cómo integrarlo en Laravel para simplificar tus procesos más complejos.

## ¿Por qué necesitas Chevere Workflow?

Imagina que tienes un flujo de procesamiento de órdenes donde necesitas:

1. Validar la orden
2. Procesar el pago (en paralelo: validar inventario, verificar dirección)
3. Generar la factura (después del pago)
4. Enviar confirmación al cliente
5. Actualizar analíticas

Con Jobs tradicionales, terminarías con callbacks anidados, lógica condicional esparcida por tu código, y dificultad para reutilizar pasos. **Chevere Workflow** te permite definir esto de forma clara y mantenible.

## Instalación y configuración

Primero, instala Chevere Workflow via Composer:

```bash
composer require chevere/workflow
```

Una vez instalado, crea un directorio para tus flujos de trabajo en tu proyecto Laravel:

```bash
mkdir -p app/Workflows
```

## Conceptos fundamentales

Antes de empezar, entiende estos conceptos clave:

### Job
Una unidad de trabajo individual. Recibe inputs, ejecuta lógica y retorna outputs.

### Workflow
Un conjunto de Jobs conectados que forman un flujo completo.

### Step
Cada paso en el workflow que puede ejecutarse secuencial o paralelamente.

### Dependency Resolution
Chevere resuelve automáticamente el orden de ejecución basándose en las dependencias entre pasos.

## Tu primer Workflow

Vamos a crear un workflow simple para procesar un pedido. Primero, define tus Jobs:

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class ValidateOrderJob implements JobInterface
{
    public function __invoke(array $order): array
    {
        if (empty($order['id'] ?? null)) {
            throw new \InvalidArgumentException('Order ID is required');
        }

        return ['order_id' => $order['id'], 'valid' => true];
    }

    public function description(): string
    {
        return 'Validates the order data';
    }
}
```

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class ProcessPaymentJob implements JobInterface
{
    public function __invoke(string $order_id, float $amount): array
    {
        // Simular procesamiento de pago
        return [
            'transaction_id' => uniqid('txn_'),
            'status' => 'completed',
            'amount' => $amount
        ];
    }

    public function description(): string
    {
        return 'Processes the payment for the order';
    }
}
```

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class GenerateInvoiceJob implements JobInterface
{
    public function __invoke(string $order_id, string $transaction_id): array
    {
        return [
            'invoice_id' => 'INV-' . date('YmdHis'),
            'order_id' => $order_id,
            'transaction_id' => $transaction_id
        ];
    }

    public function description(): string
    {
        return 'Generates an invoice for the order';
    }
}
```

Ahora, define el workflow que orquesta estos Jobs:

```php
<?php

namespace App\Workflows;

use Chevere\Workflow\Workflow;
use App\Workflows\Jobs\{ValidateOrderJob, ProcessPaymentJob, GenerateInvoiceJob};

class OrderProcessingWorkflow extends Workflow
{
    public function definition(): void
    {
        $this->addJob('validate', new ValidateOrderJob())
            ->withInputVariable('order');

        $this->addJob('payment', new ProcessPaymentJob())
            ->withReference('order_id', 'validate', 'order_id')
            ->withInputVariable('amount');

        $this->addJob('invoice', new GenerateInvoiceJob())
            ->withReference('order_id', 'validate', 'order_id')
            ->withReference('transaction_id', 'payment', 'transaction_id');
    }
}
```

## Ejecutar tu Workflow desde Laravel

Crea un controlador para ejecutar el workflow:

```php
<?php

namespace App\Http\Controllers;

use App\Workflows\OrderProcessingWorkflow;
use Chevere\Workflow\Workflow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function processOrder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|integer',
            'amount' => 'required|numeric|min:0.01'
        ]);

        try {
            $workflow = new OrderProcessingWorkflow();
            
            $runner = $workflow->runner(
                'validate' => ['order' => ['id' => $validated['id']]],
                'payment' => ['amount' => $validated['amount']]
            );

            $response = $runner->run();

            return response()->json([
                'success' => true,
                'data' => [
                    'invoice' => $response['invoice'],
                    'payment' => $response['payment']
                ]
            ]);

        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'error' => $e->getMessage()
            ], 400);
        }
    }
}
```

## Workflows avanzados: Ejecución paralela

Chevere permite ejecutar múltiples Jobs en paralelo cuando no tienen dependencias entre ellos. Aquí un ejemplo donde validamos inventario y dirección simultáneamente:

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class CheckInventoryJob implements JobInterface
{
    public function __invoke(string $product_id): array
    {
        // Simular verificación de inventario
        return ['product_id' => $product_id, 'in_stock' => true, 'quantity' => 100];
    }

    public function description(): string
    {
        return 'Checks product availability in inventory';
    }
}
```

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class ValidateAddressJob implements JobInterface
{
    public function __invoke(string $address): array
    {
        return ['address' => $address, 'valid' => true, 'zone' => 'standard'];
    }

    public function description(): string
    {
        return 'Validates shipping address';
    }
}
```

```php
<?php

namespace App\Workflows;

use Chevere\Workflow\Workflow;
use App\Workflows\Jobs\{
    ValidateOrderJob, 
    CheckInventoryJob, 
    ValidateAddressJob,
    ProcessPaymentJob
};

class AdvancedOrderWorkflow extends Workflow
{
    public function definition(): void
    {
        // Paso 1: Validar orden
        $this->addJob('validate', new ValidateOrderJob())
            ->withInputVariable('order');

        // Pasos 2 y 3: Se ejecutan EN PARALELO (sin dependencias entre ellos)
        $this->addJob('inventory', new CheckInventoryJob())
            ->withInputVariable('product_id');

        $this->addJob('address', new ValidateAddressJob())
            ->withInputVariable('address');

        // Paso 4: Depende de los anteriores
        $this->addJob('payment', new ProcessPaymentJob())
            ->withReference('order_id', 'validate', 'order_id')
            ->withInputVariable('amount');
    }
}
```

Los Jobs `inventory` y `address` se ejecutarán en paralelo porque ambos dependen solo de variables de entrada, no del resultado de otros Jobs. Chevere resuelve esto automáticamente.

## Manejo de errores y condicionales

Chevere permite condiciones y manejo de excepciones sofisticado:

```php
<?php

namespace App\Workflows\Jobs;

use Chevere\Workflow\Interfaces\JobInterface;

class ApplyDiscountJob implements JobInterface
{
    public function __invoke(float $amount, string $zone): array
    {
        $discount = $zone === 'premium' ? 0.1 : 0;
        $final_amount = $amount * (1 - $discount);

        return [
            'original_amount' => $amount,
            'discount_percentage' => $discount * 100,
            'final_amount' => $final_amount
        ];
    }

    public function description(): string
    {
        return 'Applies conditional discount based on shipping zone';
    }
}
```

En tu workflow:

```php
$this->addJob('discount', new ApplyDiscountJob())
    ->withReference('amount', 'payment', 'amount')
    ->withReference('zone', 'address', 'zone');
```

## Testing de Workflows

Integra tus workflows con testing:

```php
<?php

namespace Tests\Unit;

use App\Workflows\OrderProcessingWorkflow;
use PHPUnit\Framework\TestCase;

class OrderProcessingWorkflowTest extends TestCase
{
    public function test_order_processing_workflow_succeeds()
    {
        $workflow = new OrderProcessingWorkflow();
        
        $result = $workflow->runner([
            'validate' => ['order' => ['id' => 123]],
            'payment' => ['amount' => 99.99]
        ])->run();

        $this->assertArrayHasKey('invoice', $result);
        $this->assertArrayHasKey('payment', $result);
        $this->assertEquals('completed', $result['payment']['status']);
    }

    public function test_invalid_order_throws_exception()
    {
        $workflow = new OrderProcessingWorkflow();

        $this->expectException(\InvalidArgumentException::class);
        
        $workflow->runner([
            'validate' => ['order' => ['id' => null]],
            'payment' => ['amount' => 99.99]
        ])->run();
    }
}
```

## Integración con Queue y Jobs de Laravel

Para procesos largos, ejecuta el workflow en background:

```php
<?php

namespace App\Jobs;

use App\Workflows\OrderProcessingWorkflow;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class ProcessOrderWorkflowJob implements ShouldQueue
{
    use Queueable;

    public function __construct(private array $orderData) {}

    public function handle()
    {
        $workflow = new OrderProcessingWorkflow();
        $result = $workflow->runner([
            'validate' => ['order' => $this->orderData],
            'payment' => ['amount' => $this->orderData['amount']]
        ])->run();

        // Guardar resultado, notificar usuario, etc.
        cache()->put("order_{$this->orderData['id']}_result", $result, now()->addHours(24));
    }
}
```

## Debugging y visualización

Chevere genera reportes detallados de ejecución:

```php
$workflow = new OrderProcessingWorkflow();
$runner = $workflow->runner($inputs);

try {
    $result = $runner->run();
} catch (\Throwable $e) {
    \Log::error('Workflow failed', [
        'workflow' => OrderProcessingWorkflow::class,
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString()
    ]);
    throw $e;
}
```

## Casos de uso reales

**Chevere Workflow es ideal para:**

- Procesamiento de órdenes e-commerce
- Pipelines de ETL (Extract, Transform, Load)
- Flujos de aprobación complejos
- Procesamiento de documentos multi-paso
- Orquestación de microservicios
- Workflows de automación empresarial

## Ventajas vs soluciones alternativas

| Característica | Chevere | Jobs Laravel | State Machines |
|---|---|---|---|
| Resolución automática de dependencias | ✅ | ❌ | ✅ |
| Ejecución paralela declarativa | ✅ | Manual | ✅ |
| Sintaxis legible | ✅ | ✅ | ⚠️ |
| Overhead mínimo | ✅ | ✅ | ⚠️ |
| Reutilización de pasos | ✅ | ✅ | ✅ |

## Puntos clave

- **Chevere Workflow** simplifica la orquestación de procesos complejos en Laravel mediante definiciones declarativas
- Los **Jobs** son unidades reutilizables que ejecutan lógica específica con inputs y outputs definidos
- La **resolución automática de dependencias** evita errores y simplifica el mantenimiento
- La **ejecución paralela** ocurre automáticamente cuando Jobs no tienen dependencias entre ellos
- Se integra perfectamente con **Laravel Jobs y Queues** para procesos en background
- El **error handling** es limpio y separado del código de definición del workflow
- Es ideal para **e-commerce, ETL, aprobaciones y automación empresarial**
- Los **tests** son simples porque los workflows son predecibles y aislados
- Mantiene tu código **limpio y mantenible** en comparación con callbacks anidados
- Documenta automáticamente la estructura del flujo mediante el código mismo