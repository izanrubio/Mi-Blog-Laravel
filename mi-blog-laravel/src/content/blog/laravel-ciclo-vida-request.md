---
title: 'Cómo funciona el ciclo de vida de una Request en Laravel'
description: 'Entiende el ciclo de vida completo de una request en Laravel: desde el servidor web hasta la respuesta. Kernels, middlewares, router y controladores explicados.'
pubDate: '2024-03-13'
tags: ['laravel', 'conceptos', 'arquitectura', 'request']
---

Entender qué pasa desde que un usuario escribe una URL en el navegador hasta que ve la respuesta en pantalla es fundamental para debuggear problemas, entender dónde poner lógica, y trabajar con Laravel de forma profesional. Vamos a recorrer cada paso.

## El punto de entrada: public/index.php

Todo empieza aquí. Tu servidor web (Nginx, Apache) está configurado para redirigir todas las peticiones al archivo `public/index.php`. No importa si la URL es `/posts`, `/api/users` o `/admin/dashboard`, todas llegan primero a este archivo.

```php
// public/index.php (simplificado)
<?php

// 1. Cargar el autoloader de Composer
require __DIR__.'/../vendor/autoload.php';

// 2. Crear la aplicación Laravel (el Service Container)
$app = require_once __DIR__.'/../bootstrap/app.php';

// 3. Obtener el HTTP Kernel
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

// 4. Procesar la request y obtener la response
$request  = Illuminate\Http\Request::capture();
$response = $kernel->handle($request);

// 5. Enviar la respuesta al navegador
$response->send();

// 6. Ejecutar tareas de "terminación"
$kernel->terminate($request, $response);
```

Este archivo tiene menos de 20 líneas de código real. Su trabajo es únicamente bootstrappear la aplicación y delegar todo al Kernel.

## Bootstrapping: crear la aplicación

`bootstrap/app.php` crea la instancia del Service Container (el corazón de Laravel) y configura los bindings fundamentales:

```php
// bootstrap/app.php en Laravel 11
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Configuración de middlewares
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Configuración de manejo de excepciones
    })
    ->create();
```

En este paso, Laravel prepara todo lo necesario para procesar la request pero todavía no ejecuta nada de tu código de aplicación.

## El HTTP Kernel: el corazón del ciclo

El Kernel es el orquestador principal. Su método `handle()` es donde ocurre la magia:

```php
// Simplificación del Kernel::handle()
public function handle($request)
{
    try {
        // 1. Pasar la request por el pipeline de middlewares globales
        $response = $this->sendRequestThroughRouter($request);
    } catch (Throwable $e) {
        // 2. Si algo falla, el Exception Handler crea la respuesta de error
        $response = $this->renderException($request, $e);
    }

    return $response;
}
```

### El stack de middlewares globales

Antes de que tu ruta o controlador se ejecute, la request pasa por una serie de middlewares globales. En Laravel 11, estos están configurados en `bootstrap/app.php`:

```php
// Los middlewares que corren para TODAS las requests:
// - InertiaMiddleware (si usas Inertia)
// - TrustProxies
// - HandleCors
// - PreventRequestsDuringMaintenance (mantenimiento)
// - ValidatePostSize
// - TrimStrings
// - ConvertEmptyStringsToNull
```

Estos middlewares se ejecutan en orden, y la request pasa por todos antes de llegar al router.

## El Router: encontrar la ruta

Después de los middlewares globales, el router analiza la URL y el método HTTP para encontrar qué ruta coincide:

```php
// routes/web.php
Route::get('/posts/{post}', [PostController::class, 'show'])
    ->middleware(['auth', 'verified']);
```

Si el router encuentra una ruta:
1. Resuelve los parámetros (Route Model Binding: `{post}` → objeto `Post`)
2. Ejecuta los middlewares asignados a esa ruta (`auth`, `verified`)
3. Llama al controlador

Si el router NO encuentra ninguna ruta, devuelve un 404.

## Los middlewares de ruta

Los middlewares específicos de una ruta se ejecutan después de los globales:

```php
// Middleware auth verifica que hay un usuario autenticado
// Middleware verified verifica que el email está confirmado

// Si algún middleware rechaza la request (retorna una respuesta),
// el controlador NUNCA se ejecuta
```

Esto es importante para debuggear: si tu controlador no se ejecuta, puede ser que un middleware está interceptando la request antes.

## El controlador: tu código

Finalmente, el controlador recibe la request:

```php
// app/Http/Controllers/PostController.php

public function show(Request $request, Post $post)
{
    // En este punto:
    // - La request ya pasó por todos los middlewares globales y de ruta
    // - $post ya está resuelto por Route Model Binding
    // - El usuario está autenticado (si middleware auth lo requiere)
    
    return view('posts.show', [
        'post' => $post,
        'user' => $request->user(),
    ]);
}
```

El controlador crea una respuesta (un `Response` object, una vista, un JSON, etc.) y la devuelve.

## La respuesta viaja de vuelta

La respuesta creada por el controlador viaja de vuelta por el pipeline de middlewares, pero en orden inverso. Esto permite que los middlewares modifiquen la respuesta:

```php
// Algunos middlewares añaden headers en la respuesta de vuelta:
// - AddQueuedCookiesToResponse: añade las cookies pendientes
// - StartSession: guarda la sesión
// - ShareErrorsFromSession: comparte errores de validación con las vistas
// - VerifyCsrfToken: verifica el token (en la ida) y puede añadir cookies (en la vuelta)
```

## El método terminate()

Después de que `$response->send()` envía la respuesta al navegador, el Kernel llama a `terminate()`. Esto permite ejecutar tareas después de que el usuario ya recibió la respuesta:

```php
// Implementar terminate() en un middleware
class LogRequest
{
    public function handle(Request $request, Closure $next): Response
    {
        return $next($request);
    }

    // Se ejecuta DESPUÉS de enviar la respuesta al usuario
    public function terminate(Request $request, Response $response): void
    {
        // Registrar la petición en logs sin ralentizar la respuesta
        ActivityLog::create([
            'url'         => $request->fullUrl(),
            'method'      => $request->method(),
            'status_code' => $response->status(),
            'user_id'     => $request->user()?->id,
            'duration'    => microtime(true) - LARAVEL_START,
        ]);
    }
}
```

## Implicaciones prácticas para debuggear

Entender este ciclo te ayuda a saber dónde mirar cuando algo falla:

```php
// Si la request nunca llega a tu controlador:
// → Revisa los middlewares (¿alguno está rechazando la request?)
// → Revisa las rutas (¿coincide la URL y el método HTTP?)

// Si la respuesta es incorrecta pero el controlador se ejecuta:
// → Puede ser un middleware modificando la respuesta

// Si hay un error de sesión o autenticación:
// → El problema suele estar en el orden de middlewares o en su configuración

// Para ver todo el ciclo en tiempo real:
// → Usa Laravel Telescope (en desarrollo)
// → Añade Log::debug() en puntos clave
```

## El ciclo para requests de consola

Las peticiones de consola (`php artisan comando`) siguen un ciclo similar pero con el **Console Kernel** en lugar del HTTP Kernel. No hay middlewares HTTP, no hay router de rutas web: solo el registro de comandos y su ejecución.

## Conclusión

El ciclo de vida de una request en Laravel es: `index.php` → Bootstrap → HTTP Kernel → Middlewares globales → Router → Middlewares de ruta → Controlador → Respuesta → Middlewares de vuelta → `send()` → `terminate()`. Entender este flujo te convierte en un desarrollador Laravel mucho más efectivo porque sabes exactamente dónde colocar cada tipo de lógica.
