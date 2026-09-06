---
title: 'refreshForUpdate() en Laravel 13.27: Recarga Modelos Bloqueados'
description: 'Aprende a usar refreshForUpdate() para recargar modelos Eloquent con bloqueos de escritura. Evita condiciones de carrera en transacciones.'
pubDate: '2026-08-28'
tags: ['laravel', 'eloquent', 'transacciones', 'concurrencia']
---

# refreshForUpdate() en Laravel 13.27: Recarga Modelos Bloqueados

Laravel 13.27 introdujo el método `refreshForUpdate()` en Eloquent, una herramienta poderosa para trabajar con modelos en contextos concurrentes. Si trabajas con transacciones de base de datos o necesitas garantizar que los datos no han cambiado entre operaciones, este método es exactamente lo que necesitabas.

## ¿Qué problema resuelve refreshForUpdate()?

Imagina este escenario común en aplicaciones reales: tienes un modelo de usuario con un campo de saldo. Dos peticiones llegan simultáneamente intentando actualizar ese saldo. Sin sincronización adecuada, puedes terminar con datos inconsistentes.

```php
// ❌ Sin protección: condición de carrera
$user = User::find($userId);
$user->balance -= 100;
$user->save();
```

Antes de Laravel 13.27, si querías recargar un modelo con un bloqueo de escritura (FOR UPDATE), tenías que hacerlo de forma manual:

```php
// Antes: sintaxis verbosa
DB::transaction(function () use ($userId) {
    $user = User::where('id', $userId)->lockForUpdate()->first();
    // ... operaciones
    $user->refresh();
});
```

El nuevo método `refreshForUpdate()` simplifica esto de forma significativa, combinando dos operaciones en una.

## Sintaxis de refreshForUpdate()

El método recarga el modelo desde la base de datos aplicando automáticamente un bloqueo de escritura (FOR UPDATE). Es especialmente útil dentro de transacciones:

```php
$user = User::find(1);

DB::transaction(function () use ($user) {
    // Recarga el modelo con bloqueo de escritura
    $user->refreshForUpdate();
    
    // Ahora tienes garantizado que no ha cambiado
    $user->balance -= 50;
    $user->save();
});
```

La diferencia clave es que `refreshForUpdate()` usa `lockForUpdate()` internamente, lo que previene que otros procesos modifiquen el registro hasta que termina la transacción.

## Casos de uso reales

### 1. Operaciones de dinero o inventario

Este es el uso más común. Cuando necesitas decrementar un saldo o stock, debes asegurar que el valor actual es válido:

```php
class WithdrawMoneyJob implements ShouldQueue
{
    public function __construct(private int $userId, private float $amount) {}

    public function handle(): void
    {
        DB::transaction(function () {
            $user = User::find($this->userId);
            $user->refreshForUpdate();

            if ($user->balance < $this->amount) {
                throw new InsufficientBalanceException();
            }

            $user->balance -= $this->amount;
            $user->save();

            Transaction::create([
                'user_id' => $user->id,
                'type' => 'withdrawal',
                'amount' => $this->amount,
            ]);
        });
    }
}
```

### 2. Incrementos seguros de contadores

Si tienes un contador que múltiples procesos incrementan simultáneamente:

```php
class IncrementViewCountJob implements ShouldQueue
{
    public function __construct(private int $postId) {}

    public function handle(): void
    {
        DB::transaction(function () {
            $post = Post::find($this->postId);
            $post->refreshForUpdate();

            $post->increment('view_count');
        });
    }
}
```

### 3. Actualizaciones condicionales complejas

Cuando una actualización depende del estado actual del modelo:

```php
public function updateInventory($productId, $quantity)
{
    DB::transaction(function () use ($productId, $quantity) {
        $product = Product::find($productId);
        $product->refreshForUpdate();

        // Actualización solo si hay stock disponible
        if ($product->stock >= $quantity) {
            $product->stock -= $quantity;
            $product->last_updated_at = now();
            $product->save();

            return true;
        }

        return false;
    });
}
```

## Comparación: refreshForUpdate() vs lockForUpdate()

Hay una diferencia importante entre ambos métodos:

```php
// refreshForUpdate(): recarga Y bloquea
$user = User::find(1);
DB::transaction(function () use ($user) {
    $user->refreshForUpdate(); // Recarga desde DB con bloqueo
    // El modelo tiene datos actualizados y está bloqueado
});

// lockForUpdate(): solo bloquea
$user = User::where('id', 1)->lockForUpdate()->first();
// El usuario viene ya bloqueado desde la consulta

// lockForUpdate() es mejor cuando necesitas la consulta original
$user = User::where('email', 'test@example.com')
    ->lockForUpdate()
    ->first();
```

## Integración con Laravel Queues

El método brilla cuando trabajas con colas, ya que los jobs ejecutan en procesos separados:

```php
class ProcessPaymentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public User $user, public Payment $payment) {}

    public function handle(): void
    {
        DB::transaction(function () {
            // Recarga el usuario con bloqueo
            // Previene condiciones de carrera en jobs simultáneos
            $this->user->refreshForUpdate();

            if ($this->user->status !== 'active') {
                $this->payment->markAsFailed('User inactive');
                return;
            }

            $this->user->balance += $this->payment->amount;
            $this->user->save();

            $this->payment->markAsCompleted();
        });
    }
}
```

