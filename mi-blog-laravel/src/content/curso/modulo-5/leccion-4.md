---
modulo: 5
leccion: 4
title: 'Caché — mejorar el rendimiento'
description: 'Aprende a usar el sistema de caché de Laravel para reducir consultas a la base de datos, acelerar tu API y mejorar el rendimiento de tu aplicación.'
duracion: '20 min'
quiz:
  - pregunta: '¿Cuál es el propósito principal del sistema de caché en Laravel?'
    opciones:
      - 'Almacenar archivos subidos por el usuario'
      - 'Guardar resultados costosos temporalmente para no recalcularlos en cada petición'
      - 'Comprimir las respuestas HTTP'
      - 'Gestionar las sesiones de usuario'
    correcta: 1
    explicacion: 'La caché almacena el resultado de operaciones costosas (consultas SQL, llamadas a APIs externas, cálculos complejos) durante un tiempo determinado, de modo que las siguientes peticiones obtengan el resultado directamente de la caché sin repetir el trabajo.'
  - pregunta: '¿Qué método de Laravel guarda un valor en caché solo si todavía no existe?'
    opciones:
      - 'Cache::set()'
      - 'Cache::put()'
      - 'Cache::remember()'
      - 'Cache::store()'
    correcta: 2
    explicacion: 'Cache::remember() comprueba si la clave existe en caché. Si existe, devuelve el valor almacenado. Si no existe, ejecuta el closure, guarda el resultado en caché y lo devuelve. Es el método más utilizado en la práctica.'
  - pregunta: '¿Qué driver de caché se recomienda para producción por su rendimiento?'
    opciones:
      - 'file'
      - 'array'
      - 'database'
      - 'redis'
    correcta: 3
    explicacion: 'Redis es el driver de caché recomendado para producción porque mantiene los datos en memoria RAM, lo que lo hace extremadamente rápido. El driver "file" guarda en disco (más lento) y "array" solo persiste durante la petición actual.'
---

## ¿Por qué usar caché?

Las aplicaciones web modernas pueden recibir cientos o miles de peticiones por segundo. Si cada petición ejecuta las mismas consultas complejas a la base de datos o llama a las mismas APIs externas, el servidor se sobrecargará rápidamente y los tiempos de respuesta se dispararán.

La **caché** es una capa de almacenamiento temporal que guarda los resultados de operaciones costosas. Cuando llega la siguiente petición que necesita los mismos datos, se los devuelve desde la caché en milisegundos, sin repetir el trabajo.

Casos de uso comunes:
- Resultados de consultas SQL complejas o lentas.
- Datos de configuración leídos frecuentemente.
- Respuestas de APIs externas (clima, tipos de cambio, etc.).
- Contadores y estadísticas que no necesitan ser exactos al momento.
- Resultados de operaciones matemáticas o generación de reportes.

## Configurar el driver de caché

La configuración está en `config/cache.php` y se controla desde `.env`:

```bash
# Driver de archivo (por defecto, bueno para desarrollo)
CACHE_DRIVER=file

# Redis (recomendado para producción)
CACHE_DRIVER=redis

# Base de datos (si no tienes Redis)
CACHE_DRIVER=database

# Solo en memoria, se pierde al terminar la petición (útil para tests)
CACHE_DRIVER=array
```

Para usar Redis:

```bash
composer require predis/predis
```

```bash
# .env
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

Si usas el driver `database`, crea la tabla de caché:

```bash
php artisan cache:table
php artisan migrate
```

## Operaciones básicas de caché

### Guardar un valor

```php
use Illuminate\Support\Facades\Cache;

// Guardar durante 10 minutos
Cache::put('clave', 'valor', now()->addMinutes(10));

// Guardar durante 60 segundos
Cache::put('configuracion', $config, 60);

// Guardar para siempre (hasta que se borre manualmente)
Cache::forever('ajustes_globales', $ajustes);
```

### Recuperar un valor

```php
$valor = Cache::get('clave');

// Con valor por defecto si no existe
$valor = Cache::get('clave', 'valor_por_defecto');

// Con un closure como valor por defecto
$valor = Cache::get('clave', function () {
    return DB::table('configuracion')->value('campo');
});
```

### Comprobar si existe

```php
if (Cache::has('clave')) {
    $valor = Cache::get('clave');
}
```

### Eliminar de la caché

```php
Cache::forget('clave');

