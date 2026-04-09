---
title: 'Call to undefined method en Laravel — Errores de Eloquent'
description: 'Soluciona el error Call to undefined method en Laravel: diferencia entre Query Builder y Collection, métodos Eloquent frecuentemente confundidos.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'eloquent', 'orm']
---

# Call to undefined method en Laravel — Errores de Eloquent

El error "Call to undefined method" es especialmente frustrante en Laravel porque aparece en contextos donde juras que el método debería existir. La razón es casi siempre la misma: estás llamando a un método de Eloquent Query Builder sobre una Collection, o viceversa. Son dos objetos completamente diferentes y confundirlos es uno de los errores más comunes para los desarrolladores que están aprendiendo Laravel.

En esta guía vamos a aclarar la diferencia entre Builder y Collection, los métodos más frecuentemente confundidos y cómo evitar estos errores.

## Builder vs Collection: la diferencia fundamental

En Laravel/Eloquent, cuando haces consultas a la base de datos, trabajas con dos tipos de objetos completamente diferentes:

### Eloquent Query Builder

El Query Builder es un objeto que **representa una consulta SQL que aún no se ha ejecutado**. Puedes encadenarle métodos para construir la consulta antes de ejecutarla.

```php
// Esto es un Builder (la consulta no se ha ejecutado aún):
$query = Producto::where('activo', true);
$query = $query->where('precio', '>', 100);
$query = $query->orderBy('nombre');

// La consulta se ejecuta cuando llamas a get(), first(), count(), etc.:
$productos = $query->get(); // Ahora sí se ejecuta y devuelve una Collection
```

### Collection

La Collection es un **array avanzado** que contiene los resultados ya traídos de la base de datos. Tiene sus propios métodos para manipular los datos en PHP, sin hacer más consultas SQL.

```php
// Esto es una Collection (los datos ya están en memoria):
$productos = Producto::where('activo', true)->get(); // Collection

// Ahora puedes usar métodos de Collection:
$caros = $productos->filter(fn($p) => $p->precio > 100);
$nombres = $productos->pluck('nombre');
$total = $productos->sum('precio');
```

## El error más clásico: llamar a where() después de get()

```php
// INCORRECTO: get() devuelve una Collection, no un Builder
$productosActivos = Producto::get()->where('activo', true);

// ERROR: Call to undefined method Illuminate\Database\Eloquent\Collection::where()
// (La Collection tiene un método where() pero funciona diferente al del Builder)
```

Bueno, en realidad las Collections SÍ tienen un método `where()`, pero funciona de forma diferente al del Builder:

```php
// Collection::where() filtra en PHP los resultados ya obtenidos
$productos = Producto::get(); // Trae TODOS los productos de la BD
$activos = $productos->where('activo', true); // Filtra en PHP

// Builder::where() genera SQL WHERE y filtra en la BD
$activos = Producto::where('activo', true)->get(); // Filtra en la BD (mucho más eficiente)
```

La versión con Builder es mucho más eficiente porque filtra en la base de datos. La versión con Collection trae todos los registros a PHP y luego los filtra en memoria.

## El error de paginate() sobre una Collection

Este es el error que más veo en código de principiantes:

```php
// INCORRECTO:
$productos = Producto::all()->paginate(15);

// ERROR: Call to undefined method Illuminate\Database\Eloquent\Collection::paginate()
// La Collection no tiene paginate(), solo el Builder lo tiene
```

`paginate()` es un método del Builder porque necesita ejecutar la consulta con `LIMIT` y `OFFSET` en SQL:

```php
// CORRECTO: paginate() va antes de ejecutar la consulta
$productos = Producto::paginate(15);

// O con filtros:
$productos = Producto::where('activo', true)
    ->orderBy('nombre')
    ->paginate(15);
```

## El error de first() vs get()

```php
// first() devuelve un solo Modelo (o null), no una Collection
$producto = Producto::where('id', 1)->first();

// INCORRECTO: first() devuelve un Modelo, no una Collection
// Los Modelos no tienen métodos de colección como each(), map(), etc.
$nombres = Producto::where('activo', true)->first()->pluck('nombre');
// ERROR: Call to undefined method App\Models\Producto::pluck()
```

```php
// CORRECTO: usa get() si necesitas múltiples resultados con métodos de Collection
$nombres = Producto::where('activo', true)->get()->pluck('nombre');

// O mejor aún, usa pluck() como método del Builder (más eficiente):
$nombres = Producto::where('activo', true)->pluck('nombre');
```

## Métodos del Builder (se ejecutan en SQL)

Estos métodos pertenecen al Query Builder y construyen/ejecutan la consulta SQL:

```php
// Filtrar:
Producto::where('activo', true);
Producto::whereIn('categoria_id', [1, 2, 3]);
Producto::whereBetween('precio', [100, 500]);
Producto::whereNull('eliminado_en');
Producto::whereNotNull('publicado_en');

// Ordenar:
Producto::orderBy('nombre', 'asc');
Producto::orderByDesc('created_at');
Producto::latest();  // Equivale a orderBy('created_at', 'desc')
Producto::oldest();  // Equivale a orderBy('created_at', 'asc')

// Limitar:
Producto::limit(10);
Producto::take(10);  // Alias de limit()
Producto::skip(20)->take(10);  // Equivale a OFFSET 20 LIMIT 10

// Ejecutar la consulta:
Producto::where('activo', true)->get();     // Devuelve Collection
Producto::where('activo', true)->first();   // Devuelve Modelo o null
Producto::where('activo', true)->count();   // Devuelve int
Producto::where('activo', true)->sum('precio');  // Devuelve número
Producto::where('activo', true)->exists(); // Devuelve bool
Producto::where('activo', true)->paginate(15);  // LengthAwarePaginator

// Relacionados con relaciones:
Producto::with('categoria');         // Eager loading
Producto::withCount('reseñas');      // Contar relaciones
```

