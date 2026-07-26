---
title: 'Laravel Legacy Bridge: Migra Usuarios sin Segundo Login'
description: 'Aprende a migrar aplicaciones legacy a Laravel sin interrumpir sesiones. Importa usuarios autenticados automáticamente con Laravel Legacy Bridge.'
pubDate: '2026-07-19'
tags: ['laravel', 'autenticación', 'migraciones', 'seguridad']
---

## Introducción

Migrar una aplicación legacy a Laravel es uno de los desafíos más comunes en desarrollo empresarial. El problema más visible y frustrante para los usuarios: **perder la sesión durante la transición**.

Imaginemos una empresa que durante años ha mantenido un sistema PHP monolítico. Ahora están modernizando la arquitectura hacia Laravel. Los usuarios activos en la plataforma antigua de repente se encuentran con una pantalla de login cuando acceden al nuevo sistema. La experiencia de usuario se deteriora, el soporte técnico recibe tickets innecesarios, y algunos usuarios simplemente abandonan la sesión.

**Laravel Legacy Bridge** resuelve exactamente esto: permite que los usuarios mantengan su sesión autenticada al pasar de la aplicación antigua a Laravel, leyendo la cookie de sesión legacy, decodificando su contenido, y autenticando automáticamente al usuario coincidente en el nuevo sistema.

En este artículo exploraremos cómo implementar esta solución elegante y sus implicaciones de seguridad.

## ¿Por Qué es Crítico Resolver el Problema de Sesiones?

Cuando migramos una aplicación legacy a Laravel, hay dos enfoques tradicionales:

1. **Big Bang Migration**: Reescribir todo de una vez. Riesgoso, costoso, requiere downtime.
2. **Gradual Migration**: Migrar módulo por módulo. Requiere que ambos sistemas coexistan.

En el enfoque gradual (el más realista), necesitas una capa de transición inteligente. Los usuarios pueden estar navegando entre la aplicación vieja y la nueva. Si cada vez que acceden a Laravel pierden la sesión, la experiencia es terrible.

Aquí es donde Laravel Legacy Bridge interviene. **No es un hack temporal, es una solución arquitectónica seria**.

## Cómo Funciona Laravel Legacy Bridge

### El Flujo Básico

1. Usuario está autenticado en la aplicación legacy
2. Usuario hace clic en un enlace que lo lleva a Laravel
3. El middleware de Laravel Legacy Bridge intercepta la request
4. Lee la cookie de sesión legacy desde el navegador
5. Decodifica el payload de la sesión
6. Busca el usuario correspondiente en la BD de Laravel
7. Autentica al usuario automáticamente en Laravel
8. El usuario continúa navegando sin problemas

### Requisitos Previos

Para implementar esto correctamente necesitas:

- Acceso a la estructura de datos de sesiones legacy
- Conocer el formato de serialización (usualmente PHP `serialize()`)
- Credenciales de acceso a la misma base de datos
- El hash/formato de contraseñas (aunque no siempre necesario)
- Documentación de qué información se guarda en la sesión

## Instalación y Configuración

Primero, instala el paquete:

```bash
composer require laravel/legacy-bridge
```

Luego, publica la configuración:

```bash
php artisan vendor:publish --provider="Laravel\LegacyBridge\LegacyBridgeServiceProvider"
```

Esto creará un archivo `config/legacy-bridge.php`:

```php
<?php

return [
    /*
     * El nombre de la cookie de sesión de la aplicación legacy
     */
    'session_cookie_name' => 'PHPSESSID',

    /*
     * La ruta donde se guardan las sesiones en la aplicación legacy
     * Típicamente /tmp o session_save_path() de PHP
     */
    'session_path' => '/tmp',

    /*
     * El nombre de la tabla de usuarios en Laravel
     */
    'users_table' => 'users',

    /*
     * La columna que identifica al usuario en sesión legacy
     * (p.ej., 'user_id', 'id', etc.)
     */
    'session_user_identifier' => 'user_id',

    /*
     * Mapeo entre columnas de sesión legacy y campos de usuario Laravel
     */
    'identifier_mapping' => [
        'user_id' => 'id',
        'email' => 'email',
    ],

    /*
     * Si desabilitar al usuario legacy después de migrar
     */
    'disable_legacy_user' => false,
];
```

## Implementación Práctica: Un Ejemplo Real

Veamos una aplicación legacy típica en PHP puro donde las sesiones se almacenan así:

### Base de datos Legacy (MySQL)

