---
title: 'Subscriptionify en Laravel: Gestión de Suscripciones sin Proveedores'
description: 'Cómo implementar un sistema flexible de suscripciones basado en features en Laravel sin atarte a un proveedor de pagos específico.'
pubDate: '2026-06-16'
tags: ['laravel', 'suscripciones', 'saas', 'packages']
---

## Introducción

Construir un modelo de negocio basado en suscripciones es cada vez más común en aplicaciones web modernas. Sin embargo, la mayoría de desarrolladores Laravel se encuentran con un dilema: usar un paquete específico que los ata a un proveedor de pagos (Stripe, Paddle, etc.) o implementar todo desde cero.

**Subscriptionify** ofrece una tercera vía. Es un paquete agnóstico que te permite modelar planes, features, cuotas de uso y billing por sobrepaso sin comprometerte con ningún proveedor de pagos específico. En este artículo, descubrirás cómo implementar un sistema robusto de suscripciones que puedas integrar con cualquier plataforma de pagos.

## ¿Qué es Subscriptionify?

Subscriptionify es un paquete Laravel creado para separar la lógica de negocio de las suscripciones de la integración con proveedores de pagos. Esto significa que puedes cambiar de Stripe a Paddle o a cualquier otro proveedor sin reescribir tu lógica de suscripciones.

Los componentes principales que maneja son:

- **Planes**: definición de tus diferentes niveles de servicio
- **Features**: características que cada plan ofrece
- **Cuotas de uso**: límites de recursos (requests, MB de almacenamiento, etc.)
- **Billing por sobrepaso**: cobros adicionales cuando se exceden los límites

## Instalación y Configuración

Instalar Subscriptionify en tu proyecto Laravel es tan simple como ejecutar:

```bash
composer require subscriptionify/subscriptionify
```

Luego, publica la configuración:

```bash
php artisan vendor:publish --provider="Subscriptionify\SubscriptionifyServiceProvider"
```

Esto generará un archivo de configuración en `config/subscriptionify.php` y las migraciones necesarias:

```bash
php artisan migrate
```

## Definir Planes y Features

El corazón de Subscriptionify está en definir tus planes y qué features incluyen. Veamos cómo hacerlo de forma elegante.

### Crear Plans Programáticamente

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Subscriptionify\Models\Plan;
use Subscriptionify\Models\Feature;

class SubscriptionPlanSeeder extends Seeder
{
    public function run(): void
    {
        // Plan Gratuito
        $freePlan = Plan::create([
            'name' => 'Free',
            'slug' => 'free',
            'description' => 'Acceso básico para empezar',
            'price' => 0,
            'billing_cycle' => 'monthly',
            'is_active' => true,
        ]);

        // Plan Profesional
        $proPlan = Plan::create([
            'name' => 'Profesional',
            'slug' => 'professional',
            'description' => 'Para pequeños equipos',
            'price' => 4900, // en centavos
            'billing_cycle' => 'monthly',
            'is_active' => true,
        ]);

        // Plan Empresa
        $enterprisePlan = Plan::create([
            'name' => 'Empresa',
            'slug' => 'enterprise',
            'description' => 'Solución escalable',
            'price' => 19900,
            'billing_cycle' => 'monthly',
            'is_active' => true,
        ]);

        // Definir features para cada plan
        $features = [
            'api_calls' => Feature::create(['name' => 'API Calls', 'slug' => 'api_calls', 'type' => 'quota']),
            'storage' => Feature::create(['name' => 'Storage', 'slug' => 'storage', 'type' => 'quota']),
            'users' => Feature::create(['name' => 'Team Members', 'slug' => 'users', 'type' => 'quota']),
            'analytics' => Feature::create(['name' => 'Advanced Analytics', 'slug' => 'analytics', 'type' => 'boolean']),
            'support' => Feature::create(['name' => 'Priority Support', 'slug' => 'support', 'type' => 'boolean']),
        ];

        // Asignar features al plan gratuito
        $freePlan->features()->attach([
            $features['api_calls']->id => ['limit' => 1000],
            $features['storage']->id => ['limit' => 1024], // 1GB
            $features['users']->id => ['limit' => 1],
        ]);

        // Asignar features al plan profesional
        $proPlan->features()->attach([
            $features['api_calls']->id => ['limit' => 100000],
            $features['storage']->id => ['limit' => 102400], // 100GB
            $features['users']->id => ['limit' => 5],
            $features['analytics']->id => ['limit' => 1],
        ]);

        // Asignar features al plan empresa
        $enterprisePlan->features()->attach([
            $features['api_calls']->id => ['limit' => -1], // unlimited
            $features['storage']->id => ['limit' => -1],
            $features['users']->id => ['limit' => -1],
            $features['analytics']->id => ['limit' => 1],
            $features['support']->id => ['limit' => 1],
        ]);
    }
}
```

## Trabajar con Suscripciones de Usuarios

Una vez definidos los planes, necesitas asociarlos a tus usuarios. Subscriptionify proporciona un modelo `Subscription` y traits para facilitar esto.

### Agregar el Trait al Usuario

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Subscriptionify\Traits\HasSubscriptions;

class User extends Authenticatable
{
    use HasSubscriptions;

    // ... resto del código
}
```

