---
title: 'Atributos de Control en Laravel: Middleware con Decoradores PHP'
description: 'Aprende a usar atributos PHP para aplicar middleware en controladores. Guía completa con ejemplos de autenticación, autorización y validación.'
pubDate: '2026-04-19'
tags: ['laravel', 'middleware', 'atributos', 'php', 'seguridad']
---

## Introducción

Los atributos PHP (introducidos en PHP 8.0) revolucionaron la forma en que escribimos código decorativo en Laravel. A partir de **Laravel 13**, el framework ofrece soporte nativo para aplicar middleware directamente en controladores utilizando atributos, eliminando la necesidad de registrar middleware en métodos `__construct()` o en las rutas.

Esta característica simplifica significativamente el código, hace que sea más legible y permite una mejor reutilización de lógica de seguridad y validación. En este artículo aprenderás cómo funcionan estos atributos de control, cómo crearlos personalizados y cómo integrarlos en tu aplicación Laravel.

## ¿Qué son los Atributos de Control?

Los atributos de control son decoradores PHP que se aplican directamente en los métodos de tus controladores. Permiten declarar qué middleware debe ejecutarse antes de que tu acción de controlador se procese, todo sin tocar las rutas ni el constructor del controlador.

### Ventajas de usar atributos de control

```php
// ❌ Forma antigua - en __construct()
class PostController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
        $this->middleware('verified')->only(['store', 'update']);
    }
}

// ✅ Forma nueva - con atributos
class PostController extends Controller
{
    #[Middleware('auth')]
    #[Middleware('verified')]
    public function store(Request $request)
    {
        // Aquí sabes exactamente qué middleware se aplica
    }
}
```

**Ventajas claras:**
- El middleware se ve donde se usa
- Mejor organización para acciones específicas
- Fácil de debuggear
- Código más mantenible

## Usando Atributos Nativos de Laravel

Laravel proporciona varios atributos built-in para casos comunes. El más importante es `Middleware`.

### El Atributo Middleware

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    #[Middleware('auth')]
    public function create()
    {
        return view('products.create');
    }

    #[Middleware('auth')]
    #[Middleware('verified')]
    public function store(Request $request)
    {
        // Solo usuarios autenticados y verificados
        Product::create($request->validated());
    }

    #[Middleware('throttle:60,1')]
    public function index()
    {
        // Máximo 60 requests por minuto
        return Product::paginate();
    }
}
```

### Aplicar Middleware a Múltiples Métodos

Para aplicar el mismo middleware a varios métodos sin repetir código, usa el atributo en la clase:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\Middleware;

#[Middleware('auth')]
class AdminController extends Controller
{
    public function dashboard()
    {
        // Requiere autenticación
    }

    public function settings()
    {
        // También requiere autenticación
    }

    #[Middleware('admin')] // Middleware adicional
    public function deleteUser($id)
    {
        // Requiere auth Y admin
    }
}
```

## Creando Atributos Personalizados

A menudo necesitarás crear tus propios atributos para lógica específica de tu aplicación.

### Estructura de un Atributo Personalizado

```php
<?php

namespace App\Http\Middleware\Attributes;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS)]
class EnsureUserIsAdmin
{
    public function __construct(
        private string $role = 'admin'
    ) {}

    public function getRole(): string
    {
        return $this->role;
    }
}
```

### Implementar el Middleware que lo Procesa

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Http\Middleware\Attributes\EnsureUserIsAdmin;

class ProcessAdminAttribute
{
    public function handle(Request $request, Closure $next)
    {
        $controller = $request->route()->getController();
        $method = $request->route()->getActionMethod();

        // Obtener atributos del método
        $reflection = new \ReflectionMethod($controller, $method);
        $attributes = $reflection->getAttributes(EnsureUserIsAdmin::class);

        if (count($attributes) > 0) {
            $attribute = $attributes[0]->newInstance();
            
            if (!auth()->check() || !auth()->user()->hasRole($attribute->getRole())) {
                abort(403, 'No tienes permiso para acceder aquí');
            }
        }

        return $next($request);
    }
}
```

### Usar el Atributo en tu Controlador

```php
<?php

namespace App\Http\Controllers;

use App\Http\Middleware\Attributes\EnsureUserIsAdmin;

class UserController extends Controller
{
    #[EnsureUserIsAdmin('super_admin')]
    public function destroy($id)
    {
        User::find($id)->delete();
        return redirect()->back()->with('success', 'Usuario eliminado');
    }

    #[EnsureUserIsAdmin('moderator')]
    public function ban($id)
    {
        User::find($id)->update(['banned' => true]);
    }
}
```

## Ejemplo Completo: Sistema de Permisos con Atributos

Veamos un ejemplo realista usando `spatie/laravel-permission`:

### 1. Crear el Atributo

```php
<?php

namespace App\Http\Middleware\Attributes;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
class RequirePermission
{
    public function __construct(
        private string|array $permissions
    ) {}

    public function getPermissions(): array
    {
        return is_array($this->permissions) 
            ? $this->permissions 
            : [$this->permissions];
    }
}
```

### 2. Crear el Middleware que Procesa

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Http\Middleware\Attributes\RequirePermission;
use ReflectionMethod;

class CheckPermissionAttribute
{
    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        if (!$route) return $next($request);

        $controller = $route->getController();
        $method = $route->getActionMethod();

        $reflection = new ReflectionMethod($controller, $method);
        $attributes = $reflection->getAttributes(RequirePermission::class);

        foreach ($attributes as $attr) {
            $attribute = $attr->newInstance();
            $permissions = $attribute->getPermissions();

            if (!auth()->check()) {
                abort(401);
            }

            $user = auth()->user();
            foreach ($permissions as $permission) {
                if (!$user->can($permission)) {
                    abort(403, "No tienes el permiso: $permission");
                }
            }
        }

        return $next($request);
    }
}
```