```sql
CREATE TABLE users_legacy (
    id INT PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    name VARCHAR(255),
    created_at TIMESTAMP
);

CREATE TABLE sessions_legacy (
    id VARCHAR(40) PRIMARY KEY,
    payload LONGTEXT,
    user_id INT,
    last_activity INT
);
```

### Base de datos Laravel

```php
// Migration para usuarios en Laravel
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('email')->unique();
    $table->string('name');
    $table->string('password')->nullable(); // Nullable si migramos gradualmente
    $table->timestamps();
    $table->integer('legacy_id')->nullable()->unique(); // Referencia a usuario legacy
});
```

### Middleware de Legacy Bridge

Crea un middleware personalizado:

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class AuthenticateFromLegacy
{
    public function handle(Request $request, Closure $next)
    {
        // Si ya está autenticado en Laravel, continúa
        if (Auth::check()) {
            return $next($request);
        }

        // Intenta leer la cookie de sesión legacy
        $legacyCookie = $request->cookie(config('legacy-bridge.session_cookie_name'));

        if (!$legacyCookie) {
            return $next($request);
        }

        // Obtén los datos de sesión del path legacy
        $sessionFile = config('legacy-bridge.session_path') . '/sess_' . $legacyCookie;

        if (!file_exists($sessionFile)) {
            return $next($request);
        }

        // Lee y deserializa la sesión legacy
        $sessionData = $this->unserializePhpSession(file_get_contents($sessionFile));

        // Extrae el ID del usuario de la sesión
        $userIdentifier = $sessionData[config('legacy-bridge.session_user_identifier')] ?? null;

        if (!$userIdentifier) {
            return $next($request);
        }

        // Busca el usuario en la BD de Laravel
        $user = DB::connection('mysql')
            ->table(config('legacy-bridge.users_table'))
            ->where('legacy_id', $userIdentifier)
            ->first();

        // Si no existe, intenta crearlo desde los datos legacy
        if (!$user) {
            $user = $this->migrateUserFromLegacy($userIdentifier, $sessionData);
        }

        // Autentica al usuario en Laravel
        if ($user) {
            Auth::loginUsingId($user->id, remember: true);
        }

        return $next($request);
    }

    private function unserializePhpSession(string $data): array
    {
        $return = [];
        $offset = 0;
        $length = strlen($data);

        while ($offset < $length) {
            if (!strpos($data, '|', $offset)) {
                break;
            }

            $pos = strpos($data, '|', $offset);
            $num = $pos - $offset;
            $varname = substr($data, $offset, $num);
            $offset += $num + 1;
            $data_unserialized = unserialize(substr($data, $offset), ['allowed_classes' => false]);
            $return[$varname] = $data_unserialized;
            $offset += strlen(serialize($data_unserialized));
        }

        return $return;
    }

    private function migrateUserFromLegacy($userId, array $sessionData)
    {
        // Consulta la tabla de usuarios legacy
        $legacyUser = DB::connection('legacy')
            ->table('users_legacy')
            ->where('id', $userId)
            ->first();

        if (!$legacyUser) {
            return null;
        }

        // Crea el usuario en Laravel
        $newUser = DB::table('users')->create([
            'email' => $legacyUser->email,
            'name' => $legacyUser->name,
            'password' => $legacyUser->password, // O null si no es compatible
            'legacy_id' => $legacyUser->id,
        ]);

        return $newUser;
    }
}
```

### Registra el Middleware

En `app/Http/Kernel.php`:

```php
protected $middleware = [
    // ... otros middlewares
    \App\Http\Middleware\AuthenticateFromLegacy::class,
];
```

O a nivel de rutas en `routes/web.php`:

```php
Route::middleware(['auth.legacy'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/profile', [ProfileController::class, 'edit']);
});
```

## Seguridad: Consideraciones Críticas

### 1. Validar Integridad de Sesión

No confíes ciegamente en cualquier cookie. Valida que sea auténtica:

```php
private function validateSessionIntegrity($sessionId, $data)
{
    // Verifica que la sesión no haya expirado
    $lastActivity = $data['_last_activity'] ?? 0;
    $timeout = 3600; // 1 hora

    if (time() - $lastActivity > $timeout) {
        return false;
    }

    // Verifica tokens CSRF si están disponibles
    if (isset($data['_token'])) {
        // Lógica de validación adicional
    }

    return true;
}
```

### 2. Usar Conexión Separada para Legacy

Configura una conexión MySQL separada en `config/database.php`:

```php
'legacy' => [
    'driver' => 'mysql',
    'host' => env('LEGACY_DB_HOST'),
    'database' => env('LEGACY_DB_NAME'),
    'username' => env('LEGACY_DB_USER'),
    'password' => env('LEGACY_DB_PASSWORD'),
],
```

### 3. Auditar Migraciones

Registra cada autenticación desde legacy:

```php
if ($user) {
    Auth::loginUsingId($user->id, remember: true);
    
    \Log::info('User authenticated from legacy session', [
        'user_id' => $user->id,
        'legacy_id' => $userIdentifier,
        'ip' => $request->ip(),
        'timestamp' => now(),
    ]);
}
```

### 4. Re-validar Contraseña

Después de la migración inicial, pide al usuario que reestablezca su contraseña:

```php
// En un evento de bienvenida después de migrar
Event::listen(function (UserLoggedInFromLegacy $event) {
    $event->user->update(['password_needs_reset' => true]);
    
    Mail::send(new ResetPasswordNotification($event->user));
});
```

## Casos de Uso Avanzados

### Migración Gradual de Módulos

Si migras módulo por módulo, puedes condicionar la autenticación legacy:

```php
private function shouldAuthenticateFromLegacy(Request $request)
{
    $legacyRoutes = ['admin', 'reports', 'settings'];
    
    foreach ($legacyRoutes as $route) {
        if ($request->is($route . '/*')) {
            return true;
        }
    }
    
    return false;
}
```

### Sincronización de Datos en Tiempo Real

Para aplicaciones complejas, mantén sincronizados los datos:

```php
class SyncLegacyUserData implements ShouldQueue
{
    public function handle()
    {
        $legacyUsers = DB::connection('legacy')
            ->table('users_legacy')
            ->get();

        foreach ($legacyUsers as $legacyUser) {
            $laravelUser = User::where('legacy_id', $legacyUser->id)->first();

            if ($laravelUser) {
                $laravelUser->update([
                    'email' => $legacyUser->email,
                    'name' => $legacyUser->name,
                ]);
            }
        }
    }
}
```

## Testing de la Implementación

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;

class LegacyBridgeTest extends TestCase
{
    public function test_user_authenticated_from_legacy_session()
    {
        // Crea un usuario legacy
        $legacyUser = DB::connection('legacy')
            ->table('users_legacy')
            ->insertGetId([
                'email' => 'test@example.com',
                'name' => 'Test User',
                'password' => password_hash('secret', PASSWORD_BCRYPT),
            ]);

        // Simula una cookie de sesión legacy
        $sessionData = serialize(['user_id' => $legacyUser]);
        $sessionFile = config('legacy-bridge.session_path') . '/sess_test123';
        file_put_contents($sessionFile, $sessionData);

        // Haz una request con la cookie
        $response = $this->withCookie(
            config('legacy-bridge.session_cookie_name'),
            'test123'
        )->get('/dashboard');

        // Verifica que está autenticado
        $this->assertAuthenticated();
    }
}
```

