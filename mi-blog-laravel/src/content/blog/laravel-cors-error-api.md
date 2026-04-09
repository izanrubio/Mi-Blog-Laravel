---
title: 'CORS error en Laravel API — Cómo solucionarlo correctamente'
description: 'Soluciona los errores CORS en tu API Laravel. Configura el middleware CORS en Laravel 11 para permitir peticiones desde tu frontend correctamente.'
pubDate: '2024-02-07'
tags: ['laravel', 'errores', 'cors', 'api']
---

# CORS error en Laravel API — Cómo solucionarlo correctamente

Si estás construyendo una API con Laravel y un frontend separado (React, Vue, Angular, o cualquier aplicación JavaScript), probablemente te hayas encontrado con el error CORS. La consola del navegador te muestra algo como "Access to fetch at 'http://api.tudominio.com' from origin 'http://app.tudominio.com' has been blocked by CORS policy" y la petición simplemente no funciona.

En esta guía vamos a explicar qué es CORS, por qué existe y cómo configurarlo correctamente en Laravel.

## ¿Qué es CORS?

CORS significa Cross-Origin Resource Sharing (Compartición de Recursos entre Orígenes). Es una política de seguridad que los navegadores implementan para proteger a los usuarios.

La regla básica es: **un navegador no permite que código JavaScript de un origen (dominio + puerto + protocolo) haga peticiones a un origen diferente**, a menos que el servidor de destino lo permita explícitamente.

Un "origen" es la combinación de:
- Protocolo: `http` vs `https`
- Dominio: `tudominio.com` vs `api.tudominio.com`
- Puerto: `:3000` vs `:8000`

Por ejemplo, estas son peticiones cross-origin:

- `http://localhost:3000` haciendo una petición a `http://localhost:8000` (diferente puerto)
- `https://miapp.com` haciendo una petición a `https://api.miapp.com` (diferente subdominio)
- `http://miapp.com` haciendo una petición a `https://miapp.com` (diferente protocolo)

Importante: CORS es una restricción **del navegador**, no del servidor. Las peticiones desde Postman, curl o código PHP del servidor no están sujetas a CORS.

## Cómo funciona CORS (preflight)

Para peticiones "no simples" (con headers personalizados, JSON, métodos PUT/DELETE, etc.), el navegador primero envía una **petición OPTIONS** al servidor para preguntar si tiene permiso para hacer la petición real. Esto se llama "preflight request".

El servidor debe responder a esta petición OPTIONS con los headers CORS correctos. Si el servidor no responde correctamente, el navegador bloquea la petición real y ves el error CORS.

Los headers CORS que el servidor debe incluir en la respuesta:

```
Access-Control-Allow-Origin: https://miapp.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Allow-Credentials: true
```

## Configurar CORS en Laravel 11

Laravel incluye soporte nativo para CORS a través del paquete `fruitcake/laravel-cors`, que viene instalado por defecto. La configuración se hace en `config/cors.php`.

Si el archivo no existe, publícalo:

```php
php artisan config:publish cors
// O:
php artisan vendor:publish --tag="cors"
```

El archivo `config/cors.php` generado:

```php
<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
```

### Configuración para desarrollo

Para desarrollo, lo más simple es permitir todos los orígenes:

```php
return [
    'paths' => ['api/*'],
    'allowed_methods' => ['*'],
    'allowed_origins' => ['*'],  // Permite cualquier origen
    'allowed_headers' => ['*'],
    'supports_credentials' => false,
];
```

**Advertencia**: `allowed_origins: ['*']` es conveniente para desarrollo pero NO deberías usarlo en producción. En producción, especifica exactamente qué dominios tienen permitido hacer peticiones.

### Configuración para producción

```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [
        'https://miapp.com',
        'https://www.miapp.com',
        'https://admin.miapp.com',
    ],

    'allowed_origins_patterns' => [
        // Regex para orígenes dinámicos (por ejemplo, preview deploys):
        // '#^https://deploy-\w+\.miapp\.com$#'
    ],

    'allowed_headers' => [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-TOKEN',
        'Accept',
        'Origin',
    ],

    'exposed_headers' => [],

    'max_age' => 86400,  // 24 horas de caché del preflight

    'supports_credentials' => true,  // Para enviar cookies con las peticiones
];
```

### El middleware CORS en Laravel 11

En Laravel 11, el middleware CORS se registra automáticamente para las rutas API. Puedes verificarlo en `bootstrap/app.php`:

```php
// bootstrap/app.php
->withMiddleware(function (Middleware $middleware) {
    // El middleware HandleCors se aplica globalmente
    // No necesitas hacer nada adicional
})
```

Si por algún motivo necesitas aplicarlo solo a ciertas rutas:

