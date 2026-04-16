---
modulo: 4
leccion: 6
title: 'Autenticación con Laravel Breeze'
description: 'Implementa autenticación completa en Laravel con Breeze: registro, login, logout y protección de rutas en minutos con scaffolding listo para usar.'
duracion: '25 min'
quiz:
  - pregunta: '¿Cuál es el comando para instalar Laravel Breeze en un proyecto existente?'
    opciones:
      - 'php artisan breeze:install'
      - 'composer require laravel/breeze && php artisan breeze:install'
      - 'php artisan auth:install breeze'
      - 'composer install laravel/breeze'
    correcta: 1
    explicacion: 'Primero hay que instalar el paquete con Composer y luego ejecutar php artisan breeze:install para que publique los archivos necesarios.'
  - pregunta: '¿Qué ruta redirige a los usuarios después de iniciar sesión correctamente por defecto en Breeze?'
    opciones:
      - '/home'
      - '/index'
      - '/dashboard'
      - '/profile'
    correcta: 2
    explicacion: 'Por defecto, Breeze redirige a los usuarios autenticados a /dashboard tras un login exitoso.'
  - pregunta: '¿Qué middleware protege una ruta para que solo los usuarios autenticados puedan acceder?'
    opciones:
      - 'middleware("login")'
      - 'middleware("session")'
      - 'middleware("verified")'
      - 'middleware("auth")'
    correcta: 3
    explicacion: 'El middleware auth verifica que el usuario esté autenticado. Si no lo está, lo redirige a la página de login automáticamente.'
---

## ¿Qué es Laravel Breeze?

Implementar un sistema de autenticación completo desde cero requiere horas de trabajo: formularios de registro y login, verificación de emails, recuperación de contraseña, gestión de sesiones, protección CSRF... Laravel Breeze hace todo esto por ti en minutos.

**Laravel Breeze** es un paquete oficial de Laravel que genera scaffolding de autenticación: los controladores, vistas, rutas y migraciones necesarios para tener un sistema de login funcional, seguro y personalizable.

Breeze ofrece varias opciones de frontend:
- **Blade**: vistas PHP clásicas con Tailwind CSS (la más sencilla)
- **Livewire**: componentes reactivos sin JavaScript complejo
- **Inertia + Vue**: Single Page Application con Vue.js
- **Inertia + React**: Single Page Application con React
- **API**: solo el backend, para proyectos con frontend separado

En esta lección usaremos la opción **Blade**, la más directa para aprender.

## Instalar Laravel Breeze

Primero asegúrate de tener un proyecto Laravel con la base de datos configurada. Luego:

```bash
# Instalar el paquete con Composer
composer require laravel/breeze --dev

# Instalar el scaffolding de Blade
php artisan breeze:install blade

# Instalar las dependencias de JavaScript (Tailwind CSS)
npm install

# Compilar los assets
npm run build

# Ejecutar las migraciones (crea la tabla de usuarios)
php artisan migrate
```

Después de estos comandos, tu aplicación ya tiene:
- Registro de usuarios (`/register`)
- Login (`/login`)
- Logout
- Dashboard protegido (`/dashboard`)
- Actualización del perfil (`/profile`)
- Cambio de contraseña
- Verificación de email (opcional)
- Recuperación de contraseña

## Estructura que Genera Breeze

Breeze crea los siguientes archivos:

```
app/Http/Controllers/Auth/
    AuthenticatedSessionController.php  ← Login/Logout
    ConfirmablePasswordController.php   ← Confirmar contraseña
    EmailVerificationController.php     ← Verificar email
    NewPasswordController.php           ← Nueva contraseña (reset)
    PasswordController.php              ← Cambiar contraseña
    PasswordResetLinkController.php     ← Solicitar reset de contraseña
    RegisteredUserController.php        ← Registro

resources/views/auth/
    confirm-password.blade.php
    forgot-password.blade.php
    login.blade.php
    register.blade.php
    reset-password.blade.php
    verify-email.blade.php

resources/views/
    dashboard.blade.php
    profile/
        edit.blade.php
        partials/
            delete-user-form.blade.php
            update-password-form.blade.php
            update-profile-information-form.blade.php

routes/
    auth.php    ← Todas las rutas de autenticación
```

## Las Rutas de Autenticación

Breeze crea `routes/auth.php` con todas las rutas necesarias. Este archivo se incluye automáticamente en `routes/web.php`:

```php
// routes/web.php
require __DIR__.'/auth.php';
```

Las rutas más importantes que contiene `auth.php`:

```php
// Registro
Route::get('register', [RegisteredUserController::class, 'create'])
    ->middleware('guest')
    ->name('register');

Route::post('register', [RegisteredUserController::class, 'store'])
    ->middleware('guest');

// Login
Route::get('login', [AuthenticatedSessionController::class, 'create'])
    ->middleware('guest')
    ->name('login');

Route::post('login', [AuthenticatedSessionController::class, 'store'])
    ->middleware('guest');

// Logout
Route::post('logout', [AuthenticatedSessionController::class, 'destroy'])
    ->middleware('auth')
    ->name('logout');
```

## Proteger Rutas con el Middleware Auth

Una vez instalado Breeze, proteger tus propias rutas es trivial:

