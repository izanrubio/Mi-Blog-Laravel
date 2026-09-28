---
title: 'PayZephyr en Laravel: API Única para Múltiples Pasarelas'
description: 'Integra Stripe, PayPal, Paystack y más con una sola API en Laravel. Failover automático y protección contra cargos duplicados.'
pubDate: '2025-01-15'
tags: ['laravel', 'payments', 'stripe', 'paypal', 'integraciones']
---

# PayZephyr en Laravel: API Única para Múltiples Pasarelas de Pago

Gestionar múltiples proveedores de pago en Laravel siempre ha sido un dolor de cabeza. Cada pasarela (Stripe, PayPal, Paystack, Flutterwave) tiene su propia API, endpoints diferentes y lógica de manejo de errores distinta. **PayZephyr** resuelve este problema con una interfaz unificada que abstrae la complejidad.

En este artículo te mostraremos cómo integrar PayZephyr en tu aplicación Laravel, implementar failover automático y protegerte contra los cargos duplicados que todo desarrollador teme.

## ¿Qué es PayZephyr y por qué lo necesitas?

PayZephyr es un paquete que actúa como capa de abstracción sobre múltiples pasarelas de pago. En lugar de escribir lógica condicional compleja para cada proveedor, trabajas con una interfaz consistente.

**Beneficios principales:**

- **Una sola interfaz** para Stripe, PayPal, Paystack, Flutterwave, Square, Razorpay y más
- **Failover automático**: si Stripe falla, intenta con PayPal
- **Protección contra cargos duplicados** integrada
- **Manejo de errores unificado**
- **Webhooks normalizados** entre proveedores

Esto es especialmente valioso en aplicaciones SaaS o marketplaces donde necesitas redundancia de pagos.

## Instalación y Configuración Básica

### Paso 1: Instalar el paquete

```bash
composer require payzephyr/laravel
```

### Paso 2: Publicar la configuración

```bash
php artisan vendor:publish --provider="PayZephyr\Laravel\PayZephyrServiceProvider"
```

Esto crea `config/payzephyr.php` donde configurarás tus proveedores.

### Paso 3: Configurar credenciales

Actualiza tu archivo `.env`:

```env
PAYZEPHYR_PRIMARY_PROVIDER=stripe
PAYZEPHYR_SECONDARY_PROVIDER=paypal

STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLIC_KEY=pk_test_xxxxx

PAYPAL_CLIENT_ID=AexxxxxxxxxxI
PAYPAL_CLIENT_SECRET=EFxxxxxx

PAYSTACK_PUBLIC_KEY=pk_test_xxxxx
PAYSTACK_SECRET_KEY=sk_test_xxxxx
```

Luego, en `config/payzephyr.php`:

```php
<?php

return [
    'providers' => [
        'stripe' => [
            'key' => env('STRIPE_SECRET_KEY'),
            'public_key' => env('STRIPE_PUBLIC_KEY'),
            'mode' => env('PAYZEPHYR_MODE', 'test'),
        ],
        'paypal' => [
            'client_id' => env('PAYPAL_CLIENT_ID'),
            'client_secret' => env('PAYPAL_CLIENT_SECRET'),
            'mode' => env('PAYZEPHYR_MODE', 'sandbox'),
        ],
        'paystack' => [
            'key' => env('PAYSTACK_SECRET_KEY'),
            'public_key' => env('PAYSTACK_PUBLIC_KEY'),
        ],
    ],
    
    'failover' => true,
    'primary' => env('PAYZEPHYR_PRIMARY_PROVIDER', 'stripe'),
    'secondary' => env('PAYZEPHYR_SECONDARY_PROVIDER', 'paypal'),
    'protect_duplicates' => true,
];
```

## Procesando Pagos con PayZephyr

### Crear un Cargo Simple

La forma más directa de procesar un pago es con el método `charge()`:

```php
<?php

namespace App\Http\Controllers;

use PayZephyr\Laravel\Facades\PayZephyr;

class PaymentController extends Controller
{
    public function processPayment($request)
    {
        try {
            $payment = PayZephyr::charge([
                'amount' => 9999, // en centavos: $99.99
                'currency' => 'USD',
                'customer' => [
                    'id' => auth()->id(),
                    'email' => auth()->user()->email,
                    'name' => auth()->user()->name,
                ],
                'description' => 'Compra de plan profesional',
                'metadata' => [
                    'order_id' => 12345,
                    'plan' => 'professional',
                ],
                'source' => $request->stripeToken, // token del cliente
            ]);

            // Guardar referencia del pago
            Payment::create([
                'user_id' => auth()->id(),
                'transaction_id' => $payment->id,
                'provider' => $payment->provider,
                'amount' => 9999,
                'currency' => 'USD',
                'status' => 'completed',
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Pago procesado correctamente',
                'transaction_id' => $payment->id,
            ]);

        } catch (\PayZephyr\Exceptions\PaymentFailedException $e) {
            \Log::error('Pago fallido', [
                'error' => $e->getMessage(),
                'provider' => $e->getProvider(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al procesar el pago',
            ], 422);
        }
    }
}
```

