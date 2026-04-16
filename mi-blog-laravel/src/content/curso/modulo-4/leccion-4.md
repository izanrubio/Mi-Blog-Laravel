---
modulo: 4
leccion: 4
title: 'Middlewares — proteger rutas'
description: 'Descubre cómo usar middlewares en Laravel para proteger rutas, verificar permisos y ejecutar lógica antes o después de las peticiones HTTP.'
duracion: '20 min'
quiz:
  - pregunta: '¿Qué hace el middleware "auth" en Laravel?'
    opciones:
      - 'Encripta los datos del formulario'
      - 'Redirige al usuario no autenticado al login'
      - 'Valida el token CSRF de la petición'
      - 'Registra la petición en los logs'
    correcta: 1
    explicacion: 'El middleware auth verifica si el usuario está autenticado. Si no lo está, redirige automáticamente a la ruta de login.'
  - pregunta: '¿Cuál es el comando Artisan para crear un middleware personalizado?'
    opciones:
      - 'php artisan make:filter NombreMiddleware'
      - 'php artisan make:guard NombreMiddleware'
      - 'php artisan make:middleware NombreMiddleware'
      - 'php artisan new:middleware NombreMiddleware'
    correcta: 2
    explicacion: 'El comando php artisan make:middleware crea un nuevo middleware en el directorio app/Http/Middleware/.'
  - pregunta: '¿Qué línea de código ejecuta el siguiente middleware en la cadena de procesamiento?'
    opciones:
      - 'return $response;'
      - 'return next($request);'
      - 'return $request->next();'
      - 'return $next->handle($request);'
    correcta: 1
    explicacion: 'La llamada $next($request) pasa la petición al siguiente middleware o al controlador. Sin esta llamada, la petición no llega a su destino.'
---

## ¿Qué es un Middleware?

Imagina un portero en la entrada de una discoteca. Antes de que cualquiera entre, el portero verifica que cumpla los requisitos: mayor de edad, sin prohibición de entrada, vestimenta adecuada. Si pasa todos los filtros, entra. Si no, se le niega el acceso.

Un **middleware** en Laravel es exactamente eso: un filtro que se ejecuta antes (o después) de que una petición HTTP llegue a tu controlador. Puedes usarlo para verificar si el usuario está autenticado, si tiene los permisos correctos, si el servidor acepta cierto tipo de peticiones, o para cualquier otra lógica transversal que afecte a múltiples rutas.

## Middlewares Incluidos en Laravel

Laravel viene con varios middlewares listos para usar:

- **auth**: Verifica que el usuario esté autenticado.
- **guest**: Verifica que el usuario NO esté autenticado (para páginas de login).
- **verified**: Verifica que el email del usuario esté verificado.
- **throttle**: Limita el número de peticiones (rate limiting).
- **csrf**: Verifica el token CSRF en formularios POST.

## Aplicar Middleware a una Ruta

La forma más directa es encadenar `->middleware()` a una ruta:

```php
use App\Http\Controllers\DashboardController;

// Solo usuarios autenticados pueden acceder al dashboard
Route::get('/dashboard', [DashboardController::class, 'index'])
    ->middleware('auth')
    ->name('dashboard');

// Solo usuarios NO autenticados pueden ver el login
Route::get('/login', [LoginController::class, 'index'])
    ->middleware('guest')
    ->name('login');
```

## Aplicar Middleware a un Grupo de Rutas

Lo más habitual es proteger grupos completos:

```php
Route::middleware(['auth'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/perfil', [PerfilController::class, 'index'])->name('perfil');
    Route::resource('productos', ProductoController::class);
});
```

Puedes combinar prefijos, nombres y middlewares:

```php
Route::prefix('admin')
    ->name('admin.')
    ->middleware(['auth', 'verified'])
    ->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
        Route::resource('usuarios', UsuarioController::class);
    });
```

## Crear un Middleware Personalizado

Los middlewares de Laravel son geniales, pero a veces necesitas lógica personalizada. Por ejemplo, verificar que el usuario tenga rol de administrador:

```bash
php artisan make:middleware EsAdministrador
```

