---
title: 'QueueFake en Laravel: Testing de Colas sin Dependencias'
description: 'Domina QueueFake para testear jobs y colas en Laravel sin ejecutar Redis. Guía práctica con ejemplos reales para testing avanzado.'
pubDate: '2025-07-29'
tags: ['laravel', 'testing', 'queues', 'php']
---

## Introducción

Uno de los desafíos más comunes al escribir tests en Laravel es validar que tus jobs se despachen correctamente sin ejecutar Redis o la infraestructura de colas en el entorno de pruebas. El problema es obvio: testear colas en producción es lento, frágil y requiere dependencias externas que no siempre están disponibles en tu entorno de CI/CD.

**QueueFake** es la solución elegante que Laravel proporciona para interceptar y validar el comportamiento de tus colas sin necesidad de ejecutar ningún driver real. A través de QueueFake puedes:

- Verificar que un job fue despachado
- Validar los datos pasados al job
- Probar el comportamiento de reintentos y fallos
- Simular comportamientos específicos de colas
- Testear con métodos `beforePushing` y `afterPushing`

En este artículo exploraremos las capacidades avanzadas de QueueFake, introducidas y mejoradas en las últimas versiones de Laravel, con ejemplos prácticos que puedes implementar inmediatamente.

## ¿Qué es QueueFake?

QueueFake es una implementación fake del gestor de colas de Laravel que reemplaza el driver real durante tests. En lugar de enviar jobs a Redis o a una cola real, QueueFake los almacena en memoria y te proporciona métodos de aserción para verificar que se comportaron como esperabas.

Para usarlo, simplemente llama a `Queue::fake()` al inicio de tu test:

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Queue;
use Tests\TestCase;
use App\Jobs\SendEmailJob;

