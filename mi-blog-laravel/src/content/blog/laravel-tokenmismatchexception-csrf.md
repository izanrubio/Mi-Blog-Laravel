---
title: 'TokenMismatchException — Error de CSRF en Laravel'
description: 'Soluciona el TokenMismatchException en Laravel: sesión expirada, formularios sin @csrf, peticiones AJAX sin el token y configuración de cookies.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'csrf', 'sesion']
---

# TokenMismatchException — Error de CSRF en Laravel

El `TokenMismatchException` es el nombre de la excepción PHP que Laravel lanza cuando la verificación CSRF falla. Es la excepción que se convierte en la respuesta HTTP 419 (Page Expired) que los usuarios ven. Aunque el artículo sobre el error 419 ya toca este tema, la `TokenMismatchException` tiene matices adicionales que vale la pena explorar en profundidad: cómo funciona internamente el sistema CSRF, por qué falla en ciertos escenarios y cómo manejarlo elegantemente en tu aplicación.

## ¿Cómo funciona el sistema CSRF de Laravel internamente?

Laravel genera un token CSRF por sesión. Este token:

1. Se genera la primera vez que se inicia la sesión del usuario
2. Se almacena en la sesión: `$request->session()->token()`
3. Se regenera después de autenticarse (para prevenir Session Fixation)
4. Se envía al cliente en dos formas: como campo de formulario (`_token`) y como cookie (`XSRF-TOKEN`)

Cuando llega una petición POST/PUT/PATCH/DELETE, el middleware `VerifyCsrfToken` compara el token de la sesión con el token enviado en la petición. Si no coinciden, lanza `TokenMismatchException`.

El token del formulario puede venir en:
- El campo `_token` del formulario (directiva `@csrf`)
- El header `X-CSRF-TOKEN` (para peticiones AJAX)
- El header `X-XSRF-TOKEN` (leído automáticamente de la cookie `XSRF-TOKEN` por Axios)

## La directiva @csrf en formularios Blade

El lugar más común donde falta el token:

```php
<!-- INCORRECTO: formulario sin protección CSRF -->
<form method="POST" action="{{ route('comentarios.store') }}">
    <textarea name="contenido" required></textarea>
    <button type="submit">Publicar comentario</button>
</form>
```

```php
<!-- CORRECTO: con @csrf -->
<form method="POST" action="{{ route('comentarios.store') }}">
    @csrf
    <textarea name="contenido" required></textarea>
    <button type="submit">Publicar comentario</button>
</form>
```

La directiva `@csrf` expande a:

```php
<input type="hidden" name="_token" value="{{ csrf_token() }}">
```

Puedes usar cualquiera de las dos formas. La directiva es más limpia.

## El meta tag para peticiones AJAX

Para peticiones JavaScript, el flujo es diferente. El token CSRF no puede estar en el DOM del formulario porque no hay formulario. En su lugar, se usa un meta tag en el `<head>`:

```php
<!-- En resources/views/layouts/app.blade.php -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title') - Mi App</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
```

Este meta tag hace el token disponible para JavaScript:

```php
// En resources/js/bootstrap.js
// Leer el token del meta tag:
const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

// Configurar Axios para incluir el token en todas las peticiones:
import axios from 'axios';

window.axios = axios;
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Si existe el token, configurarlo globalmente:
if (csrfToken) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = csrfToken;
}
```

Con esta configuración, todas las peticiones de Axios incluirán automáticamente el token CSRF:

```php
// Petición AJAX normal - el token se incluye automáticamente:
axios.post('/comentarios', {
    contenido: 'Excelente artículo!',
    post_id: 5
})
.then(response => {
    console.log('Comentario publicado:', response.data);
})
.catch(error => {
    if (error.response?.status === 419) {
        // La sesión expiró
        alert('Tu sesión ha expirado. Por favor, recarga la página.');
        window.location.reload();
    }
});
```

## La cookie XSRF-TOKEN (el mecanismo preferido para SPAs)

