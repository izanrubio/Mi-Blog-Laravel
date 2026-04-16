---
title: 'Atributo #[Delay] en Laravel: Colas con Ejecución Programada'
description: 'Domina el atributo #[Delay] en Laravel 13.5 para programar la ejecución de jobs en colas. Guía práctica con ejemplos reales.'
pubDate: '2026-04-16'
tags: ['laravel', 'colas', 'jobs', 'php', 'laravel-13']
---

## Introducción

Las colas en Laravel son fundamentales para procesar tareas pesadas de forma asincrónica. Sin embargo, muchos desarrolladores desconocen que desde Laravel 13.5 existe una forma elegante y declarativa de programar el retraso en la ejecución de jobs usando el atributo `#[Delay]`.

En lugar de pasar tiempos de espera como parámetros al encolar o usar métodos `delay()` en tus jobs, ahora puedes utilizar atributos PHP nativos para una sintaxis más limpia y mantenible. En este artículo aprenderás cómo implementar y aprovechar `#[Delay]` en tus aplicaciones Laravel modernas.

## ¿Qué es el atributo #[Delay]?

El atributo `#[Delay]` es un decorator PHP (atributo) introducido en Laravel 13.5 que permite especificar directamente en la clase del job cuánto tiempo debe esperar antes de ejecutarse.

**Ventajas principales:**

- **Declarativo**: Define el comportamiento en la clase del job, no al encolar
- **Type-safe**: Aprovecha el sistema de tipos de PHP 8+
- **Limpio**: Código más legible y mantenible
- **Flexible**: Soporta múltiples formatos de tiempo

Antes de esta feature, debías hacerlo así:

```php
// Manera antigua - menos clara
Bus::dispatch(new ProcessPayment($order))->delay(now()->addMinutes(5));
```

Ahora puedes declararlo directamente en el job:

```php
#[Delay(minutes: 5)]
class ProcessPayment implements ShouldQueue
{
    // ...
}
```

## Instalación y Configuración Básica

Si usas Laravel 13.5 o superior, el atributo `#[Delay]` ya está disponible. No requiere instalación adicional.

Asegúrate de tener al menos esta versión en tu `composer.json`:

```json
{
    "require": {
        "laravel/framework": "^13.5"
    }
}
```

Actualiza si es necesario:

```bash
composer update laravel/framework
```

## Uso Básico del Atributo #[Delay]

### Ejemplo Simple: Retraso en Minutos

Vamos a crear un job que procese un email de bienvenida 1 hora después de que el usuario se registre:

```php
<?php

namespace App\Jobs;

use App\Models\User;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;
use Illuminate\Support\Facades\Mail;
use App\Mail\WelcomeEmail;

#[Delay(minutes: 60)]
class SendWelcomeEmail implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public User $user
    ) {}

    public function handle(): void
    {
        Mail::to($this->user->email)->send(new WelcomeEmail($this->user));
    }
}
```

Luego, encola el job de forma normal:

```php
// En tu controlador o servicio
SendWelcomeEmail::dispatch($user);
// Se ejecutará automáticamente 60 minutos después
```

### Diferentes Unidades de Tiempo

El atributo `#[Delay]` soporta múltiples parámetros para diferentes unidades:

```php
// Retraso en segundos
#[Delay(seconds: 30)]
class QuickTask implements ShouldQueue { }

// Retraso en minutos
#[Delay(minutes: 15)]
class MediumTask implements ShouldQueue { }

// Retraso en horas
#[Delay(hours: 2)]
class LongTask implements ShouldQueue { }

// Retraso en días
#[Delay(days: 1)]
class VeryLongTask implements ShouldQueue { }
```

## Casos de Uso Prácticos

### Caso 1: Recordatorio de Carrito Abandonado

```php
<?php

namespace App\Jobs;

use App\Models\Cart;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;
use Illuminate\Support\Facades\Mail;

#[Delay(hours: 24)]
class SendAbandonedCartReminder implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public Cart $cart
    ) {}

    public function handle(): void
    {
        // Verificar que el carrito sigue abandonado
        if ($this->cart->abandoned && !$this->cart->completed) {
            Mail::to($this->cart->user->email)
                ->send(new AbandonedCartEmail($this->cart));
        }
    }
}
```

En tu controlador:

```php
public function addToCart(Request $request)
{
    $cart = Cart::create([
        'user_id' => auth()->id(),
        'items' => $request->items,
        'abandoned' => false,
    ]);

    // Enviar recordatorio después de 24 horas
    SendAbandonedCartReminder::dispatch($cart);

    return response()->json(['success' => true]);
}
```

### Caso 2: Generación de Reportes

```php
<?php

namespace App\Jobs;

use App\Models\Report;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;

#[Delay(hours: 2)]
class GenerateMonthlyReport implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $month,
        public int $year
    ) {}

    public function handle(): void
    {
        // Generar reporte después de 2 horas
        $report = Report::generateMonthly($this->month, $this->year);
        
        event(new ReportGenerated($report));
    }
}
```

### Caso 3: Limpieza de Datos Temporales

```php
<?php

namespace App\Jobs;

use App\Models\TemporaryFile;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;

#[Delay(hours: 12)]
class CleanTemporaryFiles implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        TemporaryFile::where('created_at', '<', now()->subHours(12))
            ->get()
            ->each->delete();
    }
}
```

## Combinando #[Delay] con Otros Atributos

