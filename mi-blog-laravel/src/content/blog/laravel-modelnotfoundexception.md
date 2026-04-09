---
title: 'ModelNotFoundException en Laravel — Causas y soluciones'
description: 'Entiende y maneja el ModelNotFoundException en Laravel: diferencia entre find() y findOrFail(), route model binding y personalización de la respuesta 404.'
pubDate: '2024-03-09'
tags: ['laravel', 'errores', 'eloquent', 'orm']
---

`Illuminate\Database\Eloquent\ModelNotFoundException: No query results for model [App\Models\Post] 1`. Esta excepción aparece cuando intentas obtener un registro de la base de datos que no existe. Entender cuándo y por qué se lanza, y cómo manejarla correctamente, es fundamental para construir aplicaciones Laravel robustas.

## find() vs findOrFail(): la diferencia clave

Aquí está la raíz de la mayoría de confusiones:

```php
// find(): devuelve null si no encuentra el registro
$post = Post::find(999);
// $post es null si el id 999 no existe

// Si luego intentas acceder a una propiedad de null:
echo $post->title; // PHP Error: Trying to get property of non-object

// findOrFail(): lanza ModelNotFoundException si no encuentra el registro
$post = Post::findOrFail(999);
// Lanza ModelNotFoundException automáticamente
// Laravel convierte esto en una respuesta 404
```

La ventaja de `findOrFail()` es que Laravel automáticamente convierte la `ModelNotFoundException` en una respuesta 404, que es exactamente lo que quieres cuando un usuario intenta acceder a un recurso que no existe.

## Todos los métodos que pueden lanzar ModelNotFoundException

```php
// findOrFail($id): busca por clave primaria
$post = Post::findOrFail(1);

// firstOrFail(): obtiene el primer resultado o lanza excepción
$post = Post::where('slug', 'mi-articulo')->firstOrFail();

// findOrFail con múltiples IDs
$posts = Post::findOrFail([1, 2, 3]); 
// Lanza excepción si ALGUNO de los IDs no existe

// sole(): lanza excepción si hay 0 o más de 1 resultado
$post = Post::where('slug', 'mi-articulo')->sole();
```

## firstOr() y findOr(): alternativas con fallback

En lugar de lanzar una excepción, puedes proporcionar un valor por defecto:

```php
// findOr(): ejecuta un callback si no encuentra el registro
$post = Post::findOr(999, function () {
    return new Post(['title' => 'Post por defecto']);
});

// firstOr(): similar pero con where()
$user = User::where('email', $email)->firstOr(function () use ($email) {
    // Crear el usuario si no existe
    return User::create([
        'email'    => $email,
        'name'     => 'Usuario nuevo',
        'password' => bcrypt(Str::random(16)),
    ]);
});
```

## Route Model Binding automático

Laravel tiene una característica muy útil llamada **Route Model Binding** que automáticamente inyecta el modelo en el controlador basándose en el parámetro de la ruta:

```php
// routes/web.php
Route::get('/posts/{post}', [PostController::class, 'show']);
// El {post} se resolverá automáticamente buscando Post::findOrFail($post)
```

```php
// app/Http/Controllers/PostController.php
public function show(Post $post)
{
    // $post ya es el objeto Post cargado desde la BD
    // Si el ID no existe, Laravel devuelve 404 automáticamente
    return view('posts.show', compact('post'));
}
```

Laravel hace el `findOrFail()` automáticamente. Si no encuentra el modelo, devuelve un 404.

### Personalizar la columna de búsqueda

Por defecto, Laravel busca por la clave primaria (`id`). Para buscar por otra columna:

```php
// En el modelo, definir la columna de route binding
public function getRouteKeyName(): string
{
    return 'slug'; // Buscar por slug en lugar de id
}
```

Ahora con la ruta `/posts/{post}`, Laravel buscará `Post::where('slug', $post)->firstOrFail()`.

O puedes especificarlo directamente en la ruta:

```php
// Sintaxis de Laravel 8+: {model:columna}
Route::get('/posts/{post:slug}', [PostController::class, 'show']);
```

## Manejar ModelNotFoundException globalmente

En Laravel 11, puedes registrar manejadores de excepciones en `bootstrap/app.php`:

```php
// bootstrap/app.php
use Illuminate\Database\Eloquent\ModelNotFoundException;

->withExceptions(function (Exceptions $exceptions) {
    $exceptions->render(function (ModelNotFoundException $e, Request $request) {
        // Para APIs, devolver JSON
        if ($request->expectsJson()) {
            return response()->json([
                'error'   => 'Recurso no encontrado',
                'message' => 'El recurso solicitado no existe.',
            ], 404);
        }
        
        // Para web, devolver vista 404 personalizada
        return response()->view('errors.404', [], 404);
    });
})
```

En Laravel 10 y anteriores, en `app/Exceptions/Handler.php`:

```php
use Illuminate\Database\Eloquent\ModelNotFoundException;

public function register(): void
{
    $this->renderable(function (ModelNotFoundException $e, Request $request) {
        if ($request->expectsJson()) {
            return response()->json([
                'error'   => 'Recurso no encontrado',
                'message' => 'El elemento solicitado no existe o fue eliminado.',
            ], 404);
        }
    });
}
```

## Respuestas 404 personalizadas para APIs

En una API REST, quieres devolver JSON consistente cuando no se encuentra un recurso:

```php
// app/Http/Controllers/PostController.php

public function show(int $id)
{
    $post = Post::with('user', 'tags')->findOrFail($id);
    
    return new PostResource($post);
}

// Si $id no existe, findOrFail lanza ModelNotFoundException
// El handler global la convierte en una respuesta JSON 404
```

Para hacer esto más explícito en el controlador sin depender del handler global:

```php
public function show(int $id)
{
    $post = Post::find($id);
    
    if (!$post) {
        return response()->json([
            'error' => "Post con id {$id} no encontrado"
        ], 404);
    }
    
    return new PostResource($post);
}
```

Ambos enfoques son válidos. El primero (con `findOrFail` y handler global) es más limpio y consistente. El segundo es más explícito.

## Soft deletes y ModelNotFoundException

Con soft deletes, los registros "eliminados" siguen en la BD pero con `deleted_at` no nulo. `findOrFail` no los encuentra:

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;
}
```

```php
// El post tiene deleted_at = '2024-01-01'
$post = Post::findOrFail(1);
// Lanza ModelNotFoundException aunque el registro existe (está soft-deleted)

// Para incluir los soft-deleted en la búsqueda:
$post = Post::withTrashed()->findOrFail(1);

// Solo los soft-deleted:
$post = Post::onlyTrashed()->findOrFail(1);

// Restaurar un soft-deleted:
$post->restore();
```

## El mensaje de error: cómo leerlo

```
No query results for model [App\Models\Post] 1
```

- `App\Models\Post`: el modelo que intentaste buscar
- `1`: el valor que usaste para buscar (el ID en este caso)

Si el mensaje muestra el ID correcto pero dices que el registro existe, verifica:
1. ¿Estás conectado a la base de datos correcta?
2. ¿El modelo usa soft deletes y el registro está eliminado?
3. ¿Hay una cláusula `where` adicional que excluye el registro?

## Conclusión

La `ModelNotFoundException` es tu aliada: te dice explícitamente que un registro no existe, en lugar de dejar que `null` se propague silenciosamente por tu código causando errores más confusos. Usa `findOrFail()` y `firstOrFail()` consistentemente, configura Route Model Binding donde sea posible, y registra un handler global para devolver respuestas 404 consistentes en tu API.