// Eliminar toda la caché
Cache::flush();
```

## El método remember

`Cache::remember()` es el método que más usarás en la práctica. Combina la comprobación, la carga y el almacenamiento en una sola llamada:

```php
// Si 'productos_destacados' existe en caché, lo devuelve.
// Si no existe, ejecuta el closure, guarda el resultado 30 minutos y lo devuelve.
$productos = Cache::remember('productos_destacados', now()->addMinutes(30), function () {
    return Producto::with('categoria')
        ->where('destacado', true)
        ->orderBy('ventas', 'desc')
        ->take(10)
        ->get();
});
```

Para guardar para siempre:

```php
$config = Cache::rememberForever('configuracion_app', function () {
    return Configuracion::all()->keyBy('clave');
});
```

## Caché en controladores de API

Un patrón muy común es cachear las respuestas de los endpoints más consultados:

```php
// app/Http/Controllers/Api/ProductoController.php

public function index(): JsonResponse
{
    $productos = Cache::remember('api.productos.todos', now()->addMinutes(15), function () {
        return Producto::with('categoria')->paginate(20);
    });

    return response()->json($productos);
}

public function show(int $id): JsonResponse
{
    $producto = Cache::remember("api.productos.{$id}", now()->addHour(), function () use ($id) {
        return Producto::with(['categoria', 'reviews'])->findOrFail($id);
    });

    return response()->json($producto);
}
```

## Invalidar la caché cuando los datos cambian

El mayor reto de la caché es mantenerla actualizada. Cuando un producto se actualiza o elimina, debes invalidar las claves de caché correspondientes:

```php
public function update(Request $request, Producto $producto): JsonResponse
{
    $producto->update($request->validated());

    // Invalidar la caché de este producto y la lista general
    Cache::forget("api.productos.{$producto->id}");
    Cache::forget('api.productos.todos');

    return response()->json($producto);
}

public function destroy(Producto $producto): JsonResponse
{
    $producto->delete();

    Cache::forget("api.productos.{$producto->id}");
    Cache::forget('api.productos.todos');

    return response()->json(null, 204);
}
```

## Tags de caché

Los **tags** te permiten agrupar entradas de caché y borrarlas todas a la vez. Son muy útiles para invalidar grupos relacionados de claves. Solo están disponibles con los drivers `redis`, `memcached` y `array`:

```php
// Guardar con tags
Cache::tags(['productos', 'api'])->put('productos_todos', $productos, 3600);
Cache::tags(['productos', 'destacados'])->put('productos_destacados', $destacados, 3600);

// Recuperar con tags
$productos = Cache::tags(['productos', 'api'])->get('productos_todos');

// Invalidar todo el tag 'productos' de una sola vez
Cache::tags(['productos'])->flush();
```

Esto simplifica enormemente la gestión de la caché cuando tienes muchas claves relacionadas.

## Cache::atomic — Operaciones atómicas

Para contadores y operaciones que pueden ejecutarse concurrentemente:

```php
// Incrementar un contador atómicamente
Cache::increment('visitas_producto_1');
Cache::increment('visitas_producto_1', 5); // Incrementar en 5

// Decrementar
Cache::decrement('stock_producto_1');
```

## Caché con Observers

Una forma elegante de gestionar la invalidación de caché es usar Observers de Eloquent:

```php
// app/Observers/ProductoObserver.php

namespace App\Observers;

use App\Models\Producto;
use Illuminate\Support\Facades\Cache;

class ProductoObserver
{
    public function saved(Producto $producto): void
    {
        Cache::forget("api.productos.{$producto->id}");
        Cache::forget('api.productos.todos');
        Cache::tags(['productos'])->flush();
    }

    public function deleted(Producto $producto): void
    {
        Cache::forget("api.productos.{$producto->id}");
        Cache::forget('api.productos.todos');
        Cache::tags(['productos'])->flush();
    }
}
```

Registra el observer en un Service Provider:

```php
// app/Providers/AppServiceProvider.php

use App\Models\Producto;
use App\Observers\ProductoObserver;

public function boot(): void
{
    Producto::observe(ProductoObserver::class);
}
```

Con esto, cada vez que un producto cambie, la caché se invalidará automáticamente sin tener que recordarlo en cada controlador.

## Comandos de Artisan para caché

```bash
# Limpiar toda la caché de la aplicación
php artisan cache:clear

# Limpiar la caché de configuración
php artisan config:clear

# Limpiar la caché de rutas
php artisan route:clear

# Limpiar la caché de vistas Blade
php artisan view:clear

# Cachear la configuración para producción (más rápido)
php artisan config:cache

# Cachear las rutas para producción
php artisan route:cache
```

La caché bien implementada puede reducir los tiempos de respuesta de tu aplicación en un 80-90% para los endpoints más consultados. La clave está en identificar qué datos cambian con poca frecuencia y cuánto tiempo puedes tolerar que estén desactualizados.
