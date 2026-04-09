---
title: '419 Page Expired en Laravel — Qué es y cómo arreglarlo'
description: 'El error 419 Page Expired en Laravel es causado por el token CSRF. Aprende qué lo causa y cómo solucionarlo en formularios y peticiones AJAX.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'csrf', 'seguridad']
---

# 419 Page Expired en Laravel — Qué es y cómo arreglarlo

Si llevas poco tiempo con Laravel y de repente ves una página con "419 Page Expired" después de enviar un formulario, no te preocupes. No es un bug de tu código ni un problema del servidor. Es una medida de seguridad que Laravel implementa por defecto para proteger tu aplicación contra un tipo de ataque conocido como CSRF.

En esta guía te explico qué es CSRF, por qué Laravel bloquea ciertas peticiones y cómo incluir correctamente el token CSRF en formularios y peticiones AJAX.

## ¿Qué es CSRF?

CSRF significa Cross-Site Request Forgery (Falsificación de Petición entre Sitios). Es un tipo de ataque en el que un sitio web malicioso engaña al navegador del usuario para que realice peticiones a tu aplicación sin que el usuario lo sepa.

Imagina este escenario:
1. El usuario inicia sesión en `tu-banco.com`.
2. Sin cerrar sesión, visita `sitio-malicioso.com`.
3. Ese sitio tiene código HTML que envía un formulario silencioso a `tu-banco.com/transferencia`.
4. Como el navegador todavía tiene la cookie de sesión del banco, la petición se procesa como si el usuario la hubiera hecho.

Para protegerse, Laravel genera un **token único por sesión**. Cuando se envía un formulario, Laravel verifica que el token del formulario coincide con el de la sesión. Si no coincide (como en el ataque CSRF donde el sitio malicioso no conoce el token), la petición se rechaza con el error 419.

## La causa más común: falta la directiva @csrf en el formulario

Si tienes un formulario HTML sin el token CSRF, verás el error 419 cada vez que lo envíes:

```php
<!-- INCORRECTO: falta @csrf -->
<form method="POST" action="/contacto">
    <input type="text" name="nombre">
    <button type="submit">Enviar</button>
</form>
```

**Solución**: agrega la directiva `@csrf` dentro de cualquier formulario con método POST, PUT, PATCH o DELETE:

```php
<!-- CORRECTO: con @csrf -->
<form method="POST" action="/contacto">
    @csrf
    <input type="text" name="nombre">
    <button type="submit">Enviar</button>
</form>
```

La directiva `@csrf` genera un campo oculto con el token:

```php
<!-- Lo que @csrf genera en el HTML -->
<input type="hidden" name="_token" value="AbCdEfGhIjKlMnOpQrStUvWxYz1234567890AbCd">
```

## CSRF en formularios con métodos PUT, PATCH, DELETE

Los formularios HTML solo soportan los métodos GET y POST. Para usar PUT, PATCH o DELETE en formularios Laravel, necesitas tanto `@csrf` como `@method`:

```php
<!-- Actualizar un recurso (método PUT) -->
<form method="POST" action="/productos/{{ $producto->id }}">
    @csrf
    @method('PUT')
    <input type="text" name="nombre" value="{{ $producto->nombre }}">
    <button type="submit">Actualizar</button>
</form>

<!-- Eliminar un recurso (método DELETE) -->
<form method="POST" action="/productos/{{ $producto->id }}">
    @csrf
    @method('DELETE')
    <button type="submit">Eliminar</button>
</form>
```

`@method('PUT')` genera `<input type="hidden" name="_method" value="PUT">`, que Laravel lee para determinar el método HTTP real.

## Error 419 en peticiones AJAX

Si usas JavaScript para hacer peticiones con fetch o Axios, también necesitas incluir el token CSRF. De lo contrario, obtendrás el error 419 (que en AJAX se ve como un error 419 en la consola del navegador, no como una página de error).

### Opción 1: Meta tag en el head (más recomendada)

Agrega el meta tag del token CSRF en el `<head>` de tu layout:

```php
<!-- En resources/views/layouts/app.blade.php -->
<head>
    <meta charset="UTF-8">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <!-- resto del head -->
</head>
```

Luego, en tu JavaScript, lee el token del meta tag y lo incluyes en cada petición:

```php
// Con fetch API:
const token = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

fetch('/api/productos', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token,
    },
    body: JSON.stringify({ nombre: 'Nuevo producto' }),
});
```

### Opción 2: Configurar Axios globalmente

Si usas Axios (que viene incluido en Laravel por defecto), puedes configurarlo para que incluya el token automáticamente en todas las peticiones:

```php
// resources/js/bootstrap.js (ya incluido en Laravel)
import axios from 'axios';
window.axios = axios;

// Configurar el token CSRF para todas las peticiones de Axios
window.axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';

// Leer el token del meta tag y configurarlo en Axios
const token = document.head.querySelector('meta[name="csrf-token"]');
if (token) {
    window.axios.defaults.headers.common['X-CSRF-TOKEN'] = token.content;
}
```

