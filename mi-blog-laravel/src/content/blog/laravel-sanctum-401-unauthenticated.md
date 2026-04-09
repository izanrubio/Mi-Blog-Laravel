---
title: 'Laravel Sanctum — Error 401 Unauthenticated en la API'
description: 'Soluciona el error 401 Unauthenticated con Laravel Sanctum: tokens incorrectos, middleware auth:sanctum, CORS y configuración del guard de API.'
pubDate: '2024-02-27'
tags: ['laravel', 'errores', 'sanctum', 'api', 'autenticacion']
---

Estás construyendo una API con Laravel Sanctum, envías una petición con tu token y recibes un `401 Unauthenticated`. Hay varias razones por las que esto puede ocurrir, y algunas son más sutiles de lo que parecen. Vamos a recorrerlas todas de forma sistemática.

## Instalación y configuración básica de Sanctum

Antes de debuggear, asegúrate de que Sanctum está correctamente instalado:

```bash
composer require laravel/sanctum

php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

php artisan migrate
```

Esto crea la tabla `personal_access_tokens` que necesita Sanctum para almacenar los tokens.

En tu modelo `User`, debes usar el trait `HasApiTokens`:

```php
<?php

namespace App\Models;

use Laravel\Sanctum\HasApiTokens;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;  // ← HasApiTokens es esencial
    
    // ...
}
```

Si te falta este trait, `createToken()` no existirá y el 401 es inevitable.

## Cómo crear y devolver tokens correctamente

El flujo correcto de login con Sanctum es:

```php
// app/Http/Controllers/AuthController.php

public function login(Request $request)
{
    $request->validate([
        'email'    => 'required|email',
        'password' => 'required',
    ]);

    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        return response()->json([
            'message' => 'Credenciales incorrectas'
        ], 401);
    }

    // Crear el token
    $token = $user->createToken('auth-token')->plainTextToken;

    return response()->json([
        'token' => $token,
        'user'  => $user,
    ]);
}
```

El `plainTextToken` es lo que debes guardar en el cliente. El objeto `createToken()` devuelve un `NewAccessToken` con el token en texto plano solo en el momento de creación. Después ya no puedes recuperarlo (solo su hash en la BD).

## El middleware auth:sanctum

Para proteger rutas con Sanctum, debes usar el middleware `auth:sanctum`, NO `auth`:

```php
// routes/api.php

// Rutas públicas (sin autenticación)
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Rutas protegidas
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    
    Route::apiResource('posts', PostController::class);
});
```

Si usas `auth` en lugar de `auth:sanctum`, Laravel buscará la sesión web, no el token de API.

## Cómo enviar el token correctamente

El error 401 más común ocurre porque el cliente no está enviando el token correctamente. Sanctum espera el token en el header `Authorization` como Bearer token:

```
Authorization: Bearer 1|TuTokenAqui...
```

### Probando con curl

```bash
# Primero, hacer login y capturar el token
curl -X POST http://tu-app.test/api/login \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"email":"usuario@example.com","password":"password"}'

# Respuesta esperada:
# {"token":"1|abc123...","user":{...}}

# Luego usar el token en peticiones protegidas
curl -X GET http://tu-app.test/api/user \
  -H "Authorization: Bearer 1|abc123..." \
  -H "Accept: application/json"
```

### El header Accept es importante

Sin `Accept: application/json`, cuando Sanctum rechaza la petición, puede hacer un redirect a `/login` (respuesta 302) en lugar de devolver un JSON 401. Siempre incluye este header en peticiones a la API.

## Autenticación SPA vs autenticación por token

Sanctum soporta dos modos de autenticación distintos:

### Modo token (para APIs móviles y terceros)

Es lo que hemos visto arriba. El cliente recibe un token y lo envía en cada petición como Bearer.

### Modo cookie/sesión (para SPAs en el mismo dominio)

Para SPAs que viven en el mismo dominio o subdominio:

```php
// config/sanctum.php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', sprintf(
    '%s%s',
    'localhost,localhost:3000,127.0.0.1,127.0.0.1:8000,::1',
    Sanctum::currentApplicationUrlWithPort()
))),
```

En este modo, el cliente hace una petición a `/sanctum/csrf-cookie` primero para obtener la cookie CSRF, y luego usa sesiones como una app web normal.

```php
// El frontend primero debe llamar:
// GET /sanctum/csrf-cookie

// Y luego puede autenticarse:
// POST /login (con credentials)

// Las siguientes peticiones funcionan automáticamente con la cookie de sesión
```

Si mezclas los dos modos (envías tokens de cookie-based auth en el header Bearer), obtendrás 401.

## CORS: el culpable invisible

Si tu frontend está en un dominio diferente al backend, necesitas configurar CORS. Un 401 puede parecer un problema de autenticación cuando en realidad es CORS bloqueando la petición.

En Laravel 11, CORS se configura en `config/cors.php`:

```php
return [
    'paths'                    => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods'          => ['*'],
    'allowed_origins'          => ['http://localhost:3000', 'https://tu-frontend.com'],
    'allowed_origins_patterns' => [],
    'allowed_headers'          => ['*'],
    'exposed_headers'          => [],
    'max_age'                  => 0,
    'supports_credentials'     => true,  // ← Necesario para cookies
];
```

## Verificar el guard en config/auth.php

Para que `auth:sanctum` funcione, el guard de API debe estar configurado:

```php
// config/auth.php
'guards' => [
    'web' => [
        'driver'   => 'session',
        'provider' => 'users',
    ],
    
    'api' => [
        'driver'   => 'sanctum',  // ← Debe ser 'sanctum', no 'token' ni 'passport'
        'provider' => 'users',
    ],
],
```

## Debuggear con Tinker

Si no estás seguro de si el token existe en la base de datos:

```bash
php artisan tinker

# Ver todos los tokens
>>> \Laravel\Sanctum\PersonalAccessToken::all()

# Buscar un token específico (por el ID antes del |)
>>> \Laravel\Sanctum\PersonalAccessToken::find(1)

# Ver los tokens de un usuario
>>> \App\Models\User::find(1)->tokens
```

## Conclusión

El 401 de Sanctum normalmente viene de una de estas causas: falta el trait `HasApiTokens`, el middleware es `auth` en lugar de `auth:sanctum`, el token no se envía correctamente como Bearer, o hay un problema de CORS que enmascara el error real. Sigue el checklist en ese orden y encontrarás el problema en menos de diez minutos.
