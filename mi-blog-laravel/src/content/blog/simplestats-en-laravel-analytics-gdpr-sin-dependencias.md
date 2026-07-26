---
title: 'SimpleStats en Laravel: Analytics GDPR sin Dependencias'
description: 'Implementa analytics server-side en Laravel con SimpleStats, rastreo de atribución y ingresos sin comprometer privacidad. Guía completa paso a paso.'
pubDate: '2026-07-21'
tags: ['laravel', 'analytics', 'gdpr', 'seguridad']
---

## Introducción: El Dilema de las Analytics en Laravel

Cuando desarrollamos una aplicación web moderna, necesitamos entender el comportamiento de nuestros usuarios: qué canales traen más tráfico, cuál es la tasa de conversión real, cuánto ingresos genera cada campaña. Sin embargo, soluciones populares como Google Analytics tienen un problema fundamental: envían datos a servidores externos, violando la privacidad del usuario y generando complicaciones con GDPR.

**SimpleStats** emerge como una solución elegante: un stack de analytics construido específicamente para Laravel que resuelve este dilema. Es server-side, GDPR-compliant (cumple normativas de privacidad), y más importante aún, vincula cada visitante, registro y pago a la campaña que lo originó.

En este artículo, exploraremos cómo integrar SimpleStats en tu aplicación Laravel, capturar datos de atribución correctamente, y construir dashboards que realmente te digan dónde viene tu dinero.

## ¿Qué es SimpleStats y por qué debería importarte?

### El Problema con Analytics Tradicionales

Las soluciones convencionales tienen limitaciones críticas:

- **Privacidad comprometida**: Los datos viajan a terceros
- **Tracking incompleto**: No conectan visitantes con pagos
- **Compliance complejo**: GDPR, CCPA y normativas locales requieren consentimiento explícito
- **Dependencias externas**: Si el servicio falla, pierdes datos

### Por qué SimpleStats es Diferente

SimpleStats es una plataforma de analytics server-side construida para Laravel que:

1. **Mantiene todo local** - Los datos nunca salen de tu servidor
2. **Rastrea atribución** - Vincula cada conversión a su fuente original
3. **Es GDPR-compliant** - Cumple normativas de privacidad por defecto
4. **Integración nativa** - Diseñada pensando en Laravel desde el inicio

## Instalación y Configuración Inicial

### Paso 1: Instalación del Paquete

Primero, instala SimpleStats a través de Composer:

```bash
composer require simplestats/laravel
```

Luego, publica los assets y migraciones:

```bash
php artisan vendor:publish --provider="SimpleStats\Laravel\SimpleStatsServiceProvider"
php artisan migrate
```

### Paso 2: Configurar el Archivo .env

Añade las variables de configuración en tu `.env`:

```env
SIMPLESTATS_ENABLED=true
SIMPLESTATS_HASH_IPS=true
SIMPLESTATS_RETENTION_DAYS=365
SIMPLESTATS_TRACK_REVENUE=true
```

### Paso 3: Publicar Configuración

```bash
php artisan vendor:publish --tag=simplestats-config
```

Esto crea `config/simplestats.php` donde puedes personalizar el comportamiento:

```php
<?php

return [
    'enabled' => env('SIMPLESTATS_ENABLED', true),
    
    'hash_ips' => env('SIMPLESTATS_HASH_IPS', true),
    
    'retention_days' => env('SIMPLESTATS_RETENTION_DAYS', 365),
    
    'track_revenue' => env('SIMPLESTATS_TRACK_REVENUE', true),
    
    'attribution_window_days' => 30,
    
    'database' => 'mysql',
];
```

## Capturando Eventos: Visitantes, Signups y Pagos

SimpleStats rastrea tres eventos fundamentales. Veamos cómo implementar cada uno.

### Evento 1: Rastrear Visitantes

El rastreo automático de visitantes se activa mediante un middleware que se registra automáticamente:

```php
// config/simplestats.php
'middleware' => [
    \SimpleStats\Laravel\Middleware\TrackPageViews::class,
],
```

Este middleware captura automáticamente:
- URL visitada
- Referrer (origen)
- User-Agent del navegador
- IP hasheada (opcional)
- Timestamp

Para eventos personalizados, usa la facade:

```php
<?php

namespace App\Http\Controllers;

use SimpleStats\Facades\Analytics;

class HomeController extends Controller
{
    public function index()
    {
        // Registrar evento personalizado
        Analytics::trackEvent('homepage_viewed', [
            'section' => 'hero',
            'duration' => 5,
        ]);
        
        return view('home');
    }
}
```

### Evento 2: Rastrear Registros (Signups)

Cuando un usuario se registra, queremos vincular ese evento a la campaña que lo trajo:

```php
<?php

namespace App\Http\Controllers\Auth;

use SimpleStats\Facades\Analytics;
use App\Models\User;

class RegisterController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|email|unique:users',
            'name' => 'required|string',
            'password' => 'required|min:8|confirmed',
        ]);

        $user = User::create([
            'email' => $validated['email'],
            'name' => $validated['name'],
            'password' => bcrypt($validated['password']),
        ]);

        // Registrar signup vinculado a la campaña
        Analytics::trackSignup(
            user_id: $user->id,
            email: $user->email,
            metadata: [
                'plan' => 'free',
                'source' => 'organic',
            ]
        );

        return redirect('/dashboard');
    }
}
```

### Evento 3: Rastrear Ingresos

Este es el evento más crítico. Cada pago debe vincularse a su origen:

```php
<?php

namespace App\Http\Controllers;

use SimpleStats\Facades\Analytics;
use App\Models\Subscription;

class SubscriptionController extends Controller
{
    public function store(Request $request)
    {
        $plan = $request->input('plan');
        $price = $this->getPlanPrice($plan);

        // Procesar pago (Stripe, PayPal, etc.)
        $payment = $this->processPayment($price);

        if ($payment->successful()) {
            $subscription = Subscription::create([
                'user_id' => auth()->id(),
                'plan' => $plan,
                'amount' => $price,
                'stripe_id' => $payment->id,
            ]);

            // Registrar conversión monetaria
            Analytics::trackRevenue(
                user_id: auth()->id(),
                amount: $price,
                currency: 'USD',
                transaction_id: $payment->id,
                plan: $plan,
                metadata: [
                    'subscription_id' => $subscription->id,
                ]
            );

            return response()->json(['success' => true]);
        }

        return response()->json(['error' => 'Payment failed'], 400);
    }
}
```

## Rastreo de Atribución: Vincular Campañas con Conversiones

La magia de SimpleStats está en la atribución. Debes asegurar que los parámetros UTM (o tu propio sistema) se capturen en el primer contacto.

### Capturar Parámetros UTM

```php
<?php

namespace App\Http\Middleware;

use SimpleStats\Facades\Analytics;
use Closure;

class CaptureUTMParameters
{
    public function handle($request, Closure $next)
    {
        $utm = [
            'source' => $request->query('utm_source'),
            'medium' => $request->query('utm_medium'),
            'campaign' => $request->query('utm_campaign'),
            'content' => $request->query('utm_content'),
            'term' => $request->query('utm_term'),
        ];

        // Guardar en sesión para vincular con eventos posteriores
        if (array_filter($utm)) {
            session(['utm_data' => $utm]);
            
            Analytics::trackCampaignSource(
                source: $utm['source'],
                medium: $utm['medium'],
                campaign: $utm['campaign'],
                metadata: $utm
            );
        }

        return $next($request);
    }
}
```

Registra este middleware en `app/Http/Kernel.php`:

```php
protected $middleware = [
    // ...
    \App\Http\Middleware\CaptureUTMParameters::class,
];
```

### Configurar la Ventana de Atribución

Por defecto, SimpleStats usa una ventana de 30 días. Personalízala según tus necesidades:

```php
// config/simplestats.php
'attribution_window_days' => 14, // Para ecommerce de corta conversión
```

## Consultando los Datos: El Query Builder

SimpleStats proporciona un fluido query builder para extraer insights:

```php
<?php

namespace App\Http\Controllers;

use SimpleStats\Facades\Analytics;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index()
    {
        // Visitantes únicos por fuente en los últimos 30 días
        $visitorsBySource = Analytics::query()
            ->selectRaw('utm_source, COUNT(DISTINCT visitor_id) as count')
            ->whereDateBetween('created_at', now()->subDays(30), now())
            ->groupBy('utm_source')
            ->orderByDesc('count')
            ->get();

        // ROI por campaña
        $roiByCampaign = Analytics::query()
            ->selectRaw(
                'utm_campaign, 
                 COUNT(DISTINCT visitor_id) as visitors,
                 COUNT(DISTINCT signup_id) as signups,
                 COALESCE(SUM(revenue), 0) as total_revenue'
            )
            ->whereDateBetween('created_at', now()->subDays(90), now())
            ->groupBy('utm_campaign')
            ->orderByDesc('total_revenue')
            ->get();

        $roiByCampaign = $roiByCampaign->map(function ($item) {
            return [
                'campaign' => $item->utm_campaign,
                'visitors' => $item->visitors,
                'signups' => $item->signups,
                'conversion_rate' => ($item->signups / $item->visitors * 100),
                'revenue' => $item->total_revenue,
                'roi' => ($item->total_revenue / ($item->visitors * 0.1)), // Costo estimado
            ];
        });

        return view('dashboard', [
            'visitorsBySource' => $visitorsBySource,
            'roiByCampaign' => $roiByCampaign,
        ]);
    }
}
```

## Construir un Dashboard Interactivo

Veamos cómo renderizar estos datos en una vista Blade:

```blade
@extends('layouts.app')

@section('content')
<div class="py-12">
    <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
        
        <!-- Tarjeta ROI por Campaña -->
        <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg mb-6">
            <div class="p-6">
                <h2 class="text-xl font-bold mb-4">ROI por Campaña (últimos 90 días)</h2>
                
                <table class="w-full">
                    <thead>
                        <tr class="border-b">
                            <th class="text-left py-2">Campaña</th>
                            <th class="text-right py-2">Visitantes</th>
                            <th class="text-right py-2">Registros</th>
                            <th class="text-right py-2">Conversión</th>
                            <th class="text-right py-2">Ingresos</th>
                            <th class="text-right py-2">ROI</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($roiByCampaign as $campaign)
                        <tr class="border-b hover:bg-gray-50">
                            <td class="py-3">{{ $campaign['campaign'] }}</td>
                            <td class="text-right">{{ number_format($campaign['visitors']) }}</td>
                            <td class="text-right">{{ number_format($campaign['signups']) }}</td>
                            <td class="text-right">
                                <span class="badge badge-primary">
                                    {{ number_format($campaign['conversion_rate'], 2) }}%
                                </span>
                            </td>
                            <td class="text-right font-bold">${{ number_format($campaign['revenue'], 2) }}</td>
                            <td class="text-right">
                                @if($campaign['roi'] > 0)
                                    <span class="text-green-600">+{{ number_format($campaign['roi'], 0) }}%</span>
                                @else
                                    <span class="text-red-600">{{ number_format($campaign['roi'], 0) }}%</span>
                                @endif
                            </td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Visitantes por Fuente -->
        <div class="bg-white overflow-hidden shadow-sm sm:rounded-lg">
            <div class="p-6">
                <h2 class="text-xl font-bold mb-4">Visitantes por Fuente (últimos 30 días)</h2>
                
                <div class="grid grid-cols-3 gap-4">
                    @foreach($visitorsBySource as $source)
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                        <p class="text-gray-600 text-sm uppercase">{{ $source->utm_source ?? 'Directo' }}</p>
                        <p class="text-3xl font-bold text-blue-600">{{ number_format($source->count) }}</p>
                    </div>
                    @endforeach
                </div>
            </div>
        </div>
    </div>
</div>
@endsection
```

## Privacidad y Cumplimiento GDPR

SimpleStats está diseñado para privacidad desde el inicio. Algunos detalles importantes:

### Hashing de IPs

Las IPs se hashean por defecto para anonimizar visitantes:

```php
// config/simplestats.php
'hash_ips' => true, // Recomendado para GDPR
```

### Retención de Datos

Configura cuánto tiempo almacenar datos:

```php
// config/simplestats.php
'retention_days' => 365, // Eliminar datos después de 1 año
```

SimpleStats limpia automáticamente registros antiguos:

```bash
php artisan simplestats:prune
```

Añade esto a tu `app/Console/Kernel.php` para automatizar:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('simplestats:prune')
        ->daily()
        ->at('02:00');
}
```

### Aviso de Privacidad

Aunque SimpleStats es GDPR-compliant, comunica claramente a los usuarios que recopiles datos:

```blade
<!-- En footer o política -->
<p class="text-sm text-gray-600">
    Utilizamos analytics propios para entender cómo usas nuestro sitio.
    No compartimos tus datos