### Con #[WithoutOverlapping]

Puedes combinar `#[Delay]` con otros atributos para crear comportamientos más complejos:

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;
use Illuminate\Queue\Middleware\WithoutOverlapping;

#[Delay(minutes: 5)]
#[WithoutOverlapping(key: 'process-payment')]
class ProcessPayment implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $orderId
    ) {}

    public function handle(): void
    {
        // Este job se ejecutará con retraso de 5 minutos
        // y evitará ejecuciones simultáneas
        Order::find($this->orderId)->processPayment();
    }
}
```

### Con #[Tries] y #[Backoff]

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Attributes\Delay;

#[Delay(minutes: 10)]
class FetchExternalData implements ShouldQueue
{
    use Queueable;
    
    public $tries = 3;
    public $backoff = [60, 120, 300]; // segundos

    public function handle(): void
    {
        // Fetch data from external API
        // Se reintentará 3 veces con backoff exponencial
        $this->fetchFromApi();
    }
}
```

## Métodos de Inspección de Colas (Laravel 13.4+)

Laravel 13.4 introdujo métodos útiles para inspeccionar el estado de tus jobs en colas. Aunque no están directamente relacionados con `#[Delay]`, son complementarios:

```php
// Obtener todos los jobs pendientes
$pendingJobs = Bus::peekAtQueue();

// Contar jobs en la cola
$count = Bus::countOnQueue();

// Verificar si un job está en la cola
$hasJob = Bus::hasJobInQueue(ProcessPayment::class);
```

## Errores Comunes y Soluciones

### Error: "Attribute class not found"

**Problema:**
```php
#[Delay(minutes: 5)] // Error: namespace no encontrado
```

**Solución:**
Asegúrate de importar correctamente:

```php
use Illuminate\Queue\Attributes\Delay;

#[Delay(minutes: 5)]
class MyJob implements ShouldQueue
{
    // ...
}
```

### El job no se ejecuta después del retraso

**Posible causa:** El worker de colas no está activo.

```bash
# Asegúrate de que el worker está corriendo
php artisan queue:work
```

### Conflicto con `delay()` en el dispatch

Si usas tanto el atributo como el método:

```php
// Esto NO es recomendado - usa solo uno
#[Delay(minutes: 5)]
class MyJob implements ShouldQueue { }

// En tu código
MyJob::dispatch($data)->delay(now()->addMinutes(10)); // ¿Cuál prevalece?
```

**Solución:** Elige una sola estrategia. Preferiblemente usa el atributo para mayor claridad.

## Ventajas sobre el Enfoque Anterior

| Aspecto | Antiguo | Con #[Delay] |
|--------|---------|--------------|
| Ubicación | En el dispatch | En la clase |
| Claridad | Menos obvia | Muy clara |
| Reutilización | Repetir en cada dispatch | Automatizada |
| Type hints | No | Sí |
| Testing | Más complejo | Más simple |

## Testeo de Jobs con #[Delay]

```php
<?php

namespace Tests\Feature;

use App\Jobs\SendWelcomeEmail;
use App\Models\User;
use Illuminate\Support\Facades\Bus;
use Tests\TestCase;

class SendWelcomeEmailTest extends TestCase
{
    public function test_welcome_email_is_queued_with_delay(): void
    {
        Bus::fake();

        $user = User::factory()->create();
        SendWelcomeEmail::dispatch($user);

        Bus::assertDispatched(SendWelcomeEmail::class);
        
        // Verificar que tiene el retraso correcto
        // (depende de tu implementación)
    }
}
```

## Migración desde Código Antiguo

Si tienes jobs con delays en tu código existente:

**Antes:**
```php
class ProcessOrder implements ShouldQueue
{
    public function handle()
    {
        // lógica
    }
}

// En el controlador
ProcessOrder::dispatch($order)->delay(now()->addHours(2));
```

**Después:**
```php
#[Delay(hours: 2)]
class ProcessOrder implements ShouldQueue
{
    public function handle()
    {
        // lógica
    }
}

// En el controlador - mucho más limpio
ProcessOrder::dispatch($order);
```

## Conclusión

El atributo `#[Delay]` es una adición valiosa a Laravel 13.5 que simplifica significativamente la gestión de tareas programadas en colas. Al mantener la configuración de retraso directamente en la clase del job, tu código es más mantenible, legible y menos propenso a errores.

Esta feature representa la evolución continua de Laravel hacia una sintaxis más moderna y declarativa, aprovechando las capacidades de PHP 8+. Si aún no lo estás usando en tus proyectos nuevos, es un excelente momento para empezar.

## Puntos Clave

- **#[Delay] es un atributo PHP** que define el retraso en la ejecución de jobs directamente en su clase
- **Soporta múltiples unidades**: segundos, minutos, horas y días
- **Más limpio que `delay()` en dispatch()** porque la configuración está centralizada
- **Compatible con Laravel 13.5+** sin instalación adicional
- **Puede combinarse con otros atributos** como `#[WithoutOverlapping]`
- **Mejora la testabilidad** al tener la lógica de retraso en un solo lugar
- **Type-safe** gracias al sistema de tipos de PHP
- **Ideal para casos como**: recordatorios abandonados, reportes programados, limpieza de datos
- **Requiere que el queue worker esté activo** para ejecutarse correctamente
- **No necesita cambiar tu forma de encolar** - usa `dispatch()` normalmente