---
title: 'Enums en Laravel 13: Tipado Fuerte sin Complejidad'
description: 'Aprende a usar Enums en Laravel 13 para código más seguro y mantenible. Guía completa con ejemplos prácticos de implementación.'
pubDate: '2026-04-29'
tags: ['laravel', 'php', 'laravel-13', 'enums']
---

## Introducción

Los enumerados (Enums) son una de las características más poderosas de PHP 8.1+ que Laravel ha adoptado plenamente en su versión 13. Si aún no los utilizas en tus proyectos, te estás perdiendo la oportunidad de escribir código más seguro, autocompletable y fácil de mantener.

En este artículo exploraremos cómo integrar Enums en tus aplicaciones Laravel para evitar errores en tiempo de ejecución, mejorar la documentación implícita del código y reducir bugs difíciles de detectar.

## ¿Qué son los Enums y por qué importan?

### El problema tradicional

Antes de los Enums, la mayoría de desarrolladores Laravel usaban constantes de clase o simples strings para representar estados o categorías:

```php
class Order
{
    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    public function getStatus()
    {
        return 'pending'; // ¿Es válido este valor?
    }
}
```

**Los problemas:**
- No hay validación: `'pneding'` (typo) se acepta sin error
- IDE autocomplete limitado
- Sin type hints claros
- Mantener una lista de valores válidos es manual

### La solución: Enums

Los Enums en PHP 8.1+ resuelven estos problemas proporcionando un tipo seguro:

```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';
}
```

## Tipos de Enums en Laravel

### Enums "puros" (backed Enums con strings)

El tipo más común en Laravel, ideal para valores que se guardan en base de datos:

```php
enum PaymentMethod: string
{
    case CreditCard = 'credit_card';
    case PayPal = 'paypal';
    case BankTransfer = 'bank_transfer';
    case Cryptocurrency = 'crypto';
}
```

### Enums con valores enteros

Útil cuando trabajas con códigos numéricos:

```php
enum HttpStatus: int
{
    case OK = 200;
    case Created = 201;
    case BadRequest = 400;
    case Unauthorized = 401;
    case NotFound = 404;
    case ServerError = 500;
}
```

### Enums puros (sin backing)

Para cuando solo necesitas enumerar opciones sin valores específicos:

```php
enum UserRole
{
    case Admin;
    case Editor;
    case Viewer;
}
```

## Integrando Enums en Modelos Eloquent

### Casting automático

Laravel 13 permite castear automáticamente columnas a Enums:

```php
<?php

namespace App\Models;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = ['status', 'payment_method', 'total'];

    protected $casts = [
        'status' => OrderStatus::class,
        'payment_method' => PaymentMethod::class,
        'created_at' => 'datetime',
    ];
}
```

**Ventajas:**
- Acceso automático como objeto Enum, no string
- Type hints en el IDE
- Validación implícita en migraciones

### Usando Enums con type hints

```php
class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create([
            'status' => OrderStatus::Pending,
            'payment_method' => PaymentMethod::CreditCard,
            'total' => $request->total,
        ]);

        return $order;
    }

    public function updateStatus(Order $order, OrderStatus $status)
    {
        $order->update(['status' => $status]);
        return $order;
    }
}
```

## Métodos útiles en Enums

### Acceder al valor backing

```php
$status = OrderStatus::Pending;

// Obtener el valor de base de datos
echo $status->value; // 'pending'

// Obtener el nombre del caso
echo $status->name;  // 'Pending'
```

### Listar todos los casos

```php
// Obtener todos los casos
$allStatuses = OrderStatus::cases();

// Resultado:
// [
//     OrderStatus::Pending,
//     OrderStatus::Processing,
//     OrderStatus::Completed,
//     OrderStatus::Failed,
// ]
```

### Métodos personalizados en Enums

Puedes agregar métodos a tus Enums como en cualquier clase:

```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';

    public function label(): string
    {
        return match($this) {
            self::Pending => 'Pendiente de pago',
            self::Processing => 'En proceso',
            self::Completed => 'Completada',
            self::Failed => 'Falló',
        };
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Completed, self::Failed]);
    }

    public function color(): string
    {
        return match($this) {
            self::Pending => 'yellow',
            self::Processing => 'blue',
            self::Completed => 'green',
            self::Failed => 'red',
        };
    }
}
```

**Uso en controladores:**

```php
$order = Order::find(1);

echo $order->status->label();  // "Completada"
echo $order->status->color();  // "green"

if ($order->status->isFinal()) {
    // Actualizar inventario, enviar notificación, etc.
}
```

## Validación de Enums en formularios

### Validar que una entrada sea un Enum válido

```php
use Illuminate\Validation\Rules\Enum;

class StoreOrderRequest extends FormRequest
{
    public function rules()
    {
        return [
            'status' => ['required', new Enum(OrderStatus::class)],
            'payment_method' => ['required', new Enum(PaymentMethod::class)],
            'total' => ['required', 'numeric', 'min:0.01'],
        ];
    }
}
```

### Validación personalizada

```php
class UpdateOrderRequest extends FormRequest
{
    public function rules()
    {
        return [
            'status' => [
                'required',
                new Enum(OrderStatus::class),
                function ($attribute, $value, $fail) {
                    // Lógica de negocio: solo ciertos cambios de estado son válidos
                    $currentStatus = $this->order->status;

                    if ($currentStatus === OrderStatus::Completed) {
                        $fail('No puedes cambiar el estado de una orden completada.');
                    }
                },
            ],
        ];
    }
}
```

## Trabajar con Enums en migraciones y seeders

### Crear tabla con Enum

