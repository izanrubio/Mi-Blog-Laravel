---
title: 'Relaciones Eloquent en Laravel: hasOne, hasMany, belongsTo y más'
description: 'Guía completa de relaciones Eloquent en Laravel. hasOne, hasMany, belongsTo, belongsToMany, hasManyThrough con ejemplos reales y eager loading para evitar N+1.'
pubDate: '2026-04-16'
tags: ['laravel', 'eloquent', 'base-de-datos', 'roadmap']
---

Una de las razones por las que Laravel se ha convertido en el framework PHP más popular del mundo es Eloquent, su ORM. Y dentro de Eloquent, el sistema de relaciones entre modelos es, sin duda, una de sus características más potentes. En este artículo vas a aprender a definir y usar relaciones entre tus modelos de una forma clara y práctica.

## ¿Por qué importan las relaciones?

En cualquier aplicación real, los datos no viven aislados. Un usuario tiene publicaciones, una publicación tiene comentarios, un producto pertenece a una categoría. Las relaciones en Eloquent te permiten expresar esas conexiones directamente en tus modelos y consultarlas con una sintaxis limpia, sin escribir JOINs manuales en SQL.

La clave está en que Eloquent convierte la estructura de tu base de datos en objetos PHP con los que puedes trabajar de forma natural.

## hasOne: un modelo tiene uno

La relación `hasOne` indica que un modelo posee exactamente un modelo relacionado. El ejemplo clásico es un usuario que tiene un perfil.

```php
// app/Models/User.php
public function profile(): \Illuminate\Database\Eloquent\Relations\HasOne
{
    return $this->hasOne(Profile::class);
}
```

Eloquent asume que la tabla `profiles` tiene una columna `user_id`. Para acceder al perfil de un usuario:

```php
$user = User::find(1);
$profile = $user->profile; // Instancia de Profile
echo $profile->bio;
```

Si la clave foránea tiene un nombre distinto, puedes pasarla como segundo argumento:

```php
return $this->hasOne(Profile::class, 'foreign_key', 'local_key');
```

## hasMany: un modelo tiene muchos

`hasMany` es la relación más común. Un usuario puede tener muchas publicaciones:

```php
// app/Models/User.php
public function posts(): \Illuminate\Database\Eloquent\Relations\HasMany
{
    return $this->hasMany(Post::class);
}
```

Esto devuelve una colección de modelos `Post`:

```php
$user = User::find(1);

foreach ($user->posts as $post) {
    echo $post->title . PHP_EOL;
}

// También puedes encadenar consultas
$publishedPosts = $user->posts()->where('status', 'published')->get();
```

La diferencia importante es que `$user->posts` (como propiedad) devuelve la colección directamente, mientras que `$user->posts()` (como método) devuelve el query builder, lo que te permite seguir encadenando condiciones.

## belongsTo: pertenece a otro modelo

`belongsTo` es la contraparte de `hasOne` y `hasMany`. Si un usuario tiene muchas publicaciones, cada publicación pertenece a un usuario:

```php
// app/Models/Post.php
public function user(): \Illuminate\Database\Eloquent\Relations\BelongsTo
{
    return $this->belongsTo(User::class);
}
```

Acceder al autor de una publicación es igual de sencillo:

```php
$post = Post::find(1);
echo $post->user->name;
```

## belongsToMany: relación muchos a muchos

Cuando dos modelos se relacionan en ambas direcciones con multiplicidad, necesitas una tabla pivot. El ejemplo típico es usuarios y roles: un usuario puede tener varios roles, y un rol puede pertenecer a varios usuarios.

Primero, la tabla pivot `role_user` (en orden alfabético por convención):

```php
// En la migración
Schema::create('role_user', function (Blueprint $table) {
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->foreignId('role_id')->constrained()->cascadeOnDelete();
    $table->primary(['user_id', 'role_id']);
});
```

Luego, en los modelos:

```php
// app/Models/User.php
public function roles(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
{
    return $this->belongsToMany(Role::class);
}

// app/Models/Role.php
public function users(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
{
    return $this->belongsToMany(User::class);
}
```

Para adjuntar, sincronizar y desvincular registros en la tabla pivot:

```php
$user = User::find(1);

// Adjuntar roles
$user->roles()->attach([1, 2, 3]);

// Sincronizar (elimina los que no estén en el array)
$user->roles()->sync([1, 3]);

// Desvincular
$user->roles()->detach(2);

// Acceder a columnas de la tabla pivot
foreach ($user->roles as $role) {
    echo $role->pivot->created_at;
}
```

## hasManyThrough: relación a través de un intermediario

Esta relación es menos conocida pero muy útil. Imagina que tienes `Country → User → Post`. Un país tiene muchos usuarios, y cada usuario tiene muchas publicaciones. Con `hasManyThrough` puedes acceder directamente a las publicaciones de un país:

```php
// app/Models/Country.php
public function posts(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
{
    return $this->hasManyThrough(Post::class, User::class);
}
```

```php
$country = Country::find(1);
$posts = $country->posts; // Todas las publicaciones de usuarios de ese país
```

## Relaciones polimórficas: una introducción

Las relaciones polimórficas permiten que un modelo pertenezca a más de un tipo de modelo. Por ejemplo, una tabla `comments` que puede pertenecer tanto a `Post` como a `Video`:

```php
// app/Models/Comment.php
public function commentable(): \Illuminate\Database\Eloquent\Relations\MorphTo
{
    return $this->morphTo();
}

// app/Models/Post.php
public function comments(): \Illuminate\Database\Eloquent\Relations\MorphMany
{
    return $this->morphMany(Comment::class, 'commentable');
}
```

La tabla `comments` necesita dos columnas: `commentable_id` y `commentable_type`.

## Eager Loading: evita el problema N+1

El problema N+1 ocurre cuando cargas una colección de modelos y luego accedes a una relación en un bucle. Esto genera una consulta SQL por cada elemento de la colección.

```php
// MAL: genera N+1 consultas
$posts = Post::all(); // 1 consulta

foreach ($posts as $post) {
    echo $post->user->name; // 1 consulta por cada post = N consultas
}
```

Si tienes 100 publicaciones, esto ejecuta 101 consultas. La solución es el eager loading con `with()`:

```php
// BIEN: genera solo 2 consultas en total
$posts = Post::with('user')->get();

foreach ($posts as $post) {
    echo $post->user->name; // Sin consulta adicional
}
```

Puedes cargar múltiples relaciones y relaciones anidadas:

```php
// Múltiples relaciones
$users = User::with(['posts', 'profile'])->get();

// Relaciones anidadas
$users = User::with('posts.comments')->get();

// Con condiciones en la relación cargada
$users = User::with(['posts' => function ($query) {
    $query->where('status', 'published')->orderBy('created_at', 'desc');
}])->get();
```

## Lazy Loading vs Eager Loading

- **Lazy loading**: las relaciones se cargan cuando accedes a ellas por primera vez. Cómodo, pero puede causar N+1.
- **Eager loading**: cargas las relaciones desde el principio con `with()`. Requiere planificación, pero es mucho más eficiente.

En producción puedes activar el modo estricto para detectar lazy loading:

```php
// app/Providers/AppServiceProvider.php
use Illuminate\Database\Eloquent\Model;

public function boot(): void
{
    Model::preventLazyLoading(! app()->isProduction());
}
```

## withCount: contar registros relacionados

En lugar de cargar todos los modelos relacionados para contar, usa `withCount()`:

```php
$users = User::withCount('posts')->get();

foreach ($users as $user) {
    echo $user->posts_count; // Número de publicaciones sin cargarlas todas
}

// Combinar con condiciones
$users = User::withCount([
    'posts',
    'posts as published_posts_count' => function ($query) {
        $query->where('status', 'published');
    }
])->get();
```

## Accediendo a modelos relacionados

Crear registros relacionados directamente:

```php
$user = User::find(1);

// Crear y asociar en un paso
$post = $user->posts()->create([
    'title' => 'Mi primera publicación',
    'body'  => 'Contenido del artículo...',
]);

// Con save()
$post = new Post(['title' => 'Otro artículo', 'body' => '...']);
$user->posts()->save($post);
```

## Conclusión

Las relaciones Eloquent son el corazón de cualquier aplicación Laravel bien diseñada. Dominar `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` y `hasManyThrough` te va a ahorrar muchísimo tiempo y va a hacer tu código más limpio y mantenible. Y recuerda siempre usar eager loading con `with()` para evitar el problema N+1 que puede matar el rendimiento de tu aplicación.
