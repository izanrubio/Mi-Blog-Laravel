---
title: 'Passwordless Auth en Laravel: Autenticación sin Contraseñas'
description: 'Implementa autenticación sin contraseñas en Laravel con magic links y códigos OTP. Guía completa con ejemplos de código y mejores prácticas.'
pubDate: '2026-01-15'
tags: ['laravel', 'autenticacion', 'seguridad', 'fortify']
---

## Autenticación Sin Contraseñas: El Futuro de la Seguridad en Laravel

Las contraseñas son el eslabón débil de la seguridad moderna. Los usuarios las olvidan, las reutilizan, y los atacantes las roban constantemente. **La autenticación sin contraseñas** (passwordless authentication) elimina este problema completamente, reemplazando contraseñas por métodos más seguros como magic links y códigos OTP (One-Time Password).

En esta guía aprenderás cómo implementar autenticación sin contraseñas en Laravel usando magic links, códigos de un único uso, y cómo integrarla con Laravel Fortify para agregar autenticación de dos factores. Al final, tendrás una solución de seguridad moderna y fácil de usar.

## ¿Por Qué Abandonar las Contraseñas?

### Problemas de las Contraseñas Tradicionales

Las contraseñas presentan varios problemas inherentes:

1. **Vulnerabilidad a phishing**: Los usuarios pueden ser engañados para revelar sus credenciales
2. **Reutilización**: Muchas personas usan la misma contraseña en múltiples sitios
3. **Olvidos frecuentes**: Genera costos de soporte y mal UX
4. **Fuerza bruta**: Atacantes pueden intentar adivinarlas
5. **Bases de datos comprometidas**: Un breach expone todas las contraseñas

### Ventajas de la Autenticación Sin Contraseñas

- **Mayor seguridad**: No hay contraseña que robar
- **Mejor UX**: Los usuarios solo necesitan acceso a su email
- **Reduce costos de soporte**: Menos resets de contraseña
- **Cumplimiento normativo**: Alineado con estándares modernos de seguridad
- **Flexibilidad**: Puedes combinar con 2FA para máxima seguridad

## Implementando Magic Links en Laravel

Los **magic links** son URLs únicas y con tiempo limitado que permiten login sin contraseña. El usuario recibe un enlace por email que lo autentica directamente.

### Paso 1: Configurar la Base de Datos

Primero, crea una migración para almacenar los tokens de magic link:

```bash
php artisan make:migration create_password_reset_tokens_table
```

```php
// database/migrations/2024_01_15_create_password_reset_tokens_table.php
Schema::create('password_reset_tokens', function (Blueprint $table) {
    $table->string('email')->primary();
    $table->string('token');
    $table->timestamp('created_at')->nullable();
});
```

También necesitas agregar una columna a la tabla `users` para rastrear login attempts:

```php
// database/migrations/2024_01_15_add_passwordless_to_users_table.php
Schema::table('users', function (Blueprint $table) {
    $table->timestamp('last_passwordless_login_at')->nullable();
    $table->string('passwordless_token')->nullable()->unique();
    $table->timestamp('passwordless_token_expires_at')->nullable();
});
```

### Paso 2: Crear el Controlador de Autenticación

```php
// app/Http/Controllers/Auth/PasswordlessAuthController.php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class PasswordlessAuthController extends Controller
{
    /**
     * Mostrar formulario de solicitud de magic link
     */
    public function showLinkRequestForm()
    {
        return view('auth.passwordless.request');
    }

    /**
     * Generar y enviar magic link
     */
    public function sendMagicLink(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ], [
            'email.exists' => 'No encontramos una cuenta con este email.',
        ]);

        $user = User::where('email', $request->email)->first();
        
        // Generar token único
        $token = Hash::make(Str::random(32));
        $plainToken = Str::random(32);

        // Guardar token en la base de datos
        $user->update([
            'passwordless_token' => hash('sha256', $plainToken),
            'passwordless_token_expires_at' => now()->addMinutes(15),
        ]);

        // Enviar email con magic link
        $user->notify(new \App\Notifications\PasswordlessMagicLinkNotification(
            url: route('auth.passwordless.verify', [
                'token' => $plainToken,
                'email' => $user->email,
            ])
        ));

        return back()->with('status', 
            'Hemos enviado un link mágico a tu email. Válido por 15 minutos.'
        );
    }

    /**
     * Verificar magic link y autenticar usuario
     */
    public function verifyMagicLink(Request $request, string $token)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->first();

        // Verificar token
        if (!hash_equals(
            $user->passwordless_token ?? '',
            hash('sha256', $token)
        )) {
            return redirect('/login')->with('error', 
                'El link mágico es inválido.'
            );
        }

        // Verificar expiración
        if ($user->passwordless_token_expires_at < now()) {
            return redirect('/login')->with('error', 
                'El link mágico ha expirado.'
            );
        }

        // Limpiar el token
        $user->update([
            'passwordless_token' => null,
            'passwordless_token_expires_at' => null,
            'last_passwordless_login_at' => now(),
        ]);

        // Autenticar usuario
        Auth::login($user);

        return redirect('/dashboard')->with('success', 
            '¡Bienvenido! Has iniciado sesión correctamente.'
        );
    }
}
```

### Paso 3: Crear la Notificación de Magic Link

```php
// app/Notifications/PasswordlessMagicLinkNotification.php
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class PasswordlessMagicLinkNotification extends Notification
{
    use Queueable;

    public function __construct(
        private string $url
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Tu link de acceso seguro')
            ->greeting('¡Hola ' . $notifiable->name . '!')
            ->line('Haz clic en el botón inferior para acceder a tu cuenta.')
            ->action('Acceder ahora', $this->url)
            ->line('Este link expira en 15 minutos.')
            ->line('Si no solicitaste este acceso, ignora este email.');
    }
}
```

