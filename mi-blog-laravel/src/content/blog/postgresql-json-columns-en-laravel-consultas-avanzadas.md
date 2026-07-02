---
title: 'PostgreSQL JSON Columns en Laravel: Consultas Avanzadas'
description: 'Domina consultas complejas en columnas JSON de PostgreSQL con Laravel Query Builder y Eloquent. Guía completa con ejemplos prácticos.'
pubDate: '2026-06-29'
tags: ['laravel', 'postgresql', 'json', 'database', 'eloquent']
---

## Introducción

Las columnas JSON en PostgreSQL son una herramienta poderosa para almacenar datos semiestructurados sin necesidad de normalizar completamente tu base de datos. Sin embargo, muchos desarrolladores de Laravel subutilizan esta capacidad, limitándose a guardar y recuperar datos sin aprovechar el verdadero potencial de las consultas avanzadas.

En este artículo te mostraremos cómo dominar las consultas JSON en PostgreSQL desde Laravel, desde lo básico hasta patrones avanzados que te permitirán filtrar, ordenar y transformar datos JSON directamente en la base de datos, mejorando significativamente el rendimiento de tu aplicación.

## ¿Por qué usar columnas JSON en PostgreSQL?

Antes de sumergirse en las consultas, es importante entender cuándo y por qué usar JSON. PostgreSQL trata las columnas JSON como ciudadanos de primera clase, permitiéndote:

- **Flexibilidad de esquema**: Almacenar datos sin estructura rígida
- **Consultas nativas**: Filtrar directamente en la BD, no en la aplicación
- **Mejor rendimiento**: Índices GIN y JSONB optimizan las búsquedas
- **Menos tablas**: Reduce la normalización excesiva

Un caso de uso común es almacenar metadatos, configuraciones o datos anidados que cambian frecuentemente.

## Configuración inicial en Laravel

Primero, asegúrate de que estés usando PostgreSQL con soporte JSONB:

```php
// config/database.php
'pgsql' => [
    'driver' => 'pgsql',
    'host' => env('DB_HOST'),
    'port' => env('DB_PORT'),
    'database' => env('DB_DATABASE'),
    'username' => env('DB_USERNAME'),
    'password' => env('DB_PASSWORD'),
    'charset' => 'utf8',
    'prefix' => '',
    'schema' => 'public',
    'sslmode' => 'prefer',
],
```

Crea una migración con una columna JSONB:

```php
// database/migrations/2026_01_15_create_products_table.php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->jsonb('metadata')->nullable(); // Columna JSON
    $table->timestamps();
    
    // Crear índice para queries rápidas
    $table->rawIndex('(metadata)', 'idx_metadata');
});
```

El atributo `jsonb` utiliza el tipo JSONB de PostgreSQL, que es más eficiente para búsquedas que JSON.

## Consultas básicas con JSON

### Acceder a propiedades simples

Supongamos que tu columna `metadata` contiene datos como:

```json
{
  "color": "rojo",
  "stock": 100,
  "supplier": "Proveedor A"
}
```

Puedes acceder a estas propiedades usando el operador `->`:

```php
// Obtener productos rojos
Product::where('metadata->color', 'rojo')->get();

// SQL generado: WHERE metadata->>'color' = 'rojo'
```

Laravel automáticamente convierte esto a la sintaxis correcta de PostgreSQL (`->>` para obtener texto).

### Filtrar por valores numéricos

```php
// Productos con stock mayor a 50
Product::where('metadata->stock', '>', 50)->get();

// Para comparaciones numéricas, cast explícito
Product::whereRaw("(metadata->>'stock')::integer > 50")->get();
```

### Búsquedas con LIKE

```php
// Proveedores que contienen "Premium"
Product::where('metadata->supplier', 'LIKE', '%Premium%')->get();
```

## Consultas JSON avanzadas

### Trabajar con arrays dentro de JSON

Supongamos una estructura como:

```json
{
  "tags": ["electrónico", "nuevo", "oferta"],
  "reviews": [
    {"rating": 5, "author": "Juan"},
    {"rating": 4, "author": "María"}
  ]
}
```

#### Verificar si un valor existe en un array

```php
// Productos con etiqueta "oferta"
Product::whereRaw("metadata->'tags' ? 'oferta'")
    ->get();
```

El operador `?` verifica si una clave o valor existe en JSON.

#### Filtrar por arrays anidados

```php
// Productos con al menos una reseña de 5 estrellas
Product::whereRaw(
    "EXISTS (
        SELECT 1 FROM jsonb_array_elements(metadata->'reviews') AS review 
        WHERE (review->>'rating')::int = 5
    )"
)->get();
```

### Contar elementos en arrays JSON

```php
// Productos con más de 2 tags
Product::whereRaw(
    "jsonb_array_length(metadata->'tags') > 2"
)->get();
```

### Buscar en objetos anidados

Supongamos metadatos con ubicaciones anidadas:

```json
{
  "location": {
    "warehouse": "Madrid",
    "country": "España"
  }
}
```

Usa la notación de ruta con `#>`:

```php
// Productos en el almacén de Madrid
Product::whereRaw(
    "metadata#>>'{location,warehouse}' = 'Madrid'"
)->get();
```

## Casos de uso prácticos

### Sistema de permisos dinámicos

```php
// Guardar permisos como JSON
User::create([
    'name' => 'Carlos',
    'permissions' => [
        'posts' => ['create', 'edit', 'delete'],
        'users' => ['view', 'edit'],
    ]
]);

// Verificar si usuario tiene permiso
User::whereRaw(
    "metadata->'permissions'->'posts' ? 'delete'"
)->get();
```

