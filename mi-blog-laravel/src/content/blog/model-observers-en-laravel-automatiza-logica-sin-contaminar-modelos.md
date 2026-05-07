---
title: 'Model Observers en Laravel: Automatiza Lógica sin Contaminar Modelos'
description: 'Domina los Model Observers en Laravel para mantener tu lógica desacoplada, reutilizable y fácil de testear sin contaminar tus modelos'
pubDate: '2026-05-07'
tags: ['laravel', 'php', 'architecture', 'design-patterns']
---

## Introducción

Cuando trabajas con Laravel, es fácil caer en la trampa de meter toda la lógica de negocio directamente en los modelos Eloquent. Un formulario se guarda, necesitas actualizar un caché. Se elimina un producto, tienes que limpiar imágenes. Se crea una orden, debes enviar una notificación.

Pronto tus modelos se convierten en monstruos de 500+ líneas con métodos que hacen de todo menos lo que deberían: representar una entidad de tu base de datos.

Los **Model Observers** son la solución elegante a este problema. Te permiten escuchar eventos del ciclo de vida de un modelo (creación, actualización, eliminación) y ejecutar lógica personalizada sin contaminar el modelo mismo.

En este artículo aprenderás cómo implementarlos correctamente, cuándo usarlos, y cómo sacarles el máximo partido.

## ¿Qué son los Model Observers?

Un Observer (observador) es una clase que "escucha" eventos que ocurren en un modelo Eloquent. Cuando algo sucede (un registro se crea, se actualiza, se elimina), el observer ejecuta el método correspondiente.

Piensa en ello como un sistema de hooks que separa la responsabilidad. El modelo se dedica a ser un modelo. El observer se dedica a reaccionar ante cambios en ese modelo.

Los eventos que puedes observar son:

- `creating` - antes de insertar un nuevo registro
- `created` - después de insertar
- `updating` - antes de actualizar
- `updated` - después de actualizar
- `saving` - antes de insertar o actualizar
- `saved` - después de insertar o actualizar
- `deleting` - antes de eliminar
- `deleted` - después de eliminar
- `restoring` - antes de restaurar (soft deletes)
- `restored` - después de restaurar

## Creando tu primer Observer

### Generación automática

Laravel facilita la creación de observers con Artisan:

```bash
php artisan make:observer ProductObserver --model=Product
```

Esto genera un archivo en `app/Observers/ProductObserver.php`:

```php
<?php

namespace App\Observers;

use App\Models\Product;

class ProductObserver
{
    /**
     * Handle the Product "created" event.
     */
    public function created(Product $product): void
    {
        //
    }

    /**
     * Handle the Product "updated" event.
     */
    public function updated(Product $product): void
    {
        //
    }

    /**
     * Handle the Product "deleted" event.
     */
    public function deleted(Product $product): void
    {
        //
    }

    /**
     * Handle the Product "restored" event.
     */
    public function restored(Product $product): void
    {
        //
    }

    /**
     * Handle the Product "force deleted" event.
     */
    public function forceDeleted(Product $product): void
    {
        //
    }
}
```

### Registrando el Observer

Ahora necesitas registrarlo. Lo ideal es hacerlo en un Service Provider. Puedes usar el existente `AppServiceProvider` o crear uno específico:

```php
<?php

namespace App\Providers;

use App\Models\Product;
use App\Observers\ProductObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        Product::observe(ProductObserver::class);
    }
}
```

Alternativamente, puedes registrar múltiples observers en un mismo lugar:

```php
public function boot(): void
{
    Product::observe(ProductObserver::class);
    Order::observe(OrderObserver::class);
    User::observe(UserObserver::class);
}
```

## Casos de uso prácticos

### Caso 1: Actualizar slug automáticamente

Cuando un producto cambia de nombre, necesitas regenerar su slug:

```php
<?php

namespace App\Observers;

use App\Models\Product;
use Illuminate\Support\Str;

class ProductObserver
{
    public function saving(Product $product): void
    {
        // El evento "saving" se dispara antes de insertar o actualizar
        if ($product->isDirty('name')) {
            $product->slug = Str::slug($product->name);
        }
    }
}
```

