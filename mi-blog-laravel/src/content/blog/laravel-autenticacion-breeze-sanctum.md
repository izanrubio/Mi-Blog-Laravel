---
title: 'Autenticación en Laravel: Breeze para web y Sanctum para APIs'
description: 'Aprende a implementar autenticación en Laravel con Breeze para aplicaciones web y Sanctum para APIs REST. Instalación, configuración y protección de rutas paso a paso.'
pubDate: '2026-04-16'
tags: ['laravel', 'autenticacion', 'seguridad', 'roadmap']
---

La autenticación es una de las primeras cosas que necesitas en cualquier aplicación seria. Laravel ofrece varias soluciones oficiales y cada una está pensada para un caso de uso diferente. En este artículo vamos a ver las dos más usadas: **Breeze** para aplicaciones web tradicionales y **Sanctum** para APIs REST.

## Panorama de las opciones de autenticación en Laravel

Antes de entrar en materia, conviene saber qué opciones tienes:

- **Laravel Breeze**: scaffolding mínimo de autenticación para aplicaciones web. Incluye login, registro, recuperación de contraseña y verificación de email. Usa Blade o puede configurarse con Inertia/Vue/React.
- **Laravel Jetstream**: más completo que Breeze, incluye gestión de equipos, autenticación de dos factores, gestión de sesiones, etc.
- **Laravel Sanctum**: pensado para autenticación de SPAs y APIs. Usa tokens de API simples o autenticación basada en cookies para SPAs.
- **Laravel Passport**: implementación completa de OAuth2 para APIs que necesitan autorización de terceros.

Para la mayoría de proyectos, **Breeze + Sanctum** cubre todo lo que necesitas.

## Laravel Breeze: autenticación para la web

### Instalación

Primero, crea un proyecto Laravel limpio o úsalo en uno existente:

```bash
composer require laravel/breeze --dev
php artisan breeze:install
```

Se te preguntará qué stack quieres usar. Para una aplicación tradicional con Blade:

```bash
php artisan breeze:install blade

npm install
npm run dev
php artisan migrate
```

### Qué genera Breeze

Después de la instalación, Breeze habrá creado:

- **Rutas**: en `routes/auth.php` (incluido automáticamente desde `routes/web.php`)
- **Controladores**: en `app/Http/Controllers/Auth/`
- **Vistas**: en `resources/views/auth/`
- **Middleware**: `EnsureEmailIsVerified`

Las rutas que se añaden incluyen login, registro, logout, recuperación de contraseña y verificación de email.

### Proteger rutas con el middleware auth

Una vez instalado Breeze, proteger cualquier ruta es tan sencillo como añadir el middleware `auth`:

```php
// routes/web.php

// Ruta protegida individual
Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Grupo de rutas protegidas
Route::middleware(['auth'])->group(function () {
    Route::get('/perfil', [ProfileController::class, 'show'])->name('profile.show');
    Route::put('/perfil', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/perfil', [ProfileController::class, 'destroy'])->name('profile.destroy');
});
```

Si un usuario no autenticado intenta acceder a estas rutas, Laravel lo redirige automáticamente a `/login`.

### El facade Auth

El facade `Auth` es tu herramienta principal para trabajar con el usuario autenticado:

```php
use Illuminate\Support\Facades\Auth;

// Obtener el usuario autenticado
$user = Auth::user();
echo $user->name;

// Obtener solo el ID (sin cargar el modelo completo)
$userId = Auth::id();

// Comprobar si hay un usuario autenticado
if (Auth::check()) {
    // El usuario está autenticado
}

// En Blade también tienes acceso directo
// {{ auth()->user()->name }}
// @auth ... @endauth
// @guest ... @endguest
```

En los controladores puedes usar el helper `auth()` o tipar la request:

```php
public function store(Request $request): RedirectResponse
{
    $user = $request->user(); // Alternativa a Auth::user()
    // ...
}
```

### Autenticación manual con Auth::attempt()

A veces necesitas autenticar a un usuario de forma programática, por ejemplo en un sistema de login personalizado:

```php
use Illuminate\Support\Facades\Auth;

public function login(Request $request): RedirectResponse
{
    $credentials = $request->validate([
        'email'    => ['required', 'email'],
        'password' => ['required'],
    ]);

    if (Auth::attempt($credentials, $request->boolean('remember'))) {
        $request->session()->regenerate();
        return redirect()->intended('dashboard');
    }

    return back()->withErrors([
        'email' => 'Las credenciales no coinciden con nuestros registros.',
    ])->onlyInput('email');
}
```

