---
title: 'Filterable en Laravel: Filtrado Avanzado de Modelos Eloquent'
description: 'Aprende a implementar filtros complejos en Laravel con Filterable. Soporta JSON anidado, relaciones y múltiples engines de filtrado escalable.'
pubDate: '2026-06-05'
tags: ['laravel', 'eloquent', 'filtrado', 'packages']
---

## Introducción

Uno de los desafíos más comunes al desarrollar aplicaciones Laravel es implementar sistemas de filtrado flexible y escalable para tus modelos Eloquent. Cuando necesitas filtrar por múltiples campos, relaciones anidadas y valores JSON, rápidamente el código se vuelve complejo y difícil de mantener.

**Filterable** es un paquete Laravel que resuelve este problema proporcionando un sistema declarativo y poderoso para filtrar modelos Eloquent. En este artículo, exploraremos cómo implementarlo en tus proyectos y cómo puede transformar la forma en que manejas consultas filtradas.

## ¿Qué es Filterable?

Filterable es un paquete Laravel que ofrece múltiples engines para realizar filtrado avanzado de modelos Eloquent. Sus características principales incluyen:

- **Filtrado anidado**: Soporte para JSON y relaciones complejas
- **Múltiples engines**: Diferentes estrategias de filtrado según necesites
- **Sintaxis declarativa**: Define filtros de forma clara y legible
- **Escalabilidad**: Optimizado para aplicaciones grandes
- **Integración fluida**: Funciona nativamente con Eloquent

## Instalación de Filterable

El proceso de instalación es simple usando Composer:

```bash
composer require spinoperator/filterable
```

Una vez instalado, el paquete está listo para usar sin necesidad de configuración adicional en la mayoría de los casos.

## Conceptos Fundamentales

### Traits y Setup Inicial

Para comenzar a usar Filterable, necesitas agregar el trait `Filterable` a tus modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spinoperator\Filterable\Traits\Filterable;

class Product extends Model
{
    use Filterable;

    protected $fillable = ['name', 'description', 'price', 'status'];
}
```

### Definición de Filtros

Los filtros se definen en una clase separada que implementa la interfaz de filtros:

```php
<?php

namespace App\Filters;

use Spinoperator\Filterable\Filter;

class ProductFilter extends Filter
{
    protected $filters = [
        'name' => 'like',
        'price' => 'equals',
        'status' => 'in',
        'description' => 'like',
    ];
}
```

## Uso Práctico: Ejemplo Completo

Veamos un ejemplo real de cómo implementar filtrado en una aplicación de comercio electrónico.

### Modelo con Filtros Avanzados

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spinoperator\Filterable\Traits\Filterable;

class Product extends Model
{
    use Filterable;

    protected $fillable = [
        'name',
        'description',
        'price',
        'status',
        'category_id',
        'attributes',
    ];

    protected $casts = [
        'attributes' => 'json',
        'price' => 'decimal:2',
    ];

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }
}
```

### Definición de Filtros Complejos

```php
<?php

namespace App\Filters;

use Spinoperator\Filterable\Filter;
use Illuminate\Database\Eloquent\Builder;

class ProductFilter extends Filter
{
    protected $filters = [
        'name' => 'like',
        'price_min' => 'min_price',
        'price_max' => 'max_price',
        'status' => 'equals',
        'category_id' => 'equals',
        'rating' => 'min_rating',
        'color' => 'json_filter',
    ];

    // Filtro personalizado para rango de precio
    public function minPrice(Builder $query, $value)
    {
        return $query->where('price', '>=', $value);
    }

    public function maxPrice(Builder $query, $value)
    {
        return $query->where('price', '<=', $value);
    }

    // Filtro para calificación mínima
    public function minRating(Builder $query, $value)
    {
        return $query->withAvg('reviews', 'rating')
            ->having('reviews_avg_rating', '>=', $value);
    }

    // Filtro para JSON anidado
    public function jsonFilter(Builder $query, $value)
    {
        return $query->where('attributes->color', $value);
    }
}
```

