---
title: 'Cómo optimizar queries lentas en Laravel con Eloquent'
description: 'Aprende a detectar y optimizar queries lentas en Laravel: N+1 con eager loading, índices, select() para evitar SELECT *, chunking y Laravel Debugbar.'
pubDate: '2026-04-09'
tags: ['laravel', 'rendimiento', 'optimizacion', 'eloquent', 'queries']
---

El rendimiento de la base de datos es uno de los cuellos de botella más comunes en aplicaciones Laravel. La buena noticia es que la mayoría de los problemas se pueden detectar y solucionar sin necesidad de cambiar la arquitectura completa. En este artículo vamos a ver las técnicas más efectivas para optimizar queries lentas, desde herramientas de diagnóstico hasta soluciones concretas con código real.

## Instalar Laravel Debugbar para ver qué está pasando

Antes de optimizar nada, necesitas ver qué queries se están ejecutando. Laravel Debugbar es la herramienta más popular para esto en desarrollo.

```php
composer require barryvdh/laravel-debugbar --dev
```

Una vez instalado, aparece automáticamente en la parte inferior del navegador cuando `APP_DEBUG=true`. Te muestra el número de queries ejecutadas, su tiempo, los parámetros y si hay queries duplicadas. Es lo primero que deberías instalar en cualquier proyecto Laravel.

Si prefieres no usar la barra visual, puedes activar el query log de Laravel directamente en el código:

```php
DB::enableQueryLog();

// Tu código aquí...
$posts = Post::all();

dd(DB::getQueryLog());
```

Esto te devuelve un array con todas las queries ejecutadas, su tiempo y los bindings. Perfecto para debuggear en cualquier entorno.

También puedes usar `toSql()` para ver la query generada sin ejecutarla:

```php
$query = Post::where('published', true)->orderBy('created_at', 'desc');
dd($query->toSql());
// Output: "select * from `posts` where `published` = ? order by `created_at` desc"
```

## El problema N+1 — El enemigo número uno del rendimiento

El problema N+1 es probablemente el error de rendimiento más común en aplicaciones que usan ORMs como Eloquent. Ocurre cuando ejecutas una query para obtener una colección y luego, dentro de un bucle, ejecutas una query adicional por cada elemento.

### Ejemplo del problema N+1

Imagina que tienes una vista que muestra todos los posts con el nombre de su autor:

```php
// En el controlador
public function index()
{
    $posts = Post::all(); // 1 query: SELECT * FROM posts
    return view('posts.index', compact('posts'));
}
```

```php
// En la vista (posts/index.blade.php)
@foreach ($posts as $post)
    <h2>{{ $post->title }}</h2>
    <p>Por: {{ $post->user->name }}</p> {{-- 1 query por cada post --}}
@endforeach
```

Si tienes 50 posts, esto ejecuta **51 queries**: 1 para los posts y 50 para los usuarios. Con 500 posts serían 501 queries. Esto escala terriblemente.

### La solución: Eager Loading con `with()`

Eloquent ofrece eager loading para cargar las relaciones de forma anticipada en una sola query adicional:

```php
// Con eager loading: solo 2 queries en total
$posts = Post::with('user')->get();

// Con múltiples relaciones
$posts = Post::with(['user', 'comments', 'tags'])->get();

// Con relaciones anidadas
$posts = Post::with(['user', 'comments.user'])->get();
```

Ahora, en lugar de 51 queries tienes solo 2: una para los posts y una para todos los usuarios relacionados. Laravel hace un `WHERE id IN (1, 2, 3, ...)` en lugar de una query individual por cada post.

### `withCount()` para contar relaciones sin cargarlas

Un caso muy común es mostrar cuántos comentarios tiene cada post. Un error frecuente es cargar todos los comentarios solo para contar:

```php
// MAL: carga todos los comentarios en memoria
$posts = Post::with('comments')->get();
// En la vista: {{ $post->comments->count() }}

// BIEN: solo cuenta, no carga los datos
$posts = Post::withCount('comments')->get();
// En la vista: {{ $post->comments_count }}
```

`withCount()` agrega una subquery de COUNT, lo que es mucho más eficiente que traer todos los registros relacionados.

## Usar `select()` para evitar `SELECT *`

Por defecto, Eloquent hace `SELECT *`, lo que trae todas las columnas de la tabla. Si tienes una tabla con columnas grandes (textos, JSON, imágenes en base64) esto puede ser muy costoso.

```php
// MAL: trae todas las columnas incluyendo 'content' que puede ser muy grande
$posts = Post::all();

// BIEN: solo las columnas que necesitas
$posts = Post::select('id', 'title', 'slug', 'created_at', 'user_id')->get();

// También funciona con las relaciones
$posts = Post::select('id', 'title', 'user_id')
    ->with(['user:id,name,email']) // Formato especial para seleccionar columnas en relaciones
    ->get();
```

Nota importante: cuando usas `with()` con `select()`, asegúrate de incluir siempre la foreign key (`user_id` en este caso) o la relación no podrá cargarse correctamente.

## Índices en la base de datos — La optimización más impactante

Los índices son la optimización más impactante que puedes hacer a nivel de base de datos. Sin índices, MySQL tiene que escanear cada fila de la tabla para encontrar los registros que coinciden con tu `WHERE`. Con índices, la búsqueda es casi instantánea.

### Cuándo agregar índices

Agrega índices en columnas que uses frecuentemente en:
- Cláusulas `WHERE`
- Cláusulas `ORDER BY`
- Cláusulas `JOIN`
- Foreign keys