### Failover Automático

Si `PAYZEPHYR_PRIMARY_PROVIDER=stripe` falla, PayZephyr intenta automáticamente con `PAYZEPHYR_SECONDARY_PROVIDER`:

```php
$payment = PayZephyr::charge([
    'amount' => 5000,
    'currency' => 'USD',
    'customer' => [...],
]);

// Si Stripe falla, PayZephyr intenta con PayPal automáticamente
// El response incluye qué provider se usó
echo "Pago procesado con: " . $payment->provider; // "paypal" si Stripe falló
```

Puedes deshabilitar el failover si lo necesitas:

```php
$payment = PayZephyr::withoutFailover()->charge([
    'amount' => 5000,
    'currency' => 'USD',
    'customer' => [...],
]);
```

## Protección Contra Cargos Duplicados

La característica más crítica de PayZephyr es su protección idempotente. Si tu cliente hace clic dos veces en "Pagar", no se cargará dos veces:

```php
public function processPayment(Request $request)
{
    $idempotencyKey = "order_" . auth()->id() . "_" . $request->order_id;

    try {
        $payment = PayZephyr::withIdempotencyKey($idempotencyKey)
            ->charge([
                'amount' => 2999,
                'currency' => 'USD',
                'customer' => [...],
                'source' => $request->token,
            ]);

        return response()->json(['success' => true]);

    } catch (\PayZephyr\Exceptions\DuplicatePaymentException $e) {
        // La misma clave se usó hace poco
        // PayZephyr devuelve el pago anterior, no crea uno nuevo
        return response()->json([
            'success' => true,
            'message' => 'Este pago ya fue procesado',
            'transaction_id' => $e->getDuplicateTransaction()->id,
        ]);
    }
}
```

Internamente, PayZephyr:
1. Genera un hash basado en la idempotencyKey
2. Busca si ese hash existe en la base de datos dentro de 24 horas
3. Si existe, devuelve el pago anterior en lugar de crear uno nuevo
4. Si no existe, procesa normalmente y guarda el hash

## Manejo de Webhooks Normalizado

Cada proveedor tiene webhooks diferentes. PayZephyr normaliza todo:

### Registrar la ruta

En `routes/web.php`:

```php
Route::post('/webhooks/payments', [\App\Http\Controllers\WebhookController::class, 'handlePaymentWebhook']);
```

### Procesar el webhook

```php
<?php

namespace App\Http\Controllers;

use PayZephyr\Laravel\Facades\PayZephyr;
use Illuminate\Http\Request;

class WebhookController extends Controller
{
    public function handlePaymentWebhook(Request $request)
    {
        // PayZephyr detecta automáticamente qué proveedor envía el webhook
        $event = PayZephyr::handleWebhook($request->all());

        switch ($event->type) {
            case 'payment.succeeded':
                $this->onPaymentSucceeded($event);
                break;

            case 'payment.failed':
                $this->onPaymentFailed($event);
                break;

            case 'payment.disputed':
                $this->onPaymentDisputed($event);
                break;

            case 'subscription.updated':
                $this->onSubscriptionUpdated($event);
                break;
        }

        return response()->json(['received' => true]);
    }

    private function onPaymentSucceeded($event)
    {
        $transactionId = $event->transaction_id;
        $provider = $event->provider; // "stripe", "paypal", etc.
        $amount = $event->amount;

        Payment::where('transaction_id', $transactionId)->update([
            'status' => 'confirmed',
            'confirmed_at' => now(),
        ]);

        // Enviar confirmación al usuario
        auth()->user()->notify(new PaymentConfirmedNotification($event));
    }

    private function onPaymentFailed($event)
    {
        Payment::where('transaction_id', $event->transaction_id)->update([
            'status' => 'failed',
            'error_message' => $event->error,
        ]);
    }
}
```

Lo extraordinario aquí es que `$event->type` es **igual** sin importar si viene de Stripe, PayPal o Paystack.