### Uso en Controladores

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Filters\ProductFilter;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index(Request $request)
    {
        // Crear una instancia del filtro
        $filter = new ProductFilter($request->all());

        // Aplicar filtros al query
        $products = Product::filter($filter)
            ->with('category', 'reviews')
            ->paginate(15);

        return response()->json($products);
    }

    public function search(Request $request)
    {
        // Filtrado simple con validación
        $validated = $request->validate([
            'name' => 'nullable|string|max:255',
            'price_min' => 'nullable|numeric|min:0',
            'price_max' => 'nullable|numeric|min:0',
            'status' => 'nullable|in:active,inactive,draft',
            'category_id' => 'nullable|exists:categories,id',
            'rating' => 'nullable|numeric|min:0|max:5',
        ]);

        $filter = new ProductFilter($validated);

        $products = Product::filter($filter)
            ->select('id', 'name', 'price', 'status', 'category_id')
            ->get();

        return view('products.search', ['products' => $products]);
    }
}
```

## Filtrado con Relaciones

### Filtros en Relaciones Anidadas

```php
<?php

namespace App\Filters;

use Spinoperator\Filterable\Filter;
use Illuminate\Database\Eloquent\Builder;

class ProductFilter extends Filter
{
    protected $filters = [
        'name' => 'like',
        'category_name' => 'filter_category',
        'author_name' => 'filter_author',
    ];

    // Filtrar por nombre de categoría
    public function filterCategory(Builder $query, $value)
    {
        return $query->whereHas('category', function ($q) use ($value) {
            $q->where('name', 'like', "%{$value}%");
        });
    }

    // Filtrar por autor a través de categoría
    public function filterAuthor(Builder $query, $value)
    {
        return $query->whereHas('category.author', function ($q) use ($value) {
            $q->where('name', 'like', "%{$value}%");
        });
    }
}
```

### Uso en Request

```php
// Request GET a /api/products?name=Laptop&category_name=Electronics&author_name=TechBrand

$filter = new ProductFilter($request->all());
$products = Product::filter($filter)->get();
```

## Filtrado de JSON Avanzado

### Trabajar con Datos JSON Anidados

```php
<?php

namespace App\Filters;

use Spinoperator\Filterable\Filter;
use Illuminate\Database\Eloquent\Builder;

class ProductFilter extends Filter
{
    protected $filters = [
        'color' => 'json_color',
        'size' => 'json_size',
        'specs' => 'json_specs',
    ];

    public function jsonColor(Builder $query, $value)
    {
        return $query->where('attributes->color', $value);
    }

    public function jsonSize(Builder $query, $value)
    {
        return $query->whereJsonContains('attributes->sizes', $value);
    }

    public function jsonSpecs(Builder $query, $value)
    {
        // Filtrar múltiples especificaciones
        return $query->where('attributes->specifications->weight', '>', $value);
    }
}
```

## Optimización y Mejores Prácticas

### Evitar N+1 Queries

```php
<?php

public function index(Request $request)
{
    $filter = new ProductFilter($request->all());

    $products = Product::filter($filter)
        ->with([
            'category' => function ($query) {
                $query->select('id', 'name');
            },
            'reviews' => function ($query) {
                $query->select('id', 'product_id', 'rating')->limit(5);
            }
        ])
        ->select('id', 'name', 'price', 'category_id')
        ->paginate(15);

    return response()->json($products);
}
```

### Caché de Filtros Frecuentes

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Filters\ProductFilter;
use Illuminate\Support\Facades\Cache;

public function index(Request $request)
{
    $cacheKey = 'products:filter:' . md5(json_encode($request->all()));

    $products = Cache::remember($cacheKey, 3600, function () use ($request) {
        $filter = new ProductFilter($request->all());
        
        return Product::filter($filter)
            ->with('category')
            ->paginate(15);
    });

    return response()->json($products);
}
```