Laravel también establece automáticamente una cookie llamada `XSRF-TOKEN` con cada respuesta. Esta cookie contiene el token CSRF cifrado.

Axios lee esta cookie automáticamente y la envía en el header `X-XSRF-TOKEN` en cada petición. Esto significa que si configuraste Axios correctamente, no necesitas el meta tag de CSRF para que funcione:

```php
// Configurar Axios para enviar cookies:
axios.defaults.withCredentials = true;

// Axios leerá automáticamente la cookie XSRF-TOKEN y la enviará como header
// No necesitas hacer nada más para el CSRF si las cookies funcionan correctamente
```

Esto es especialmente importante para SPAs donde el frontend y el backend están en dominios diferentes. Para que las cookies funcionen cross-domain, necesitas configurar correctamente `SESSION_DOMAIN` y los headers CORS.

## Sesión expirada: la causa más difícil de debuggear

Esta es la causa más frustrante del `TokenMismatchException` porque todo parece correcto: el formulario tiene `@csrf`, pero el token que se envía ya no coincide con el de la sesión porque la sesión expiró.

Escenario típico:
1. El usuario abre un formulario largo (registro, checkout, redacción de un artículo)
2. El usuario se toma su tiempo rellenando el formulario (más de `SESSION_LIFETIME` minutos)
3. El usuario envía el formulario
4. La sesión expiró → el token del formulario no coincide con el de la sesión → `TokenMismatchException`

### Aumentar el tiempo de vida de la sesión

```php
// .env
SESSION_LIFETIME=480  // 8 horas en lugar de 2
```

### Detectar la expiración en JavaScript y mostrar un mensaje amigable

```php
// resources/js/app.js

// Escuchar eventos de formulario antes de enviar:
document.addEventListener('DOMContentLoaded', () => {
    const formularios = document.querySelectorAll('form[method="post"], form[method="POST"]');

    formularios.forEach(form => {
        form.addEventListener('submit', async (e) => {
            // Verificar que la sesión sigue activa antes de enviar
            try {
                await axios.get('/api/health-check');  // Endpoint que verifica la sesión
            } catch (error) {
                if (error.response?.status === 401 || error.response?.status === 419) {
                    e.preventDefault();
                    alert('Tu sesión ha expirado. La página se recargará para que puedas continuar.');
                    window.location.reload();
                }
            }
        });
    });
});
```

### Mantener la sesión activa con ping periódico

```php
// Mantener la sesión activa mientras el usuario está en la página:
setInterval(async () => {
    try {
        await axios.get('/ping');  // Endpoint que renueva la sesión
    } catch (error) {
        console.log('Sesión expirada o sin conexión');
    }
}, 10 * 60 * 1000); // Cada 10 minutos
```

```php
// routes/web.php - endpoint de ping:
Route::get('/ping', function () {
    return response()->json(['status' => 'ok']);
})->middleware('auth');
```

## Personalizar el manejo de TokenMismatchException

En lugar de mostrar la página genérica de error 419, puedes personalizar cómo se maneja la excepción:

### Crear una vista personalizada para el error 419

```php
// resources/views/errors/419.blade.php
<!DOCTYPE html>
<html lang="es">
<head>
    <title>Sesión expirada</title>
</head>
<body>
    <h1>Página expirada</h1>
    <p>Tu sesión ha expirado por inactividad. Por favor, recarga la página y vuelve a intentarlo.</p>
    <a href="{{ url()->previous() }}" onclick="location.reload()">Recargar página</a>
</body>
</html>
```

### Manejar la excepción en bootstrap/app.php (Laravel 11)

