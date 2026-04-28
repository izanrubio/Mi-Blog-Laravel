---
title: 'Spatie Permission en Laravel: Control Roles y Permisos'
description: 'Guía completa sobre laravel-permission de Spatie. Implementa un sistema robusto de roles y permisos en tu aplicación Laravel con ejemplos prácticos.'
pubDate: '2026-04-28'
tags: ['laravel', 'seguridad', 'autorizacion', 'spatie']
---

## Spatie Permission en Laravel: Control Roles y Permisos

El control de acceso basado en roles y permisos es uno de los pilares fundamentales en cualquier aplicación web moderna. Si bien Laravel ofrece soluciones nativas como Gates y Policies, el paquete **laravel-permission** de Spatie se ha convertido en el estándar de facto para aplicaciones que requieren un sistema granular y flexible de autorización.

Con más de 93 millones de descargas en Packagist, este paquete es prácticamente imprescindible cuando necesitas gestionar múltiples roles, permisos complejos y relaciones entre usuarios y sus capacidades. En esta guía, aprenderás a implementarlo desde cero.

## ¿Por qué usar Spatie Permission?

Antes de profundizar en la implementación, es importante entender las ventajas que ofrece este paquete frente a otras alternativas:

### Ventajas principales

**Flexibilidad extrema**: Permite definir permisos y roles de forma dinámica, sin necesidad de modificar código.

**Gestión en base de datos**: Todos los roles y permisos se almacenan en la base de datos, facilitando cambios en tiempo de ejecución.

**Middleware integrado**: Proporciona middleware listo para proteger rutas basándose en roles y permisos.

**Caché automático**: Optimiza el rendimiento memorizando roles y permisos.

**Bloqueos de equipo**: Soporte para múltiples equipos en aplicaciones SaaS.

## Instalación y Configuración

### Paso 1: Instalar el paquete

```bash
composer require spatie/laravel-permission
```

### Paso 2: Publicar las migraciones

```bash
php artisan vendor:publish --provider="Spatie\Permission\PermissionServiceProvider"
```

Este comando crea las migraciones necesarias en tu carpeta `database/migrations`. Las tablas que se crearán son:

- `roles`: almacena los roles (admin, editor, viewer, etc.)
- `permissions`: almacena los permisos (create_posts, edit_posts, delete_posts, etc.)
- `role_has_permissions`: relación muchos-a-muchos entre roles y permisos
- `model_has_roles`: relación muchos-a-muchos entre usuarios y roles
- `model_has_permissions`: relación muchos-a-muchos entre usuarios y permisos directos

### Paso 3: Ejecutar las migraciones

```bash
php artisan migrate
```

### Paso 4: Configurar el modelo User

Modifica tu modelo `User` para que use los traits de Spatie:

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    use HasRoles;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];
}
```

El trait `HasRoles` automáticamente añade métodos para gestionar roles y permisos en el usuario.

## Crear Roles y Permisos

### Usando Seeders

La forma más común de crear roles y permisos es mediante seeders. Crea un nuevo seeder:

```bash
php artisan make:seeder RoleAndPermissionSeeder
```

Implementa el seeder de la siguiente manera:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleAndPermissionSeeder extends Seeder
{
    public function run(): void
    {
        // Limpiar la caché de permisos
        app()['cache']->forget('spatie.permission.cache');

        // Crear permisos
        $permissions = [
            'create_posts',
            'edit_posts',
            'delete_posts',
            'view_posts',
            'create_users',
            'edit_users',
            'delete_users',
            'view_users',
        ];

        foreach ($permissions as $permission) {
            Permission::create(['name' => $permission]);
        }

        // Crear roles
        $admin = Role::create(['name' => 'admin']);
        $editor = Role::create(['name' => 'editor']);
        $viewer = Role::create(['name' => 'viewer']);

        // Asignar permisos a roles
        $admin->givePermissionTo(Permission::all());

        $editor->givePermissionTo([
            'create_posts',
            'edit_posts',
            'view_posts',
            'view_users',
        ]);

        $viewer->givePermissionTo([
            'view_posts',
            'view_users',
        ]);
    }
}
```