## Métodos de Collection (se ejecutan en PHP)

Estos métodos operan sobre datos ya cargados en memoria:

```php
$productos = Producto::all(); // Ya están en memoria

// Filtrar (en PHP, no en SQL):
$productos->filter(fn($p) => $p->precio > 100);
$productos->where('activo', true);  // Collection::where() trabaja en PHP
$productos->reject(fn($p) => $p->stock === 0);

// Transformar:
$productos->map(fn($p) => $p->nombre);
$productos->pluck('nombre');
$productos->mapWithKeys(fn($p) => [$p->id => $p->nombre]);

// Reducir:
$productos->sum('precio');
$productos->avg('precio');
$productos->max('precio');
$productos->min('precio');
$productos->count();

// Ordenar (en PHP):
$productos->sortBy('nombre');
$productos->sortByDesc('precio');

// Buscar:
$producto = $productos->find(5);          // Por ID
$producto = $productos->first();          // El primero
$producto = $productos->firstWhere('activo', true);

// Agrupar:
$porCategoria = $productos->groupBy('categoria_id');

// Verificar:
$productos->contains('id', 5);
$productos->isEmpty();
$productos->isNotEmpty();

// Slice/chunk:
$productos->take(5);          // Primeros 5
$productos->skip(10)->take(5); // Paginación manual
$productos->chunk(100);       // Grupos de 100 para procesar
```

## Query Scopes para encapsular lógica de filtrado

Una forma elegante de evitar confusión entre Builder y Collection es usar Query Scopes en los modelos:

```php
// app/Models/Producto.php
class Producto extends Model
{
    // Local scope: filtra en SQL
    public function scopeActivo(Builder $query): Builder
    {
        return $query->where('activo', true);
    }

    public function scopeCaros(Builder $query, float $precioMinimo = 100): Builder
    {
        return $query->where('precio', '>', $precioMinimo);
    }

    public function scopeDeCategoria(Builder $query, int $categoriaId): Builder
    {
        return $query->where('categoria_id', $categoriaId);
    }
}
```

Uso:

```php
// Los scopes se pueden encadenar como métodos del Builder:
$productos = Producto::activo()->caros(200)->deCategoria(3)->paginate(15);

// Son Builder, no Collection, así que todo funciona:
$count = Producto::activo()->count();
$hayProductos = Producto::activo()->exists();
```

## El error de encadenar métodos de Collection sobre lazy collections

Las lazy collections son diferentes a las collections normales:

```php
// LazyCollection - se procesa elemento por elemento (eficiente en memoria)
$productos = Producto::cursor(); // Devuelve LazyCollection

// No todos los métodos de Collection están disponibles en LazyCollection
$productos->sortBy('nombre'); // ERROR: sortBy() no existe en LazyCollection
```

Para procesar grandes conjuntos de datos sin cargar todo en memoria:

```php
// CORRECTO para grandes conjuntos:
Producto::where('activo', true)->chunk(100, function ($productos) {
    foreach ($productos as $producto) {
        // Procesar cada producto
    }
});

// O con cursor():
Producto::where('activo', true)->cursor()->each(function ($producto) {
    // Procesar uno por uno, carga uno en memoria a la vez
});
```

## Errores comunes en relaciones Eloquent

Las relaciones también pueden confundir Builder con Collection:

```php
// hasMany devuelve un Builder (antes de get())
$categoria = Categoria::find(1);

// INCORRECTO: llamar paginate() sobre una relación ya cargada
$productos = $categoria->productos->paginate(10);
// ERROR: La relación ya se evaluó como Collection con ->productos (sin paréntesis)

// CORRECTO: usar la relación como Builder (con paréntesis)
$productos = $categoria->productos()->paginate(10);
// Con paréntesis: devuelve un Builder al que puedes llamar paginate()
```

La diferencia entre `$categoria->productos` y `$categoria->productos()`:

```php
// Sin paréntesis: accede a la relación ya cargada (Collection)
$productos = $categoria->productos;  // Collection - datos ya en memoria

// Con paréntesis: devuelve el Builder de la relación
$productosQuery = $categoria->productos();  // Builder - puedes encadenar más métodos
$productosActivos = $categoria->productos()->where('activo', true)->get();
```

## Debugging rápido: saber qué tipo de objeto tienes

```php
$resultado = Producto::where('activo', true)->get();

// Verificar el tipo:
get_class($resultado);
// "Illuminate\Database\Eloquent\Collection"

$resultado2 = Producto::where('activo', true);
get_class($resultado2);
// "Illuminate\Database\Eloquent\Builder"

// En Tinker:
php artisan tinker
$q = Producto::where('activo', true);
get_class($q); // "Illuminate\Database\Eloquent\Builder"
```

## Conclusión

El error "Call to undefined method" en Laravel casi siempre indica que estás llamando a un método de Builder sobre una Collection o viceversa. La regla es simple:

- Si la consulta **no se ha ejecutado** (no has llamado a `get()`, `first()`, `all()`, etc.), tienes un **Builder** y puedes usar métodos SQL como `where()`, `orderBy()`, `paginate()`.
- Si ya ejecutaste la consulta y tienes los datos en PHP, tienes una **Collection** y usas métodos PHP como `filter()`, `map()`, `sortBy()`.

Siempre que puedas, filtra en el Builder (en SQL), no en la Collection (en PHP). Es más eficiente y escala mejor.
