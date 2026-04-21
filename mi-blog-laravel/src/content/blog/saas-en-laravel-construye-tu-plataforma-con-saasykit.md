---
title: 'SaaS en Laravel: Construye tu Plataforma con SaaSykit'
description: 'Guía completa para crear aplicaciones SaaS con Laravel usando SaaSykit. Aprende a implementar facturación, tenants y autenticación.'
pubDate: '2026-04-21'
tags: ['laravel', 'saas', 'arquitectura', 'avanzado']
---

## Introducción: El Auge de los SaaS y Laravel

Construir una aplicación SaaS (Software as a Service) desde cero es un desafío complejo. No solo necesitas lógica de negocio sólida, sino también características empresariales críticas como facturación, multi-tenancy, autenticación avanzada y gestión de suscripciones.

**SaaSykit** es un starter kit de Laravel diseñado específicamente para resolver este problema. Viene preconfigurado con todas las características que una aplicación SaaS moderna necesita, permitiéndote enfocarte en lo que realmente importa: tu producto.

En este artículo, exploraremos cómo SaaSykit acelera el desarrollo de SaaS, qué incluye de fábrica y cómo personalizarlo para tu caso específico.

## ¿Qué es SaaSykit?

SaaSykit es un kit de inicio (starter kit) de Laravel que proporciona una base lista para producción con componentes esenciales para aplicaciones SaaS. No es un framework adicional, sino una distribución configurada de Laravel con arquitectura y características preconstruidas.

### Características principales

**Multi-tenancy**: Soporte nativo para múltiples clientes con datos aislados.

**Facturación integrada**: Sistema de pagos y suscripciones preconfigurado.

**Autenticación avanzada**: Manejo de usuarios, roles y permisos listos para usar.

**Plantillas de UI**: Interfaces modernas basadas en Tailwind CSS.

**API REST**: Endpoints ya configurados para integraciones.

**Documentación completa**: Guías paso a paso para cada feature.

## Instalación de SaaSykit

### Requisitos previos

Antes de comenzar, asegúrate de tener:

- PHP 8.2 o superior
- Composer instalado
- Node.js 18+ (para compilar assets)
- Base de datos MySQL o PostgreSQL
- Un servidor web (Apache, Nginx o Laravel Herd)

### Pasos de instalación

La instalación es tan simple como clonar el repositorio:

```bash
git clone https://github.com/saasykit/saasykit.git tu-proyecto
cd tu-proyecto
```

Instala las dependencias de PHP:

```bash
composer install
```

Copia el archivo de configuración:

```bash
cp .env.example .env
```

Genera la clave de aplicación:

```bash
php artisan key:generate
```

Ejecuta las migraciones para crear la estructura de base de datos:

```bash
php artisan migrate
```

Instala las dependencias de Node.js y compila los assets:

```bash
npm install
npm run dev
```

Finalmente, inicia el servidor de desarrollo:

```bash
php artisan serve
```

Ahora puedes acceder a tu aplicación en `http://localhost:8000`.

## Estructura Multi-Tenancy en SaaSykit

### ¿Qué es Multi-tenancy?

Multi-tenancy es una arquitectura donde múltiples clientes (tenants) comparten la misma aplicación, pero sus datos están completamente aislados. Es fundamental en cualquier SaaS.

SaaSykit usa el enfoque de **database per tenant**, donde cada cliente tiene su propia base de datos.

### Configuración de Tenants

El archivo de configuración principal está en `config/tenancy.php`:

```php
<?php

return [
    'database' => [
        'connection' => env('DB_TENANT_CONNECTION', 'tenant'),
        'prefix' => env('DB_TENANT_PREFIX', 'tenant_'),
    ],

    'domain' => [
        'pattern' => env('TENANT_DOMAIN_PATTERN', '{tenant}.localhost'),
    ],

    'path' => [
        'enabled' => env('TENANCY_BY_PATH', false),
        'pattern' => '{tenant}',
    ],
];
```

### Crear un nuevo Tenant

SaaSykit incluye comandos artisan para gestionar tenants:

```bash
php artisan tenants:create nombre-empresa ejemplo.com
```

Este comando crea automáticamente:

- Una nueva base de datos para el tenant
- Un registro en la tabla `tenants`
- Las migraciones específicas del tenant

### Modelo Tenant

El modelo `Tenant` es el corazón de la arquitectura:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant
{
    protected $guarded = [];

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'domain',
            'subscription_plan',
            'subscription_status',
            'stripe_customer_id',
        ];
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class, 'subscription_plan');
    }

    public function isActive()
    {
        return $this->subscription_status === 'active';
    }
}
```

## Sistema de Facturación y Pagos

### Integración con Stripe

SaaSykit viene preconfigurado con Stripe para manejar pagos. La integración se realiza a través de Laravel Cashier.

Primero, configura tus credenciales de Stripe en `.env`:

```env
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Modelos de suscripción

El modelo `Subscription` maneja toda la lógica de suscripciones:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Laravel\Cashier\Billable;

class Subscription extends Model
{
    use Billable;

    protected $fillable = [
        'tenant_id',
        'plan_id',
        'stripe_subscription_id',
        'status',
        'current_period_start',
        'current_period_end',
        'cancel_at_period_end',
    ];