```php
use Illuminate\Http\Middleware\HandleCors;

Route::middleware([HandleCors::class])->group(function () {
    Route::get('/api/productos', [ProductoController::class, 'index']);
});
```

## Configurar CORS en Laravel 10 y versiones anteriores

En Laravel 10, el middleware CORS se registra en `app/Http/Kernel.php`:

```php
protected $middleware = [
    \Illuminate\Http\Middleware\HandleCors::class,
    // ... otros middlewares
];
```

Verifica que `HandleCors` está en la lista de middlewares globales.

## El error más común: supports_credentials con allowed_origins wildcard

Este es el error de configuración CORS más frecuente: usar `allowed_origins: ['*']` junto con `supports_credentials: true`.

Los navegadores no permiten esta combinación. Si necesitas enviar credenciales (cookies, headers de autorización), **debes especificar orígenes concretos**:

```php
// INCORRECTO (el navegador lo rechazará):
return [
    'allowed_origins' => ['*'],
    'supports_credentials' => true,  // No funciona con wildcard
];

// CORRECTO:
return [
    'allowed_origins' => ['https://miapp.com'],
    'supports_credentials' => true,
];
```

## Laravel Sanctum y CORS

Si usas Laravel Sanctum para autenticación de SPAs, la configuración de CORS es especialmente importante. Sanctum usa cookies para la autenticación de SPAs y necesita que las credenciales estén habilitadas.

### Configuración de Sanctum para SPA

En `.env`:

```php
SANCTUM_STATEFUL_DOMAINS=localhost:3000,miapp.com
SESSION_DOMAIN=.miapp.com  // Para cookies en subdominos
```

En `config/sanctum.php`:

```php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
    Sanctum::currentApplicationUrlWithPort()
))),
```

En `config/cors.php`:

```php
return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_origins' => ['http://localhost:3000', 'https://miapp.com'],
    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],
    'supports_credentials' => true,
];
```

En el frontend (JavaScript), necesitas hacer primero una petición para obtener la cookie CSRF:

```php
// Paso 1: Obtener la cookie CSRF
await axios.get('https://api.miapp.com/sanctum/csrf-cookie');

// Paso 2: Ahora puedes hacer el login
await axios.post('https://api.miapp.com/login', {
    email: 'usuario@ejemplo.com',
    password: 'password',
});

// Paso 3: Peticiones autenticadas
const response = await axios.get('https://api.miapp.com/api/user');
```

## Solucionar CORS cuando no es un problema de configuración de Laravel

A veces el problema no es la configuración CORS en sí, sino otros factores:

### El servidor no está respondiendo correctamente

Nginx o Apache puede estar bloqueando o no pasando los headers CORS. Asegúrate de que la configuración de Nginx pasa correctamente las peticiones OPTIONS a PHP:

```php
// En tu configuración de Nginx:
location / {
    try_files $uri $uri/ /index.php?$query_string;
}

// Las peticiones OPTIONS también deben pasar a PHP:
location ~ \.php$ {
    fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
    fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    include fastcgi_params;
}
```

### Caché de la configuración de Laravel

Si modificas `config/cors.php` pero la configuración está en caché, los cambios no se aplicarán:

```php
php artisan config:clear
php artisan cache:clear
```

### El origen en la petición no coincide exactamente

El header `Origin` en la petición debe coincidir exactamente con uno de los orígenes en `allowed_origins`. Un trailing slash, diferente protocolo o diferente puerto hace que no coincida:

```php
// Estas son URLs DISTINTAS para CORS:
http://miapp.com
http://miapp.com/
https://miapp.com
http://www.miapp.com
```

## Depurar errores CORS

Para ver exactamente qué está pasando con CORS, abre las DevTools del navegador y ve a la pestaña Network:

1. Filtra las peticiones por la URL de tu API.
2. Busca la petición OPTIONS (el preflight).
3. Verifica los headers de respuesta del servidor.

Los headers que debes buscar en la respuesta:

```
Access-Control-Allow-Origin: https://miapp.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

Si estos headers no están presentes en la respuesta, el middleware CORS de Laravel no está funcionando correctamente.

También puedes usar `curl` para simular una petición preflight:

```php
curl -X OPTIONS https://api.miapp.com/api/productos \
  -H "Origin: https://miapp.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  -v
```

La respuesta debería incluir los headers `Access-Control-Allow-*`.

## Conclusión

Los errores CORS en Laravel son siempre solucionables con la configuración correcta en `config/cors.php`. El punto más importante es entender que CORS es una restricción del navegador, no del servidor, y que la solución es configurar el servidor para que envíe los headers correctos.

Para APIs REST simples sin autenticación de SPA, `allowed_origins: ['*']` con `supports_credentials: false` es suficiente. Para SPAs con Sanctum, necesitas orígenes específicos y credenciales habilitadas, y asegurarte de seguir el flujo de autenticación correcto con la cookie CSRF.