Ejecuta el seeder:

```bash
php artisan db:seed --class=RoleAndPermissionSeeder
```

### Crear roles y permisos dinámicamente

También puedes crear roles y permisos en tiempo de ejecución, por ejemplo, en un comando o un panel administrativo:

```php
<?php

use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

// Crear un permiso
$permission = Permission::create(['name' => 'moderate_comments']);

// Crear un rol
$role = Role::create(['name' => 'moderator']);

// Asignar permiso a rol
$role->givePermissionTo($permission);

// O crear múltiples
$role->givePermissionTo(['create_posts', 'edit_posts', 'delete_posts']);
```

## Asignar Roles y Permisos a Usuarios

### Asignar roles

```php
<?php

use App\Models\User;

$user = User::find(1);

// Asignar un rol
$user->assignRole('editor');

// Asignar múltiples roles
$user->assignRole(['editor', 'viewer']);

// Sincronizar roles (reemplaza los existentes)
$user->syncRoles(['admin', 'editor']);

// Remover un rol
$user->removeRole('viewer');
```

### Asignar permisos directos

A veces necesitas dar permisos específicos a un usuario sin asignarle un rol completo:

```php
<?php

$user = User::find(1);

// Dar permiso directo
$user->givePermissionTo('create_posts');

// Dar múltiples permisos
$user->givePermissionTo(['create_posts', 'edit_posts']);

// Revocar permiso
$user->revokePermissionTo('delete_posts');

// Sincronizar permisos
$user->syncPermissions(['view_posts', 'create_posts']);
```

## Verificar Roles y Permisos

### En controladores

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PostController extends Controller
{
    public function store(Request $request)
    {
        // Verificar si el usuario tiene un permiso
        if (!$request->user()->can('create_posts')) {
            abort(403, 'No tienes permiso para crear posts');
        }

        // O de forma más concisa
        $this->authorize('create_posts');

        // Lógica para crear el post
    }

    public function edit(Request $request, $postId)
    {
        // Verificar si tiene un rol específico
        if ($request->user()->hasRole('admin')) {
            // Los admins pueden editar cualquier post
        } elseif ($request->user()->hasRole('editor')) {
            // Los editores solo ciertos posts
        }
    }
}
```

### En vistas Blade

```blade
@if (Auth::user()->hasPermissionTo('create_posts'))
    <a href="{{ route('posts.create') }}" class="btn btn-primary">
        Crear Post
    </a>
@endif

@if (Auth::user()->hasRole('admin'))
    <button class="btn btn-danger">Eliminar</button>
@endif

@can('delete_posts')
    <form method="POST" action="{{ route('posts.destroy', $post) }}">
        @csrf
        @method('DELETE')
        <button type="submit">Eliminar</button>
    </form>
@endcan
```

## Proteger Rutas con Middleware

Spatie proporciona middleware listo para proteger rutas basándose en roles y permisos.

### Registrar el middleware

En `bootstrap/app.php` (Laravel 11+):

```php
<?php

use Spatie\Permission\Middleware\PermissionMiddleware;
use Spatie\Permission\Middleware\RoleMiddleware;

return Application::configure(basePath: dirname(__DIR__))
    // ...
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'permission' => PermissionMiddleware::class,
        ]);
    })
    // ...
```

### Usar el middleware en rutas

```php
<?php

use Illuminate\Support\Facades\Route;

Route::middleware(['auth'])->group(function () {
    // Solo usuarios con rol 'admin'
    Route::get('/admin', function () {
        return 'Panel de administrador';
    })->middleware('role:admin');

    // Usuarios con permiso 'create_posts'
    Route::get('/posts/create', function () {
        return 'Crear post';
    })->middleware('permission:create_posts');

    // Múltiples roles (cualquiera de ellos)
    Route::get('/dashboard', function () {
        return 'Dashboard';
    })->middleware('role:admin|editor');

    // Múltiples permisos (todos requeridos)
    Route::post('/posts', function () {
        return 'Guardar post';
    })->middleware('permission:create_posts|edit_posts');
});
```

## Casos de Uso Avanzados

### Verificaciones en políticas (Policies)

Combina Spatie Permission con Laravel Policies para control más granular:

```php
<?php