```php
// routes/web.php
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\PedidoController;

// Rutas públicas (sin middleware)
Route::get('/', [HomeController::class, 'index'])->name('home');
Route::get('/catalogo', [CatalogoController::class, 'index'])->name('catalogo');

// Dashboard generado por Breeze
Route::get('/dashboard', function () {
    return view('dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

// Rutas que requieren autenticación
Route::middleware(['auth'])->group(function () {
    Route::get('/pedidos', [PedidoController::class, 'index'])->name('pedidos.index');
    Route::resource('productos', ProductoController::class);
    Route::get('/perfil-usuario', [PerfilController::class, 'show'])->name('perfil');
});
```

Si un usuario no autenticado intenta acceder a `/pedidos`, Laravel lo redirige automáticamente a `/login`.

## El Modelo User

Breeze usa el modelo `App\Models\User` que viene por defecto en Laravel. Su migración crea la tabla `users`:

```php
// database/migrations/0001_01_01_000000_create_users_table.php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamp('email_verified_at')->nullable();
    $table->string('password');
    $table->rememberToken();
    $table->timestamps();
});
```

## Acceder al Usuario Autenticado

En cualquier parte de tu aplicación puedes obtener el usuario que ha iniciado sesión:

```php
// En un controlador
use Illuminate\Support\Facades\Auth;

public function index()
{
    // Obtener el usuario autenticado
    $usuario = Auth::user();
    $usuarioId = Auth::id();

    // O usando el helper
    $usuario = auth()->user();

    // También desde el Request
    $usuario = $request->user();

    return view('mi-vista', compact('usuario'));
}
```

En una vista Blade:

```html
@auth
    <p>Bienvenido, {{ auth()->user()->name }}</p>
    <a href="{{ route('profile.edit') }}">Mi perfil</a>
    
    <form method="POST" action="{{ route('logout') }}">
        @csrf
        <button type="submit">Cerrar sesión</button>
    </form>
@endauth

@guest
    <a href="{{ route('login') }}">Iniciar sesión</a>
    <a href="{{ route('register') }}">Registrarse</a>
@endguest
```

Las directivas `@auth` y `@guest` son atajos muy limpios para mostrar contenido según el estado de autenticación.

## Personalizar el Registro

El controlador de registro `RegisteredUserController` se puede personalizar. Por ejemplo, añadir un campo de teléfono:

```php
// En la migración, añadir la columna
$table->string('telefono')->nullable();

// En el modelo User, añadirla al fillable
protected $fillable = [
    'name',
    'email',
    'password',
    'telefono',
];

// En RegisteredUserController::store()
public function store(Request $request): RedirectResponse
{
    $request->validate([
        'name'      => ['required', 'string', 'max:255'],
        'email'     => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
        'password'  => ['required', 'confirmed', Rules\Password::defaults()],
        'telefono'  => ['nullable', 'string', 'max:20'],
    ]);

    $user = User::create([
        'name'      => $request->name,
        'email'     => $request->email,
        'password'  => Hash::make($request->password),
        'telefono'  => $request->telefono,
    ]);

    event(new Registered($user));
    Auth::login($user);

    return redirect(route('dashboard', absolute: false));
}
```

También debes añadir el campo en la vista `resources/views/auth/register.blade.php`.

## Redirigir Después del Login

Por defecto, después del login Breeze redirige a `/dashboard`. Para cambiar esto, modifica la constante `HOME` en `app/Http/Controllers/Auth/AuthenticatedSessionController.php` o directamente en el controlador:

```php
// Redirigir según el rol del usuario
public function store(LoginRequest $request): RedirectResponse
{
    $request->authenticate();
    $request->session()->regenerate();

    $usuario = auth()->user();

    if ($usuario->es_admin) {
        return redirect()->route('admin.dashboard');
    }

    return redirect()->intended(route('dashboard', absolute: false));
}
```

## Verificación de Email

Breeze incluye soporte para verificación de email. Para activarla, el modelo User debe implementar `MustVerifyEmail`:

```php
// app/Models/User.php
use Illuminate\Contracts\Auth\MustVerifyEmail;

class User extends Authenticatable implements MustVerifyEmail
{
    // ...
}
```

Y en las rutas, añadir el middleware `verified`:

```php
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', fn () => view('dashboard'))->name('dashboard');
});
```

Si el usuario no ha verificado su email, será redirigido a una página que le pide hacerlo.

## Logout Seguro

El logout en Breeze usa `POST` (no `GET`) para prevenir que un enlace malicioso pueda cerrar la sesión del usuario sin su consentimiento. En tus vistas:

```html
<form method="POST" action="{{ route('logout') }}">
    @csrf
    <button type="submit" class="btn-logout">
        Cerrar sesión
    </button>
</form>
```

## Resumen

Laravel Breeze convierte en minutos lo que serían días de trabajo en un sistema de autenticación completo, seguro y mantenible. La clave de Breeze es que el código generado es tuyo: puedes leerlo, entenderlo y modificarlo libremente. No es una caja negra. Con autenticación en marcha y el middleware `auth` protegiendo tus rutas, tienes la base perfecta para construir cualquier aplicación web con áreas privadas. Este es el punto de partida para el siguiente módulo, donde profundizaremos en Eloquent ORM y la capa de datos.
