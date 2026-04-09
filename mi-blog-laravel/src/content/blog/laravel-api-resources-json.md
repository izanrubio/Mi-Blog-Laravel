---
title: 'API Resources en Laravel — Cómo formatear respuestas JSON'
description: 'Aprende a usar API Resources en Laravel para transformar tus modelos Eloquent en respuestas JSON limpias y consistentes con campos personalizados y colecciones.'
pubDate: '2026-04-09'
tags: ['laravel', 'api', 'resources', 'json']
---

Cuando construyes una API con Laravel, uno de los errores más comunes es devolver directamente el modelo Eloquent como JSON. Eso expone la estructura interna de tu base de datos, puede filtrar campos sensibles y hace difícil versionar la API. Los API Resources son la solución.

## El problema de devolver modelos directamente

```php
// MAL: devolver el modelo directamente
public function show(User $user)
{
    return response()->json($user);
    // Devuelve TODOS los campos del modelo,
    // incluyendo password, remember_token, etc.
}

// Resultado:
// {
//     "id": 1,
//     "name": "Juan",
//     "email": "juan@example.com",
//     "password": "$2y$10$...",        ← PROBLEMA: campo sensible
//     "remember_token": "...",         ← PROBLEMA: campo interno
//     "email_verified_at": "...",
//     "created_at": "2024-01-01...",
//     "updated_at": "2024-01-01..."    ← Formato feo, exposición interna
// }
```

## Crear un API Resource

```bash
php artisan make:resource UserResource
```

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    /**
     * Transforma el modelo en un array para la respuesta JSON.
     */
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'avatar_url' => $this->avatar
                                ? Storage::url($this->avatar)
                                : asset('images/default-avatar.png'),
            'joined_at'  => $this->created_at->format('d/m/Y'),
            'is_admin'   => $this->is_admin,
            
            // Campos calculados
            'posts_count' => $this->whenCounted('posts'),
            
            // Relaciones condicionales (solo si están cargadas)
            'posts'       => PostResource::collection($this->whenLoaded('posts')),
        ];
    }
}
```

```php
// Uso en el controlador
public function show(User $user)
{
    return new UserResource($user);
    // Devuelve exactamente los campos que definiste, nada más
}

// Resultado:
// {
//     "data": {
//         "id": 1,
//         "name": "Juan",
//         "email": "juan@example.com",
//         "avatar_url": "https://...",
//         "joined_at": "01/01/2024",
//         "is_admin": false
//     }
// }
```

## Campos condicionales: when()

El método `when()` incluye un campo solo si la condición es verdadera:

```php
public function toArray(Request $request): array
{
    return [
        'id'    => $this->id,
        'name'  => $this->name,
        'email' => $this->email,
        
        // Solo incluir si el usuario autenticado es admin
        'internal_notes' => $this->when(
            $request->user()?->isAdmin(),
            $this->internal_notes
        ),
        
        // Incluir solo si el campo no es null
        'bio' => $this->when(
            !is_null($this->bio),
            $this->bio
        ),
        
        // Con valor alternativo si la condición es false
        'subscription_status' => $this->when(
            $this->subscription !== null,
            fn() => $this->subscription->status,
            'no_subscription'  // Valor si la condición es false
        ),
    ];
}
```

## Relaciones condicionales: whenLoaded()

`whenLoaded()` incluye la relación solo si ya fue cargada con `with()`, evitando el problema N+1:

```php
public function toArray(Request $request): array
{
    return [
        'id'      => $this->id,
        'title'   => $this->title,
        'content' => $this->content,
        
        // Solo si fue cargado con with('user')
        'author' => new UserResource($this->whenLoaded('user')),
        
        // Solo si fue cargado con with('tags')
        'tags' => TagResource::collection($this->whenLoaded('tags')),
        
        // Solo si fue cargado con with('comments')
        'comments'       => CommentResource::collection($this->whenLoaded('comments')),
        'comments_count' => $this->whenCounted('comments'),
    ];
}
```

```php
// En el controlador, controlas qué se carga
public function show(Post $post)
{
    // Cargar solo lo necesario para esta ruta
    $post->load(['user:id,name,avatar', 'tags', 'comments.user']);
    $post->loadCount('comments');
    
    return new PostResource($post);
}

