---
title: 'Sqids en Laravel: IDs cortos y seguros para URLs'
description: 'Genera IDs cortos, URL-safe y reversibles desde números con Sqids. Ideal para acortadores, referencias públicas y APIs seguras en Laravel.'
pubDate: '2026-06-09'
tags: ['laravel', 'php', 'seguridad', 'urls']
---

## Sqids en Laravel: IDs cortos y seguros para URLs

En muchas aplicaciones web necesitamos exponer identificadores públicos que no revelen información sobre la estructura interna de nuestros datos. Un usuario no debería poder incrementar un número en la URL y acceder al siguiente recurso, ni deberíamos mostrar IDs secuenciales que revelen cuántos usuarios o productos tenemos.

Sqids es una librería PHP elegante que resuelve este problema: convierte números enteros en cadenas cortas, URL-safe y reversibles. Es perfecto para crear referencias públicas en tus aplicaciones Laravel sin sacrificar seguridad ni legibilidad.

## ¿Qué es Sqids y por qué necesitarlo?

Sqids transforma números en identificadores codificados de forma biyectiva (uno a uno), lo que significa que cada número tiene exactamente una representación en Sqids, y cada ID de Sqids puede decodificarse de nuevo al número original.

### Diferencia entre Sqids y UUID

Mientras que los UUID son identificadores completamente únicos y aleatorios:

```
550e8400-e29b-41d4-a716-446655440000  // UUID - 36 caracteres
```

Los Sqids son más compactos y derivados de números secuenciales:

```
AzLa  // Sqids - 4 caracteres, decodificable a un número
```

### Casos de uso reales

- **Acortadores de URLs**: Convertir IDs de base de datos en referencias cortas
- **Referencias públicas**: URLs públicas sin exponer el número interno
- **Códigos de descuento**: Generar códigos únicos y cortos
- **Invitaciones y tokens**: Crear referencias memorables para compartir
- **Tracking y analytics**: Evitar enumerar accesos por número

## Instalación en Laravel

Instala la librería mediante Composer:

```bash
composer require sqids/sqids
```

Una vez instalada, es recomendable crear un service provider para configurar Sqids globalmente en tu aplicación.

## Configuración inicial

Crea un archivo de configuración en `config/sqids.php`:

```php
<?php

return [
    'min_length' => 8,
    'alphabet' => 'abcdefghijklmnopqrstuvwxyz0123456789',
    'blocklist' => [],
];
```

**Explicación de parámetros:**

- `min_length`: Longitud mínima del ID generado. Sqids añadirá caracteres si es necesario
- `alphabet`: Caracteres permitidos. Evita usar caracteres especiales que causen problemas en URLs
- `blocklist`: Palabras censuradas que se evitarán en los IDs (por ejemplo, palabras inapropiadas)

## Crear un Service Provider

Crea un service provider personalizado para gestionar Sqids:

```bash
php artisan make:provider SqidsProvider
```

Configura el provider en `app/Providers/SqidsProvider.php`:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Sqids\Sqids;

class SqidsProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Sqids::class, function () {
            return new Sqids(
                minLength: config('sqids.min_length', 8),
                alphabet: config('sqids.alphabet', 'abcdefghijklmnopqrstuvwxyz0123456789'),
                blocklist: config('sqids.blocklist', [])
            );
        });
    }
}
```

Registra el provider en `config/app.php`:

```php
'providers' => [
    // ... otros providers
    App\Providers\SqidsProvider::class,
],
```

## Uso básico en controladores

### Codificar números a Sqids

```php
<?php

namespace App\Http\Controllers;

use Sqids\Sqids;

class ProductController extends Controller
{
    public function __construct(private Sqids $sqids) {}

    public function show(string $sqid)
    {
        // Decodificar Sqid a número
        $id = $this->sqids->decode($sqid)[0] ?? null;

        if (!$id) {
            abort(404);
        }

        $product = Product::findOrFail($id);

        return view('product.show', [
            'product' => $product,
            'sqid' => $this->sqids->encode($product->id),
        ]);
    }

    public function create()
    {
        // Crear un producto y obtener su Sqid
        $product = Product::create([
            'name' => 'Laptop',
            'price' => 999.99,
        ]);

        $sqid = $this->sqids->encode($product->id);

        return redirect()->route('product.show', ['sqid' => $sqid]);
    }
}
```

### Decodificar Sqids a números

```php
// Desde un Sqid conocido
$sqid = 'AzLa';
$numbers = $this->sqids->decode($sqid);

// $numbers = [42]
```

## Integración con modelos Eloquent

Crea un trait para automatizar la conversión Sqids en tus modelos:

```php
<?php

namespace App\Traits;

use Sqids\Sqids;

trait HasSqids
{
    protected string $sqidsColumn = 'id';

    public function getSqidAttribute(): string
    {
        return app(Sqids::class)->encode($this->{$this->sqidsColumn});
    }

    public static function findBySqid(string $sqid)
    {
        $ids = app(Sqids::class)->decode($sqid);
        
        if (empty($ids)) {
            return null;
        }

        return static::find($ids[0]);
    }

    public static function findBySqidOrFail(string $sqid)
    {
        $model = static::findBySqid($sqid);

        if (!$model) {
            abort(404);
        }

        return $model;
    }
}
```

Usa el trait en tus modelos:

```php
<?php

