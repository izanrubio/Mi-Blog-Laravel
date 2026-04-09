---
title: 'Service Container y Service Providers en Laravel explicados'
description: 'Entiende el Service Container y los Service Providers de Laravel: qué son, cómo funcionan, cómo crear el tuyo y para qué sirven en aplicaciones reales.'
pubDate: '2024-03-19'
tags: ['laravel', 'service-container', 'service-providers', 'arquitectura']
---

El Service Container (contenedor de servicios) es el corazón de Laravel. Todo en el framework pasa por él: desde la resolución de controladores hasta la inyección de dependencias. Entenderlo convierte a un desarrollador Laravel de bueno en muy bueno. Vamos paso a paso.

## El problema que resuelve: Inversión de Control

Imagina que tienes una clase `OrderService` que necesita un `PaymentGateway`. La forma ingenua sería:

```php
class OrderService
{
    private PaymentGateway $gateway;
    
    public function __construct()
    {
        // MAL: dependencia hardcodeada
        $this->gateway = new StripeGateway('sk_live_...'); 
    }
}
```

El problema: si quieres cambiar a PayPal, debes modificar `OrderService`. Si quieres testear sin hacer cobros reales, es muy difícil. Esto viola el principio de responsabilidad única.

La solución es la **Inversión de Control (IoC)**: la clase no crea sus dependencias, las recibe:

```php
class OrderService
{
    public function __construct(
        private PaymentGateway $gateway  // Recibe la dependencia
    ) {}
}
```

El Service Container de Laravel es el mecanismo que crea y entrega esas dependencias automáticamente.

## El Service Container en acción

### Resolución automática (Auto-wiring)

Laravel puede resolver clases automáticamente sin ninguna configuración si no tienen dependencias abstractas:

```php
// Laravel puede crear esto sin configuración
class EmailService
{
    public function __construct(
        private MailerInterface $mailer  // Interfaz, necesita configuración
    ) {}
}

// Pero esto lo resuelve automáticamente
class PostService
{
    public function __construct(
        private PostRepository $repo  // Clase concreta
    ) {}
}
```

Cuando Laravel ve que un controlador o clase necesita un `PostService`, mira sus dependencias, crea un `PostRepository` (y sus propias dependencias, recursivamente) y se lo inyecta.

### bind(): registrar una implementación

```php
// bind() crea una nueva instancia cada vez que se solicita
app()->bind(PaymentGateway::class, StripeGateway::class);

// O con un callback para configuración adicional
app()->bind(PaymentGateway::class, function ($app) {
    return new StripeGateway(
        config('services.stripe.secret'),
        config('services.stripe.webhook_secret')
    );
});
```

### singleton(): una sola instancia

```php
// singleton() crea la instancia una vez y la reutiliza
app()->singleton(CacheService::class, function ($app) {
    return new CacheService(
        $app->make(Redis::class),
        config('cache.prefix')
    );
});

// La misma instancia en toda la request
$cache1 = app(CacheService::class);
$cache2 = app(CacheService::class);
// $cache1 === $cache2 (misma instancia)
```

### instance(): registrar una instancia ya creada

```php
// Si ya tienes la instancia creada, regístrala directamente
$gateway = new StripeGateway(config('services.stripe.secret'));
app()->instance(PaymentGateway::class, $gateway);
```

## Resolución y uso del contenedor

```php
// Forma 1: Helper app()
$service = app(PaymentGateway::class);

// Forma 2: make()
$service = app()->make(PaymentGateway::class);

// Forma 3: Type-hinting en controladores (automático)
class OrderController extends Controller
{
    public function __construct(
        private OrderService $orderService  // Se inyecta automáticamente
    ) {}
    
    public function store(Request $request)
    {
        $this->orderService->processOrder($request->validated());
    }
}

// Forma 4: Type-hinting en métodos del controlador
public function store(Request $request, PaymentGateway $gateway)
{
    // $gateway se inyecta automáticamente en el método
}
```

## Service Providers: dónde configuras el contenedor

Los Service Providers son las clases donde le dices al contenedor qué implementaciones usar para cada interfaz. Son el "mapa" de tu aplicación.

### Crear un Service Provider

```bash
php artisan make:provider PaymentServiceProvider
```