### Paso 4: Configurar las Rutas

```php
// routes/web.php
Route::middleware('guest')->group(function () {
    Route::get('/login/passwordless', 
        [PasswordlessAuthController::class, 'showLinkRequestForm']
    )->name('auth.passwordless.request');
    
    Route::post('/login/passwordless', 
        [PasswordlessAuthController::class, 'sendMagicLink']
    )->name('auth.passwordless.send');
    
    Route::get('/login/verify/{token}', 
        [PasswordlessAuthController::class, 'verifyMagicLink']
    )->name('auth.passwordless.verify');
});
```

## Autenticación con Códigos OTP

Los códigos de un único uso (OTP) ofrecen más control: el usuario los genera o los recibe y los ingresa manualmente.

### Implementar OTP con TOTP

```php
// app/Services/OtpService.php
<?php

namespace App\Services;

use App\Models\User;

class OtpService
{
    /**
     * Generar código OTP de 6 dígitos
     */
    public function generateCode(): string
    {
        return str_pad(
            random_int(0, 999999),
            6,
            '0',
            STR_PAD_LEFT
        );
    }

    /**
     * Guardar código OTP para usuario
     */
    public function storeCode(User $user, string $code): void
    {
        $user->update([
            'otp_code' => hash('sha256', $code),
            'otp_expires_at' => now()->addMinutes(10),
            'otp_attempts' => 0,
        ]);
    }

    /**
     * Verificar código OTP
     */
    public function verify(User $user, string $code): bool
    {
        // Verificar expiración
        if ($user->otp_expires_at < now()) {
            return false;
        }

        // Limitar intentos fallidos
        if ($user->otp_attempts >= 3) {
            return false;
        }

        // Verificar código
        if (!hash_equals(
            $user->otp_code ?? '',
            hash('sha256', $code)
        )) {
            $user->increment('otp_attempts');
            return false;
        }

        // Limpiar código usado
        $user->update([
            'otp_code' => null,
            'otp_expires_at' => null,
            'otp_attempts' => 0,
        ]);

        return true;
    }
}
```

### Controlador para OTP

```php
// app/Http/Controllers/Auth/OtpAuthController.php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\OtpService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OtpAuthController extends Controller
{
    public function __construct(
        private OtpService $otpService
    ) {}

    /**
     * Solicitar código OTP
     */
    public function requestOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $user = User::where('email', $request->email)->first();
        
        // Generar código
        $code = $this->otpService->generateCode();
        $this->otpService->storeCode($user, $code);

        // Enviar por email
        $user->notify(new \App\Notifications\OtpCodeNotification($code));

        return back()->with('status', 
            'Hemos enviado un código de 6 dígitos a tu email.'
        );
    }

    /**
     * Verificar código OTP
     */
    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
            'code' => 'required|string|size:6',
        ]);

        $user = User::where('email', $request->email)->first();

        // Verificar código
        if (!$this->otpService->verify($user, $request->code)) {
            return back()->withErrors([
                'code' => 'El código es inválido o ha expirado.',
            ]);
        }

        // Autenticar
        Auth::login($user);

        return redirect('/dashboard');
    }
}
```

## Integración con Laravel Fortify y 2FA

Para máxima seguridad, puedes combinar passwordless auth con autenticación de dos factores:

```php
// config/fortify.php
'features' => [
    Features::registration(),
    Features::resetPasswords(),
    Features::emailVerification(),
    Features::twoFactorAuthentication([
        'confirmPassword' => true,
        'window' => 0,
    ]),
],
```

```php
// Middleware personalizado para passwordless + 2FA
class RequirePasswordlessThenTwoFactor
{
    public function handle(Request $request, Closure $next)
    {
        $user = Auth::user();

        // Si tiene 2FA habilitado, requerir verificación
        if ($user && $user->two_factor_enabled) {
            if (!session()->get('passwordless_2fa_verified')) {
                return redirect('/auth/two-factor-challenge');
            }
        }

        return $next($request);
    }
}
```

## Vistas Blade

Aquí está el formulario de solicitud de magic link:

```blade
<!-- resources/views/auth/passwordless/request.blade.php -->
<div class="min-h-screen flex items-center justify-center bg-gray-50">
    <div class="max-w-md w-full space-y-8">
        <div>
            <h2 class="text-3xl font-bold text-gray-900">
                Acceso sin contraseña
            </h2>
            <p class="mt-2 text-gray-600">
                Ingresa tu email y te enviaremos un link seguro
            </p>
        </div>

        @if (session('status'))
            <div class="rounded-md bg-green-50 p-4">
                <p class="text-sm text-green-700">
                    {{ session('status') }}
                </p>
            </div>
        @endif

        <form method="POST" action="{{ route('auth.passwordless.send') }}">
            @csrf
            
            <div>
                <label for="email" class="sr-only">Email</label>
                <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    class="block w-full px-4 py-2 border border-gray-300 rounded-md"
                    placeholder="tu@email.com"
                    value="{{ old('email') }}"
                >
                @error('email')
                    <p class="mt-1 text-sm text-red-600">{{ $message }}</p>
                @enderror
            </div>

            <button
                type="submit"
                class="w-full mt-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
                Enviar link mágico
            </button>
        </form>

        <p class="text-center text-gray-600">
            ¿Prefieres contraseña?
            <a href="{{ route('login') }}" class="text-blue-600 hover:underline">
                Inicia sesión aquí
            </a>
        </p>
    </div>
</div>
```

## Mejores Prácticas de Seguridad

### 1. Validación y Rate Limiting

```php
// Proteger contra ataques de fuerza bruta
Route::middleware([
    'throttle:3,15' // 3 intentos cada 15 minutos
])->group(function () {