### Cerrar sesión

```php
public function logout(Request $request): RedirectResponse
{
    Auth::logout();

    $request->session()->invalidate();
    $request->session()->regenerateToken();

    return redirect('/');
}
```

## Laravel Sanctum: autenticación para APIs

### ¿Cuándo usar Sanctum?

Sanctum es la elección correcta cuando construyes:
- Una API REST consumida por tu propia SPA (Single Page Application)
- Una API móvil
- Cualquier API donde los clientes necesiten autenticarse con tokens

### Instalación

Sanctum viene incluido en Laravel desde la versión 11, pero si no lo tienes:

```bash
composer require laravel/sanctum
php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"
php artisan migrate
```

### Configurar el modelo User

Añade el trait `HasApiTokens` a tu modelo `User`:

```php
// app/Models/User.php
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    // ...
}
```

### Generar tokens de API

Para crear un token para un usuario, usa el método `createToken()`:

```php
// En el controlador de login de la API
public function login(Request $request): JsonResponse
{
    $request->validate([
        'email'    => 'required|email',
        'password' => 'required',
    ]);

    $user = User::where('email', $request->email)->first();

    if (! $user || ! Hash::check($request->password, $user->password)) {
        return response()->json([
            'message' => 'Credenciales incorrectas.',
        ], 401);
    }

    $token = $user->createToken('auth_token')->plainTextToken;

    return response()->json([
        'access_token' => $token,
        'token_type'   => 'Bearer',
        'user'         => $user,
    ]);
}
```

### Usar el token en las peticiones

El cliente debe enviar el token en el header `Authorization`:

```
Authorization: Bearer 1|AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

Con JavaScript/fetch:

```js
const response = await fetch('/api/user', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
  }
});
```

### Proteger rutas de la API con Sanctum

```php
// routes/api.php
use Illuminate\Support\Facades\Route;

// Rutas públicas (sin autenticación)
Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

// Rutas protegidas con Sanctum
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::apiResource('posts', PostController::class);
    Route::post('/logout', [AuthController::class, 'logout']);
});
```

### Revocar tokens (logout)

```php
public function logout(Request $request): JsonResponse
{
    // Revocar solo el token actual
    $request->user()->currentAccessToken()->delete();

    // O revocar todos los tokens del usuario
    // $request->user()->tokens()->delete();

    return response()->json(['message' => 'Sesión cerrada correctamente.']);
}
```

### Habilidades (abilities) de los tokens

Los tokens de Sanctum pueden tener habilidades específicas, similar a los scopes de OAuth:

```php
// Crear un token con habilidades específicas
$token = $user->createToken('token-admin', ['read:posts', 'create:posts', 'delete:posts'])->plainTextToken;

// O un token de solo lectura
$token = $user->createToken('token-lectura', ['read:posts'])->plainTextToken;
```

Verificar habilidades en el controlador:

```php
public function destroy(Request $request, Post $post): JsonResponse
{
    if (! $request->user()->tokenCan('delete:posts')) {
        return response()->json(['message' => 'No tienes permiso para esta acción.'], 403);
    }

    $post->delete();

    return response()->json(['message' => 'Publicación eliminada.']);
}
```

### Listar y gestionar tokens

```php
// Ver todos los tokens de un usuario
$tokens = $request->user()->tokens;

// Revocar un token específico por ID
$request->user()->tokens()->where('id', $tokenId)->delete();
```

## Resumen: ¿cuándo usar cada uno?

| Necesidad | Solución |
|---|---|
| App web con login/registro clásico | Laravel Breeze |
| App web con más funcionalidades | Laravel Jetstream |
| API REST con tokens | Laravel Sanctum |
| OAuth2 / autorizar apps de terceros | Laravel Passport |

La combinación más habitual en proyectos modernos es tener Breeze para el panel de administración web y Sanctum para exponer una API que consume un frontend Vue/React o una app móvil.

## Conclusión

Laravel hace que implementar autenticación sea sorprendentemente sencillo. Con Breeze tienes login y registro funcionando en minutos, y con Sanctum puedes proteger tu API con tokens de forma segura. Dominar estas dos herramientas es fundamental en el roadmap de cualquier desarrollador Laravel.