```php
// En una migración
Schema::table('posts', function (Blueprint $table) {
    $table->index('published'); // índice simple
    $table->index(['user_id', 'published']); // índice compuesto
    $table->index(['published', 'created_at']); // para queries con ORDER BY
});
```

Si ya tienes una tabla con datos y quieres agregar un índice, crea una nueva migración:

```php
php artisan make:migration add_indexes_to_posts_table
```

```php
public function up()
{
    Schema::table('posts', function (Blueprint $table) {
        $table->index('slug'); // búsquedas por slug son muy comunes
        $table->index(['published', 'created_at']); // para el listado de posts publicados ordenados
    });
}

public function down()
{
    Schema::table('posts', function (Blueprint $table) {
        $table->dropIndex(['slug']);
        $table->dropIndex(['published', 'created_at']);
    });
}
```

## `chunk()` y `chunkById()` para datasets grandes

Cuando necesitas procesar miles o millones de registros, cargarlos todos en memoria de una vez puede hacer que la aplicación se caiga por falta de RAM.

```php
// MAL: carga todos los registros en memoria
$users = User::all(); // Si hay 100,000 usuarios, esto consume mucha RAM
foreach ($users as $user) {
    // procesar...
}

// BIEN: procesa en grupos de 500
User::chunk(500, function ($users) {
    foreach ($users as $user) {
        // procesar...
    }
});
```

`chunkById()` es más eficiente y seguro que `chunk()` cuando los datos pueden cambiar durante el procesamiento:

```php
// chunkById es más estable y no tiene problemas con registros modificados durante el proceso
User::chunkById(500, function ($users) {
    foreach ($users as $user) {
        // procesar...
    }
});
```

Para reports o exportaciones, también puedes usar `cursor()` que usa PHP generators y es más eficiente en memoria:

```php
foreach (Post::cursor() as $post) {
    // procesa un registro a la vez, mínimo uso de memoria
}
```

## `DB::listen()` para logging personalizado de queries

En producción, a veces necesitas detectar queries lentas de forma automática y registrarlas:

```php
// En AppServiceProvider::boot()
DB::listen(function ($query) {
    if ($query->time > 1000) { // más de 1000ms (1 segundo)
        Log::warning('Query lenta detectada', [
            'sql' => $query->sql,
            'bindings' => $query->bindings,
            'time' => $query->time . 'ms',
        ]);
    }
});
```

## Queries condicionales con `when()`

Un patrón muy común es construir queries dinámicamente según filtros del usuario. El método `when()` hace esto de forma limpia:

```php
// MAL: código verboso con ifs
public function index(Request $request)
{
    $query = Post::query();

    if ($request->has('category')) {
        $query->where('category_id', $request->category);
    }

    if ($request->has('author')) {
        $query->where('user_id', $request->author);
    }

    return $query->get();
}

// BIEN: usando when()
public function index(Request $request)
{
    $posts = Post::query()
        ->when($request->category, fn($q, $category) => $q->where('category_id', $category))
        ->when($request->author, fn($q, $author) => $q->where('user_id', $author))
        ->when($request->search, fn($q, $search) => $q->where('title', 'like', "%{$search}%"))
        ->get();

    return $posts;
}
```

## Ejemplo real: antes y después de la optimización

Veamos un caso real de un controlador de blog que carga posts con sus autores, categorías y conteo de comentarios.

### Antes (sin optimizar)

```php
public function index()
{
    $posts = Post::where('published', true)
        ->orderBy('created_at', 'desc')
        ->get(); // SELECT * — carga todas las columnas
    // Resultado: 1 query para posts + N queries para user + N queries para category
    // Si hay 50 posts: 101 queries, ~800ms

    return view('posts.index', compact('posts'));
}
```

```php
// En la vista
@foreach ($posts as $post)
    {{ $post->user->name }}        {{-- query N+1 --}}
    {{ $post->category->name }}    {{-- query N+1 --}}
    {{ $post->comments->count() }} {{-- carga todos los comments solo para contar --}}
@endforeach
```

### Después (optimizado)

```php
public function index()
{
    $posts = Post::select('id', 'title', 'slug', 'excerpt', 'user_id', 'category_id', 'created_at')
        ->with([
            'user:id,name,avatar',
            'category:id,name,slug',
        ])
        ->withCount('comments')
        ->where('published', true)
        ->orderBy('created_at', 'desc')
        ->get();
    // Resultado: 3 queries totales (posts + users + categories), ~45ms

    return view('posts.index', compact('posts'));
}
```

```php
// En la vista — ahora sin queries adicionales
@foreach ($posts as $post)
    {{ $post->user->name }}        {{-- datos ya cargados --}}
    {{ $post->category->name }}    {{-- datos ya cargados --}}
    {{ $post->comments_count }}    {{-- calculado en la query principal --}}
@endforeach
```

El resultado: pasamos de 101 queries en ~800ms a 3 queries en ~45ms. Una mejora de más del 90% sin cambiar la lógica de negocio.

## Conclusión

Optimizar queries en Laravel no es magia, es metodología. Primero mides (Debugbar, query log), luego identificas el problema (N+1, SELECT *, falta de índices), y finalmente aplicas la solución correcta.

Las técnicas más impactantes, en orden de importancia, son:

1. **Eager loading** con `with()` para eliminar el problema N+1
2. **Índices** en las columnas que usas en WHERE y ORDER BY
3. **`select()`** para evitar traer columnas innecesarias
4. **`withCount()`** en lugar de cargar relaciones completas solo para contar
5. **`chunk()`** para procesar datasets grandes sin agotar la memoria

Con estas técnicas aplicadas de forma consistente, verás mejoras drásticas en el rendimiento de tu aplicación sin necesidad de infraestructura adicional.