namespace App\Models;

use App\Traits\HasSqids;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasSqids;

    protected $appends = ['sqid'];
}
```

Ahora puedes usarlo cómodamente:

```php
$product = Product::find(42);
echo $product->sqid;  // "AzLaB4Cd"

// En rutas y vistas
<a href="{{ route('product.show', ['sqid' => $product->sqid]) }}">
    Ver producto
</a>

// En controladores
$product = Product::findBySqidOrFail($request->sqid);
```

## Implementar en rutas

Define route model binding personalizado para automatizar la decodificación:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Sqids\Sqids;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider
{
    public function boot(): void
    {
        Route::bind('product', function (string $sqid) {
            return Product::findBySqidOrFail($sqid);
        });
    }
}
```

Define las rutas normalmente:

```php
Route::get('/products/{product}', [ProductController::class, 'show']);
```

En el controlador:

```php
public function show(Product $product)
{
    return view('product.show', ['product' => $product]);
}
```

## Configuración avanzada

### Blocklist personalizada

Prevén que se generen IDs con palabras inapropiadas:

```php
// config/sqids.php
return [
    'blocklist' => [
        'badword1',
        'badword2',
        'inappropriate',
    ],
];
```

### Alfabeto personalizado

Usa un alfabeto específico para evitar caracteres ambiguos:

```php
return [
    'alphabet' => '0123456789abcdefghijklmnopqrstuvwxyz',
];
```

### Longitud mínima dinámica

Ajusta la longitud según el contexto:

```php
public function generateInviteCode(): string
{
    $sqids = new Sqids(minLength: 12);
    return $sqids->encode(rand(1, 999999));
}
```

## Casos de uso avanzados

### Acortador de URLs

```php
<?php

namespace App\Http\Controllers;

use App\Models\Link;
use Sqids\Sqids;

class LinkController extends Controller
{
    public function __construct(private Sqids $sqids) {}

    public function shorten(string $url)
    {
        $link = Link::updateOrCreate(
            ['original_url' => $url],
            ['clicks' => 0]
        );

        return [
            'short_url' => route('link.redirect', [
                'code' => $this->sqids->encode($link->id)
            ]),
            'original_url' => $url,
        ];
    }

    public function redirect(string $code)
    {
        $ids = $this->sqids->decode($code);

        if (empty($ids)) {
            abort(404);
        }

        $link = Link::findOrFail($ids[0]);
        $link->increment('clicks');

        return redirect($link->original_url);
    }
}
```

### Códigos de referencia

```php
public function generateReferralCode(): string
{
    $sqids = new Sqids(
        minLength: 8,
        blocklist: ['spam', 'fake']
    );

    return $sqids->encode(auth()->id());
}
```

## Seguridad y consideraciones

### ⚠️ Sqids NO es encriptación

Sqids es reversible. Cualquiera que conozca el alfabeto y parámetros puede decodificar los IDs. Para información sensible, usa encriptación real:

```php
// Usar Crypt para datos sensibles
$encrypted = encrypt($sensitiveData);

// Usar Sqids solo para referencias públicas
$sqid = $this->sqids->encode($userId);
```

### Validación de entrada

Valida los Sqids en las solicitudes:

```php
public function show(string $sqid)
{
    $validator = validator(['sqid' => $sqid], [
        'sqid' => 'required|string|regex:/^[a-z0-9]+$/',
    ]);

    if ($validator->fails()) {
        abort(400, 'Invalid Sqid format');
    }

    $ids = $this->sqids->decode($sqid);
    // ... resto del código
}
```

## Performance y optimización

Sqids es extremadamente rápido. Benchmarks muestran codificación/decodificación en microsegundos. Sin embargo, ten en cuenta:

1. **Cachea los Sqids**: Si los generas frecuentemente, almacena el resultado
2. **Úsalos en atributos computados**: Aprovecha el accessors de Eloquent
3. **Índices en base de datos**: Mantén índices en el ID numérico, no en el Sqid

```php
// Cachear Sqids
$product->sqid = cache()->rememberForever(
    "sqid.{$product->id}",
    fn() => $this->sqids->encode($product->id)
);
```

## Integración con API REST

En APIs, devuelve siempre el Sqid en las respuestas:

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class ProductResource extends JsonResource
{
    public function toArray($request)
    {
        return [
            'sqid' => $this->sqid,
            'name' => $this->name,
            'price' => $this->price,
            'created_at' => $this->created_at,
        ];
    }
}
```

## Puntos clave

- **Sqids** convierte números secuenciales en IDs cortos y reversibles URL-safe
- **No es encriptación**: Es codificación biyectiva, cualquiera puede decodificar si conoce los parámetros
- **Ideal para referencias públicas**: URLs, códigos de invitación, acortadores
- **Implementación en traits**: Automatiza la conversión en modelos Eloquent
- **Performance**: Operaciones en microsegundos, apto para aplicaciones de alto rendimiento
- **Blocklist**: Previene palabras inapropiadas en los IDs generados
- **Configuración flexible**: Alfabeto personalizado, longitud dinámica, parámetros ajustables
- **Validación importante**: Valida formato de entrada y maneja decodificaciones fallidas
- **Caché las conversiones**: En high-traffic, cachea los Sqids generados
- **Usa en APIs**: Devuelve siempre el Sqid en respuestas JSON, mantén coherencia