namespace App\Policies;

use App\Models\Post;
use App\Models\User;

class PostPolicy
{
    public function update(User $user, Post $post): bool
    {
        // El admin puede editar cualquier post
        if ($user->hasRole('admin')) {
            return true;
        }

        // El usuario es el dueño y tiene permiso
        return $user->id === $post->user_id 
            && $user->hasPermissionTo('edit_posts');
    }

    public function delete(User $user, Post $post): bool
    {
        return $user->hasRole('admin') 
            || ($user->id === $post->user_id && $user->can('delete_posts'));
    }
}
```

Úsalo en tu controlador:

```php
<?php

$this->authorize('update', $post);
$this->authorize('delete', $post);
```

### Permisos condicionales basados en equipos

Para aplicaciones multi-tenant:

```php
<?php

namespace Database\Seeders;

use Spatie\Permission\Models\Role;

class RoleAndPermissionSeeder
{
    public function run(): void
    {
        // Crear roles con soporte para equipos
        Role::create([
            'name' => 'team-admin',
            'team_id' => 1,
        ]);

        Role::create([
            'name' => 'team-member',
            'team_id' => 1,
        ]);
    }
}
```

### Caché y rendimiento

Spatie Permission automáticamente cachea roles y permisos. Si realizas cambios dinámicos, limpia la caché:

```php
<?php

// Limpiar toda la caché de permisos
app()['cache']->forget('spatie.permission.cache');

// O usar el helper
cache()->forget('spatie.permission.cache');

// También se limpia automáticamente cuando modificas roles/permisos
$user->assignRole('editor'); // Caché se limpia automáticamente
```

## Mejor Integración con Controladores

Crea un trait reutilizable para verificaciones comunes:

```php
<?php

namespace App\Traits;

use Illuminate\Http\Response;

trait AuthorizesWithPermission
{
    protected function authorizePermission(string $permission): void
    {
        if (!auth()->user()->hasPermissionTo($permission)) {
            abort(Response::HTTP_FORBIDDEN);
        }
    }

    protected function authorizeRole(string|array $roles): void
    {
        if (!auth()->user()->hasAnyRole($roles)) {
            abort(Response::HTTP_FORBIDDEN);
        }
    }
}
```

Úsalo en tus controladores:

```php
<?php

namespace App\Http\Controllers;

use App\Traits\AuthorizesWithPermission;

class PostController extends Controller
{
    use AuthorizesWithPermission;

    public function store(Request $request)
    {
        $this->authorizePermission('create_posts');
        
        // Tu lógica aquí
    }
}
```

## Puntos Clave

- **Spatie Permission** es el paquete estándar para gestionar roles y permisos en Laravel con más de 93 millones de descargas
- La instalación es simple: `composer require spatie/laravel-permission` seguida de migraciones
- Los permisos y roles se almacenan en la base de datos, permitiendo cambios dinámicos sin modificar código
- Usa seeders para inicializar roles y permisos en el deploy
- El middleware `role` y `permission` protege rutas de forma declarativa
- Combina con Laravel Policies para lógica de autorización más compleja
- El trait `HasRoles` en tus modelos proporciona métodos como `hasPermissionTo()`, `hasRole()`, `can()`
- La caché se gestiona automáticamente, pero puedes limpiarla manualmente si necesitas
- Soporta equipos/multi-tenancy para aplicaciones SaaS
- Las vistas Blade integran directivas como `@can`, `@role` para mostrar contenido condicionalmente
- Verifica permisos en controladores, vistas, políticas y middleware según sea necesario
- Crea traits reutilizables para reducir código duplicado en tus controladores