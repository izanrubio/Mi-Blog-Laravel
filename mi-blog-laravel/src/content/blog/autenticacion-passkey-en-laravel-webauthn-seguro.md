---
title: 'Autenticación Passkey en Laravel: WebAuthn Seguro'
description: 'Implementa autenticación Passkey con WebAuthn en Laravel. Guía completa con Face ID, Touch ID y seguridad biométrica sin contraseñas.'
pubDate: '2026-05-13'
tags: ['laravel', 'autenticación', 'seguridad', 'webauthn', 'passkey']
---

## Introducción a la autenticación Passkey

La autenticación basada en contraseñas es uno de los mayores problemas de seguridad en la web moderna. Los usuarios reutilizan contraseñas débiles, sufren ataques de phishing y los desarrolladores deben gestionar bases de datos de credenciales cifradas. **Laravel acaba de lanzar soporte nativo para Passkey**, una alternativa revolucionaria que elimina las contraseñas tradicionales.

Los Passkey utilizan **WebAuthn**, un estándar W3C que permite autenticación biométrica (Face ID, Touch ID, Windows Hello) y llaves de seguridad físicas. En lugar de confiar en algo que *sabes* (contraseña), confías en algo que *tienes* (dispositivo) o algo que *eres* (biometría).

Este artículo te mostrará cómo implementar Passkey en Laravel desde cero.

## ¿Qué es WebAuthn y por qué importa?

WebAuthn es un protocolo de autenticación basado en criptografía de clave pública. El proceso funciona así:

1. **Registro**: El dispositivo crea un par de claves (pública/privada). La clave privada nunca abandona el dispositivo. Solo la clave pública se envía al servidor.

2. **Autenticación**: Cuando el usuario intenta iniciar sesión, el servidor envía un desafío. El dispositivo firma ese desafío con la clave privada. El servidor verifica la firma con la clave pública.

**Ventajas clave:**

- No hay contraseñas para robar
- Imposible de hacer phishing (vinculado al dominio)
- Compatible con biometría nativa del dispositivo
- Funciona offline en muchos casos
- Retrocompatible con navegadores modernos

## Instalación del paquete Passkey de Laravel

Laravel proporciona un paquete first-party `laravel/passkey` para manejar toda la lógica de WebAuthn.

```bash
composer require laravel/passkey
```

Publica los assets y configuración:

```bash
php artisan passkey:install
```

Esto crea:
- Tablas de migración para almacenar Passkeys
- Configuración en `config/passkey.php`
- Vistas y componentes necesarios

Ejecuta las migraciones:

```bash
php artisan migrate
```

## Configuración Inicial

Abre `config/passkey.php`:

```php
<?php

return [
    'driver' => env('PASSKEY_DRIVER', 'eloquent'),

    'table' => 'passkeys',

    'model' => App\Models\Passkey::class,

    'user_model' => App\Models\User::class,

    // RP ID debe coincidir con tu dominio
    'rp_id' => env('PASSKEY_RP_ID', parse_url(env('APP_URL'), PHP_URL_HOST)),

    // Nombre de la aplicación que verá el usuario
    'rp_name' => env('APP_NAME', 'Mi Aplicación'),

    // Origen válido para WebAuthn
    'origins' => [
        env('APP_URL'),
    ],
];
```

Configura en `.env`:

```env
PASSKEY_RP_ID=tudominio.com
PASSKEY_DRIVER=eloquent
```

## Preparar el Modelo User

Primero, asegúrate de que el modelo `User` tenga una relación con los Passkeys:

```php
<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Spatie\LaravelPasskey\HasPasskeys;

class User extends Authenticatable
{
    use HasPasskeys;

    protected $fillable = [
        'name',
        'email',
        'password', // Todavía podemos mantener contraseña como fallback
    ];

    public function passkeys()
    {
        return $this->hasMany(Passkey::class);
    }
}
```

El trait `HasPasskeys` proporciona métodos para gestionar Passkeys.

## Crear Rutas para Registro de Passkey

En `routes/web.php`:

```php
<?php

use Illuminate\Support\Facades\Route;
use Laravel\Passkey\Http\Controllers\PasskeyController;
use App\Http\Controllers\Auth\PasskeyRegistrationController;

Route::middleware('auth')->group(function () {
    // Mostrar formulario para registrar nuevo Passkey
    Route::get('/account/passkeys', [PasskeyRegistrationController::class, 'show'])
        ->name('passkey.show');

    // Iniciar proceso de registro de Passkey
    Route::post('/account/passkeys', [PasskeyController::class, 'store'])
        ->name('passkey.store');

    // Eliminar un Passkey
    Route::delete('/account/passkeys/{passkey}', [PasskeyController::class, 'destroy'])
        ->name('passkey.destroy');
});

// Rutas de autenticación con Passkey
Route::get('/login/passkey', [PasskeyController::class, 'loginView'])
    ->name('passkey.login');

Route::post('/login/passkey', [PasskeyController::class, 'authenticate'])
    ->name('passkey.authenticate');
```

## Controlador de Registro de Passkey

Crea `app/Http/Controllers/Auth/PasskeyRegistrationController.php`:

```php
<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Request;

class PasskeyRegistrationController extends Controller
{
    /**
     * Mostrar la vista para registrar un nuevo Passkey
     */
    public function show(Request $request): View
    {
        $user = $request->user();
        $passkeys = $user->passkeys;

        return view('auth.passkey-register', [
            'passkeys' => $passkeys,
            'user' => $user,
        ]);
    }
}
```

## Vista de Registro de Passkey

Crea `resources/views/auth/passkey-register.blade.php`:

```blade
<div class="container mx-auto px-4 py-8">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 class="text-2xl font-bold mb-6">Gestionar Passkeys</h1>

        <!-- Mensaje de éxito -->
        @if (session('success'))
            <div class="mb-4 p-3 bg-green-100 text-green-700 rounded">
                {{ session('success') }}
            </div>
        @endif

        <!-- Botón para registrar nuevo Passkey -->
        <button
            id="register-passkey"
            type="button"
            class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 mb-6"
        >
            Registrar Nuevo Passkey
        </button>

        <!-- Lista de Passkeys registrados -->
        <div class="mt-6">
            <h2 class="text-lg font-semibold mb-3">Tus Passkeys</h2>
            @forelse ($passkeys as $passkey)
                <div class="flex justify-between items-center mb-3 p-3 border rounded">
                    <div>
                        <p class="font-medium">{{ $passkey->name ?? 'Passkey sin nombre' }}</p>
                        <p class="text-sm text-gray-500">
                            Registrado: {{ $passkey->created_at->format('d/m/Y H:i') }}
                        </p>
                    </div>
                    <form
                        action="{{ route('passkey.destroy', $passkey) }}"
                        method="POST"
                        onsubmit="return confirm('¿Eliminar este Passkey?')"
                    >
                        @csrf
                        @method('DELETE')
                        <button type="submit" class="text-red-600 hover:text-red-800">
                            Eliminar
                        </button>
                    </form>
                </div>
            @empty
                <p class="text-gray-500">Aún no has registrado ningún Passkey</p>
            @endforelse
        </div>
    </div>
</div>

<script>
    document.getElementById('register-passkey').addEventListener('click', async () => {
        try {
            // Solicitar opciones de registro al servidor
            const response = await fetch('/passkey/register/options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                }
            });

            const options = await response.json();

            // Crear el Passkey
            const credential = await navigator.credentials.create({
                publicKey: options
            });

            if (credential) {
                // Enviar el Passkey al servidor
                await fetch('{{ route("passkey.store") }}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
                    },
                    body: JSON.stringify(credential)
                });

                alert('¡Passkey registrado exitosamente!');
                location.reload();
            }
        } catch (error) {
            console.error('Error al registrar Passkey:', error);
            alert('No se pudo registrar el Passkey. Verifica que tu dispositivo sea compatible.');
        }
    });
</script>
```

## Vista de Login con Passkey

Crea `resources/views/auth/passkey-login.blade.php`:

```blade
<div class="container mx-auto px-4 py-8">
    <div class="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h1 class="text-2xl font-bold mb-6 text-center">Iniciar Sesión con Passkey</h1>

        @if ($errors->any())
            <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
                @foreach ($errors->all() as $error)
                    <p>{{ $error }}</p>
                @endforeach
            </div>
        @endif

        <button
            id="authenticate-passkey"
            type="button"
            class="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-lg font-semibold"
        >
            Iniciar Sesión
        </button>

        <p class="text-center text-gray-600 mt-4">
            <a href="{{ route('login') }}" class="text-blue-600 hover:underline">
                ¿Prefieres usar contraseña?
            </a>
        </p>
    </div>
</div>

<script>
    document.getElementById('authenticate-passkey').addEventListener('click', async () => {
        try {
            // Obtener opciones de autenticación
            const response = await fetch('/login/passkey/options', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const options = await response.json();

            // Pedir al usuario que confirme con biometría
            const assertion = await navigator.credentials.get({
                publicKey: options
            });

            if (assertion) {
                // Enviar respuesta al servidor
                const verifyResponse = await fetch('{{ route("passkey.authenticate") }}', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(assertion)
                });

                if (verifyResponse.ok) {
                    window.location.href = '/dashboard';
                } else {
                    alert('No se pudo autenticar. Intenta de nuevo.');
                }
            }
        } catch (error) {
            console.error('Error de autenticación:', error);
            alert('Error al iniciar sesión. Asegúrate de usar un dispositivo compatible.');
        }
    });
</script>
```

## Flujo de Autenticación Completo

El paquete de Laravel maneja internamente la lógica criptográfica. El flujo es:

```
1. Usuario hace clic en "Iniciar Sesión"
   ↓
2. Servidor genera un desafío aleatorio
   ↓
3. Navegador solicita al dispositivo que firme el desafío
   ↓
4. Dispositivo autentica con biometría/PIN y devuelve la firma
   ↓
5. Servidor verifica la firma con la clave pública almacenada
   ↓
6. Si es válida, se inicia la sesión
```

## Manejo de Errores Comunes

### Dispositivo no compatible

```php
// En tu controlador
try {
    $passkey = $user->passkeys()->create([
        'credential_id' => $credentialId,
        'public_key' => $publicKey,
    ]);
} catch (\Exception $e) {
    return back()->withErrors(['device' => 'Tu dispositivo no soporta Passkey']);
}
```

### Usuario sin Passkey registrado

```php
public function authenticate(Request $request)
{
    $user = User::where('email', $request->email)->first();

    if (!$user || $user->passkeys()->count() === 0) {
        return back()->withErrors(['passkey' => 'Usuario no tiene Passkey registrado']);
    }

    // Continuar con verificación...
}
```

## Combinando Passkey con Autenticación Tradicional

Es recomendable permitir tanto Passkey como contraseña durante una fase de transición:

```php
// En tu controlador de login
public function login(Request $request)
{
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    $user = User::where('email', $request->email)->first();

    // Opción 1: Passkey
    if ($user && $user->passkeys()->count() > 0) {
        return redirect()->route('passkey.login');
    }

    // Opción 2: Contraseña
    if (Auth::attempt($request->only('email', 'password'))) {
        return redirect()->intended('/dashboard');
    }

    return back()->withErrors(['email' => 'Credenciales inválidas']);
}
```

## Seguridad y Buenas Prácticas

**1. Valida el origen**
El servidor debe verificar que la solicitud viene del dominio correcto:

```php
if (!in_array($_SERVER['HTTP_ORIGIN'], config('passkey.origins'))) {
    abort(403, 'Origen no autorizado');
}
```

**2. Rate limiting**
Protege contra ataques de fuerza bruta:

```php
Route::post('/login/passkey', [PasskeyController::class, 'authenticate'])
    ->middleware('throttle:5,1') // 5 intentos por minuto
    ->name('passkey.authenticate');
```

**3. Backup de Passkeys**
Permite que los usuarios registren múltiples Passkeys:

```php
// Un usuario puede tener varios Passkeys en diferentes dispositivos
$user->pass