---
title: 'Cooldown en Laravel: Controla Tiempos de Espera por Acción'
description: 'Implementa períodos de espera por acción en Laravel con la paquete Cooldown. Prevén abuso, protege APIs y controla tasa de solicitudes de forma fluida.'
pubDate: '2026-07-17'
tags: ['laravel', 'paquetes', 'seguridad', 'apis']
---

## Introdución

En aplicaciones modernas, proteger tus APIs y funcionalidades contra el abuso es fundamental. Un usuario malintencionado podría enviar múltiples solicitudes en segundos, causando problemas de rendimiento o consumiendo recursos innecesarios. **Cooldown en Laravel** es una solución elegante que implementa períodos de espera por acción, permitiendo que definas cuánto tiempo debe pasar entre cada ejecución de una acción específica.

A diferencia del rate limiting genérico, Cooldown trabaja a nivel de **acción individual** y por **propietario** (usuario, IP, o lo que definas). Es ideal para casos como:

- Envío de correos electrónicos de verificación
- Reintentos de autenticación fallida
- Publicación de comentarios o posts
- Solicitudes de cambio de contraseña
- Creación de recursos limitados

En este artículo, exploraremos cómo instalarlo, configurarlo y usarlo en tus proyectos Laravel.

## ¿Qué es Cooldown y por qué lo necesitas?

Cooldown es un paquete Laravel que enforza períodos de espera entre acciones. A diferencia del middleware de rate limiting que actúa globalmente, Cooldown opera a nivel granular: **por acción y por propietario**.

Imagina que quieres:
- Permitir que un usuario envíe un email de verificación solo una vez cada 5 minutos
- Limitar intentos de login fallidos a uno cada 10 segundos
- Permitir crear un post cada 2 minutos como máximo

Cooldown maneja esto de manera fluida con:

- **API fluida** para definición intuitiva
- **Trait de Eloquent** para integración directa en modelos
- **Middleware de ruta** para protección automática
- **Almacenamiento flexible** en caché o base de datos
- **Bloqueos atómicos** para evitar condiciones de carrera

## Instalación y Configuración

Primero, instala el paquete con Composer:

```bash
composer require spatie/laravel-cooldown
```

Opcionalmente, publica la configuración:

```bash
php artisan vendor:publish --provider="Spatie\Cooldown\CooldownServiceProvider"
```

Esto crea un archivo `config/cooldown.php` donde puedes personalizar el almacenamiento (caché o base de datos) y otros parámetros.

## Uso básico con la API fluida

El uso más simple es dentro de un controlador o comando:

```php
<?php

namespace App\Http\Controllers;

use Spatie\Cooldown\Facades\Cooldown;
use Illuminate\Http\Request;

class EmailVerificationController extends Controller
{
    public function sendVerificationEmail(Request $request)
    {
        $user = $request->user();
        
        // Verifica si el usuario está en cooldown
        if (Cooldown::for('send-verification-email')
            ->owner($user->id)
            ->isActive()) {
            return response()->json([
                'message' => 'Debes esperar antes de enviar otro email',
                'retry_after' => Cooldown::for('send-verification-email')
                    ->owner($user->id)
                    ->remainingSeconds()
            ], 429);
        }
        
        // Envía el email
        Mail::send(new VerificationMail($user));
        
        // Activa el cooldown por 5 minutos
        Cooldown::for('send-verification-email')
            ->owner($user->id)
            ->activateFor(minutes: 5);
        
        return response()->json(['message' => 'Email enviado']);
    }
}
```

En este ejemplo:
- `for('send-verification-email')` define la acción
- `owner($user->id)` especifica a quién aplica el cooldown
- `isActive()` verifica si está activo
- `remainingSeconds()` obtiene segundos restantes
- `activateFor()` inicia el período de espera

## Integración con modelos Eloquent

Usa el trait `HasCooldowns` en tus modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Cooldown\Traits\HasCooldowns;

class Post extends Model
{
    use HasCooldowns;
}
```

Ahora puedes trabajar directamente con la instancia:

```php
$post = auth()->user()->posts()->create($validated);

// Verifica cooldown
if ($post->cooldown('create-post')
    ->owner(auth()->id())
    ->isActive()) {
    return response()->json(['error' => 'Espera antes de crear otro post'], 429);
}

// Activa cooldown de 2 minutos
$post->cooldown('create-post')
    ->owner(auth()->id())
    ->activateFor(minutes: 2);
```

## Middleware de ruta

Protege rutas automáticamente con middleware:

```php
<?php

Route::post('/posts', [PostController::class, 'store'])
    ->middleware(\Spatie\Cooldown\Http\Middleware\Cooldown::class . ':create-post,5');

Route::post('/send-email', [EmailController::class, 'send'])
    ->middleware(\Spatie\Cooldown\Http\Middleware\Cooldown::class . ':send-email,3');
```

El middleware automáticamente:
- Verifica el cooldown
- Retorna 429 Too Many Requests si está activo
- Activa el cooldown después de la acción

## Casos de uso avanzados

### Cooldown con diferentes propietarios

A veces necesitas múltiples propietarios (usuario + IP, por ejemplo):

```php
Cooldown::for('api-request')
    ->owner(auth()->id())
    ->owner(request()->ip())
    ->isActive();
