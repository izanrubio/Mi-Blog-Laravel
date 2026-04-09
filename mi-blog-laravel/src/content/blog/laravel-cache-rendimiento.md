---
title: 'Cómo usar caché en Laravel para mejorar el rendimiento'
description: 'Implementa caché en Laravel con Redis o Memcached: Cache facade, cache de queries, remember(), forever() y estrategias de invalidación correctas.'
pubDate: '2026-04-09'
tags: ['laravel', 'cache', 'rendimiento', 'redis', 'optimizacion']
---

Una de las formas más efectivas de mejorar el rendimiento de una aplicación Laravel es implementar una buena estrategia de caché. La idea es simple: si una operación es costosa (una query compleja, una llamada a una API externa, un cálculo pesado) y el resultado no cambia muy frecuentemente, guarda ese resultado y sírvelo directamente la próxima vez sin repetir el trabajo.

En este artículo vamos a ver cómo funciona el sistema de caché de Laravel, qué drivers existen, cuándo usar cada uno y cómo implementarlo de forma correcta con ejemplos prácticos.

## Por qué importa el caché

Imagina que tienes un blog con miles de visitantes por día. Cada vez que alguien visita la página principal, Laravel ejecuta una query para obtener los últimos 10 posts. Si esa query tarda 200ms y tienes 1000 visitas por hora, estás ejecutando esa misma query 1000 veces por hora y gastando 200 segundos de tiempo de CPU en la base de datos, todo para devolver exactamente el mismo resultado.

Con caché, ejecutas esa query una vez, guardas el resultado, y los 999 visitantes restantes reciben la respuesta en menos de 1ms directamente desde la memoria. Tu base de datos respira, tu aplicación es más rápida y los usuarios están más contentos.

## Drivers de caché disponibles

Laravel soporta varios drivers de caché out of the box. Configuras el driver en `config/cache.php` o simplemente en el `.env`:

```php
CACHE_DRIVER=redis
```

### File (por defecto)

Guarda el caché en archivos en `storage/framework/cache`. Es la opción por defecto y funciona sin configuración adicional. Está bien para desarrollo o aplicaciones pequeñas, pero no escala bien en producción porque acceder a disco es mucho más lento que acceder a memoria.

### Database

Guarda el caché en una tabla de base de datos. Antes de usarlo necesitas crear la tabla:

```php
php artisan cache:table
php artisan migrate
```

Es más lento que file en muchos casos, pero puede ser útil si no tienes Redis disponible y quieres compartir el caché entre varios servidores.

### Redis

Redis es el driver recomendado para producción. Es extremadamente rápido porque guarda todo en memoria RAM, soporta estructuras de datos complejas y tiene soporte nativo para cache tags. Necesitas instalar el paquete PHP:

```php
composer require predis/predis
```

Y configurar la conexión en `.env`:

```php
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
```

### Memcached

Similar a Redis en velocidad, pero más limitado en funcionalidades. No soporta cache tags ni la misma variedad de tipos de datos. Si ya tienes Redis disponible, úsalo.

## Operaciones básicas con la facade Cache

Laravel proporciona la facade `Cache` con una API muy limpia:

```php
use Illuminate\Support\Facades\Cache;

// Guardar un valor por 60 minutos
Cache::put('key', 'value', 60); // segundos en Laravel 8+
Cache::put('key', 'value', now()->addMinutes(60)); // con Carbon

// Guardar permanentemente (hasta que se borre manualmente)
Cache::forever('key', 'value');

// Obtener un valor (null si no existe)
$value = Cache::get('key');

// Obtener con valor por defecto
$value = Cache::get('key', 'default_value');

// Verificar si existe
if (Cache::has('key')) {
    // ...
}

// Eliminar una clave
Cache::forget('key');

// Limpiar todo el caché
Cache::flush();
```

## `Cache::remember()` — El método más útil

El método `remember()` es el que más vas a usar en el día a día. Combina el get y el put en una sola operación con una sintaxis muy elegante:

```php
$posts = Cache::remember('latest-posts', 3600, function () {
    return Post::with('user')
        ->where('published', true)
        ->orderBy('created_at', 'desc')
        ->take(10)
        ->get();
});
```

Lo que hace este código:
1. Busca en el caché la clave `latest-posts`
2. Si existe, devuelve el valor cacheado directamente (sin tocar la base de datos)
3. Si no existe, ejecuta el closure, guarda el resultado en caché durante 3600 segundos (1 hora) y lo devuelve

Es exactamente lo que necesitas el 90% de las veces. La lógica es: "dame esto del caché, y si no está, ejecútalo y guárdalo".

## `Cache::rememberForever()` para datos que casi nunca cambian

Para datos que raramente o nunca cambian, usa `rememberForever()`:

```php
$categories = Cache::rememberForever('all-categories', function () {
    return Category::orderBy('name')->get();
});
```

Solo ten cuidado de invalidar este caché cuando los datos cambien. Hablaremos de eso más adelante.

## Cache Tags para agrupar caches relacionados

Los cache tags te permiten agrupar múltiples entradas de caché bajo una etiqueta común, para poder invalidarlas todas juntas. Esto es extremadamente útil.

**Importante**: los cache tags solo funcionan con los drivers `redis` y `memcached`. El driver `file` no los soporta.

```php
// Guardar con tags
Cache::tags(['posts', 'blog'])->put('latest-posts', $posts, 3600);
Cache::tags(['posts'])->put('post-1', $post, 3600);
Cache::tags(['posts'])->put('popular-posts', $popularPosts, 3600);

// Obtener con tags
$posts = Cache::tags(['posts', 'blog'])->get('latest-posts');

// Invalidar TODO lo que tenga el tag 'posts'
Cache::tags(['posts'])->flush();
```

Esto es perfecto para invalidar el caché cuando guardas o modificas un post: en lugar de borrar claves individuales, simplemente haces `Cache::tags(['posts'])->flush()` y limpias todo lo relacionado con posts.

## Cachear respuestas HTTP completas

Para páginas públicas que no cambian con frecuencia, puedes cachear la respuesta HTTP completa usando el middleware `cache.headers`:

```php
// En routes/web.php
Route::get('/blog', [PostController::class, 'index'])
    ->middleware('cache.headers:public;max_age=3600;etag');
```

O manualmente en el controlador:

```php
public function show(Post $post)
{
    return response()
        ->view('posts.show', compact('post'))
        ->header('Cache-Control', 'public, max-age=3600');
}
```

## Caché de rutas, configuración y vistas

Laravel ofrece comandos artisan para cachear partes de la propia aplicación:

```php
// Cachear todas las rutas (mejora el tiempo de arranque de la app)
php artisan route:cache

// Limpiar el caché de rutas
php artisan route:clear

// Cachear la configuración (combina todos los archivos de config en uno)
php artisan config:cache

// Limpiar el caché de configuración
php artisan config:clear

// Cachear las vistas compiladas de Blade
php artisan view:cache

// Limpiar el caché de vistas
php artisan view:clear

// Cachear todo de una vez (el comando más útil para deployment)
php artisan optimize
```

Estos comandos son especialmente importantes en producción. Incluye `php artisan optimize` en tu script de deployment para mejorar el rendimiento de arranque de la aplicación.

**Importante**: después de ejecutar `route:cache` o `config:cache`, los cambios en rutas o configuración no se reflejarán hasta que limpies el caché. Esto puede causar confusión en desarrollo, así que estos comandos son principalmente para producción.

## Estrategias de invalidación de caché

Invalidar el caché de forma correcta es la parte más difícil del trabajo con caché. Hay varias estrategias:

### Estrategia 1: TTL (Time To Live)

La más simple. El caché expira automáticamente después de un tiempo:

```php
// El caché expira en 1 hora y se regenera automáticamente
$posts = Cache::remember('latest-posts', 3600, function () {
    return Post::published()->latest()->take(10)->get();
});
```