```php
<?php

namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Services\Payment\StripeGateway;
use Illuminate\Support\ServiceProvider;

class PaymentServiceProvider extends ServiceProvider
{
    /**
     * register(): SOLO para registrar bindings en el contenedor.
     * Aquí NO puedes usar otros servicios todavía (pueden no estar listos).
     */
    public function register(): void
    {
        $this->app->singleton(PaymentGateway::class, function ($app) {
            $driver = config('services.payment.driver', 'stripe');
            
            return match($driver) {
                'stripe' => new StripeGateway(
                    config('services.stripe.secret')
                ),
                'paypal' => new PayPalGateway(
                    config('services.paypal.client_id'),
                    config('services.paypal.secret')
                ),
                default => throw new \InvalidArgumentException("Driver {$driver} no soportado"),
            };
        });
    }

    /**
     * boot(): se ejecuta después de que TODOS los providers
     * han sido registrados. Aquí puedes usar otros servicios.
     */
    public function boot(): void
    {
        // Registrar un observer
        User::observe(UserObserver::class);
        
        // Publicar assets del paquete
        // $this->publishes([...]);
        
        // Escuchar eventos
        Event::listen(OrderCreated::class, SendOrderConfirmation::class);
    }
}
```

### Registrar el provider

En Laravel 11, los providers se registran en `bootstrap/providers.php`:

```php
// bootstrap/providers.php
return [
    App\Providers\AppServiceProvider::class,
    App\Providers\PaymentServiceProvider::class,  // ← Añadir aquí
];
```

En Laravel 10 y anteriores, en `config/app.php`:

```php
'providers' => [
    // ...
    App\Providers\PaymentServiceProvider::class,
],
```

## AppServiceProvider: el provider más importante

`AppServiceProvider` es donde configuras las cosas generales de tu aplicación:

```php
// app/Providers/AppServiceProvider.php

public function register(): void
{
    // Binding de interfaces a implementaciones
    $this->app->bind(
        \App\Contracts\UserRepository::class,
        \App\Repositories\EloquentUserRepository::class
    );
    
    // Macro para Carbon (fechas en español)
    \Carbon\Carbon::setLocale('es');
}

public function boot(): void
{
    // Forzar HTTPS en producción
    if ($this->app->environment('production')) {
        \URL::forceScheme('https');
    }
    
    // Reglas de validación personalizadas
    \Validator::extend('phone', function ($attribute, $value, $parameters, $validator) {
        return preg_match('/^\+?[0-9]{9,15}$/', $value);
    });
    
    // Configurar paginación
    \Illuminate\Pagination\Paginator::useBootstrapFive();
    
    // Observar modelos
    \App\Models\Post::observe(\App\Observers\PostObserver::class);
}
```

## Providers diferidos (deferred)

Si un provider registra servicios que raramente se usan, puedes diferir su carga para que no se ejecute en cada request:

```php
class ReportServiceProvider extends ServiceProvider
{
    // Marcar como diferido
    protected bool $defer = true;
    
    // Decirle al framework qué servicios provee
    public function provides(): array
    {
        return [ReportGenerator::class, PDFExporter::class];
    }
    
    public function register(): void
    {
        $this->app->singleton(ReportGenerator::class, function ($app) {
            return new ReportGenerator(
                $app->make(PDFExporter::class)
            );
        });
        
        $this->app->singleton(PDFExporter::class, function () {
            return new PDFExporter(config('reports.paper_size'));
        });
    }
}
```

Laravel solo carga este provider cuando alguien solicita `ReportGenerator` o `PDFExporter`, no en cada request.

## Ejemplo práctico: inyección de dependencias en un flujo real

```php
// Interfaz
interface NotificationSender
{
    public function send(User $user, string $message): void;
}

// Implementaciones
class EmailNotificationSender implements NotificationSender
{
    public function send(User $user, string $message): void
    {
        Mail::to($user)->send(new GenericNotification($message));
    }
}

class SmsNotificationSender implements NotificationSender
{
    public function send(User $user, string $message): void
    {
        // Enviar SMS con Twilio o similar
    }
}

// AppServiceProvider
public function register(): void
{
    $this->app->bind(NotificationSender::class, function () {
        return config('notifications.driver') === 'sms'
            ? new SmsNotificationSender()
            : new EmailNotificationSender();
    });
}

// Controlador: no sabe qué implementación usa
class UserController extends Controller
{
    public function __construct(
        private NotificationSender $notifier
    ) {}
    
    public function update(Request $request, User $user)
    {
        $user->update($request->validated());
        
        $this->notifier->send($user, 'Tu perfil ha sido actualizado');
        
        return back()->with('success', 'Perfil actualizado');
    }
}
```

Cambiar de email a SMS solo requiere cambiar una línea en la configuración, no modificar el controlador.

## Conclusión

El Service Container es el mecanismo que permite a Laravel construir objetos automáticamente con sus dependencias. Los Service Providers son los "registros" donde defines cómo construir esos objetos. La Inversión de Control que esto habilita hace tu código más flexible, testeable y mantenible. Dominar estos conceptos es dar el salto de desarrollador básico a desarrollador Laravel serio.
