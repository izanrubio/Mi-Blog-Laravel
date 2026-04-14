---
title: 'Atributos de Control en Laravel: Middleware con Decoradores PHP'
description: 'Aprende a usar atributos PHP para gestionar middleware en controladores. Guía práctica con ejemplos reales en Laravel 13.'
pubDate: '2026-04-14'
tags: ['laravel', 'php', 'middleware', 'atributos']
---

## Atributos de Control en Laravel: Middleware con Decoradores PHP

Los atributos PHP (también llamados decoradores o annotations) son una característica poderosa que permite agregar metadatos a clases y métodos. En Laravel 13, estos atributos se han mejorado significativamente para gestionar middleware directamente en tus controladores, haciendo el código más limpio y expresivo.

Si aún defines todo tu middleware en las rutas o en el constructor del controlador, este artículo te mostrará cómo modernizar tu código con atributos y heredar comportamientos de forma elegante.

## ¿Qué son los Atributos PHP y por qué importan?

Los atributos fueron introducidos en PHP 8 como una alternativa a las anotaciones basadas en comentarios (docblocks). En lugar de:

```php
/**
 * @authenticated
 * @throttle:60,1
 */
public function show($id)
{
    // ...
}
```

Ahora puedes escribir:

```php
#[Authenticate]
#[Throttle('60,1')]
public function show($id)
{
    // ...
}
```

Los atributos son más seguros, verificados en tiempo de compilación, y mucho más fáciles de refactorizar. Laravel aprovecha esto para permitirte declara middleware directamente en tus controladores.

## Middleware como Atributos en Laravel

### Usando Atributos Nativos de Laravel

Laravel proporciona varios atributos listos para usar:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use App\Models\Post;

class PostController implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            'auth',
            new Middleware('throttle:60,1'),
        ];
    }

    public function index()
    {
        // El middleware se aplica automáticamente
        return Post::all();
    }
}
```

Pero esto sigue siendo declarativo. Con atributos puedes ser más específico:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Routing\Middleware\ThrottleRequests;
use App\Models\Post;

class PostController implements HasMiddleware
{
    // El middleware se aplica a todos los métodos
    #[Authenticate]
    #[ThrottleRequests('60,1')]
    public function index()
    {
        return Post::all();
    }

    // Este método solo usa autenticación
    #[Authenticate]
    public function show($id)
    {
        return Post::findOrFail($id);
    }

    // Este método no tiene restricciones
    public function create()
    {
        return view('posts.create');
    }
}
```

### Control a Nivel de Método vs Controlador

Una de las grandes ventajas es que puedes aplicar atributos de forma granular:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Auth\Middleware\Authenticate;
use App\Http\Middleware\IsAdmin;
use App\Http\Middleware\LogActivity;

class AdminController implements HasMiddleware
{
    // Aplica a todo el controlador
    #[LogActivity]
    public static function middleware(): array
    {
        return [
            new Middleware('auth'),
        ];
    }

    // Autenticación + verificar admin
    #[IsAdmin]
    public function dashboard()
    {
        return view('admin.dashboard');
    }

    // Solo autenticación (heredada del middleware())
    public function profile()
    {
        return view('admin.profile');
    }

    // Sin middleware adicional (mantiene el de middleware())
    public function settings()
    {
        return view('admin.settings');
    }
}
```

## Crear Atributos Personalizados

A veces necesitas lógica de middleware más específica. Puedes crear atributos personalizados:

```php
<?php

namespace App\Http\Attributes;

use Attribute;

#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS)]
class RequireRole
{
    public function __construct(
        public string $role,
        public string $permission = null,
    ) {}
}
```

Luego, en tu controlador:

```php
<?php

namespace App\Http\Controllers;

use App\Http\Attributes\RequireRole;

class TeamController
{
    #[RequireRole('manager', 'edit-team')]
    public function edit($id)
    {
        return view('teams.edit');
    }

    #[RequireRole('admin')]
    public function destroy($id)
    {
        // Eliminar equipo
    }
}
```

Para que funcione, necesitas un middleware que procese estos atributos:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Routing\Controllers\Middleware;
use ReflectionClass;
use ReflectionMethod;
use App\Http\Attributes\RequireRole;

class CheckRoleAttribute
{
    public function handle(Request $request, Closure $next)
    {
        $controller = $request->route()->getController();
        $method = $request->route()->getActionMethod();

        if (!$controller) {
            return $next($request);
        }

        // Obtener atributos del método
        $reflection = new ReflectionClass($controller);
        $reflectionMethod = $reflection->getMethod($method);
        $attributes = $reflectionMethod->getAttributes(RequireRole::class);

        foreach ($attributes as $attribute) {
            $roleAttribute = $attribute->newInstance();

            if (!$request->user() || !$request->user()->hasRole($roleAttribute->role)) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            if ($roleAttribute->permission && 
                !$request->user()->can($roleAttribute->permission)) {
                return response()->json(['error' => 'Forbidden'], 403);
            }
        }

        return $next($request);
    }
}
```