Ahora, cada vez que crees o actualices un producto, el slug se genera automáticamente:

```php
$product = Product::create([
    'name' => 'Laptop Gaming XYZ'
]);

echo $product->slug; // laptop-gaming-xyz
```

### Caso 2: Limpiar caché al actualizar

Cuando actualizas un producto, necesitas invalidar el caché:

```php
<?php

namespace App\Observers;

use App\Models\Product;
use Illuminate\Support\Facades\Cache;

class ProductObserver
{
    public function updated(Product $product): void
    {
        // Limpiar el caché de lista de productos
        Cache::forget('products.list');
        
        // Limpiar el caché específico de este producto
        Cache::forget("product.{$product->id}");
    }

    public function deleted(Product $product): void
    {
        Cache::forget('products.list');
        Cache::forget("product.{$product->id}");
    }
}
```

### Caso 3: Enviar notificaciones

Cuando se crea una nueva orden, necesitas notificar al administrador y al cliente:

```php
<?php

namespace App\Observers;

use App\Models\Order;
use App\Notifications\OrderConfirmed;
use App\Notifications\NewOrderNotification;
use Illuminate\Support\Facades\Notification;

class OrderObserver
{
    public function created(Order $order): void
    {
        // Notificar al cliente
        $order->user->notify(new OrderConfirmed($order));
        
        // Notificar a administradores
        $admins = User::where('role', 'admin')->get();
        Notification::send($admins, new NewOrderNotification($order));
    }

    public function updated(Order $order): void
    {
        if ($order->isDirty('status')) {
            $order->user->notify(
                new OrderStatusChanged($order)
            );
        }
    }
}
```

### Caso 4: Mantener estadísticas

Actualizar contadores cuando se crean o eliminan registros:

```php
<?php

namespace App\Observers;

use App\Models\Comment;

class CommentObserver
{
    public function created(Comment $comment): void
    {
        // Incrementar el contador de comentarios del post
        $comment->post->increment('comments_count');
    }

    public function deleted(Comment $comment): void
    {
        // Decrementar el contador
        $comment->post->decrement('comments_count');
    }
}
```

### Caso 5: Auditoría de cambios

Registrar quién hizo qué y cuándo:

```php
<?php

namespace App\Observers;

use App\Models\Product;
use App\Models\AuditLog;

class ProductObserver
{
    public function created(Product $product): void
    {
        AuditLog::create([
            'model' => 'Product',
            'model_id' => $product->id,
            'action' => 'created',
            'user_id' => auth()->id(),
            'changes' => $product->toArray(),
        ]);
    }

    public function updated(Product $product): void
    {
        AuditLog::create([
            'model' => 'Product',
            'model_id' => $product->id,
            'action' => 'updated',
            'user_id' => auth()->id(),
            'changes' => $product->getChanges(),
            'old_values' => $product->getOriginal(),
        ]);
    }

    public function deleted(Product $product): void
    {
        AuditLog::create([
            'model' => 'Product',
            'model_id' => $product->id,
            'action' => 'deleted',
            'user_id' => auth()->id(),
        ]);
    }
}
```

## Errores comunes y cómo evitarlos

### ❌ Hacer queries costosas en eventos

```php
// MAL - Esto causa un N+1 query
public function updated(Product $product): void
{
    $relatedProducts = Product::where('category_id', $product->category_id)
        ->get();
    // ...
}
```

**Solución**: Usa relaciones eager-loaded o delega a jobs:

```php
// BIEN - Usa un job para operaciones costosas
public function updated(Product $product): void
{
    dispatch(new UpdateRelatedProducts($product));
}
```

### ❌ Observers que disparan otros observers infinitamente

```php
// MAL - Causa bucle infinito
public function updated(Product $product): void
{
    $product->update(['last_updated' => now()]);
}
```

**Solución**: Usa `updateQuietly()` para evitar que se dispare el observer:

```php
// BIEN
public function updated(Product $product): void
{
    $product->updateQuietly(['last_updated' => now()]);
}
```

### ❌ Olvidar que los observers se ejecutan incluso en seeds

