---
title: 'Cómo estructurar un proyecto Laravel grande correctamente'
description: 'Aprende a organizar un proyecto Laravel a medida que crece: módulos, Actions, Services, DTOs y convenciones para mantener el código mantenible y escalable.'
pubDate: '2024-03-27'
tags: ['laravel', 'arquitectura', 'estructura', 'buenas-practicas']
---

La estructura por defecto de Laravel funciona perfectamente para proyectos pequeños y medianos. Pero cuando tu aplicación tiene 50 modelos, 100 controladores y lógica de negocio compleja, el directorio `app/` se convierte en un caos. Hablemos de cómo organizar un proyecto Laravel a medida que escala.

## Las limitaciones de la estructura por defecto

La estructura estándar de Laravel pone todo en pocas carpetas:

```
app/
├── Http/
│   ├── Controllers/     ← Pueden ser 50+ archivos
│   ├── Requests/        ← 100+ archivos
│   └── Middleware/
├── Models/              ← 30+ modelos
└── Providers/
```

Cuando tienes controladores enormes con 500 líneas que mezclan validación, lógica de negocio y acceso a datos, algo está mal. La solución no es abandonar la estructura de Laravel, sino añadir capas.

## Fat controllers: el antipatrón más común

```php
// MAL: controlador con toda la lógica
class OrderController extends Controller
{
    public function store(Request $request)
    {
        // Validación
        $validated = $request->validate([...]);
        
        // Lógica de negocio (50 líneas)
        $cart = Cart::find($request->cart_id);
        $discount = $this->calculateDiscount($cart, $request->coupon_code);
        $tax = $this->calculateTax($cart->total - $discount, $request->country);
        
        // Acceso a datos (30 líneas)
        $order = Order::create([...]);
        foreach ($cart->items as $item) {
            $order->items()->create([...]);
        }
        
        // Efectos secundarios (20 líneas)
        Mail::to($request->user())->send(new OrderConfirmation($order));
        $cart->delete();
        
        return redirect('/orders/'.$order->id);
    }
}
```

## La capa de Actions: un método, una responsabilidad

El patrón Action es una clase con un solo método público que hace una sola cosa:

```php
// app/Actions/Orders/CreateOrder.php
<?php

namespace App\Actions\Orders;

use App\Models\Cart;
use App\Models\Order;
use App\Models\User;

class CreateOrder
{
    public function __construct(
        private CalculateDiscount $calculateDiscount,
        private CalculateTax $calculateTax,
    ) {}

    public function execute(User $user, Cart $cart, array $data): Order
    {
        $discount = $this->calculateDiscount->execute($cart, $data['coupon_code'] ?? null);
        $tax      = $this->calculateTax->execute($cart->total - $discount, $data['country']);

        $order = Order::create([
            'user_id'  => $user->id,
            'subtotal' => $cart->total,
            'discount' => $discount,
            'tax'      => $tax,
            'total'    => $cart->total - $discount + $tax,
            'country'  => $data['country'],
        ]);

        foreach ($cart->items as $item) {
            $order->items()->create([
                'product_id' => $item->product_id,
                'quantity'   => $item->quantity,
                'price'      => $item->price,
            ]);
        }

        return $order;
    }
}
```

```php
// El controlador queda limpio
class OrderController extends Controller
{
    public function __construct(
        private CreateOrder $createOrder
    ) {}

    public function store(StoreOrderRequest $request)
    {
        $order = $this->createOrder->execute(
            user: $request->user(),
            cart: Cart::findOrFail($request->cart_id),
            data: $request->validated(),
        );
        
        OrderCompleted::dispatch($order); // El email va en un listener

        return redirect()->route('orders.show', $order)
                         ->with('success', 'Pedido creado correctamente');
    }
}
```

## Form Requests: validación fuera del controlador

Las Form Requests mueven la validación del controlador a su propia clase:

```php
// app/Http/Requests/StoreOrderRequest.php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Autorización aquí también si es necesario
        return $this->user()->can('create', Order::class);
    }

    public function rules(): array
    {
        return [
            'cart_id'     => 'required|exists:carts,id',
            'country'     => 'required|string|size:2',
            'coupon_code' => 'nullable|string|exists:coupons,code',
            'address'     => 'required|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'cart_id.exists'     => 'El carrito no existe o ya fue procesado',
            'coupon_code.exists' => 'El código de descuento no es válido',
        ];
    }
}
```

## DTOs (Data Transfer Objects): tipado fuerte para datos

Los DTOs son objetos simples que representan datos con tipos definidos:

```php
// app/DTOs/CreateOrderDTO.php
<?php

namespace App\DTOs;

readonly class CreateOrderDTO
{
    public function __construct(
        public int    $userId,
        public int    $cartId,
        public string $country,
        public string $address,
        public ?string $couponCode = null,
    ) {}

    public static function fromRequest(StoreOrderRequest $request): self
    {
        return new self(
            userId:     $request->user()->id,
            cartId:     $request->input('cart_id'),
            country:    $request->input('country'),
            address:    $request->input('address'),
            couponCode: $request->input('coupon_code'),
        );
    }
}
```

Los DTOs con `readonly` (PHP 8.1+) son perfectos: inmutables y con tipado explícito.

## La capa de Services: lógica de dominio compleja

Para lógica más compleja que involucra múltiples modelos y servicios:

```php
// app/Services/PaymentService.php
<?php

namespace App\Services;

use App\Contracts\PaymentGateway;
use App\Models\Order;
use App\Models\Payment;

class PaymentService
{
    public function __construct(
        private PaymentGateway $gateway
    ) {}

    public function processPayment(Order $order, string $paymentMethod): Payment
    {
        $result = $this->gateway->charge(
            amount:   $order->total,
            currency: 'EUR',
            method:   $paymentMethod,
            metadata: ['order_id' => $order->id],
        );

        $payment = Payment::create([
            'order_id'       => $order->id,
            'amount'         => $order->total,
            'transaction_id' => $result->transactionId,
            'status'         => $result->status,
            'gateway'        => config('services.payment.driver'),
        ]);

        if ($result->failed()) {
            throw new PaymentFailedException($result->errorMessage);
        }

        $order->update(['payment_status' => 'paid', 'status' => 'processing']);

        return $payment;
    }
}
```

## API Resources: transformar modelos para la API

Las API Resources evitan exponer la estructura interna de tus modelos:

```php
// app/Http/Resources/OrderResource.php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'         => $this->id,
            'status'     => $this->status,
            'total'      => number_format($this->total, 2),
            'currency'   => 'EUR',
            'created_at' => $this->created_at->format('d/m/Y H:i'),
            
            // Incluir items solo si están cargados
            'items' => OrderItemResource::collection($this->whenLoaded('items')),
            
            // Incluir solo si hay permiso
            'payment_details' => $this->when(
                $request->user()?->isAdmin(),
                fn() => [
                    'transaction_id' => $this->payment->transaction_id,
                    'gateway'        => $this->payment->gateway,
                ]
            ),
        ];
    }
}
```

## Organización por dominio para proyectos grandes

En proyectos muy grandes, puedes organizar por dominio en lugar de por tipo de clase:

```
app/
├── Domain/
│   ├── Orders/
│   │   ├── Actions/
│   │   │   ├── CreateOrder.php
│   │   │   └── CancelOrder.php
│   │   ├── DTOs/
│   │   │   └── CreateOrderDTO.php
│   │   ├── Events/
│   │   │   └── OrderCompleted.php
│   │   ├── Listeners/
│   │   │   └── SendOrderConfirmation.php
│   │   └── Models/
│   │       └── Order.php
│   ├── Users/
│   │   ├── Actions/
│   │   ├── Models/
│   │   └── Services/
│   └── Payments/
│       ├── Contracts/
│       │   └── PaymentGateway.php
│       ├── Gateways/
│       │   ├── StripeGateway.php
│       │   └── PayPalGateway.php
│       └── Services/
│           └── PaymentService.php
├── Http/
│   ├── Controllers/
│   ├── Requests/
│   └── Resources/
└── Providers/
```

Esta estructura hace que todo lo relacionado con "Orders" esté junto, facilitando el mantenimiento.

## Cuándo añadir cada capa

No necesitas todas las capas desde el principio. Una guía práctica:

- **Form Requests:** desde el primer controlador con validación
- **Actions:** cuando un método de controlador supera 30-40 líneas
- **Services:** cuando la lógica involucra múltiples modelos o llamadas externas
- **DTOs:** cuando pasas muchos parámetros entre capas o necesitas tipado fuerte
- **Repositorios:** raramente necesarios en Laravel (Eloquent ya es un repositorio)
- **Organización por dominio:** cuando tienes 10+ modelos relacionados temáticamente

## Conclusión

La clave es no añadir complejidad prematuramente. Empieza con la estructura por defecto de Laravel, añade Form Requests inmediatamente, y cuando los controladores empiecen a crecer, introduce Actions. Los Services y DTOs llegan cuando la lógica de negocio se complica. Un proyecto organizado no es el que usa todos los patrones, sino el que usa los patrones correctos para su tamaño y complejidad actual.
