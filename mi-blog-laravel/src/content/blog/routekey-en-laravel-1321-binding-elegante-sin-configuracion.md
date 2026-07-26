---
title: 'RouteKey en Laravel 13.21: Binding Elegante sin Configuración'
description: 'Domina el atributo #[RouteKey] para route model binding automático. Simplifica tus rutas, evita conflictos y mejora la legibilidad del código.'
pubDate: '2026-07-23'
tags: ['laravel', 'routing', 'eloquent', 'atributos-php']
---

## Introducción

Laravel 13.21 introduce el atributo `#[RouteKey]`, una característica que revoluciona cómo definimos el **route model binding** en nuestras aplicaciones. Durante años, hemos configurado explícitamente qué columna usar para resolver modelos en nuestras rutas. Ahora, con este nuevo atributo, podemos delegar esa responsabilidad directamente al modelo Eloquent, logrando código más limpio, tipado y mantenible.

Si trabajas con rutas que incluyen modelos como parámetros (ej: `/posts/{post}`), este artículo te mostrará cómo usar `#[RouteKey]` para evitar configuraciones redundantes y hacer tus rutas más expresivas.

## ¿Qué es el Route Model Binding?

Antes de sumergirnos en `#[RouteKey]`, recordemos qué es el route model binding. Es un mecanismo que transforma un parámetro de ruta en una instancia de modelo Eloquent automáticamente.

**Ejemplo tradicional (antes de Laravel 13.21):**

```php
// routes/web.php
Route::get('/posts/{post}', [PostController::class, 'show']);

// Esto automáticamente resuelve:
// POST /posts/123 → busca Post::find(123)
```

El binding por defecto usa la clave primaria, pero a menudo queremos usar slugs u otros identificadores:

```php
// routes/web.php
Route::get('/posts/{post:slug}', [PostController::class, 'show']);

// Ahora busca por slug: Post::where('slug', $value)->first()
```

El problema: esta configuración vive en la ruta, no en el modelo. Si cambias el identificador o tienes múltiples rutas, repites la lógica.

## El Atributo #[RouteKey] de Laravel 13.21

El atributo `#[RouteKey]` centraliza esta configuración **en el modelo**. Define qué columna debe usar Laravel para resolver el modelo en cualquier ruta, sin necesidad de especificarlo cada vez.

### Sintaxis básica

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\RouteKey;

#[RouteKey('slug')]
class Post extends Model
{
    protected $fillable = ['title', 'slug', 'content'];
}
```

Ahora, en tus rutas:

```php
// routes/web.php
Route::get('/posts/{post}', [PostController::class, 'show']);
// Laravel automáticamente busca por slug, no por ID
```

No necesitas escribir `{post:slug}`. El binding se resuelve automáticamente.

## Ejemplos prácticos

### Ejemplo 1: Blog con slugs

Imagina un blog donde los posts se acceden por slug (ej: `/posts/como-aprender-laravel`).

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\RouteKey;

#[RouteKey('slug')]
class Post extends Model
{
    protected $fillable = ['title', 'slug', 'content'];
    
    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }
    
    // Generar slug automáticamente
    protected static function booted(): void
    {
        static::creating(function ($post) {
            if (!$post->slug) {
                $post->slug = \Str::slug($post->title);
            }
        });
    }
}
```

Tu controlador es directo:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Post;

class PostController extends Controller
{
    public function show(Post $post)
    {
        // $post ya está resuelto por slug, gracias a #[RouteKey('slug')]
        return view('posts.show', ['post' => $post]);
    }
}
```

Rutas simples:

```php
// routes/web.php
Route::get('/posts/{post}', [PostController::class, 'show'])->name('posts.show');
Route::post('/posts/{post}/comments', [CommentController::class, 'store'])->name('comments.store');
```

Sin `#[RouteKey]`, necesitarías escribir `{post:slug}` en cada ruta.

### Ejemplo 2: API REST con UUIDs

Muchas APIs modernas usan UUIDs en lugar de IDs secuenciales.

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\RouteKey;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

#[RouteKey('uuid')]
class Order extends Model
{
    use HasUuids;
    
    protected $fillable = ['user_id', 'total', 'status'];
}
```

Ahora tus rutas API usan UUIDs automáticamente:

```php
// routes/api.php
Route::apiResource('orders', OrderController::class);

// GET /api/orders/550e8400-e29b-41d4-a716-446655440000
// Laravel resuelve por UUID sin configuración extra
```

### Ejemplo 3: Parámetros personalizados

¿Qué si quieres un identificador personalizado, como un código de pedido?

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\RouteKey;

#[RouteKey('order_code')]
class Invoice extends Model
{
    protected $fillable = ['order_code', 'amount', 'issued_at'];
}
```

Ruta simplificada:

```php
Route::get('/invoices/{invoice}', [InvoiceController::class, 'show']);
// POST /invoices/INV-2024-00123 resuelve por order_code
```

## Casos de uso avanzados

### Múltiples modelos con RouteKey

Cuando tienes rutas anidadas con varios modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Attributes\RouteKey;