```php
// Durante el seeding, tus observers también se ejecutan
// Esto puede ralentizar muchísimo el proceso

// SOLUCIÓN: Desactiva observadores durante seeds
php artisan tinker
>>> Model::withoutEvents(function () {
    Product::factory(1000)->create();
});
```

## Ventajas y desventajas

### Ventajas ✅

- **Separación de responsabilidades**: Los modelos son modelos, los observers reaccionan
- **Reutilización**: Un observer puede escuchar múltiples eventos
- **Testeable**: Puedes testear la lógica de observer independientemente
- **Legible**: El código es más organizado y fácil de seguir
- **Mantenible**: Cambios en la lógica de reacción no afectan el modelo

### Desventajas ⚠️

- **Lógica implícita**: Si no sabes que existe un observer, su comportamiento parece "mágico"
- **Difícil de debuggear**: A veces es complicado entender por qué sucede algo
- **Performance**: Pueden ralentizar operaciones masivas si haces queries costosas
- **Complejidad**: Agregan una capa más de indirección

## Alternativas y cuándo usarlas

### Events y Listeners (más control)

Si necesitas más control o múltiples listeners para el mismo evento:

```php
// En el modelo
protected $dispatchesEvents = [
    'created' => \App\Events\ProductCreated::class,
];

// El listener hace exactamente lo mismo que un observer
class SendProductCreatedNotification implements ShouldQueue
{
    public function handle(ProductCreated $event)
    {
        // ...
    }
}
```

### Hooks en el modelo (más simple)

Para lógica muy sencilla que siempre pertenece al modelo:

```php
class Product extends Model
{
    public function save(array $options = [])
    {
        if (!$this->slug) {
            $this->slug = Str::slug($this->name);
        }
        return parent::save($options);
    }
}
```

## Mejores prácticas

### 1. Mantén los observers enfocados

```php
// BIEN - cada observer tiene una responsabilidad clara
class ProductObserver {
    public function created(Product $product): void {
        // Solo cosas relacionadas a "creación"
    }
}

class ProductCacheObserver {
    public function updated(Product $product): void {
        // Solo cosas relacionadas a "caché"
    }
}
```

### 2. Documenta el comportamiento

```php
class ProductObserver
{
    /**
     * Cuando se crea un producto:
     * - Genera el slug automáticamente
     * - Asigna el usuario actual como creador
     * - Envía notificación al equipo de inventario
     */
    public function created(Product $product): void
    {
        // ...
    }
}
```

### 3. Usa silent updates cuando sea necesario

```php
public function updated(Product $product): void
{
    // No dispara el observer nuevamente
    $product->updateQuietly(['updated_by' => auth()->id()]);
}
```

### 4. Delega operaciones pesadas a jobs

```php
public function created(Product $product): void
{
    dispatch(new GenerateProductThumbnails($product))->onQueue('images');
}
```

## Conclusión

Los Model Observers son una herramienta poderosa que mantiene tus modelos limpios y tu lógica de negocio organizada. Son especialmente útiles cuando necesitas reaccionar ante cambios sin contaminar el modelo mismo.

La clave está en usarlos con propósito, mantener la lógica dentro enfocada, y recordar que con gran poder viene gran complejidad. No todo necesita un observer; a veces un hook en el modelo o un evento explícito es mejor opción.

Úsalos para:
- Mantener datos derivados sincronizados (slugs, contadores)
- Limpiar cachés
- Registrar cambios (auditoría)
- Enviar notificaciones
- Disparar trabajos asíncronos

Evítalos para:
- Lógica core del negocio (esa va en el modelo o en un Service)
- Queries costosas sin justificación
- Lógica que depende de contexto externo complejo

## Puntos clave

- Los Model Observers escuchan eventos del ciclo de vida de un modelo (created, updated, deleted, etc.)
- Se registran en un Service Provider usando `Model::observe(ObserverClass::class)`
- Mantienen los modelos limpios al separar la reacción ante cambios
- Úsalos para caché, auditoría, notificaciones y datos derivados
- Evita queries costosas dentro de observers; usa jobs en su lugar
- Recuerda que `updateQuietly()` previene bucles infinitos
- Documenta el comportamiento del observer para que otros desarrolladores lo entiendan
- Considera Events y Listeners como alternativa si necesitas más control