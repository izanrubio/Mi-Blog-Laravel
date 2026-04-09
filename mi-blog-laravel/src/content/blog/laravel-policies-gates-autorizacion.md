---
title: 'Cómo usar Policies y Gates para autorización en Laravel'
description: 'Aprende a implementar autorización en Laravel con Policies y Gates: diferencias, cuándo usar cada uno y cómo integrarlos en controladores y Blade.'
pubDate: '2024-03-21'
tags: ['laravel', 'autorizacion', 'policies', 'gates', 'seguridad']
---

Autenticación y autorización son conceptos diferentes que se confunden frecuentemente. La **autenticación** responde "¿quién eres?". La **autorización** responde "¿qué puedes hacer?". Laravel tiene dos herramientas para la autorización: Gates y Policies. Vamos a ver cómo usarlas correctamente.

## Gates: autorización simple basada en closures

Los Gates son closures que definen si un usuario puede realizar una acción específica. Son perfectos para acciones generales que no pertenecen a un modelo específico.

```php
// app/Providers/AppServiceProvider.php

use Illuminate\Support\Facades\Gate;

public function boot(): void
{
    // Un admin puede hacer cualquier cosa
    Gate::before(function (User $user, string $ability) {
        if ($user->isAdmin()) {
            return true; // Saltarse todas las demás comprobaciones
        }
    });

    // Gate simple: ¿puede el usuario acceder al panel de administración?
    Gate::define('access-admin-panel', function (User $user) {
        return $user->role === 'admin' || $user->role === 'moderator';
    });

    // Gate con recurso: ¿puede el usuario ver estadísticas de este equipo?
    Gate::define('view-team-stats', function (User $user, Team $team) {
        return $user->teams->contains($team) || $user->isAdmin();
    });
}
```

### Usar Gates

```php
// En un controlador
public function adminPanel()
{
    // Opción 1: authorize() lanza excepción 403 si no tiene permiso
    Gate::authorize('access-admin-panel');
    
    // Opción 2: allows() / denies() devuelve booleano
    if (Gate::denies('access-admin-panel')) {
        abort(403, 'No tienes acceso al panel de administración');
    }
    
    // Opción 3: check() para múltiples gates
    if (Gate::any(['access-admin-panel', 'moderator-panel'])) {
        // El usuario tiene al menos uno de los permisos
    }
    
    return view('admin.dashboard');
}

// En el Request object
if ($request->user()->can('access-admin-panel')) {
    // ...
}

if ($request->user()->cannot('access-admin-panel')) {
    abort(403);
}
```

### En Blade

```blade
@can('access-admin-panel')
    <a href="/admin">Panel de Admin</a>
@endcan

@cannot('access-admin-panel')
    <p>No tienes acceso al panel de administración.</p>
@endcannot

@can('view-team-stats', $team)
    <div>Estadísticas del equipo...</div>
@endcan
```

## Policies: autorización basada en modelos

Las Policies son clases dedicadas a la autorización de un modelo específico. Son más organizadas y reutilizables que los Gates cuando la autorización está relacionada con operaciones CRUD sobre un modelo.

### Crear una Policy

```bash
php artisan make:policy PostPolicy --model=Post
```

```php
<?php

namespace App\Policies;

use App\Models\Post;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class PostPolicy
{
    /**
     * El método before() se ejecuta antes que cualquier otro.
     * Si devuelve true/false, el resultado se usa directamente.
     * Si devuelve null, se continúa con el método específico.
     */
    public function before(User $user, string $ability): bool|null
    {
        // Los admins pueden hacer todo con posts
        if ($user->isAdmin()) {
            return true;
        }
        
        return null; // Continuar con los métodos específicos
    }

    /**
     * ¿Puede el usuario ver la lista de posts?
     */
    public function viewAny(User $user): bool
    {
        return true; // Cualquier usuario autenticado
    }

    /**
     * ¿Puede el usuario ver este post?
     */
    public function view(User $user, Post $post): bool
    {
        // Posts publicados: cualquiera puede verlos
        // Posts borradores: solo el autor
        return $post->is_published || $user->id === $post->user_id;
    }

    /**
     * ¿Puede el usuario crear posts?
     */
    public function create(User $user): bool
    {
        return $user->hasVerifiedEmail() && $user->is_active;
    }

    /**
     * ¿Puede el usuario editar este post?
     */
    public function update(User $user, Post $post): bool
    {
        // Solo el autor puede editar
        return $user->id === $post->user_id;
    }

    /**
     * ¿Puede el usuario eliminar este post?
     */
    public function delete(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    /**
     * ¿Puede el usuario restaurar un post eliminado (soft delete)?
     */
    public function restore(User $user, Post $post): bool
    {
        return $user->id === $post->user_id;
    }

    /**
     * ¿Puede el usuario eliminar permanentemente el post?
     */
    public function forceDelete(User $user, Post $post): bool
    {
        return $user->isAdmin();
    }
    
    /**
     * Devolver una respuesta con mensaje personalizado en lugar de booleano
     */
    public function publish(User $user, Post $post): Response
    {
        if ($user->id !== $post->user_id) {
            return Response::deny('Solo el autor puede publicar este post.');
        }
        
        if ($post->is_published) {
            return Response::deny('Este post ya está publicado.');
        }
        
        return Response::allow();
    }
}
```

