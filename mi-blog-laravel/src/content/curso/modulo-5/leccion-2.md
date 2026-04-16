---
modulo: 5
leccion: 2
title: 'API Resources — formatear respuestas JSON'
description: 'Domina los API Resources de Laravel para controlar exactamente qué datos devuelve tu API, transformar respuestas y crear capas de presentación limpias.'
duracion: '20 min'
quiz:
  - pregunta: '¿Para qué sirven los API Resources en Laravel?'
    opciones:
      - 'Para definir las rutas de la API'
      - 'Para transformar y controlar el formato de las respuestas JSON'
      - 'Para autenticar las peticiones a la API'
      - 'Para crear migraciones de base de datos'
    correcta: 1
    explicacion: 'Los API Resources actúan como una capa de transformación entre tus modelos Eloquent y las respuestas JSON, permitiéndote controlar exactamente qué campos se exponen y cómo se formatean.'
  - pregunta: '¿Qué comando de Artisan crea un API Resource para el modelo Producto?'
    opciones:
      - 'php artisan make:resource ProductoResource'
      - 'php artisan make:api-resource Producto'
      - 'php artisan resource:make ProductoResource'
      - 'php artisan make:transformer ProductoResource'
    correcta: 0
    explicacion: 'El comando correcto es php artisan make:resource ProductoResource. Esto crea la clase en app/Http/Resources/ProductoResource.php.'
  - pregunta: '¿Qué clase se usa para devolver una colección de recursos con metadatos adicionales?'
    opciones:
      - 'ResourceCollection'
      - 'JsonCollection'
      - 'ApiCollection'
      - 'CollectionResource'
    correcta: 0
    explicacion: 'ResourceCollection (o la clase generada con --collection) permite devolver colecciones de recursos y añadir metadatos como paginación o totales en el campo "meta" de la respuesta.'
---

## ¿Por qué necesitas API Resources?

Cuando devuelves un modelo Eloquent directamente en tu controlador con `response()->json($producto)`, Laravel serializa el modelo tal cual, incluyendo todos sus campos, incluso los que no deberían ser públicos, como `password`, `remember_token` o campos internos de la base de datos.

Los **API Resources** resuelven este problema actuando como una **capa de transformación** entre tu modelo y la respuesta JSON. Con ellos puedes:

- Elegir exactamente qué campos exponer.
- Renombrar campos para adaptarlos a la convención camelCase del frontend.
- Añadir campos calculados o relaciones anidadas.
- Incluir metadatos en la respuesta (paginación, totales, etc.).
- Mantener una estructura de respuesta consistente en toda la API.

## Crear un API Resource

```bash
php artisan make:resource ProductoResource
```

Esto crea el archivo `app/Http/Resources/ProductoResource.php`:

```php
// app/Http/Resources/ProductoResource.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'          => $this->id,
            'nombre'      => $this->nombre,
            'descripcion' => $this->descripcion,
            'precio'      => (float) $this->precio,
            'stock'       => $this->stock,
            'disponible'  => $this->stock > 0,
            'creadoEn'    => $this->created_at->format('d/m/Y H:i'),
        ];
    }
}
```

Fíjate en lo que hemos hecho:
- Excluimos campos sensibles como `updated_at`.
- Forzamos que `precio` sea un float (evitando que llegue como string desde MySQL).
- Añadimos un campo calculado `disponible` basado en el stock.
- Renombramos `created_at` a `creadoEn` en formato legible.

## Usar el Resource en el controlador

```php
// app/Http/Controllers/Api/ProductoController.php

use App\Http\Resources\ProductoResource;

public function show(Producto $producto): ProductoResource
{
    return new ProductoResource($producto);
}

public function store(Request $request): ProductoResource
{
    $validated = $request->validate([
        'nombre'  => 'required|string|max:255',
        'precio'  => 'required|numeric|min:0',
        'stock'   => 'required|integer|min:0',
    ]);

    $producto = Producto::create($validated);

    return new ProductoResource($producto);
}
```

La respuesta JSON resultante tendrá este formato:

```json
{
  "data": {
    "id": 1,
    "nombre": "Teclado mecánico",
    "descripcion": "Teclado TKL con switches Cherry MX Red",
    "precio": 89.99,
    "stock": 50,
    "disponible": true,
    "creadoEn": "16/04/2026 10:30"
  }
}
```