class QueueTest extends TestCase
{
    public function test_job_is_dispatched()
    {
        Queue::fake();
        
        // Tu código que dispecha un job
        SendEmailJob::dispatch('user@example.com');
        
        // Verificar que el job fue despachado
        Queue::assertPushed(SendEmailJob::class);
    }
}
```

Cuando activas QueueFake, Laravel intercepta todas las operaciones de cola y las maneja en memoria. Esto significa que los jobs **nunca se ejecutan** realmente—solo se registran sus despachos para que los valides después.

## Métodos Esenciales de QueueFake

### assertPushed: Verificar que un Job fue Despachado

El método más fundamental es `assertPushed()`. Te permite confirmar que un job específico fue añadido a la cola:

```php
public function test_notification_job_is_pushed()
{
    Queue::fake();
    
    // Trigger code que dispecha el job
    $this->post('/api/users', [
        'name' => 'Juan',
        'email' => 'juan@example.com'
    ]);
    
    // Verificar que el job se despachó
    Queue::assertPushed(SendWelcomeEmailJob::class);
}
```

Puedes ser más específico con un callback que valide los datos:

```php
public function test_job_dispatched_with_correct_data()
{
    Queue::fake();
    
    SendEmailJob::dispatch('user@example.com', 'Welcome!');
    
    Queue::assertPushed(SendEmailJob::class, function ($job) {
        return $job->email === 'user@example.com' &&
               $job->subject === 'Welcome!';
    });
}
```

### assertNotPushed: Verificar que un Job NO fue Despachado

Útil para validar lógica condicional:

```php
public function test_job_not_pushed_for_inactive_users()
{
    Queue::fake();
    
    $inactiveUser = User::factory()->inactive()->create();
    
    // Trigger code
    $inactiveUser->sendNotification();
    
    // Verificar que el job NO se despachó
    Queue::assertNotPushed(SendNotificationJob::class);
}
```

### assertPushedOn: Validar la Cola Específica

Si trabajas con múltiples colas (default, emails, heavy-processing), puedes validar en cuál se despachó:

```php
public function test_heavy_job_uses_correct_queue()
{
    Queue::fake();
    
    ProcessVideoJob::dispatch($video->id);
    
    // Verificar que se envió a la cola "processing"
    Queue::assertPushedOn('processing', ProcessVideoJob::class);
}
```

### assertPushedWithChain: Validar Cadenas de Jobs

Los jobs encadenados son comunes en Laravel. Puedes validarlos así:

```php
public function test_job_chain_is_correct()
{
    Queue::fake();
    
    Bus::chain([
        new ProcessPayment($order),
        new SendInvoice($order),
        new UpdateInventory($order)
    ])->dispatch();
    
    Queue::assertPushedWithChain(ProcessPayment::class, [
        SendInvoice::class,
        UpdateInventory::class,
    ]);
}
```

### assertPushedTimes: Contar Despachos

Verifica cuántas veces se despachó un job:

```php
public function test_job_dispatched_for_each_user()
{
    Queue::fake();
    
    $users = User::factory(5)->create();
    
    $users->each(fn($user) => 
        SendBirthdayEmailJob::dispatch($user)
    );
    
    // Verificar que se despachó 5 veces
    Queue::assertPushedTimes(SendBirthdayEmailJob::class, 5);
}
```

## beforePushing y afterPushing: Hooks Avanzados

Las versiones recientes de Laravel introdujeron `beforePushing` y `afterPushing` en QueueFake, permitiéndote ejecutar código antes y después de que un job sea despachado.

### beforePushing: Interceptar Antes del Despacho

Útil para modificar el comportamiento o validar precondiciones:

```php
public function test_job_payload_is_modified()
{
    Queue::fake();
    
    Queue::beforePushing(SendEmailJob::class, function ($job) {
        // Validar que el email tenga un formato válido
        if (!filter_var($job->email, FILTER_VALIDATE_EMAIL)) {
            throw new InvalidArgumentException('Invalid email');
        }
        
        // Podrías log el job antes de ser despachado
        Log::info('Job being pushed', ['job' => get_class($job)]);
    });
    
    SendEmailJob::dispatch('invalid-email');
    // Esto lanzará una excepción
}
```

### afterPushing: Ejecutar Después del Despacho

Útil para limpiar, auditar o generar side effects:

```php
public function test_job_audit_is_logged()
{
    Queue::fake();
    
    $jobsDispatched = [];
    
    Queue::afterPushing(SendEmailJob::class, function ($job) use (&$jobsDispatched) {
        $jobsDispatched[] = [
            'class' => get_class($job),
            'email' => $job->email,
            'timestamp' => now()
        ];
    });
    
    SendEmailJob::dispatch('user1@example.com');
    SendEmailJob::dispatch('user2@example.com');
    
    $this->assertCount(2, $jobsDispatched);
}
```

## Caso de Uso Práctico: Testing de un Workflow Completo

Supongamos que tienes un sistema donde crear una orden dispecha múltiples jobs. Así es cómo testearlo completamente:

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;
use App\Jobs\ProcessPayment;
use App\Jobs\SendInvoice;
use App\Jobs\UpdateInventory;
use App\Models\Order;

class OrderCreationTest extends TestCase
{
    public function test_creating_order_dispatches_correct_jobs()
    {
        Queue::fake();
        
        // Crear una orden vía API
        $response = $this->post('/api/orders', [
            'items' => [
                ['product_id' => 1, 'quantity' => 2],
            ],
            'payment_method' => 'card'
        ]);
        
        $response->assertStatus(201);
        $order = Order::latest()->first();
        
        // Validar que se despachó el job de pago
        Queue::assertPushed(ProcessPayment::class, function ($job) use ($order) {
            return $job->order_id === $order->id;
        });
        
        // Validar que se despachó el job de factura
        Queue::assertPushed(SendInvoice::class, function ($job) use ($order) {
            return $job->order_id === $order->id;
        });
        
        // Validar que se actualizó el inventario
        Queue::assertPushed(UpdateInventory::class);
        
        // Verificar que se despacharon exactamente 3 jobs
        Queue::assertPushedTimes(ProcessPayment::class, 1);
        Queue::assertPushedTimes(SendInvoice::class, 1);
        Queue::assertPushedTimes(UpdateInventory::class, 1);
    }
    
    public function test_invalid_payment_method_does_not_process_payment()
    {
        Queue::fake();
        
        $response = $this->post('/api/orders', [
            'items' => [['product_id' => 1, 'quantity' => 1]],
            'payment_method' => 'invalid'
        ]);
        
        $response->assertStatus(422);
        
        // ProcessPayment no debería haberse despachado
        Queue::assertNotPushed(ProcessPayment::class);
    }
    
    public function test_tracking_all_dispatched_jobs()
    {
        Queue::fake();
        
        $allJobs = [];
        
        Queue::afterPushing(function ($job) use (&$allJobs) {
            $allJobs[] = [
                'class' => get_class($job),
                'timestamp' => now()
            ];
        });
        
        // Crear múltiples órdenes
        for ($i = 0; $i < 5; $i++) {
            $this->post('/api/orders', [
                'items' => [['product_id' => 1, 'quantity' => 1]],
                'payment_method' => 'card'
            ]);
        }
        
        // Debería haber despachado 15 jobs (3 por orden × 5 órdenes)
        $this->assertCount(15, $allJobs);
        
        // Validar que cada orden generó los 3 jobs
        $paymentJobs = array_filter($allJobs, fn($j) => 
            str_contains($j['class'], 'ProcessPayment')
        );
        $this->assertCount(5, $paymentJobs);
    }
}
```