### Crear una Suscripción

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Subscriptionify\Models\Plan;

class SubscriptionController extends Controller
{
    public function subscribe(User $user, Plan $plan)
    {
        $subscription = $user->subscribe($plan, [
            'started_at' => now(),
            'ends_at' => now()->addMonth(),
            'metadata' => [
                'payment_intent_id' => 'stripe_12345',
                'referrer' => 'landing_page',
            ],
        ]);

        return response()->json([
            'message' => 'Suscripción creada exitosamente',
            'subscription' => $subscription,
        ]);
    }
}
```

## Gestionar Cuotas de Uso

Una de las características más poderosas de Subscriptionify es el tracking de uso de features con límites.

### Registrar Uso

```php
<?php

namespace App\Services;

use App\Models\User;

class ApiService
{
    public function processRequest(User $user, array $data)
    {
        $subscription = $user->activeSubscription();

        // Verificar si puede hacer la llamada
        if (!$subscription->canUse('api_calls')) {
            throw new \Exception('Has alcanzado tu límite de llamadas API');
        }

        // Registrar el uso
        $subscription->recordUsage('api_calls', 1);

        // Tu lógica de negocio aquí
        return $this->handleRequest($data);
    }

    public function uploadFile(User $user, $fileSize)
    {
        $subscription = $user->activeSubscription();
        $storageInMB = $fileSize / (1024 * 1024);

        if (!$subscription->canUse('storage', $storageInMB)) {
            throw new \Exception('No hay espacio de almacenamiento disponible');
        }

        $subscription->recordUsage('storage', $storageInMB);

        // Lógica de almacenamiento
    }
}
```

### Obtener Información de Uso

```php
<?php

public function getUserUsage(User $user)
{
    $subscription = $user->activeSubscription();

    return [
        'api_calls' => [
            'used' => $subscription->getUsage('api_calls'),
            'limit' => $subscription->getLimit('api_calls'),
            'remaining' => $subscription->getRemaining('api_calls'),
            'percentage' => $subscription->getUsagePercentage('api_calls'),
        ],
        'storage' => [
            'used' => $subscription->getUsage('storage'),
            'limit' => $subscription->getLimit('storage'),
            'remaining' => $subscription->getRemaining('storage'),
            'percentage' => $subscription->getUsagePercentage('storage'),
        ],
    ];
}
```

## Billing por Sobrepaso

Subscriptionify permite cobrar cuando los usuarios exceden sus límites. Esto es especialmente útil para modelos freemium.

### Configurar Sobrepaso en Features

```php
<?php

// En tu seeder
$apiCallsFeature = Feature::create([
    'name' => 'API Calls',
    'slug' => 'api_calls',
    'type' => 'metered',
    'overage_price' => 0.01, // $0.01 por llamada extra
]);

// Asociar al plan con config de sobrepaso
$plan->features()->attach($apiCallsFeature->id, [
    'limit' => 100000,
    'overage_enabled' => true,
]);
```

### Procesar Sobrepasos Automáticamente

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Subscriptionify\Models\Subscription;

class ProcessOverages implements ShouldQueue
{
    use Queueable;

    public function handle()
    {
        Subscription::query()
            ->active()
            ->each(function (Subscription $subscription) {
                $overageAmount = 0;

                foreach ($subscription->plan->features as $feature) {
                    if (!$feature->pivot->overage_enabled) {
                        continue;
                    }

                    $used = $subscription->getUsage($feature->slug);
                    $limit = $subscription->getLimit($feature->slug);

                    if ($used > $limit) {
                        $excess = $used - $limit;
                        $overageAmount += $excess * $feature->pivot->overage_price;
                    }
                }

                if ($overageAmount > 0) {
                    // Dispara un evento o job para cobrar el sobrepaso
                    event(new OverageDetected($subscription, $overageAmount));
                }
            });
    }
}
```