Con esto configurado, todas las peticiones de Axios incluirán automáticamente el token CSRF:

```php
// Petición AJAX normal, ya incluye el token automáticamente:
axios.post('/productos', { nombre: 'Nuevo producto' })
    .then(response => console.log(response.data))
    .catch(error => console.error(error));
```

### Opción 3: Usar cookies CSRF con Axios (para SPAs)

Si desarrollas una SPA (Single Page Application) con Vue, React o similar, hay una alternativa más limpia: usar la cookie `XSRF-TOKEN` que Laravel establece automáticamente:

```php
// Axios la lee automáticamente de la cookie y la envía en el header X-XSRF-TOKEN
// Solo necesitas asegurarte de que Axios está configurado correctamente:
axios.defaults.withCredentials = true;

// Laravel Sanctum, cuando lo usas para SPAs, gestiona esto automáticamente
```

## Excluir rutas de la verificación CSRF

En algunos casos, puede que necesites excluir ciertas rutas de la verificación CSRF. Por ejemplo, si recibes webhooks de servicios externos (Stripe, PayPal, etc.), esos servicios no pueden incluir tu token CSRF.

En Laravel 11, la exclusión de rutas se hace en el archivo `bootstrap/app.php`:

```php
// bootstrap/app.php
<?php

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
        $middleware->validateCsrfTokens(except: [
            'webhook/stripe',
            'webhook/paypal',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
```

En versiones anteriores de Laravel (hasta Laravel 10), se hacía en `app/Http/Middleware/VerifyCsrfToken.php`:

```php
<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    protected $except = [
        'webhook/stripe',
        'webhook/paypal',
        'api/*',  // Cuidado: excluir toda la API puede ser un riesgo de seguridad
    ];
}
```

**Nota**: las rutas en `routes/api.php` no tienen verificación CSRF por defecto en Laravel. Solo las rutas en `routes/web.php` están sujetas a la verificación CSRF.

## El error 419 por sesión expirada

Otra causa del error 419 es que la sesión del usuario ha expirado. Cuando el usuario deja la página abierta mucho tiempo sin interactuar y luego envía un formulario, la sesión puede haber expirado y el token CSRF ya no es válido.

Puedes aumentar la duración de la sesión en `.env`:

```php
SESSION_LIFETIME=120  // Minutos. Por defecto son 120 (2 horas)
```

O en `config/session.php`:

```php
'lifetime' => env('SESSION_LIFETIME', 120),
'expire_on_close' => false,  // Si true, la sesión expira al cerrar el navegador
```

Para mejorar la UX cuando esto ocurre, puedes interceptar el error 419 en JavaScript y mostrar un mensaje amigable:

```php
// Con Axios:
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 419) {
            // Mostrar mensaje al usuario y recargar la página
            alert('Tu sesión ha expirado. La página se recargará para continuar.');
            window.location.reload();
        }
        return Promise.reject(error);
    }
);
```

## Problemas con el dominio de la cookie

Si accedes a tu aplicación desde un dominio o subdominio diferente al configurado en `SESSION_DOMAIN`, las cookies de sesión no se enviarán y el token CSRF no será válido.

Configura correctamente en `.env`:

```php
SESSION_DOMAIN=.tudominio.com  // El punto al inicio permite subdominos
APP_URL=https://app.tudominio.com
```

Si trabajas en local y accedes por `localhost`, asegúrate de que `SESSION_DOMAIN` está vacío o es `localhost`:

```php
SESSION_DOMAIN=  // Vacío para desarrollo local
```

## Verificar que el middleware CSRF está activo

Si por algún motivo el middleware CSRF no está en la cadena de middlewares, las rutas web no estarán protegidas (y tampoco recibirás el error 419, que a veces es síntoma de un problema diferente).

En Laravel 11, el middleware web está configurado en `bootstrap/app.php` y en `app/Http/Kernel.php` en versiones anteriores. Verifica que el middleware `VerifyCsrfToken` está presente en el grupo `web`.

## Diagnóstico rápido

Si encuentras el error 419:

1. ¿Tu formulario tiene `@csrf`? Si no, agrégalo.
2. ¿Es una petición AJAX? ¿Incluyes el header `X-CSRF-TOKEN`?
3. ¿La sesión expiró? Aumenta `SESSION_LIFETIME` o maneja el error en JavaScript.
4. ¿Es una ruta que debería estar excluida (webhook)? Exclúyela en la configuración de middleware.
5. ¿Problemas de dominio? Verifica `SESSION_DOMAIN` y `APP_URL`.

## Conclusión

El error 419 Page Expired es en realidad una buena señal: significa que el sistema de protección CSRF de Laravel está funcionando. La solución en el 90% de los casos es simplemente agregar `@csrf` al formulario. Para peticiones AJAX, configura Axios con el token del meta tag y el problema desaparecerá.

Nunca deshabilites la protección CSRF globalmente. Es una capa de seguridad importante. Si necesitas excluir rutas específicas (como webhooks), hazlo de forma quirúrgica solo para esas rutas.
