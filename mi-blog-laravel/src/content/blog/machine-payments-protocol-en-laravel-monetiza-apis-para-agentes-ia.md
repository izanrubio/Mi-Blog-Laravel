---
title: 'Machine Payments Protocol en Laravel: Monetiza APIs para Agentes IA'
description: 'Implementa pagos automáticos en APIs con Laravel MPP. Usa HTTP 402 y tokens de pago para monetizar acceso de agentes IA sin fricción.'
pubDate: '2026-07-08'
tags: ['laravel', 'api', 'ia', 'pagos', 'monetización']
---

## Introducción: El Futuro de las APIs Pagadas

Las APIs tradicionales utilizan autenticación por clave de acceso (API Keys) o tokens OAuth, pero estas soluciones fueron diseñadas para humanos. Los agentes de IA modernos necesitan un mecanismo diferente: **pagos micro-transaccionales automáticos sin intervención humana**.

Aquí es donde entra **Machine Payments Protocol (MPP)**, un estándar emergente que permite que los agentes IA paguen por acceso a APIs usando el código de estado HTTP 402 Payment Required. Laravel MPP, un middleware de Square1, facilita esta integración en tus aplicaciones.

En este artículo aprenderás cómo implementar pagos automáticos para agentes IA en Laravel, monetizando tus APIs de forma inteligente.

## ¿Qué es Machine Payments Protocol?

### El estándar HTTP 402

El código de estado HTTP 402 Payment Required existe desde 1997 pero nunca tuvo un uso práctico real. MPP lo revive como estándar para transacciones máquina-a-máquina:

```
HTTP/1.1 402 Payment Required
WWW-Authenticate: Bearer realm="api.example.com", token="stripe_token_xyz"
Retry-After: 1
```

Cuando un agente IA recibe este código, **automáticamente paga usando Stripe Shared Payment Tokens** y reintentar la solicitud con el pago procesado.

### Flujo típico de MPP

1. **Agente IA** realiza solicitud GET a tu API
2. **Servidor** responde con 402 + desafío de pago
3. **Agente IA** ejecuta pago con token Stripe
4. **Agente IA** reintenta la solicitud con prueba de pago
5. **Servidor** valida pago y devuelve datos (200 OK)

## Instalación y Configuración de Laravel MPP

### Requisitos previos

- Laravel 11 o superior
- Cuenta Stripe configurada
- PHP 8.1+

### Instalación del paquete

```bash
composer require square1/laravel-mpp
```

Publicar la configuración:

```bash
php artisan vendor:publish --provider="Square1\LaravelMPP\ServiceProvider"
```

### Configurar variables de entorno

En tu `.env`:

```env
STRIPE_PUBLIC_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
MPP_ENABLED=true
MPP_CURRENCY=usd
MPP_DEFAULT_PRICE=0.01
```

## Implementar MPP en tus rutas

### Proteger una ruta individual

```php
// routes/api.php
Route::get('/api/data', [DataController::class, 'show'])
    ->middleware('mpp')
    ->name('api.data');
```

### Middleware de configuración avanzada

Crea un middleware personalizado para lógica más compleja:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Square1\LaravelMPP\MPP;

class MachinePaymentGate
{
    public function handle(Request $request, Closure $next)
    {
        // Determinar precio dinámicamente
        $price = $this->calculatePrice($request);
        
        // Aplicar MPP
        return MPP::gate($request, $next, [
            'price' => $price,
            'currency' => 'usd',
            'description' => 'API Access - ' . $request->path(),
        ]);
    }
    
    private function calculatePrice(Request $request): float
    {
        // Endpoints diferentes, precios diferentes
        $prices = [
            'api/data' => 0.01,
            'api/advanced' => 0.05,
            'api/premium' => 0.25,
        ];
        
        foreach ($prices as $path => $price) {
            if ($request->is($path)) {
                return $price;
            }
        }
        
        return 0.01;
    }
}
```

Registrar el middleware:

```php
// app/Http/Kernel.php
protected $routeMiddleware = [
    // ...
    'mpp' => \App\Http\Middleware\MachinePaymentGate::class,
];
```

## Casos de uso avanzados

### 1. Precios por usuario o tier

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Square1\LaravelMPP\MPP;

class PricingController
{
    public function getPrice(Request $request)
    {
        $user = auth()->user();
        
        // Si tiene suscripción premium, sin costo
        if ($user && $user->subscription_tier === 'premium') {
            return response()->json(['data' => $this->getData()]);
        }
        
        // Precio dinámico según endpoint
        $price = $this->determinePriceByEndpoint($request);
        
        return MPP::requirePayment($request, $price);
    }
    
    private function determinePriceByEndpoint(Request $request): float
    {
        return match($request->route()->getName()) {
            'api.lite' => 0.001,
            'api.standard' => 0.01,
            'api.enterprise' => 0.50,
            default => 0.01,
        };
    }
}
```

### 2. Monitorear pagos recibidos

```php
<?php

namespace App\Http\Controllers;

use Square1\LaravelMPP\Events\PaymentReceived;
use Illuminate\Support\Facades\Event;

class PaymentMonitor
{
    public function __construct()
    {
        Event::listen(PaymentReceived::class, [$this, 'logPayment']);
    }
    
    public function logPayment(PaymentReceived $event)
    {
        // Registrar en tu sistema
        \Log::info('MPP Payment Received', [
            'amount' => $event->amount,
            'currency' => $event->currency,
            'agent_id' => $event->agent_id,
            'timestamp' => now(),
        ]);
        
        // Enviar a analytics
        event(new \App\Events\APIAccessLogged(
            $event->agent_id,
            $event->amount,
            $event->endpoint
        ));
    }
}
```