```

### Obtener información del cooldown

```php
$cooldown = Cooldown::for('send-verification-email')
    ->owner($user->id);

// Verificar estado completo
if ($cooldown->isActive()) {
    $remaining = $cooldown->remainingSeconds();
    $expires = $cooldown->expiresAt();
    
    return response()->json([
        'status' => 'cooldown_active',
        'retry_after' => $remaining,
        'expires_at' => $expires
    ], 429);
}
```

### Restablecimiento manual

```php
// Elimina el cooldown activo
Cooldown::for('send-verification-email')
    ->owner($user->id)
    ->reset();

// Ahora puede ejecutar la acción nuevamente
```

### En Jobs y Queues

Integra cooldown en tareas en segundo plano:

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Spatie\Cooldown\Facades\Cooldown;

class SendNotificationEmail implements ShouldQueue
{
    public function __construct(
        public int $userId
    ) {}

    public function handle()
    {
        // Verifica antes de procesar
        if (Cooldown::for('notification-email')
            ->owner($this->userId)
            ->isActive()) {
            return; // Skip si está en cooldown
        }

        // Procesa la notificación
        // ...

        // Activa cooldown de 1 hora
        Cooldown::for('notification-email')
            ->owner($this->userId)
            ->activateFor(hours: 1);
    }
}
```

## Almacenamiento en base de datos

Por defecto, Cooldown usa caché. Para usar base de datos, modifica `config/cooldown.php`:

```php
return [
    'driver' => 'database',
];
```

Crea la tabla con migración:

```bash
php artisan make:migration create_cooldowns_table
```

```php
<?php

Schema::create('cooldowns', function (Blueprint $table) {
    $table->id();
    $table->string('action');
    $table->string('owner');
    $table->timestamp('expires_at');
    $table->timestamps();
    
    $table->unique(['action', 'owner']);
});
```

## Respuestas HTTP amigables

Implementa una respuesta consistente:

```php
<?php

namespace App\Http\Controllers;

use Spatie\Cooldown\Facades\Cooldown;

class ApiController extends Controller
{
    protected function checkCooldown(string $action, $owner, int $minutes = 5)
    {
        if (Cooldown::for($action)->owner($owner)->isActive()) {
            $remaining = Cooldown::for($action)
                ->owner($owner)
                ->remainingSeconds();
            
            return response()->json([
                'message' => 'Acción muy frecuente',
                'retry_after' => $remaining,
            ], 429);
        }
    }

    protected function activateCooldown(string $action, $owner, int $minutes = 5)
    {
        Cooldown::for($action)
            ->owner($owner)
            ->activateFor(minutes: $minutes);
    }
}
```

Úsalo así:

```php
public function store(Request $request)
{
    if ($response = $this->checkCooldown('create-resource', auth()->id())) {
        return $response;
    }

    // Lógica de creación...

    $this->activateCooldown('create-resource', auth()->id(), minutes: 2);

    return response()->json(['success' => true]);
}
```

## Testing con Cooldown

Desactiva cooldown en tests:

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Spatie\Cooldown\Facades\Cooldown;

class CooldownTest extends TestCase
{
    public function test_cooldown_prevents_duplicate_action()
    {
        $user = User::factory()->create();

        // Primera solicitud: éxito
        $response = $this->actingAs($user)->post('/send-email');
        $response->assertOk();

        // Segunda inmediata: bloqueada
        $response = $this->actingAs($user)->post('/send-email');
        $response->assertStatus(429);
    }

    public function test_cooldown_expires()
    {
        $user = User::factory()->create();

        Cooldown::fake(); // Desactiva en tests si es necesario
    }
}
```

## Integración con autenticación

Protege intentos de login:

```php
<?php

namespace App\Http\Controllers\Auth;

use Spatie\Cooldown\Facades\Cooldown;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function store(Request $request)
    {
        $email = $request->email;

        // Verifica cooldown por IP e email
        if (Cooldown::for('login-attempt')
            ->owner($email)
            ->isActive()) {
            throw ValidationException::withMessages([
                'email' => 'Demasiados intentos. Intenta más tarde.'
            ]);
        }

        if (!Auth::attempt($request->only('email', 'password'))) {
            // Activa cooldown después de fallo
            Cooldown::for('login-attempt')
                ->owner($email)
                ->activateFor(minutes: 5);

            throw ValidationException::withMessages([
                'email' => 'Credenciales inválidas.'
            ]);
        }

        return redirect('/dashboard');
    }
}
```

## Puntos clave

- **Cooldown** implementa límites de tiempo por acción y propietario, no globales
- Usa **API fluida** para verificar y activar períodos de espera
- El **trait HasCooldowns** integra cooldown directamente en modelos Eloquent
- **Middleware automático** protege rutas sin código adicional
- Almacena en **caché o base de datos** según necesidades
- **Múltiples propietarios** permiten límites combinados (usuario + IP)
- **remainingSeconds()** y **expiresAt()** facilitan respuestas amigables al cliente
- Útil para **autenticación**, **APIs**, **notificaciones** y **creación de recursos**
- En **tests**, desactiva cooldown para evitar bloqueos en suites
- Previene **abuso**, **spam** y **carga excesiva** de forma elegante