Esto crea `app/Http/Middleware/EsAdministrador.php`:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EsAdministrador
{
    public function handle(Request $request, Closure $next): Response
    {
        // Verificar si el usuario está autenticado y es admin
        if (!$request->user() || !$request->user()->es_admin) {
            // Redirigir con un mensaje de error
            return redirect('/')->with('error', 'No tienes permisos para acceder a esta sección.');
        }

        // Si pasa la verificación, continuar con la petición
        return $next($request);
    }
}
```

La línea clave es `return $next($request)`: esto pasa la petición al siguiente middleware o al controlador. Si no llamas a `$next`, la petición queda bloqueada aquí.

## Registrar el Middleware

En Laravel 11, puedes registrar el middleware directamente en las rutas usando la clase completa:

```php
use App\Http\Middleware\EsAdministrador;

Route::prefix('admin')
    ->middleware([EsAdministrador::class])
    ->group(function () {
        Route::get('/panel', [AdminController::class, 'panel']);
    });
```

O puedes darle un alias en `bootstrap/app.php`:

```php
// bootstrap/app.php
return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'admin' => \App\Http\Middleware\EsAdministrador::class,
        ]);
    })
    ->create();
```

Ahora puedes usar el alias en las rutas:

```php
Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/admin/panel', [AdminController::class, 'panel']);
});
```

## Middleware con Parámetros

Los middlewares pueden aceptar parámetros adicionales. Esto es útil para verificar roles específicos:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TieneRol
{
    public function handle(Request $request, Closure $next, string $rol): Response
    {
        if (!$request->user() || $request->user()->rol !== $rol) {
            abort(403, 'Acceso denegado.');
        }

        return $next($request);
    }
}
```

En las rutas, pasas el parámetro con dos puntos:

```php
Route::get('/admin/usuarios', [UsuarioController::class, 'index'])
    ->middleware('rol:administrador');

Route::get('/moderacion', [ModeracionController::class, 'index'])
    ->middleware('rol:moderador');

// Múltiples roles aceptados
Route::get('/reportes', [ReporteController::class, 'index'])
    ->middleware('rol:administrador,supervisor');
```

## Middleware After: Ejecutar Lógica Después del Controlador

La mayoría de middlewares ejecutan lógica ANTES del controlador (before middleware). Pero también puedes ejecutar lógica DESPUÉS de que el controlador haya generado la respuesta:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Illuminate\Support\Facades\Log;

class RegistrarPeticion
{
    public function handle(Request $request, Closure $next): Response
    {
        // Código ANTES del controlador
        $inicio = microtime(true);

        // Procesar la petición
        $response = $next($request);

        // Código DESPUÉS del controlador
        $tiempoMs = round((microtime(true) - $inicio) * 1000, 2);
        Log::info("Petición {$request->method()} {$request->path()} - {$tiempoMs}ms");

        return $response;
    }
}
```

Este middleware registra en los logs el tiempo que tardó cada petición.

## Rate Limiting con Throttle

El middleware `throttle` limita cuántas peticiones puede hacer un usuario en un período de tiempo. Muy útil para proteger endpoints sensibles:

```php
// Máximo 60 peticiones por minuto (por defecto)
Route::middleware('throttle:60,1')->group(function () {
    Route::get('/api/datos', [ApiController::class, 'datos']);
});

// 5 intentos de login por minuto
Route::post('/login', [LoginController::class, 'store'])
    ->middleware('throttle:5,1')
    ->name('login');
```

El formato es `throttle:{intentos},{minutos}`.

## Ver los Middlewares Activos

Para ver qué middlewares están aplicados a cada ruta:

```bash
php artisan route:list --verbose
```

La columna "Middleware" mostrará todos los middlewares activos para cada ruta.

## Deshabilitar Middleware en Testing

Durante las pruebas, a veces quieres deshabilitar middlewares para simplificar los tests:

```php
// En un test
public function test_el_dashboard_es_accesible(): void
{
    $usuario = User::factory()->create();

    $response = $this->actingAs($usuario)->get('/dashboard');

    $response->assertStatus(200);
}
```

Usando `actingAs()`, le dices a Laravel que actúe como si ese usuario estuviera autenticado, así el middleware `auth` lo dejará pasar.

## Resumen

Los middlewares son la herramienta perfecta para aplicar lógica transversal a múltiples rutas de forma DRY (Don't Repeat Yourself). En lugar de repetir la misma verificación en cada controlador, la centralizas en un middleware y la aplicas a las rutas que lo necesiten. El middleware `auth` es el más usado para proteger secciones privadas, pero crear tus propios middlewares personalizados te da un control total sobre quién puede acceder a cada parte de tu aplicación.