### 3. Rate limiting basado en pagos

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class MachinePaymentRateLimit
{
    public function handle(Request $request, Closure $next)
    {
        $agentId = $request->header('X-Agent-ID');
        
        // Obtener saldo de créditos del agente
        $credits = Cache::get("agent.{$agentId}.credits", 0);
        
        if ($credits < 0.01) {
            return response()->json([
                'error' => 'Insufficient credits',
                'balance' => $credits,
            ], 402);
        }
        
        // Deducir crédito
        Cache::decrement("agent.{$agentId}.credits", 0.01);
        
        return $next($request);
    }
}
```

## Validar pagos en el servidor

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Square1\LaravelMPP\PaymentValidator;

class ValidateMPPPayment
{
    public function handle(Request $request, Closure $next)
    {
        // Token enviado por el agente después de pagar
        $paymentToken = $request->header('X-Payment-Token');
        
        if (!$paymentToken) {
            return response()->json(['error' => 'Payment required'], 402);
        }
        
        // Validar token con Stripe
        $isValid = PaymentValidator::validate($paymentToken, [
            'amount' => 0.01,
            'currency' => 'usd',
        ]);
        
        if (!$isValid) {
            return response()->json(['error' => 'Invalid payment'], 403);
        }
        
        return $next($request);
    }
}
```

## Implementar en controladores

```php
<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Square1\LaravelMPP\MPP;

class DataController extends Controller
{
    public function show(Request $request)
    {
        // El pago ya fue validado por el middleware
        $data = [
            'results' => [
                ['id' => 1, 'name' => 'Item 1'],
                ['id' => 2, 'name' => 'Item 2'],
            ],
            'timestamp' => now(),
        ];
        
        return response()->json($data);
    }
    
    public function premium(Request $request)
    {
        // Opcionalmente, obtener información de pago
        $paymentInfo = MPP::getPaymentInfo($request);
        
        \Log::info('Premium endpoint accessed', $paymentInfo);
        
        return response()->json([
            'premium_data' => 'sensitive information',
            'payment_id' => $paymentInfo['payment_id'] ?? null,
        ]);
    }
}
```

## Considerar alternativas: Tempo y pathUSD

Aunque Stripe es la opción principal, MPP también soporta:

### Tempo pathUSD

```php
// En configuración
'mpp' => [
    'payment_providers' => [
        'stripe',
        'tempo', // Pagos en stablecoins
    ],
],
```

### Validar múltiples proveedores

```php
$validator = MPP::createValidator()
    ->acceptStripe()
    ->acceptTempo()
    ->validate($request);
```

## Debugging y logs

Habilitar logs detallados:

```php
// config/mpp.php
'debug' => env('APP_DEBUG', false),
'log_payments' => true,
'log_channel' => 'mpp',
```

Ver logs:

```bash
# Monitorear pagos en tiempo real
tail -f storage/logs/mpp.log

# O usar Telescope
php artisan tinker
>>> \Log::channel('mpp')->get()
```

## Buenas prácticas

### 1. Mantener precios transparentes

```php
// Endpoint público para ver precios
Route::get('/api/pricing', function () {
    return [
        'endpoints' => [
            '/api/lite' => ['price' => 0.001, 'rate_limit' => '1000/hour'],
            '/api/standard' => ['price' => 0.01, 'rate_limit' => '100/hour'],
            '/api/enterprise' => ['price' => 0.50, 'rate_limit' => 'unlimited'],
        ],
    ];
});
```

### 2. Permitir suscrpciones recurrentes

```php
public function createSubscription(Request $request)
{
    $agent = $request->user();
    
    $subscription = $agent->newSubscription('api_access')
        ->price('price_mpp_monthly')
        ->add();
    
    // Con suscripción, sin necesidad de MPP por solicitud
}
```

### 3. Monitorear fraude

```php
use Square1\LaravelMPP\Events\PaymentReceived;

Event::listen(PaymentReceived::class, function ($event) {
    // Detectar patrones sospechosos
    $recentPayments = Cache::remember(
        "agent.{$event->agent_id}.payments",
        60,
        fn() => []
    );
    
    if (count($recentPayments) > 100) {
        // Alertar sobre actividad sospechosa
        \Log::warning('Suspicious MPP activity', $event->all());
    }
});
```

## Monitoreo en producción

```php
// Enviar métricas a tu sistema de monitoreo
event(new \App\Events\MPPMetric(
    agent_id: $agentId,
    amount: 0.01,
    endpoint: $request->path(),
    status: 'success',
    timestamp: now()
));
```

## Conclusión

Machine Payments Protocol revoluciona cómo monetizamos APIs para agentes IA. Con Laravel MPP puedes:

✅ Cobrar automáticamente sin intervención humana  
✅ Implementar precios dinámicos por endpoint  
✅ Validar pagos de forma segura  
✅ Monitorear ingresos en tiempo real  
✅ Soportar múltiples proveedores de pago  

Esta es la próxima generación de monetización de APIs. Los agentes IA no esperarán a que configures facturación manual: pagarán automáticamente con su presupuesto asignado.

## Puntos clave

- **HTTP 402** es el código de estado oficial para transacciones máquina-a-máquina en MPP
- **Laravel MPP** simplifica la integración con middleware listo para usar
- **Precios dinámicos** según endpoint, usuario, o tier de suscripción
- **Validación de pagos** debe hacerse siempre en el servidor
- **Monitoreo de eventos** permite detectar patrones de fraude
- **Stripe y Tempo** son los proveedores soportados actualmente
- **Rate limiting basado en créditos** complementa bien con MPP
- **Logs detallados** son esenciales para auditoría y debugging
- **Suscripciones recurrentes** ofrecen alternativa a pagos por solicitud
- **Transparencia de precios** aumenta confianza de los agentes IA