## Integración con Proveedores de Pagos

La belleza de Subscriptionify es que puedes integrar cualquier proveedor. Aquí mostramos cómo hacerlo con Stripe como ejemplo:

```php
<?php

namespace App\Services;

use App\Models\User;
use Subscriptionify\Models\Plan;
use Stripe\StripeClient;

class StripeSubscriptionService
{
    protected $stripe;

    public function __construct()
    {
        $this->stripe = new StripeClient(config('services.stripe.secret'));
    }

    public function createSubscription(User $user, Plan $plan)
    {
        // Crear customer en Stripe si no existe
        if (!$user->stripe_id) {
            $stripeCustomer = $this->stripe->customers->create([
                'email' => $user->email,
                'name' => $user->name,
                'metadata' => ['user_id' => $user->id],
            ]);
            $user->update(['stripe_id' => $stripeCustomer->id]);
        }

        // Crear suscripción en Stripe
        $stripeSubscription = $this->stripe->subscriptions->create([
            'customer' => $user->stripe_id,
            'items' => [
                ['price' => $plan->stripe_price_id],
            ],
        ]);

        // Crear suscripción en Subscriptionify
        $subscription = $user->subscribe($plan, [
            'started_at' => now(),
            'ends_at' => now()->addMonth(),
            'metadata' => [
                'stripe_subscription_id' => $stripeSubscription->id,
            ],
        ]);

        return $subscription;
    }
}
```

## Listeners para Eventos de Suscripción

Subscriptionify dispara eventos que puedes escuchar para ejecutar lógica adicional:

```php
<?php

namespace App\Listeners;

use Subscriptionify\Events\SubscriptionCreated;
use Illuminate\Support\Facades\Mail;
use App\Mail\SubscriptionWelcome;

class HandleNewSubscription
{
    public function handle(SubscriptionCreated $event)
    {
        $user = $event->subscription->user;
        $plan = $event->subscription->plan;

        // Enviar email de bienvenida
        Mail::to($user)->send(new SubscriptionWelcome($plan));

        // Registrar en analytics
        event(new \App\Events\SubscriptionAnalytics([
            'user_id' => $user->id,
            'plan_id' => $plan->id,
            'timestamp' => now(),
        ]));
    }
}
```

Registra el listener en tu `EventServiceProvider`:

```php
protected $listen = [
    'Subscriptionify\Events\SubscriptionCreated' => [
        'App\Listeners\HandleNewSubscription',
    ],
    'Subscriptionify\Events\SubscriptionCancelled' => [
        'App\Listeners\HandleCancelledSubscription',
    ],
];
```

## Middlewares para Proteger Features

Protege tus rutas basadas en suscripción:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CheckSubscriptionFeature
{
    public function handle(Request $request, Closure $next, $feature)
    {
        $user = $request->user();

        if (!$user || !$user->hasFeature($feature)) {
            return response()->json([
                'message' => 'Esta característica no está disponible en tu plan',
            ], 403);
        }

        return $next($request);
    }
}
```

Úsalo en tus rutas:

```php
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/api/advanced-analytics', [AnalyticsController::class, 'advanced'])
        ->middleware('check.feature:analytics');
});
```

## Dashboard de Administración

Para monitorear suscripciones, crea un dashboard simple:

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Subscriptionify\Models\Plan;
use Subscriptionify\Models\Subscription;

class SubscriptionDashboardController extends Controller
{
    public function index()
    {
        return view('admin.subscriptions', [
            'active_subscriptions' => Subscription::active()->count(),
            'total_revenue' => Subscription::active()
                ->get()
                ->sum(fn ($s) => $s->plan->price),
            'subscriptions_by_plan' => Plan::withCount('subscriptions')
                ->get(),
            'recent_signups' => Subscription::latest()