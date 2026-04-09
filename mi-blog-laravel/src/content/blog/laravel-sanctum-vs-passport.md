---
title: 'Laravel Sanctum vs Passport — Diferencias reales para tu API'
description: 'Elige entre Laravel Sanctum y Passport para autenticación API: diferencias de OAuth2, casos de uso, complejidad y cuál es mejor para cada tipo de proyecto.'
pubDate: '2026-04-09'
tags: ['laravel', 'sanctum', 'passport', 'api', 'autenticacion', 'comparativa']
---

"¿Uso Sanctum o Passport para mi API?" es una pregunta muy frecuente. La respuesta depende de si realmente necesitas OAuth2. La mayoría de los proyectos no lo necesitan, y elegir Passport cuando Sanctum es suficiente añade complejidad innecesaria.

## La diferencia fundamental

**Sanctum** es un sistema de autenticación ligero para APIs propias y SPAs. No es OAuth2. Es perfecto para apps donde tú controlas tanto el backend como el cliente (tu app móvil, tu SPA).

**Passport** es una implementación completa de OAuth2 para Laravel. Es para cuando necesitas autenticación federada: que otras aplicaciones de terceros puedan acceder a tu API en nombre de tus usuarios.

La pregunta clave: **¿Necesitas que apps de terceros se autentiquen con tu API?**

- No → Usa Sanctum
- Sí → Usa Passport

## Laravel Sanctum: autenticación simple y efectiva

### Instalación

```bash
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

En el modelo `User`:

```php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;
}
```

### Autenticación por token (para apps móviles y SPAs externas)

```php
// Controlador de login
public function login(Request $request)
{
    $request->validate([
        'email'       => 'required|email',
        'password'    => 'required',
        'device_name' => 'required',  // Para identificar el dispositivo
    ]);

    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['Las credenciales son incorrectas.'],
        ]);
    }

    // Crear token para este dispositivo
    $token = $user->createToken($request->device_name)->plainTextToken;

    return response()->json([
        'token' => $token,
        'user'  => new UserResource($user),
    ]);
}

// Logout: revocar el token actual
public function logout(Request $request)
{
    $request->user()->currentAccessToken()->delete();
    
    return response()->json(['message' => 'Sesión cerrada']);
}

// Logout de todos los dispositivos
public function logoutAll(Request $request)
{
    $request->user()->tokens()->delete();
    
    return response()->json(['message' => 'Todas las sesiones cerradas']);
}
```

### Abilities: permisos por token

Sanctum permite definir qué puede hacer cada token:

```php
// Crear token con abilities específicas
$token = $user->createToken('mobile-app', [
    'read:posts',
    'create:comments',
    // 'delete:posts' no está incluido → este token no puede borrar posts
])->plainTextToken;

// Verificar ability en el controlador
public function destroy(Post $post)
{
    if (!$request->user()->tokenCan('delete:posts')) {
        return response()->json(['error' => 'No autorizado'], 403);
    }
    
    $post->delete();
}
```

### Autenticación para SPAs (misma sesión que la web)

Para SPAs en el mismo dominio, Sanctum puede usar cookies de sesión:

```php
// config/sanctum.php
'stateful' => explode(',', env('SANCTUM_STATEFUL_DOMAINS', 'localhost,localhost:3000')),
```

El SPA llama a `/sanctum/csrf-cookie` primero y luego puede usar las mismas cookies de sesión que la app web.

## Laravel Passport: OAuth2 completo

### Cuándo realmente necesitas OAuth2

OAuth2 tiene sentido cuando:

1. **Terceras aplicaciones** quieren acceder a tu API en nombre de tus usuarios (como GitHub o Google permiten esto)
2. Necesitas **authorization codes** para flujos tipo "Conectar con [Tu App]"
3. Necesitas **refresh tokens** de larga duración
4. Tu API es un **servicio público** que otros desarrolladores van a usar

Ejemplos reales: una empresa que ofrece una API pública donde sus clientes pueden registrar sus propias aplicaciones y autenticarse.

### Instalación de Passport

```bash
composer require laravel/passport
php artisan passport:install
# Esto crea las claves de encriptación y los clientes por defecto
```

```php
use Laravel\Passport\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;  // Passport tiene su propio HasApiTokens
}
```

```php
// config/auth.php
'guards' => [
    'api' => [
        'driver'   => 'passport',  // No 'sanctum'
        'provider' => 'users',
    ],
],
```

### Los grant types de OAuth2 en Passport

```php
// 1. Authorization Code Grant (para apps de terceros)
// El usuario es redirigido a tu app para autorizar, luego vuelve con un código
Route::get('/oauth/authorize', [AuthorizationController::class, 'authorize']);
Route::post('/oauth/authorize', [ApproveAuthorizationController::class, 'approve']);