### Búsqueda de productos con filtros múltiples

```php
class Product extends Model
{
    public function scopeFilterByMetadata($query, array $filters)
    {
        foreach ($filters as $key => $value) {
            if (is_array($value)) {
                // Para arrays dentro de JSON
                $query->whereRaw(
                    "metadata->'{$key}' ? ?",
                    [$value[0]]
                );
            } else {
                // Para valores simples
                $query->where("metadata->{$key}", $value);
            }
        }
        
        return $query;
    }
}

// Uso
Product::filterByMetadata([
    'color' => 'rojo',
    'tags' => ['oferta']
])->get();
```

### Ordenar por propiedades JSON

```php
// Ordenar por stock (descendente)
Product::orderByRaw(
    "(metadata->>'stock')::integer DESC"
)->get();

// Combinado con otros ordenamientos
Product::orderBy('name')
    ->orderByRaw("(metadata->>'price')::numeric")
    ->get();
```

### Aggregaciones en JSON

```php
// Obtener el rating promedio de todas las reseñas
Product::selectRaw(
    'id, name, ' .
    'AVG((jsonb_array_elements(metadata->\'reviews\')->>\'rating\')::int) as avg_rating'
)
->whereRaw(
    "jsonb_array_length(metadata->'reviews') > 0"
)
->groupBy('id', 'name')
->get();
```

## Optimización de índices

Las consultas JSON sin índices pueden ser lentas con grandes volúmenes de datos. Crea índices apropiados:

```php
// Migración con índices JSON
Schema::table('products', function (Blueprint $table) {
    // Índice GIN para búsquedas generales
    $table->rawIndex('(metadata)', 'idx_metadata_gin');
    
    // Índice específico para una propiedad
    $table->rawIndex(
        "((metadata->>'color'))",
        'idx_metadata_color'
    );
    
    // Índice para arrays
    $table->rawIndex(
        "(metadata->'tags')",
        'idx_metadata_tags'
    );
});
```

## Transformación de datos JSON en consultas

### Extraer y transformar

```php
// Obtener solo los datos que necesitas
Product::selectRaw(
    'id, ' .
    'name, ' .
    'metadata->\'color\' as color, ' .
    '(metadata->>\'stock\')::integer as stock'
)->get();

// Con alias legible
Product::selectRaw(
    'id, name, metadata->>\'color\' as color'
)->get();
```

### Validar estructura JSON

```php
// Solo productos con metadata válida
Product::whereRaw(
    "jsonb_typeof(metadata) = 'object'"
)->get();

// Que tengan la propiedad 'color'
Product::whereRaw(
    "metadata ? 'color'"
)->get();
```

## Mejores prácticas y errores comunes

### ✅ Hacer

```php
// Usar whereRaw para operadores JSON complejos
Product::whereRaw("metadata->'tags' ? 'oferta'")->get();

// Castear tipos explícitamente
Product::whereRaw("(metadata->>'price')::numeric > 100")->get();

// Usar índices JSONB GIN
// (en migraciones)
```

### ❌ Evitar

```php
// ❌ No usar JSON en bucles de lectura
$products = Product::all();
foreach ($products as $product) {
    if (in_array('oferta', $product->metadata['tags'] ?? [])) {
        // Lógica...
    }
}

// ✅ Hacer consulta directa en BD
Product::whereRaw("metadata->'tags' ? 'oferta'")->get();

// ❌ No comparar strings con números sin castear
Product::where('metadata->stock', '>', 50); // Puede fallar

// ✅ Hacer con cast
Product::whereRaw("(metadata->>'stock')::integer > 50");
```

## Depuración de consultas JSON

Para ver exactamente qué SQL genera Laravel:

```php
$query = Product::where('metadata->color', 'rojo');

// Ver SQL
echo $query->toSql();
// Salida: SELECT * FROM "products" WHERE metadata->>'color' = ?

// Ver con bindings
dump($query->getBindings());
// Salida: ['rojo']
```

Usa Laravel Debugbar o Telescope para inspeccionar consultas en tiempo real durante el desarrollo.

## Conclusión

Las columnas JSON en PostgreSQL ofrecen una flexibilidad extraordinaria cuando se combinan correctamente con Laravel. Desde acceder a propiedades simples hasta filtrar arrays anidados y ejecutar aggregaciones, tienes todo lo necesario para manejar datos semiestructurados eficientemente.

La clave está en:

1. **Entender la sintaxis de PostgreSQL** y cómo Laravel la traduce
2. **Usar índices estratégicamente** para mantener el rendimiento
3. **Validar la estructura JSON** antes de consultarla
4. **Castear tipos explícitamente** en comparaciones numéricas
5. **Mantener consultas legibles** con `whereRaw` y alias claros

Con estos conocimientos, podrás construir aplicaciones más eficientes que aprovechen todo el poder de PostgreSQL sin sacrificar la elegancia de Laravel.

## Puntos clave

- **JSONB vs JSON**: Usa `jsonb` para mejor rendimiento en consultas
- **Operadores clave**: `->` (JSON), `->>` (texto), `?` (contiene), `#>` (ruta profunda)
- **Índices GIN**: Imprescindibles para volúmenes grandes de datos
- **Casting de tipos**: Siempre castea a `::integer` o `::numeric` en comparaciones
- **Validación**: Verifica que las propiedades existan antes de acceder
- **whereRaw**: Necesario para operadores PostgreSQL complejos
- **Legibilidad**: Usa alias y selectRaw para queries más limpias
- **Testing**: Prueba índices con EXPLAIN para optimizar