Ventaja: sin mantenimiento. Desventaja: los datos pueden estar desactualizados hasta que expire el TTL.

### Estrategia 2: Invalidación manual en eventos

Cuando un usuario modifica datos, invalidas el caché relacionado:

```php
public function store(Request $request)
{
    $post = Post::create($request->validated());

    // Invalidar el caché de posts
    Cache::forget('latest-posts');
    Cache::tags(['posts'])->flush(); // si usas tags

    return redirect()->route('posts.show', $post);
}
```

### Estrategia 3: Observers de Eloquent

La forma más elegante: usar un Observer para invalidar el caché automáticamente cuando un modelo cambia:

```php
// php artisan make:observer PostObserver --model=Post
class PostObserver
{
    public function saved(Post $post): void
    {
        Cache::tags(['posts'])->flush();
    }

    public function deleted(Post $post): void
    {
        Cache::tags(['posts'])->flush();
        Cache::forget("post-{$post->id}");
    }
}
```

Registra el observer en el `AppServiceProvider`:

```php
public function boot(): void
{
    Post::observe(PostObserver::class);
}
```

Con este enfoque, cada vez que se crea, actualiza o elimina un post, el caché se invalida automáticamente sin que tengas que recordarlo en cada controlador.

## Ejemplo real: cachear un blog popular

Vamos a ver un ejemplo completo de cómo cachear la página principal de un blog con diferentes niveles de caché:

```php
class PostController extends Controller
{
    public function index()
    {
        // Caché de 1 hora para los posts principales
        $posts = Cache::remember('homepage-posts', 3600, function () {
            return Post::select('id', 'title', 'slug', 'excerpt', 'user_id', 'created_at')
                ->with(['user:id,name', 'tags:id,name'])
                ->withCount('comments')
                ->where('published', true)
                ->orderBy('created_at', 'desc')
                ->take(12)
                ->get();
        });

        // Caché de 24 horas para las categorías (cambian raramente)
        $categories = Cache::rememberForever('sidebar-categories', function () {
            return Category::withCount('posts')
                ->orderBy('posts_count', 'desc')
                ->take(10)
                ->get();
        });

        // Posts populares en caché de 6 horas
        $popularPosts = Cache::remember('popular-posts', 21600, function () {
            return Post::select('id', 'title', 'slug', 'views')
                ->where('published', true)
                ->orderBy('views', 'desc')
                ->take(5)
                ->get();
        });

        return view('posts.index', compact('posts', 'categories', 'popularPosts'));
    }

    public function show(Post $post)
    {
        // Cachear el post individual por su slug
        $cachedPost = Cache::remember("post-{$post->slug}", 1800, function () use ($post) {
            return $post->load(['user', 'tags', 'comments.user']);
        });

        // Incrementar contador de vistas (no se cachea, siempre es exacto)
        $post->increment('views');

        return view('posts.show', ['post' => $cachedPost]);
    }
}
```

## Monitorear el caché con Telescope

Si usas Laravel Telescope (ver artículo sobre Telescope), puedes ver todas las operaciones de caché en tiempo real: qué claves se leen, cuáles fallan (cache miss) y cuáles se guardan. Esto te ayuda a entender si tu estrategia de caché está funcionando correctamente.

## Conclusión

El caché es una de las optimizaciones más potentes que tienes disponible en Laravel. La regla general es:

- Usa **`remember()`** para datos que se leen frecuentemente pero cambian poco
- Usa **cache tags** para agrupar datos relacionados y poder invalidarlos juntos
- Usa **Observers** para invalidar el caché automáticamente cuando los datos cambian
- Ejecuta **`php artisan optimize`** en cada deployment
- Usa **Redis** en producción para mejor rendimiento y soporte de tags

La clave del éxito con el caché es encontrar el equilibrio correcto entre frescura de los datos y velocidad. No todos los datos necesitan estar siempre 100% actualizados, y entender eso es lo que separa una buena estrategia de caché de una mala.