// 2. Client Credentials Grant (para server-to-server sin usuario)
// Una aplicación se autentica directamente, sin contexto de usuario
$response = Http::post('https://tu-api.com/oauth/token', [
    'grant_type'    => 'client_credentials',
    'client_id'     => 'client-id',
    'client_secret' => 'client-secret',
    'scope'         => '',
]);

// 3. Password Grant (para apps propias que conocen las credenciales del usuario)
// Deprecated en OAuth 2.1, pero común en sistemas legacy
$response = Http::post('https://tu-api.com/oauth/token', [
    'grant_type'    => 'password',
    'client_id'     => 'client-id',
    'client_secret' => 'client-secret',
    'username'      => 'usuario@example.com',
    'password'      => 'password',
    'scope'         => '',
]);
```

### Gestión de clientes OAuth

```bash
# Crear un cliente para una app de terceros
php artisan passport:client

# Crear cliente para personal access tokens
php artisan passport:client --personal

# Crear cliente de credenciales de cliente
php artisan passport:client --client
```

```php
// Los usuarios pueden ver y revocar sus tokens autorizados
// Passport incluye rutas para esto:
Passport::routes();
// Esto registra: /oauth/tokens, /oauth/clients, /oauth/authorize, etc.
```

## Tabla comparativa rápida

| Característica | Sanctum | Passport |
|---|---|---|
| Complejidad de setup | Baja | Alta |
| OAuth2 | No | Sí completo |
| Authorization Code | No | Sí |
| Refresh tokens | No (tokens no expiran por defecto) | Sí |
| Personal Access Tokens | Sí | Sí |
| SPAs (mismo dominio) | Nativo | Posible |
| Apps de terceros | No | Sí (es su caso de uso principal) |
| Casos de uso | Tu app móvil, tu SPA | API pública, marketplace de integraciones |

## El error más común: usar Passport cuando no necesitas OAuth2

```php
// Escenario: tienes una app móvil React Native que consume tu API Laravel
// Tu app móvil = app propia, tú controlas el código

// MAL: usar Passport porque "suena más profesional"
// Resultado: meses de setup OAuth2 complejo, tokens de refresh, rotación de claves...

// BIEN: usar Sanctum
$token = $user->createToken('react-native-app')->plainTextToken;
// 5 minutos de setup, funciona perfectamente
```

Passport es sobre delegar acceso a terceros. Si no hay terceros involucrados, Sanctum es siempre la elección correcta.

## Coexistencia: Sanctum + Passport

En apps grandes, puedes usar ambos:

```php
// Sanctum para tu SPA y app móvil propia
// Passport para la API pública que ofrecen a developers externos

// config/auth.php
'guards' => [
    'web' => ['driver' => 'session', 'provider' => 'users'],
    'api' => ['driver' => 'sanctum', 'provider' => 'users'],
    'api-public' => ['driver' => 'passport', 'provider' => 'users'],
],
```

## Conclusión

El 90% de los proyectos Laravel deben usar Sanctum. Es simple, seguro y más que suficiente para APIs propias, apps móviles y SPAs. Passport es una herramienta excelente pero específica: úsala cuando construyas una plataforma donde desarrolladores externos necesitan autenticarse con tus usuarios. Si no estás en ese caso, Sanctum es la respuesta correcta y te ahorrará semanas de complejidad.