Nota que Laravel envuelve automáticamente la respuesta en una clave `data`. Esto es parte de la especificación JSON:API y se puede desactivar, pero es una buena práctica mantenerlo.

## Colecciones de recursos

Para devolver múltiples recursos, puedes usar `ProductoResource::collection()`:

```php
public function index(): \Illuminate\Http\Resources\Json\AnonymousResourceCollection
{
    $productos = Producto::paginate(15);
    return ProductoResource::collection($productos);
}
```

Cuando se usa con paginación, la respuesta incluye automáticamente los metadatos de paginación:

```json
{
  "data": [
    { "id": 1, "nombre": "Teclado mecánico", ... },
    { "id": 2, "nombre": "Ratón inalámbrico", ... }
  ],
  "links": {
    "first": "http://localhost:8000/api/productos?page=1",
    "last": "http://localhost:8000/api/productos?page=4",
    "prev": null,
    "next": "http://localhost:8000/api/productos?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 4,
    "per_page": 15,
    "to": 15,
    "total": 58
  }
}
```

## Resource Collections personalizadas

Si necesitas añadir metadatos propios a la colección, crea una clase de colección dedicada:

```bash
php artisan make:resource ProductoCollection --collection
```

```php
// app/Http/Resources/ProductoCollection.php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class ProductoCollection extends ResourceCollection
{
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            'meta' => [
                'total'      => $this->collection->count(),
                'enStock'    => $this->collection->where('stock', '>', 0)->count(),
                'agotados'   => $this->collection->where('stock', 0)->count(),
            ],
        ];
    }
}
```

Úsala así en el controlador:

```php
public function index(): ProductoCollection
{
    return new ProductoCollection(Producto::all());
}
```

## Incluir relaciones condicionales

Una de las funcionalidades más útiles de los API Resources es poder incluir relaciones de forma condicional, solo cuando han sido cargadas con Eager Loading:

```php
// app/Http/Resources/ProductoResource.php

public function toArray(Request $request): array
{
    return [
        'id'       => $this->id,
        'nombre'   => $this->nombre,
        'precio'   => (float) $this->precio,
        'categoria' => new CategoriaResource($this->whenLoaded('categoria')),
        'reviews'   => ReviewResource::collection($this->whenLoaded('reviews')),
    ];
}
```

En el controlador, cargas la relación explícitamente cuando la necesitas:

```php
// Sin relación (respuesta ligera)
public function index()
{
    return ProductoResource::collection(Producto::paginate(15));
}

// Con relación (respuesta completa)
public function show(Producto $producto)
{
    return new ProductoResource($producto->load('categoria', 'reviews'));
}
```

Esto evita el problema N+1 y permite controlar cuándo se incluyen datos adicionales.

## Añadir metadatos con `with()`

Puedes añadir datos extra a cualquier respuesta de Resource sobreescribiendo el método `with()`:

```php
// app/Http/Resources/ProductoResource.php

public function with(Request $request): array
{
    return [
        'meta' => [
            'version' => 'v1',
            'autor'   => 'Mi Tienda API',
        ],
    ];
}
```

La respuesta resultante incluirá:

```json
{
  "data": { ... },
  "meta": {
    "version": "v1",
    "autor": "Mi Tienda API"
  }
}
```

## Respuestas condicionales con `when()`

El método `when()` permite incluir un campo solo si se cumple una condición:

```php
public function toArray(Request $request): array
{
    return [
        'id'        => $this->id,
        'nombre'    => $this->nombre,
        'precio'    => (float) $this->precio,
        // Solo incluir el costo si el usuario es administrador
        'costo'     => $this->when($request->user()?->esAdmin(), $this->costo),
        // Solo incluir el token si acaba de ser creado
        'api_token' => $this->when($this->wasRecentlyCreated, $this->api_token),
    ];
}
```

## Estructura de respuesta consistente

Una buena práctica es crear un Resource base que todos tus recursos extiendan, garantizando una estructura uniforme:

```php
// app/Http/Resources/BaseResource.php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class BaseResource extends JsonResource
{
    public function with($request): array
    {
        return [
            'success' => true,
            'version' => config('app.api_version', 'v1'),
        ];
    }
}
```

Los API Resources de Laravel son una herramienta poderosa que separa la lógica de presentación de la lógica de negocio. Usarlos desde el principio en tus proyectos hará que tus APIs sean más mantenibles, seguras y consistentes.