public function index()
{
    // Para el listado, menos datos
    $posts = Post::with(['user:id,name'])->withCount('comments')->paginate(15);
    
    return PostResource::collection($posts);
    // 'tags' y 'comments' no serán incluidos porque no fueron cargados
}
```

## Resource Collections

Para colecciones de recursos, tienes dos opciones:

```php
// Opción 1: Usar ::collection() directamente (más simple)
return PostResource::collection(Post::paginate(15));

// Opción 2: Crear una clase Collection dedicada (más control)
php artisan make:resource PostCollection
```

```php
// app/Http/Resources/PostCollection.php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class PostCollection extends ResourceCollection
{
    // Especificar qué Resource usar para cada item
    public $collects = PostResource::class;
    
    public function toArray(Request $request): array
    {
        return [
            'data' => $this->collection,
            // Metadata adicional de la colección
        ];
    }
    
    // Añadir metadata a la respuesta paginada
    public function with(Request $request): array
    {
        return [
            'meta' => [
                'version'    => '1.0',
                'generated_at' => now()->toIso8601String(),
            ],
        ];
    }
}
```

## Paginación automática

Cuando pasas un objeto paginado a un Resource, Laravel automáticamente incluye los links de paginación:

```php
public function index()
{
    $posts = Post::with('user')->paginate(15);
    
    return PostResource::collection($posts);
}

// Resultado JSON:
// {
//     "data": [...],
//     "links": {
//         "first": "https://api.example.com/posts?page=1",
//         "last": "https://api.example.com/posts?page=5",
//         "prev": null,
//         "next": "https://api.example.com/posts?page=2"
//     },
//     "meta": {
//         "current_page": 1,
//         "from": 1,
//         "last_page": 5,
//         "per_page": 15,
//         "to": 15,
//         "total": 73
//     }
// }
```

## Añadir metadata: withCount() y datos extra

```php
public function toArray(Request $request): array
{
    return [
        'id'             => $this->id,
        'title'          => $this->title,
        
        // $this->whenCounted() para conteos con withCount()
        'comments_count' => $this->whenCounted('comments'),
        'likes_count'    => $this->whenCounted('likes'),
        
        // Datos calculados
        'reading_time_minutes' => $this->getReadingTime(),
        
        // Estado dinámico
        'is_liked_by_me' => $this->when(
            $request->user() !== null,
            fn() => $this->likes()->where('user_id', $request->user()->id)->exists()
        ),
    ];
}

private function getReadingTime(): int
{
    $wordCount = str_word_count(strip_tags($this->content));
    return (int) ceil($wordCount / 200); // 200 palabras por minuto
}
```

## Ejemplo completo: UserResource con relaciones

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'         => $this->id,
            'name'       => $this->name,
            'email'      => $this->email,
            'avatar'     => $this->avatarUrl(),
            'role'       => $this->role,
            'joined_at'  => $this->created_at->toIso8601String(),
            
            // Solo para admins viendo otros usuarios
            'last_login_at' => $this->when(
                $request->user()?->isAdmin() && $request->user()->id !== $this->id,
                $this->last_login_at?->toIso8601String()
            ),
            
            // Conteos
            'posts_count'    => $this->whenCounted('posts'),
            'comments_count' => $this->whenCounted('comments'),
            
            // Relaciones
            'posts'   => PostResource::collection($this->whenLoaded('posts')),
            'profile' => new ProfileResource($this->whenLoaded('profile')),
        ];
    }
    
    private function avatarUrl(): string
    {
        return $this->avatar
            ? \Storage::disk('public')->url($this->avatar)
            : "https://ui-avatars.com/api/?name=" . urlencode($this->name);
    }
}
```

## Eliminar el wrapper "data"

Por defecto, los resources envuelven la respuesta en un objeto `data`. Puedes eliminar esto:

```php
// Para un Resource individual (usa merge en el nivel del response)
public function show(User $user)
{
    return (new UserResource($user))->response()->setStatusCode(200);
}

// Para eliminar el wrapper globalmente (solo si realmente lo necesitas)
// En AppServiceProvider::boot()
JsonResource::withoutWrapping();
```

Normalmente es mejor mantener el wrapper `data` ya que deja espacio para añadir metadata al mismo nivel.

## Conclusión

Los API Resources son esenciales para construir APIs Laravel profesionales. Te dan control total sobre qué datos expones, en qué formato y bajo qué condiciones. Usa `when()` para campos condicionales, `whenLoaded()` para evitar el N+1 en relaciones, y colecciones paginadas automáticamente. Con recursos bien definidos, tu API tiene una forma consistente y predecible que es mucho más fácil de consumir desde el frontend.