### Registrar la Policy

Laravel auto-descubre policies que siguen la convención `ModelPolicy` en `App\Policies`. Si sigues la convención, no necesitas registrarla manualmente.

Para registros manuales (en `AppServiceProvider`):

```php
use App\Models\Post;
use App\Policies\PostPolicy;

public function boot(): void
{
    Gate::policy(Post::class, PostPolicy::class);
}
```

### Usar Policies en controladores

```php
// app/Http/Controllers/PostController.php

public function show(Post $post)
{
    // Lanza AuthorizationException (403) si no tiene permiso
    $this->authorize('view', $post);
    
    return view('posts.show', compact('post'));
}

public function edit(Post $post)
{
    $this->authorize('update', $post);
    
    return view('posts.edit', compact('post'));
}

public function update(Request $request, Post $post)
{
    $this->authorize('update', $post);
    
    $post->update($request->validated());
    
    return redirect()->route('posts.show', $post)
                     ->with('success', 'Post actualizado correctamente');
}

public function create()
{
    // Para métodos sin modelo específico
    $this->authorize('create', Post::class);
    
    return view('posts.create');
}
```

### Autorización masiva con authorizeResource()

En el constructor del controlador, puedes aplicar la Policy a todos los métodos de un recurso a la vez:

```php
class PostController extends Controller
{
    public function __construct()
    {
        // Aplica automáticamente la PostPolicy a todos los métodos:
        // index → viewAny, show → view, create/store → create,
        // edit/update → update, destroy → delete
        $this->authorizeResource(Post::class, 'post');
    }
    
    // Todos los métodos ya tienen autorización aplicada
    public function index() { /* ... */ }
    public function show(Post $post) { /* ... */ }
    public function store(Request $request) { /* ... */ }
    // ...
}
```

### En Blade con Policies

```blade
{{-- Usando el nombre de la acción de la policy --}}
@can('update', $post)
    <a href="{{ route('posts.edit', $post) }}">Editar</a>
@endcan

@can('delete', $post)
    <form action="{{ route('posts.destroy', $post) }}" method="POST">
        @csrf @method('DELETE')
        <button type="submit">Eliminar</button>
    </form>
@endcan

@can('create', App\Models\Post::class)
    <a href="{{ route('posts.create') }}">Nuevo Post</a>
@endcan
```

## Cuándo usar Gates vs Policies

La regla es simple:

- **Gates:** para acciones que no pertenecen a un modelo (acceso al admin panel, ver reportes globales, exportar datos)
- **Policies:** para acciones CRUD sobre un modelo específico (ver, crear, editar, eliminar posts, comentarios, etc.)

```php
// Gate: acción general
Gate::define('export-all-users', fn(User $u) => $u->isAdmin());

// Policy: acción sobre un modelo
// PostPolicy::delete(User $user, Post $post): bool
```

## Conclusión

Las Policies y Gates de Laravel te dan un sistema de autorización limpio y centralizado. Evitan que tengas lógica de autorización esparcida por controladores, vistas y middleware. Define las Policies para tus modelos Eloquent usando `php artisan make:policy`, usa `$this->authorize()` en los controladores, y `@can` en Blade. Con el método `before()` de las Policies, los administradores pueden tener acceso total sin duplicar lógica en cada método.
