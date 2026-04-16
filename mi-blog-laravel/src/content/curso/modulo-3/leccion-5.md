---
modulo: 3
leccion: 5
title: 'Relaciones entre modelos'
description: 'Aprende a definir y usar relaciones Eloquent: hasOne, hasMany, belongsTo, belongsToMany y relaciones polimórficas en Laravel.'
duracion: '25 min'
quiz:
  - pregunta: '¿Qué relación Eloquent usarías para representar que un Post pertenece a un User?'
    opciones:
      - 'hasOne(User::class)'
      - 'hasMany(User::class)'
      - 'belongsTo(User::class)'
      - 'morphTo(User::class)'
    correcta: 2
    explicacion: 'belongsTo() se usa cuando la tabla del modelo contiene la clave foránea. El Post tiene user_id, por lo tanto el Post "pertenece a" un User.'
  - pregunta: '¿Cómo se llama la técnica para cargar relaciones en la misma consulta y evitar el problema N+1?'
    opciones:
      - 'Lazy loading'
      - 'Eager loading'
      - 'Deferred loading'
      - 'Batch loading'
    correcta: 1
    explicacion: 'Eager loading (with()) carga las relaciones junto con el modelo principal en una o pocas consultas adicionales, evitando el problema N+1 que ocurre con lazy loading en bucles.'
  - pregunta: '¿Qué tabla requiere una relación belongsToMany entre Posts y Tags?'
    opciones:
      - 'Una tabla post_tags con columnas post_id y tag_id'
      - 'Una columna tags en la tabla posts'
      - 'Una columna posts en la tabla tags'
      - 'Una tabla pivot llamada posts_tags con timestamps'
    correcta: 0
    explicacion: 'Las relaciones muchos a muchos requieren una tabla pivot (intermedia) con las claves foráneas de ambas tablas. Laravel la espera nombrada con los dos modelos en singular, orden alfabético: post_tag.'
---

## Relaciones entre modelos en Eloquent

Una de las funcionalidades más poderosas de Eloquent es su sistema de relaciones. En el mundo real, los datos raramente existen de forma aislada: un usuario tiene muchos posts, un post tiene muchos comentarios, un post puede tener muchas etiquetas y una etiqueta puede pertenecer a muchos posts. Eloquent modela estos vínculos con métodos expresivos que ocultan la complejidad del SQL subyacente.

## Tipos de relaciones

Eloquent soporta las relaciones más comunes:

- `hasOne` — Uno a uno
- `hasMany` — Uno a muchos
- `belongsTo` — Inversa de hasOne/hasMany
- `belongsToMany` — Muchos a muchos
- `hasManyThrough` — Uno a muchos a través de un intermediario
- `morphTo` / `morphMany` — Polimórficas

## hasOne — Uno a uno

Un usuario tiene un perfil. La clave foránea `user_id` vive en la tabla `perfiles`.

```php
// Modelo User
class User extends Model
{
    public function perfil(): HasOne
    {
        return $this->hasOne(Perfil::class);
        // Laravel busca perfil.user_id por convención
    }
}

// Modelo Perfil
class Perfil extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

Uso:

```php
$user   = User::find(1);
$perfil = $user->perfil; // objeto Perfil o null

// Crear perfil asociado
$user->perfil()->create([
    'bio'      => 'Desarrollador Laravel',
    'twitter'  => '@laravel_dev',
    'website'  => 'https://ejemplo.com',
]);
```

## hasMany — Uno a muchos

Un usuario tiene muchos posts. La clave foránea `user_id` vive en la tabla `posts`.

```php
// Modelo User
class User extends Model
{
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    public function postsPublicados(): HasMany
    {
        return $this->hasMany(Post::class)
            ->where('estado', 'publicado')
            ->latest();
    }
}

// Modelo Post
class Post extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

Uso:

```php
$user  = User::find(1);
$posts = $user->posts;                 // colección de Posts
$count = $user->posts()->count();      // consulta directa, no carga todos

// Acceder al autor desde el post
$post  = Post::find(1);
$autor = $post->user;                  // objeto User
$nombre = $post->user->name;
```

## belongsTo — La inversa

`belongsTo` siempre va en el modelo que contiene la clave foránea. En el ejemplo anterior, `Post` tiene `user_id`, así que `Post` "pertenece a" `User`.

Puedes personalizar la clave foránea si no sigue la convención:

```php
// Si la columna fuera 'autor_id' en lugar de 'user_id'
public function autor(): BelongsTo
{
    return $this->belongsTo(User::class, 'autor_id');
}
```

## belongsToMany — Muchos a muchos

Un post puede tener muchas etiquetas, y una etiqueta puede pertenecer a muchos posts. Esto requiere una tabla pivot.

Migración de la tabla pivot:

```php
Schema::create('post_tag', function (Blueprint $table) {
    $table->id();
    $table->foreignId('post_id')->constrained()->cascadeOnDelete();
    $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
    $table->timestamps();
});
```

Modelos:

```php
// Modelo Post
class Post extends Model
{
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
        // Laravel busca tabla post_tag por convención
    }
}

// Modelo Tag
class Tag extends Model
{
    public function posts(): BelongsToMany
    {
        return $this->belongsToMany(Post::class);
    }
}
```

Uso:

```php
$post = Post::find(1);

// Obtener etiquetas
$tags = $post->tags;

// Adjuntar etiquetas
$post->tags()->attach([1, 2, 3]);

// Desvincular etiquetas
$post->tags()->detach([1, 2]);

// Sincronizar (deja solo las indicadas)
$post->tags()->sync([2, 3, 4]);

// Datos extra en la tabla pivot
$post->tags()->attach(1, ['destacado' => true]);

// Acceder a datos del pivot
foreach ($post->tags as $tag) {
    echo $tag->pivot->destacado;
}
```

Para acceder al pivot debes indicarlo en la relación:

```php
return $this->belongsToMany(Tag::class)->withPivot('destacado')->withTimestamps();
```

## hasManyThrough — A través de

Permite acceder a relaciones indirectas. Por ejemplo, obtener todos los comentarios de los posts de un usuario:

```php
// Modelo User
class User extends Model
{
    public function comentarios(): HasManyThrough
    {
        return $this->hasManyThrough(
            Comentario::class,  // modelo final
            Post::class,        // modelo intermedio
            'user_id',          // FK en posts
            'post_id',          // FK en comentarios
        );
    }
}
```

## Relaciones polimórficas

Las relaciones polimórficas permiten que un modelo se relacione con múltiples modelos usando una sola relación. Por ejemplo, tanto `Post` como `Video` pueden tener `Comentario`.

Migración:

```php
Schema::create('comentarios', function (Blueprint $table) {
    $table->id();
    $table->text('cuerpo');
    $table->morphs('comentable'); // crea comentable_id y comentable_type
    $table->foreignId('user_id')->constrained();
    $table->timestamps();
});
```

Modelos:

```php
class Comentario extends Model
{
    public function comentable(): MorphTo
    {
        return $this->morphTo();
    }
}

class Post extends Model
{
    public function comentarios(): MorphMany
    {
        return $this->morphMany(Comentario::class, 'comentable');
    }
}

class Video extends Model
{
    public function comentarios(): MorphMany
    {
        return $this->morphMany(Comentario::class, 'comentable');
    }
}
```

Uso:

```php
// Comentar un post
$post->comentarios()->create(['cuerpo' => 'Excelente artículo', 'user_id' => 1]);

// Comentar un video
$video->comentarios()->create(['cuerpo' => 'Gran video', 'user_id' => 1]);

// Obtener el modelo padre desde un comentario
$comentario = Comentario::find(1);
$padre = $comentario->comentable; // devuelve un Post o un Video
```

## Eager Loading — evitar el problema N+1

El problema N+1 ocurre cuando cargas una colección y luego accedes a una relación dentro de un bucle, generando una consulta extra por cada elemento:

```php
// MAL: genera 1 + N consultas (1 para posts, N para cada user)
$posts = Post::all();
foreach ($posts as $post) {
    echo $post->user->name; // consulta extra por cada iteración
}
```

La solución es Eager Loading con `with()`:

```php
// BIEN: genera solo 2 consultas (posts + users en batch)
$posts = Post::with('user')->get();

// Cargar múltiples relaciones
$posts = Post::with(['user', 'tags', 'comentarios'])->get();

// Relaciones anidadas
$posts = Post::with('user.perfil')->get();

// Eager loading condicional
$posts = Post::with(['comentarios' => function ($query) {
    $query->where('aprobado', true)->latest();
}])->get();
```

## Lazy Eager Loading

Si ya tienes una colección cargada y necesitas cargar relaciones después:

```php
$posts = Post::all();

// Cargar relación sobre una colección ya existente
$posts->load('user');
$posts->load(['user', 'tags']);
```

## Contar relaciones sin cargarlas

```php
// withCount agrega columna {relacion}_count al modelo
$posts = Post::withCount('comentarios')->get();

foreach ($posts as $post) {
    echo $post->comentarios_count;
}
```

## Insertar a través de relaciones

```php
$user = User::find(1);

// Crear un post asociado al usuario
$post = $user->posts()->create([
    'titulo'    => 'Nuevo post',
    'slug'      => 'nuevo-post',
    'contenido' => 'Contenido...',
]);

// Asociar un modelo existente
$post = Post::find(5);
$user->posts()->save($post);
```

Las relaciones de Eloquent son una de las razones por las que Laravel es tan productivo. Con pocas líneas de código puedes navegar estructuras de datos complejas de forma legible y eficiente.