    protected $casts = [
        'current_period_start' => 'datetime',
        'current_period_end' => 'datetime',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function isActive()
    {
        return $this->status === 'active';
    }

    public function isCancelled()
    {
        return $this->status === 'cancelled';
    }

    public function renew()
    {
        // Lógica de renovación
        $this->update(['status' => 'active']);
    }
}
```

### Crear un plan de precios

Los planes se definen en la tabla `plans`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // 'Starter', 'Pro', 'Enterprise'
            $table->text('description');
            $table->decimal('price', 10, 2);
            $table->string('stripe_price_id');
            $table->integer('billing_period'); // 30 para mensual
            $table->json('features'); // ['feature1', 'feature2']
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('plans');
    }
};
```

Seed algunos planes de ejemplo:

```php
<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run()
    {
        Plan::create([
            'name' => 'Starter',
            'description' => 'Para equipos pequeños',
            'price' => 29.00,
            'stripe_price_id' => 'price_...',
            'billing_period' => 30,
            'features' => [
                'users_limit' => 5,
                'storage_gb' => 10,
                'api_calls' => 10000,
            ],
        ]);

        Plan::create([
            'name' => 'Pro',
            'description' => 'Para equipos en crecimiento',
            'price' => 99.00,
            'stripe_price_id' => 'price_...',
            'billing_period' => 30,
            'features' => [
                'users_limit' => 50,
                'storage_gb' => 100,
                'api_calls' => 100000,
            ],
        ]);
    }
}
```

## Autenticación y Control de Acceso

### Sistema de permisos integrado

SaaSykit usa `spatie/laravel-permission` para un control de acceso granular:

```php
<?php

namespace App\Models;

use Spatie\Permission\Traits\HasRoles;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasRoles;

    protected $fillable = [
        'tenant_id',
        'name',
        'email',
        'password',
        'email_verified_at',
    ];

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isAdmin()
    {
        return $this->hasRole('admin');
    }

    public function canAccessFeature($feature)
    {
        $plan = $this->tenant->plan;
        return $plan->features[$feature] ?? false;
    }
}
```

### Definir roles y permisos

En un seeder:

```php
<?php

use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

// Crear permisos
Permission::create(['name' => 'view_dashboard']);
Permission::create(['name' => 'manage_users']);
Permission::create(['name' => 'manage_billing']);
Permission::create(['name' => 'view_reports']);

// Crear roles
$adminRole = Role::create(['name' => 'admin']);
$memberRole = Role::create(['name' => 'member']);

// Asignar permisos a roles
$adminRole->givePermissionTo(['view_dashboard', 'manage_users', 'manage_billing', 'view_reports']);
$memberRole->givePermissionTo(['view_dashboard', 'view_reports']);
```

### Proteger rutas con permisos

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\BillingController;

Route::middleware(['auth:sanctum', 'verified'])->group(function () {
    Route::get('/dashboard', fn() => view('dashboard'))->name('dashboard');
    
    Route::middleware(['permission:manage_billing'])->group(function () {
        Route::get('/billing', [BillingController::class, 'show'])->name('billing.show');
        Route::post('/billing/update-payment', [BillingController::class, 'update'])->name('billing.update');
    });
});
```

## API REST para Integraciones

SaaSykit incluye una API REST completamente funcional con autenticación token.

### Endpoints de ejemplo

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\SubscriptionController;

Route::middleware('api')->prefix('api')->group(function () {
    // Autenticación
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);

    // Rutas protegidas
    Route::middleware('auth:sanctum')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::apiResource('subscriptions', SubscriptionController::class);
        Route::get('/me', fn() => auth()->user());
    });
});
```

### Ejemplo de controlador API

```php
<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Http\Resources\UserResource;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index()
    {
        $users = auth()->user()->tenant->users()->paginate(15);
        return UserResource::collection($users);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users',
        ]);

        $user = auth()->user()->tenant->users()->create($validated);
        
        return new UserResource($user);
    }

    public function show(User $user)
    {
        $this->authorize('view', $user);
        return new UserResource($user);
    }
}
```

## Personalización y Extensión

### Agregar campos personalizados al tenant

Crea una migración:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up()
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->string('logo_url')->nullable();
            $table->string('primary_color')->default('#000000');
            $table->json('metadata')->nullable();
            $table->boolean('enable_sso')->default(false);
        });
    }

    public function down()
    {
        Schema::table('tenants', function (Blueprint $table) {
            $table->dropColumn(['logo_url', 'primary_color', 'metadata', 'enable_sso']);
        });
    }
};
```

### Crear eventos de ciclo de vida

Cuando un tenant se crea o cancela, dispara eventos:

```php
<?php

namespace App\Events;

use App\Models\Tenant;
use Illuminate\Foundation\Events\Dispatchable;

class TenantCreated
{
    use Dispatchable;

    public function __construct(public Tenant $tenant)
    {
    }
}

class TenantCancelled
{
    use Dispatchable;

    public function __construct(public Tenant $tenant)
    {
    }
}
```

Luego, crea listeners para procesar estos eventos:

```php
<?php

namespace App\Listeners;

use App\Events\TenantCreated;
use App\Mail\WelcomeEmail;
use Illuminate\Support\Facades\Mail;

class SendWelcomeEmail
{
    public function handle(TenantCreated $event)
    {
        Mail::to($event->tenant->owner_email)
            ->send(new WelcomeEmail($event->tenant));
    }
}
```

## Despliegue de una aplicación SaaS

### Consideraciones importantes

- **Seguridad de tenants**: Asegúrate de que los datos de un tenant nunca sean accesibles a otro.
- **Escalabilidad de base de datos**: Con muchos tenants, considera usar clustering.
- **Monitoreo**: Configura Laravel Telescope o New Relic para monitoreo en producción.
- **Backups**: Automat