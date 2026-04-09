---
title: 'Too many redirects en Laravel con HTTPS — Cómo solucionarlo'
description: 'Soluciona el error Too many redirects en Laravel cuando usas HTTPS: configuración de HTTPS forzado, proxies, TRUSTED_PROXIES y variables de entorno.'
pubDate: '2024-03-01'
tags: ['laravel', 'errores', 'https', 'configuracion']
---

`ERR_TOO_MANY_REDIRECTS`. El navegador entra en un bucle infinito de redirecciones y no puede mostrar tu aplicación. Este error con HTTPS en Laravel tiene una causa muy específica y soluciones bien definidas. Te explico exactamente qué está pasando y cómo resolverlo.

## Por qué ocurre este error

El escenario típico es este:

1. Tu aplicación Laravel está detrás de un servidor proxy o balanceador de carga (Nginx, Cloudflare, etc.)
2. El proxy termina la conexión SSL/TLS y reenvía las peticiones al servidor de Laravel como HTTP normal
3. Laravel no sabe que la petición original era HTTPS, así que `request()->isSecure()` devuelve `false`
4. Tu código fuerza HTTPS, redirigiendo a `https://`
5. La petición HTTPS llega al proxy, que la convierte a HTTP y la envía a Laravel
6. Laravel vuelve a redirigir a HTTPS
7. Bucle infinito → Too many redirects

## La solución: TrustProxies middleware

Laravel incluye el middleware `TrustProxies` para exactamente este problema. Cuando configuras proxies de confianza, Laravel lee los headers que el proxy añade (`X-Forwarded-For`, `X-Forwarded-Proto`, etc.) para saber si la petición original era HTTPS.

### En Laravel 11

```php
// bootstrap/app.php
use Illuminate\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;

->withMiddleware(function (Middleware $middleware) {
    $middleware->trustProxies(
        at: '*',  // Confiar en todos los proxies
        // O especifica IPs: at: ['192.168.1.1', '10.0.0.0/8']
        headers: Request::HEADER_X_FORWARDED_FOR |
                 Request::HEADER_X_FORWARDED_HOST |
                 Request::HEADER_X_FORWARDED_PORT |
                 Request::HEADER_X_FORWARDED_PROTO |
                 Request::HEADER_X_FORWARDED_AWS_ELB
    );
})
```

### En Laravel 10 y anteriores

```php
// app/Http/Middleware/TrustProxies.php
<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    // Para confiar en todos los proxies (Cloudflare, load balancers, etc.)
    protected $proxies = '*';

    // O especifica IPs concretas
    // protected $proxies = ['192.168.1.1'];

    protected $headers =
        Request::HEADER_X_FORWARDED_FOR |
        Request::HEADER_X_FORWARDED_HOST |
        Request::HEADER_X_FORWARDED_PORT |
        Request::HEADER_X_FORWARDED_PROTO |
        Request::HEADER_X_FORWARDED_AWS_ELB;
}
```

Usando `'*'` confías en cualquier proxy. Esto es apropiado cuando tu servidor no es accesible públicamente (está detrás de un proxy que sí lo es). Si tu servidor es accesible directamente desde internet, especifica las IPs exactas de tus proxies.

## Variable de entorno TRUSTED_PROXIES

En algunos setups puedes configurarlo via `.env`:

```bash
# .env
TRUSTED_PROXIES=*
# O IPs específicas
TRUSTED_PROXIES=192.168.1.1,10.0.0.0/8
```

## Configurar APP_URL correctamente

Asegúrate de que `APP_URL` en tu `.env` usa `https://`:

```bash
APP_URL=https://tu-dominio.com
```

Esto afecta a la generación de URLs con los helpers `url()`, `asset()` y `route()`.

## Forzar HTTPS en AppServiceProvider

Si necesitas forzar HTTPS globalmente, hazlo correctamente en el `AppServiceProvider`:

```php
// app/Providers/AppServiceProvider.php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\URL;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Solo forzar HTTPS en producción
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }
    }
}
```

`URL::forceScheme('https')` afecta solo a la generación de URLs, no añade redirecciones. Para las redirecciones, usa el middleware.

### Middleware de redirección a HTTPS

Si quieres redirigir HTTP a HTTPS manualmente, hazlo con cuidado:

```php
// app/Http/Middleware/ForceHttps.php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceHttps
{
    public function handle(Request $request, Closure $next)
    {
        // Solo redirigir si no es ya HTTPS Y estamos en producción
        if (!$request->isSecure() && app()->environment('production')) {
            return redirect()->secure($request->getRequestUri());
        }

        return $next($request);
    }
}
```

El problema aquí es `$request->isSecure()`: si no has configurado `TrustProxies`, este método siempre devuelve `false` cuando hay un proxy intermedio, causando el bucle. **Siempre configura TrustProxies antes de forzar HTTPS.**

## Cloudflare y configuraciones especiales

Si usas Cloudflare, hay una consideración adicional. Cloudflare puede estar en modo "Flexible SSL" (HTTPS entre usuario y Cloudflare, pero HTTP entre Cloudflare y tu servidor). En ese caso:

1. Laravel ve la petición como HTTP (correcto, así llega)
2. Pero intenta redirigir a HTTPS
3. Que vuelve a Cloudflare como HTTPS → HTTP → Laravel ve HTTP de nuevo → redirige

Solución: o configura Cloudflare en modo "Full" o "Full (Strict)" para que use HTTPS hasta tu servidor, o configura Laravel para que confíe en el header `CF-Visitor` que envía Cloudflare:

```php
// El header que Cloudflare envía cuando la conexión original era HTTPS:
// CF-Visitor: {"scheme":"https"}

// En TrustProxies, asegúrate de incluir los headers de Cloudflare
protected $headers = Request::HEADER_X_FORWARDED_PROTO;
```

## Diagnóstico rápido

Para saber qué está pasando, añade temporalmente este código a una ruta:

```php
Route::get('/debug-https', function (Request $request) {
    return [
        'isSecure'          => $request->isSecure(),
        'scheme'            => $request->getScheme(),
        'forwarded_proto'   => $request->header('X-Forwarded-Proto'),
        'cf_visitor'        => $request->header('CF-Visitor'),
        'server_https'      => $_SERVER['HTTPS'] ?? 'not set',
    ];
});
```

Si `X-Forwarded-Proto` es `https` pero `isSecure()` es `false`, es seguro que el problema es `TrustProxies` no configurado.

## Conclusión

El error "too many redirects" con HTTPS es casi siempre una combinación de: proxy que termina SSL + Laravel no configurado para confiar en ese proxy. La solución es configurar `TrustProxies` con `'*'` o las IPs específicas de tu proxy, asegurarte de que `APP_URL` usa `https://`, y que cualquier lógica de redirección solo se activa cuando `$request->isSecure()` devuelve `false` de forma confiable.