## Mejores prácticas

### ✅ Haz esto

```php
// 1. Usa dentro de transacciones explícitas
DB::transaction(function () use ($model) {
    $model->refreshForUpdate();
    // operaciones
});

// 2. Úsalo cuando necesites garantías de consistencia
if ($user->refreshForUpdate()->status === 'premium') {
    // Solo usuarios premium
}

// 3. Combínalo con validaciones después de recargar
$invoice->refreshForUpdate();
if ($invoice->is_paid) {
    throw new AlreadyPaidException();
}
```

### ❌ Evita esto

```php
// ❌ Sin transacción: el bloqueo se libera inmediatamente
$user->refreshForUpdate();
$user->balance -= 50;
$user->save(); // Otro proceso podría haber modificado entre refresh y save

// ❌ Fuera de transacción en jobs paralelos
// (El bloqueo se libera cuando termina la consulta)
$model->refreshForUpdate();
// ... código que podría tardar
$model->save();
```

## Rendimiento y consideraciones

`refreshForUpdate()` ejecuta una consulta SELECT FOR UPDATE, que bloquea la fila hasta que termina la transacción. Esto tiene implicaciones:

```php
// ⚠️ Cuidado: bloqueos largos afectan el rendimiento
DB::transaction(function () {
    $user->refreshForUpdate();
    
    // Si esto tarda mucho, otros procesos esperarán
    $expensive_api_call = externalServiceCall();
    
    $user->update(['data' => $expensive_api_call]);
});

// ✅ Mejor: haz operaciones costosas fuera del bloqueo
$expensive_api_call = externalServiceCall();

DB::transaction(function () {
    $user->refreshForUpdate();
    $user->update(['data' => $expensive_api_call]);
});
```

## Ejemplo completo: Sistema de carritos de compra

Aquí un ejemplo realista que muestra cómo usar `refreshForUpdate()` en una operación común:

```php
class ApplyCouponToCartController extends Controller
{
    public function apply(Request $request)
    {
        $user = auth()->user();
        $coupon = Coupon::findOrFail($request->coupon_code);

        DB::transaction(function () use ($user, $coupon) {
            // Recarga el usuario para asegurar saldo actual
            $user->refreshForUpdate();

            // Validaciones después de recargar
            if ($user->cart_total < $coupon->minimum_purchase) {
                throw new InvalidCouponException('Compra mínima no alcanzada');
            }

            if ($user->hasUsedCoupon($coupon->id)) {
                throw new CouponAlreadyUsedException();
            }

            // Aplicar descuento
            $discount = $coupon->calculate_discount($user->cart_total);
            $user->cart_total -= $discount;
            $user->save();

            // Registrar uso del cupón
            UserCouponUsage::create([
                'user_id' => $user->id,
                'coupon_id' => $coupon->id,
                'discount_applied' => $discount,
            ]);
        });

        return response()->json(['success' => true, 'total' => $user->cart_total]);
    }
}
```

## Depuración y observabilidad

Cuando uses `refreshForUpdate()`, los bloqueos pueden aparecer en tu base de datos:

```bash
# MySQL: ver bloqueos activos
SELECT * FROM performance_schema.data_locks;

# PostgreSQL: ver bloqueos
SELECT * FROM pg_locks WHERE NOT granted;
```

Para debugging en desarrollo, Laravel Telescope capturará estas queries:

```php
// En desarrollo, verás en Telescope:
// SELECT `users`.* FROM `users` WHERE `users`.`id` = ? FOR UPDATE
```

## Compatibilidad con diferentes bases de datos

`refreshForUpdate()` funciona con los siguientes motores:

- **MySQL/MariaDB**: `FOR UPDATE` ✅
- **PostgreSQL**: `FOR UPDATE` ✅
- **SQLite**: `FOR UPDATE` ✅
- **SQL Server**: Usa `WITH (UPDLOCK)` ✅

Laravel maneja automáticamente la sintaxis específica de cada base de datos.

## Puntos clave

- **`refreshForUpdate()` recarga un modelo desde la base de datos con bloqueo de escritura** (FOR UPDATE)
- **Es esencial para evitar condiciones de carrera** en operaciones concurrentes sobre dinero, inventario o datos críticos
- **Siempre úsalo dentro de transacciones explícitas** con `DB::transaction()`
- **No realices operaciones costosas mientras el modelo está bloqueado** para evitar deadlocks
- **Es especialmente útil en Laravel Queues** donde múltiples jobs pueden procesar simultáneamente
- **Valida condiciones después de recargar**, no antes, para garantizar consistencia
- **Funciona en todos los motores de base de datos** que Laravel soporta
- **Simplifica el código** comparado con `lockForUpdate()` cuando necesitas recargar después de obtener el modelo
- **Aparecerá en Telescope y logs** para debugging de transacciones
- **Previene actualizaciones perdidas** (lost update problem) en sistemas concurrentes