## Troubleshooting Común

### La sesión no se lee correctamente

```php
// Debug: imprime qué está leyendo
\Log::debug('Legacy session data:', [
    'cookie' => request()->cookie(config('legacy-bridge.session_cookie_name')),
    'session_path' => config('legacy-bridge.session_path'),
    'files' => glob(config('legacy-bridge.session_path') . '/*'),
]);
```

### El usuario no se encuentra en Laravel

```php
// Verifica que el mapeo sea correcto
$user = DB::table('users')
    ->where('legacy_id', $userIdentifier)
    ->first();

if (!$user) {
    \Log::warning('User not found in Laravel', ['legacy_id' => $userIdentifier]);
}
```

### La contraseña no coincide después de migrar

Si usas diferentes algoritmos de hash, maneja esto explícitamente:

```php
// En el modelo User
public function verifyPassword($password)
{
    // Si es un usuario migrado, verifica contra el hash legacy
    if ($this->legacy_id && !password_needs_reset) {
        return password_verify($password, $this->password);
    }
    
    return parent::verifyPassword($password);
}
```

## Conclusión

Laravel Legacy Bridge transforma un problema potencial de migración en una experiencia transparente para el usuario. No es solo una herramienta técnica, es un **facilitador de transiciones empresariales suaves**.

La clave del éxito está en:
- Entender profundamente cómo funciona la autenticación legacy
- Implementar controles de seguridad robustos desde el inicio
- Auditar cada autenticación desde legacy
- Planificar la deprecación gradual del acceso legacy

Con esta arquitectura en lugar, tus usuarios pueden navegar entre aplicaciones sin perder contexto, y t