Registra el middleware en `bootstrap/app.php`:

```php
->withMiddleware(function (Middleware $middleware) {
    $middleware->append(\App\Http\Middleware\CheckRoleAttribute::class);
})
```

## Herencia de Middleware en Laravel 13

Una mejora reciente en Laravel 13 es el soporte para **herencia de middleware en atributos de controladores**. Esto significa que puedes crear controladores base con comportamientos compartidos:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;
use Illuminate\Auth\Middleware\Authenticate;

abstract class ApiController implements HasMiddleware
{
    #[Authenticate]
    public static function middleware(): array
    {
        return [
            new Middleware('throttle:300,1'),
        ];
    }
}
```

Y luego heredar en tus controladores:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\ApiController;
use App\Http\Attributes\RequireRole;
use App\Models\User;

class UserController extends ApiController
{
    // Hereda: autenticación + throttle
    public function index()
    {
        return User::all();
    }

    // Agrega restricción adicional
    #[RequireRole('admin')]
    public function destroy($id)
    {
        return User::findOrFail($id)->delete();
    }
}
```

## Combinando con Atributos de Delay en Queues

Laravel 13.5 introdujo el atributo `#[Delay]` para mailables en colas. Puedes combinar esto con middleware de controladores para workflows complejos:

```php
<?php

namespace App\Http\Controllers;

use App\Mail\WelcomeMail;
use Illuminate\Auth\Middleware\Authenticate;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\Attributes\Delay;

class AuthController
{
    #[Authenticate]
    public function register()
    {
        $user = auth()->user();
        
        // Enviar email con delay
        Mail::queue(new WelcomeMail($user));

        return response()->json(['message' => 'User registered']);
    }
}
```

Y en tu Mailable:

```php
<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Queue\Attributes\Delay;
use DateTime;

class WelcomeMail extends Mailable
{
    #[Delay(seconds: 300)]
    public function build()
    {
        return $this->view('emails.welcome');
    }
}
```

## Buenas Prácticas

### 1. Mantén la Consistencia

Elige un enfoque y mantente con él. Si usas atributos, hazlo en todo el proyecto:

```php
// ✅ Consistente
#[Authenticate]
#[Throttle('60,1')]
public function store() {}

// ❌ Evita mezclar
public function update()
{
    $this->middleware('auth');
    $this->middleware('throttle:60,1');
}
```

### 2. Documenta Tus Atributos Personalizados

```php
#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_CLASS)]
class RequireSubscription
{
    /**
     * Requiere que el usuario tenga una suscripción activa.
     * 
     * @param string $plan Plan requerido (basic, pro, enterprise)
     */
    public function __construct(public string $plan = 'basic') {}
}
```

### 3. Evita Sobre-Complejidad

Si necesitas lógica muy compleja, considera usar Policies:

```php
// ✅ Simple y legible
#[RequireRole('editor')]
public function edit($id) {}

// ❌ Demasiado complejo
#[ComplexAuthorization('role:editor|role:admin', 'permission:edit|ownership')]
public function edit($id) {}
```

En este caso, usa Policies de Laravel:

```php
public function edit(User $user, Post $post)
{
    return $user->can('update', $post);
}
```

## Performance y Consideraciones

Los atributos tienen un pequeño impacto en performance porque Laravel necesita usar Reflection para leerlos. Sin embargo, esto es insignificante en la mayoría de casos:

```php
// Laravel cachea la información de atributos
// en el contenedor de servicios durante el bootstrap
```

Para aplicaciones muy grandes con cientos de rutas, considera cachear la información de rutas:

```bash
php artisan route:cache
```

## Puntos Clave

- **Los atributos PHP son la forma moderna y segura** de agregar metadatos a controladores y métodos, reemplazando anotaciones en comentarios
- **Implementa `HasMiddleware`** para usar atributos de middleware en tus controladores
- **Los atributos pueden ser específicos por método**, dándote control granular sobre qué middleware se aplica dónde
- **Crea atributos personalizados** para lógica reutilizable usando Reflection
- **Laravel 13 mejora la herencia de middleware**, permitiendo crear controladores base con comportamientos compartidos
- **Combina atributos de middleware con `#[Delay]`** en queues para workflows avanzados
- **Mantén la consistencia** en todo tu proyecto y evita mezclar enfoques antiguos con nuevos
- **Los atributos se cachean**, así que no hay preocupaciones significativas de performance
- **Usa Policies** para lógica de autorización compleja en lugar de crear atributos demasiado genéricos
- **Documenta tus atributos personalizados** para que otros desarrolladores entiendan su propósito