```php
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->string('status')
        ->default(OrderStatus::Pending->value)
        ->index();
    $table->string('payment_method');
    $table->decimal('total', 10, 2);
    $table->timestamps();
});
```

### Seeder con Enums

```php
<?php

namespace Database\Seeders;

use App\Enums\OrderStatus;
use App\Enums\PaymentMethod;
use App\Models\Order;
use Illuminate\Database\Seeder;

class OrderSeeder extends Seeder
{
    public function run()
    {
        Order::factory()
            ->count(50)
            ->create([
                'status' => OrderStatus::cases()[array_rand(OrderStatus::cases())],
                'payment_method' => PaymentMethod::cases()[array_rand(PaymentMethod::cases())],
            ]);
    }
}
```

## Enums en Queries y Filtros

### Filtrar por Enum en Eloquent

```php
// Obtener todas las órdenes pendientes
$pendingOrders = Order::where('status', OrderStatus::Pending)->get();

// O más limpio:
$pendingOrders = Order::where('status', OrderStatus::Pending->value)->get();

// Con whereIn para múltiples valores
$inactiveOrders = Order::whereIn('status', [
    OrderStatus::Failed->value,
    OrderStatus::Completed->value,
])->get();
```

### Scopes con Enums

```php
class Order extends Model
{
    public function scopeByStatus(Builder $query, OrderStatus $status)
    {
        return $query->where('status', $status);
    }

    public function scopeActive(Builder $query)
    {
        return $query->whereIn('status', [
            OrderStatus::Pending->value,
            OrderStatus::Processing->value,
        ]);
    }
}

// Uso:
$pending = Order::byStatus(OrderStatus::Pending)->get();
$active = Order::active()->get();
```

## Serialización JSON y APIs

### Respuestas API con Enums

```php
class OrderResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value, // Convertir a string para JSON
            'status_label' => $this->status->label(),
            'payment_method' => $this->payment_method->value,
            'total' => $this->total,
            'created_at' => $this->created_at,
        ];
    }
}
```

### Request binding automático en rutas API

Laravel 13 puede vincular automáticamente Enums en route model binding:

```php
Route::apiResource('orders', OrderController::class);

// En OrderController:
public function show(Order $order, OrderStatus $status)
{
    // $status se convierte automáticamente desde la URL
}
```

## Mejores prácticas

### 1. Organiza Enums en una carpeta dedicada

```
app/
├── Enums/
│   ├── OrderStatus.php
│   ├── PaymentMethod.php
│   ├── UserRole.php
│   └── NotificationType.php
```

### 2. Documenta los Enums con comentarios

```php
/**
 * Estados posibles de una orden
 * 
 * @method static self Pending()
 * @method static self Processing()
 * @method static self Completed()
 * @method static self Failed()
 */
enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';
}
```

### 3. Usa Enums para constantes de negocio

En lugar de constantes dispersas en la aplicación, centraliza en Enums:

```php
// ❌ Malo
class OrderService
{
    const PENDING = 'pending';
    const COMPLETED = 'completed';
}

// ✅ Bien
class OrderService
{
    public function process(OrderStatus $status)
    {
        // Type hint seguro
    }
}
```

### 4. Combina Enums con métodos para lógica de negocio

```php
enum OrderStatus: string
{
    case Pending = 'pending';
    case Processing = 'processing';
    case Completed = 'completed';
    case Failed = 'failed';

    public function canTransitionTo(OrderStatus $target): bool
    {
        return match($this) {
            self::Pending => in_array($target, [self::Processing, self::Failed]),
            self::Processing => in_array($target, [self::Completed, self::Failed]),
            self::Completed => false,
            self::Failed => false,
        };
    }
}

// Uso:
if ($order->status->canTransitionTo($newStatus)) {
    $order->update(['status' => $newStatus]);
}
```

## Enums en Laravel 13: Nuevas características

Laravel 13 introdujo soporte mejorado para Enums en varias áreas:

### Soporte en LazyCollection

```php
$statuses = collect(OrderStatus::cases())
    ->lazy()
    ->keyBy(fn($enum) => $enum->value)
    ->map(fn($enum) => $enum->label());
```

### Soporte en ConcurrencyManager

```php
// Los Enums funcionan mejor con validación de concurrencia
$concurrency = new ConcurrencyManager(
    driver: ConcurrencyDriver::Process,
    limit: 5
);
```

## Conclusión

Los Enums son un cambio de juego para la seguridad de tipos en Laravel. Al usarlos correctamente, reduces bugs en tiempo de ejecución, mejoras el autocompletado del IDE y haces tu código más legible y mantenible.

Las ventajas se multiplican en proyectos medianos y grandes donde hay múltiples desarrolladores, ya que los Enums sirven como documentación ejecutable del código.

Comienza integrando Enums en nuevas features de tu aplicación y considera refactorizar código antiguo que use constantes de clase o strings mágicos.

## Puntos clave

- **Los Enums proporcionan tipado seguro** para valores específicos, evitando typos y valores inválidos
- **Laravel 13 integra Enums nativamente** en modelos, validación y rutas
- **Usa `protected $casts`** para convertir automáticamente columnas de base de datos a Enums
- **Agrega métodos a Enums** para centralizar lógica de negocio relacionada con estados
- **Valida con `new Enum(EnumClass::class)`** en tus Form Requests
- **Los Enums mejoran el autocompletado del IDE** y sirven como documentación viva
- **Organiza Enums en la carpeta `app/Enums`** para mantener el proyecto estructurado
- **Combina Enums con scopes y validadores** personalizados para máxima seguridad
- **Accede al valor con `->value`** y al nombre con `->name` cuando sea necesario
- **Los Enums funcionan perfectamente con APIs JSON** si los conviertes a strings explícitamente