```php
// bootstrap/app.php
use Illuminate\Session\TokenMismatchException;

->withExceptions(function (Exceptions $exceptions) {
    $exceptions->renderable(function (TokenMismatchException $e, $request) {
        if ($request->expectsJson()) {
            return response()->json([
                'message' => 'La sesión ha expirado. Por favor, recarga la página.',
                'error' => 'token_mismatch',
            ], 419);
        }

        // Para peticiones web normales, redirige de vuelta con un mensaje
        return redirect()->back()
            ->withInput()
            ->withErrors(['csrf' => 'La sesión ha expirado. Por favor, inténtalo de nuevo.']);
    });
})
```

### Manejar la excepción en app/Exceptions/Handler.php (Laravel 10 y anteriores)

```php
<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Session\TokenMismatchException;
use Illuminate\Http\Request;
use Throwable;

class Handler extends ExceptionHandler
{
    public function render($request, Throwable $e)
    {
        if ($e instanceof TokenMismatchException) {
            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'La sesión ha expirado.',
                    'error' => 'token_mismatch',
                ], 419);
            }

            return redirect()->back()
                ->withInput($request->except('password', 'password_confirmation'))
                ->with('error', 'Tu sesión ha expirado. Los datos del formulario se han preservado, por favor envíalo de nuevo.');
        }

        return parent::render($request, $e);
    }
}
```

## Problemas con cookies SameSite

Los navegadores modernos tienen políticas `SameSite` para cookies que pueden causar problemas con CSRF en ciertos escenarios cross-site. Laravel configura sus cookies con `SameSite=Lax` por defecto, que es un buen equilibrio entre seguridad y compatibilidad.

Configura las cookies de sesión en `.env`:

```php
SESSION_SECURE_COOKIE=true   // Solo en HTTPS
SESSION_SAME_SITE=lax        // 'strict', 'lax' o 'none'
```

Si usas `SameSite=none`, necesitas `SESSION_SECURE_COOKIE=true` (HTTPS obligatorio) y `CORS_ALLOW_CREDENTIALS=true`.

## El token en dominio y subdominio

Si tu aplicación tiene el frontend en `app.tudominio.com` y el backend en `api.tudominio.com`, las cookies de sesión no se compartirán entre subdominios a menos que configures el dominio de la cookie:

```php
// .env
SESSION_DOMAIN=.tudominio.com  // El punto al inicio hace que la cookie aplique a todos los subdominios
APP_URL=https://api.tudominio.com
```

La cookie de sesión con dominio `.tudominio.com` se enviará tanto en peticiones a `app.tudominio.com` como a `api.tudominio.com`.

## Diferencia entre TokenMismatchException y el error 419

Son la misma cosa desde perspectivas diferentes:

- `TokenMismatchException` es la excepción PHP interna
- El error HTTP `419 Page Expired` es la respuesta HTTP que ve el cliente

Cuando el middleware `VerifyCsrfToken` detecta una falta de coincidencia del token, lanza `TokenMismatchException`. El `ExceptionHandler` de Laravel convierte esta excepción en una respuesta HTTP con código 419.

## Debugging del token CSRF

Para verificar que el token CSRF está llegando correctamente a Laravel:

```php
// En un controlador o middleware de prueba:
public function verificarToken(Request $request)
{
    return response()->json([
        'token_en_sesion' => $request->session()->token(),
        'token_en_request' => $request->input('_token'),
        'header_csrf' => $request->header('X-CSRF-TOKEN'),
        'coinciden' => $request->session()->token() === $request->input('_token'),
    ]);
}
```

Esto te ayuda a ver exactamente qué tokens está enviando el cliente y qué token tiene la sesión.

## Conclusión

El `TokenMismatchException` es siempre consecuencia de una de tres causas: el formulario no tiene `@csrf`, las peticiones AJAX no incluyen el token en los headers, o la sesión expiró haciendo que el token del formulario sea inválido.

La solución para aplicaciones web tradicionales es simple: `@csrf` en cada formulario. Para APIs y SPAs, configura Axios para enviar el token automáticamente. Y para mejorar la experiencia de usuario cuando la sesión expira, maneja el error 419 en JavaScript y muestra un mensaje claro en lugar de dejar al usuario confundido con una página de error.