### 3. Registrar en el Kernel

```php
<?php

namespace App\Http;

use Illuminate\Foundation\Http\Kernel as HttpKernel;

class Kernel extends HttpKernel
{
    protected $middleware = [
        // ... otros middleware
        \App\Http\Middleware\CheckPermissionAttribute::class,
    ];
}
```

### 4. Usar en Controladores

```php
<?php

namespace App\Http\Controllers;

use App\Http\Middleware\Attributes\RequirePermission;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index()
    {
        // Sin restricciones
        return Post::paginate();
    }

    #[RequirePermission('create posts')]
    public function create()
    {
        return view('posts.create');
    }

    #[RequirePermission('create posts')]
    public function store(Request $request)
    {
        Post::create($request->validated());
    }

    #[RequirePermission(['edit posts', 'view posts'])]
    public function edit(Post $post)
    {
        return view('posts.edit', compact('post'));
    }

    #[RequirePermission('delete posts')]
    public function destroy(Post $post)
    {
        $post->delete();
        return redirect()->back();
    }
}
```

## Atributos Avanzados: Rate Limiting

Aquí combinamos un atributo personalizado con funcionalidad nativa de Laravel:

```php
<?php

namespace App\Http\Middleware\Attributes;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD)]
class RateLimit
{
    public function __construct(
        private int $requests,
        private int $minutes
    ) {}

    public function getKey(): string
    {
        return $this->requests . ',' . $this->minutes;
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Http\Middleware\Attributes\RateLimit;

class ApiController extends Controller
{
    #[RateLimit(100, 1)] // 100 requests por minuto
    public function search(Request $request)
    {
        $query = $request->input('q');
        return Product::where('name', 'like', "%$query%")
            ->limit(50)
            ->get();
    }

    #[RateLimit(10, 1)] // 10 requests por minuto - más restrictivo
    public function export(Request $request)
    {
        return Excel::download(
            new ProductsExport(),
            'products.xlsx'
        );
    }
}
```

## Debugging de Atributos

Es importante saber cómo debuggear cuando algo no funciona:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use ReflectionMethod;

class DebugAttributeMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $route = $request->route();
        if ($route) {
            $controller = $route->getController();
            $method = $route->getActionMethod();
            
            $reflection = new ReflectionMethod($controller, $method);
            $attributes = $reflection->getAttributes();

            logger()->debug('Atributos detectados:', [
                'ruta' => $route->uri,
                'controlador' => get_class($controller),
                'método' => $method,
                'atributos' => array_map(
                    fn($attr) => $attr->getName(),
                    $attributes
                )
            ]);
        }

        return $next($request);
    }
}
```

## Mejores Prácticas

### 1. Nombra tus atributos claramente

```php
// ✅ Bueno
#[RequirePermission('edit posts')]
#[RequireRole('admin')]
#[RateLimit(60, 1)]

// ❌ Evitar
#[CheckPerms('edit posts')]
#[Auth('admin')]
```

### 2. Usa namespaces apropiados

```php
// Agrupar atributos relacionados
App\Http\Middleware\Attributes\
├── RequirePermission.php
├── RequireRole.php
├── RateLimit.php
└── ValidateJson.php
```

### 3. Documenta tus atributos

```php
/**
 * Require a specific permission to access this method.
 * 
 * @param string|array $permissions La(s) permisión(es) requerida(s)
 * 
 * @example
 * #[RequirePermission('edit posts')]
 * #[RequirePermission(['edit posts', 'publish posts'])]
 */
#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS | Attribute::IS_REPEATABLE)]
class RequirePermission
{
    // ...
}
```

### 4. Combina con políticas de Laravel

```php
#[Authorize('view', Post::class)]
public function show(Post $post)
{
    return view('posts.show', compact('post'));
}
```

## Comparativa: Atributos vs Otras Aproximaciones

```php
// ❌ En rutas (poco mantenible)
Route::post('/posts', [PostController::class, 'store'])
    ->middleware('auth')
    ->middleware('verified');

// ⚠️ En __construct() (válido pero menos visible)
public function __construct()
{
    $this->middleware('auth');
}

// ✅ Con atributos (claro y mantenible)
#[Middleware('auth')]
#[Middleware('verified')]
public function store(Request $request)
{
}
```

## Conclusión

Los atributos de control en Laravel representan un salto hacia un código más limpio, más legible y más fácil de mantener. Aunque requieren PHP 8.0+, sus beneficios en aplicaciones modernas son innegables.

La capacidad de crear atributos personalizados te permite construir un sistema flexible de seguridad y validación específico para tu aplicación, manteniendo el código centralizado y fácil de auditar.

Recuerda que los atributos son solo metadatos: necesitas implementar el middleware que los procesa. Pero una vez configurado, tu código será significativamente más expresivo y profesional.

## Puntos Clave

- Los atributos de control permiten aplicar middleware directamente en métodos de controlador
- Son más legibles y mantenibles que registrar middleware en `__construct()` o rutas
- Puedes crear atributos personalizados implementando un middleware que los procese
- Es importante usar `ReflectionMethod` para acceder a los atributos en tiempo de ejecución
- Combina atributos con la reflexión PHP para crear sistemas de autorización y validación robustos
- Los atributos pueden ser repetibles para aplicar múltiples validaciones
- Usa namespaces claros para organizar tus atributos personalizados
- Documenta bien tus atributos para facilitar su uso a otros desarrolladores
- Aprovecha la combinación con políticas y gates de Laravel para máxima seguridad
- Registra tus middlewares de atributos en `Kernel.php` dentro del array `$middleware` global