#[RouteKey('slug')]
class Category extends Model
{
    protected $fillable = ['name', 'slug'];
}

#[RouteKey('slug')]
class Product extends Model
{
    protected $fillable = ['category_id', 'name', 'slug'];
    
    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
```

Rutas anidadas elegantes:

```php
Route::get('/categories/{category}/products/{product}', 
    [ProductController::class, 'show']
);

// GET /categories/electronics/products/iphone-15
// Ambos se resuelven por slug automáticamente
```

Controlador:

```php
public function show(Category $category, Product $product)
{
    // Ambos modelos ya están resueltos
    // No necesitas validar que product pertenece a category
    return view('products.show', [
        'category' => $category,
        'product' => $product,
    ]);
}
```

### Combinar RouteKey con scoping

Aunque `#[RouteKey]` define el identificador, aún puedes usar **scoped binding** para mayor seguridad:

```php
Route::get('/categories/{category}/products/{product}', function (Category $category, Product $product) {
    // Aunque ambos usen slug, Laravel resuelve product dentro de category
})
->scopeBindings(); // Valida relación implícita
```

## Ventajas sobre la configuración tradicional

| Aspecto | Sin #[RouteKey] | Con #[RouteKey] |
|--------|-----------------|-----------------|
| **Dónde se define** | En cada ruta (`{post:slug}`) | En el modelo |
| **Repetición** | Sí, en múltiples rutas | No, centralizado |
| **Cambios futuros** | Actualizar todas las rutas | Solo el modelo |
| **Legibilidad** | Rutas más largas | Rutas concisas |
| **Tipado** | Implícito | Explícito con atributo |

## Compatibilidad y consideraciones

**Versión requerida:** Laravel 13.21 o superior

**Notas importantes:**

- El atributo es opcional. Puedes seguir usando `{post:slug}` en rutas si prefieres.
- Si defines `#[RouteKey]` pero especificas otra columna en la ruta (`{post:id}`), la ruta tiene prioridad.
- El atributo no afecta métodos como `Model::find()` o `Model::findOrFail()`.

## Debugging y validación

Si el binding no funciona como esperas, verifica:

1. **La columna existe y tiene datos:**

```php
// En Tinker
php artisan tinker
>>> Post::first()->slug
```

2. **El atributo está correctamente importado:**

```php
use Illuminate\Database\Eloquent\Attributes\RouteKey;
```

3. **El valor en la URL coincide exactamente** (sensible a mayúsculas):

```php
// Si slug es 'como-aprender-laravel'
// La URL debe ser /posts/como-aprender-laravel
// No /posts/Como-Aprender-Laravel
```

4. **Usa `artisan route:list` para verificar bindings:**

```bash
php artisan route:list
```

Verás qué columna usa cada ruta.

## Integración con API Resources

Si usas API Resources, `#[RouteKey]` también funciona:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'content' => $this->content,
            'created_at' => $this->created_at,
        ];
    }
}
```

Las rutas API heredan automáticamente el binding:

```php
Route::apiResource('posts', PostController::class);
// POST /api/posts/como-aprender-laravel resuelve por slug
```

## Migración desde configuración antigua

Si tienes un proyecto con binding configurable en rutas:

**Antes:**

```php
Route::get('/users/{user:username}', [UserController::class, 'show']);
Route::post('/users/{user:username}/posts', [PostController::class, 'store']);
Route::put('/users/{user:username}', [UserController::class, 'update']);
```

**Después:**

```php
// En Model: User.php
#[RouteKey('username')]
class User extends Model { ... }

// En rutas
Route::get('/users/{user}', [UserController::class, 'show']);
Route::post('/users/{user}/posts', [PostController::class, 'store']);
Route::put('/users/{user}', [UserController::class, 'update']);
```

Más limpio y DRY.

## Conclusión

El atributo `#[RouteKey]` de Laravel 13.21 representa un paso adelante en la elegancia y mantenibilidad del código. Centralizar la configuración de binding en el modelo donde pertenece logra:

- **Menos repetición:** Define una vez, usa en todas partes
- **Mayor claridad:** El modelo declara explícitamente cómo se resuelve
- **Código moderno:** Aprovecha atributos PHP nativos
- **Menos errores:** No olvidas especificar `:slug` en una ruta

Si trabajas con rutas parametrizadas, especialmente con slugs o identificadores personalizados, este atributo debería estar en tu caja de herramientas.

## Puntos clave

- ✅ `#[RouteKey]` centraliza la configuración de binding en el modelo Eloquent
- ✅ Elimina la necesidad de escribir `{model:columna}` en cada ruta
- ✅ Compatible con slugs, UUIDs, códigos personalizados y cualquier columna única
- ✅ La configuración en rutas aún tiene prioridad si la especificas
- ✅ Funciona con rutas anidadas, scoped binding y API Resources
- ✅ Requiere Laravel 13.21 o superior
- ✅ Usa atributos PHP nativos, mejorando la expresividad del código
- ✅ Facilita refactoring futuro: cambiar identificadores solo afecta el modelo