## Integración con Bus Fake

Para testing más completo, combina QueueFake con `Bus::fake()`, que además testea el despachador de comandos/jobs:

```php
public function test_order_flow_with_bus_fake()
{
    Bus::fake();
    
    // Dispatch un command que a su vez dispecha jobs
    $this->dispatch(new CreateOrderCommand($orderData));
    
    // Validar el comando
    Bus::assertDispatched(CreateOrderCommand::class);
    
    // Validar los jobs
    Bus::assertDispatched(ProcessPayment::class);
    Bus::assertDispatched(SendInvoice::class);
}
```

## Mejores Prácticas

### 1. Testea Comportamiento, No Implementación

Enfócate en validar que los jobs correctos se despachen con datos correctos, no en detalles internos:

```php
// ✅ Bien: Validar el resultado funcional
Queue::assertPushed(SendEmailJob::class, function ($job) {
    return $job->email === 'user@example.com';
});

// ❌ Evitar: Testear detalles de implementación
Queue::assertPushed(SendEmailJob::class, function ($job) {
    return $job->delay === 60 && $job->tries === 3;
});
```

### 2. Usa Factories en Tests

Genera datos realistas para tests más robustos:

```php
public function test_job_dispatched_for_each_active_user()
{
    Queue::fake();
    
    User::factory(10)->active()->create();
    
    $this->artisan('users:send-newsletter');
    
    Queue::assertPushedTimes(SendNewsletterJob::class, 10);
}
```

### 3. Limpia el Estado entre Tests

Aunque Laravel resetea la cola entre tests automáticamente, sé explícito:

```php
public function setUp(): void
{
    parent::setUp();
    Queue::fake();
}
```

## Puntos Clave

- **QueueFake** permite testear jobs sin ejecutar Redis ni infraestructura de colas reales
- **`assertPushed()`** verifica que un job fue despachado; acepta callbacks para validar datos
- **`assertNotPushed()`** confirma que un job NO se despachó (útil para lógica condicional)
- **`assertPushedOn()`** valida que el job se envió a la cola correcta
- **`beforePushing()` y `afterPushing()`** permiten interceptar jobs antes y después de despacho
- **`assertPushedWithChain()`** valida cadenas de jobs en secuencia
- **`assertPushedTimes()`** cuenta cuántas veces se despachó un job específico
- **Combina con `Bus::fake()`** para testing más completo del flujo de comandos
- **Tests más rápidos y confiables** que testing de colas reales sin dependencias externas