## Reembolsos y Cancelaciones

PayZephyr simplifica refunds:

```php
public function refundPayment($transactionId, $amount = null)
{
    try {
        $refund = PayZephyr::refund($transactionId, [
            'amount' => $amount, // opcional, reembolsa todo si no se especifica
            'reason' => 'customer_request',
            'notes' => 'Cliente solicitó cancelación',
        ]);

        Payment::where('transaction_id', $transactionId)->update([
            'status' => 'refunded',
            'refund_id' => $refund->id,
            'refunded_at' => now(),
        ]);

        return response()->json([
            'success' => true,
            'refund_id' => $refund->id,
        ]);

    } catch (\PayZephyr\Exceptions\RefundFailedException $e) {
        \Log::error('Refund failed', ['error' => $e->getMessage()]);
        return response()->json(['success' => false], 422);
    }
}
```

## Consultar Transacciones Existentes

PayZephyr puede buscar transacciones sin conocer el proveedor exacto:

```php
// Buscar una transacción por ID
$transaction = PayZephyr::find('pi_1234567890abcdef');

echo $transaction->provider;  // "stripe"
echo $transaction->amount;    // 5000
echo $transaction->status;    // "succeeded"
echo $transaction->created_at; // DateTime

// Listar últimas transacciones de un cliente
$transactions = PayZephyr::forCustomer(auth()->id())->limit(10)->get();

foreach ($transactions as $txn) {
    echo $txn->id . " - " . $txn->provider . " - $" . ($txn->amount / 100);
}
```

## Mejores Prácticas

### 1. Guarda Siempre la Referencia del Proveedor

```php
Payment::create([
    'user_id' => auth()->id(),
    'transaction_id' => $payment->id,
    'provider' => $payment->provider, // ¡Importante!
    'amount' => 5000,
]);
```

Necesitarás esto si quieres refundar o disputar después.

### 2. Implementa Reintentos con Backoff Exponencial

```php
$maxRetries = 3;
$attempt = 0;

do {
    try {
        $payment = PayZephyr::charge($chargeData);
        break;
    } catch (\PayZephyr\Exceptions\TemporaryFailureException $e) {
        $attempt++;
        if ($attempt < $maxRetries) {
            sleep(2 ** $attempt); // 2, 4, 8 segundos
            continue;
        }
        throw $e;
    }
} while ($attempt < $maxRetries);
```

### 3. Monitorea Failovers

```php
$payment = PayZephyr::charge($data);

if ($payment->provider !== config('payzephyr.primary')) {
    \Log::warning('Failover activado', [
        'primary_failed' => config('payzephyr.primary'),
        'used_provider' => $payment->provider,
        'order_id' => $data['metadata']['order_id'],
    ]);
}
```

### 4. Valida Webhooks

```php
$signature = $request->header('X-PayZephyr-Signature');

if (!PayZephyr::verifyWebhookSignature($signature, $request->getContent())) {
    return response()->json(['error' => 'Invalid signature'], 401);
}
```

## Alternativas y Comparativas

**Stripe-only**: Si solo usas Stripe, PayZephyr agrega overhead. Usa la API directa.

**Mollie**: Excelente para Europa, pero menos providers que PayZephyr.

**Cashier**: Enfocado en suscripciones. PayZephyr es más flexible para cargos únicos.

**Comercial dedicado**: Si necesitas soporte empresarial, considera servicios como Adyen.

## Conclusión

PayZephyr democratiza la integración de múltiples pasarelas en Laravel. Ya no necesitas escribir adapters complejos ni manejar lógica de failover manualmente. Con una configuración mínima, tienes redundancia de pagos, protección contra duplicados y webhooks normalizados.

La inversión en entender PayZephyr se amortiza rápidamente en cualquier aplicación que:
- Quiera ofrecer opciones de pago
- Necesite redundancia
- Tenga clientes en múltiples regiones

Comienza pequeño (Stripe + PayPal), y expande a más providers conforme creces.

## Puntos clave

- **PayZephyr abstrae múltiples pasarelas** bajo una interfaz unificada, eliminando complejidad
- **Failover automático** intenta el proveedor secundario si el primario falla
- **Protección idempotente** contra cargos duplicados usando llaves de idempotencia
- **Webhooks normalizados** usan los mismos tipos de eventos (`payment.succeeded`, etc.) sin importar el proveedor
- **Refunds simplificados** con un método único que funciona en todas las pasarelas
- **Guarda siempre el proveedor** en tu base de