### Validación de Filtros

```php
<?php

public function index(Request $request)
{
    $validated = $request->validate([
        'name' => 'nullable|string|max:100',
        'price_min' => 'nullable|numeric|min:0|max:1000000',
        'price_max' => 'nullable|numeric|min:0|max:1000000',
        'status' => 'nullable|in:active,inactive,draft',
        'category_id' => 'nullable|integer|exists:categories,id',
        'rating' => 'nullable|numeric|between:0,5',
        'page' => 'nullable|integer|min:1',
        'per_page' => 'nullable|integer|between:1,100',
    ]);

    $filter = new ProductFilter($validated);
    
    $products = Product::filter($filter)
        ->paginate($validated['per_page'] ?? 15);

    return response()->json($products);
}
```

## Comparación: Antes vs Después

### Sin Filterable

```php
// Código tedioso y repetitivo
$query = Product::query();

if ($request->has('name')) {
    $query->where('name', 'like', "%{$request->name}%");
}

if ($request->has('price_min')) {
    $query->where('price', '>=', $request->price_min);
}

if ($request->has('price_max')) {
    $query->where('price', '<=', $request->price_max);
}

if ($request->has('status')) {
    $query->where('status', $request->status);
}

if ($request->has('rating')) {
    $query->withAvg('reviews', 'rating')
        ->having('reviews_avg_rating', '>=', $request->rating);
}

$products = $query->paginate(15);
```

### Con Filterable

```php
// Código limpio y mantenible
$filter = new ProductFilter($request->all());
$products = Product::filter($filter)->paginate(15);
```

## Casos de Uso Reales

### E-commerce

```php
// Búsqueda avanzada de productos
$filter = new ProductFilter([
    'name' => 'laptop',
    'price_min' => 500,
    'price_max' => 2000,
    'category_id' => 1,
    'rating' => 4,
    'color' => 'black'
]);

$products = Product::filter($filter)->with('reviews')->get();
```

### Sistema de Gestión de Usuarios

```php
class UserFilter extends Filter
{
    protected $filters = [
        'email' => 'like',
        'role' => 'equals',
        'status' => 'equals',
        'created_after' => 'date_min',
        'created_before' => 'date_max',
    ];
}
```

### API REST con Filtrado

```php
// GET /api/users?role=admin&status=active&created_after=2024-01-01

$filter = new UserFilter($request->all());
$users = User::filter($filter)->paginate(50);

return UserResource::collection($users);
```

## Conclusión

Filterable es un paquete poderoso que simplifica significativamente la implementación de sistemas de filtrado complejos en Laravel. Al adoptar este enfoque declarativo, tu código se vuelve más limpio, mantenible y escalable.

Las ventajas clave incluyen:

- **Código más legible**: Los filtros se definen de forma clara y centralizada
- **Reutilización**: Puedes reutilizar los mismos filtros en múltiples controladores
- **Mantenimiento**: Cambios en la lógica de filtrado se hacen en un único lugar
- **Flexibilidad**: Soporta desde filtros simples hasta complejos con relaciones y JSON
- **Performance**: Te permite optimizar queries y agregar caché fácilmente

Si trabajas frecuentemente con búsquedas y filtros en tus aplicaciones Laravel, Filterable es definitivamente una inversión valiosa que te ahorrará horas de desarrollo y dolor de cabeza.

## Puntos Clave

- **Filterable simplifica el código de filtrado** mediante un sistema declarativo y reutilizable
- **Soporta múltiples tipos de filtrado**: campos simples, JSON anidado, relaciones complejas
- **Define filtros personalizados** extendiendo la clase Filter con métodos específicos
- **Integración natural con Eloquent** usando el trait Filterable en tus modelos
- **Mejora el performance** permitiendo eager loading, caché y validación de filtros
- **Mantiene el código DRY** centralizando la lógica de filtrado en clases dedicadas
- **Escalable para aplicaciones grandes** con soporte para relaciones anidadas y datos complejos