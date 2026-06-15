---
title: 'Typed Translation Accessors en Laravel: Traducciones con Tipado Fuerte'
description: 'Domina los Typed Translation Accessors en Laravel 13.15: tipado fuerte para tus traducciones, validación automática y menos errores en producción.'
pubDate: '2025-06-11'
tags: ['laravel', 'i18n', 'php', 'laravel-13']
---

## Introducción

Las traducciones son una parte crítica de cualquier aplicación Laravel que busque ser global. Sin embargo, trabajar con archivos de idioma tradicionales puede ser propenso a errores: typos en las claves, valores faltantes en algunos idiomas, o simplemente no saber qué estructura espera tu aplicación.

Laravel 13.15.0 introduce **Typed Translation Accessors**, una característica que revoluciona cómo gestionamos las traducciones mediante **tipado fuerte**. En lugar de acceder a traducciones como strings simples, ahora puedes definir tipos específicos que garantizan que tus traducciones tengan la estructura correcta.

En este artículo aprenderás cómo aprovechar esta característica para mejorar la calidad, mantenibilidad y seguridad de tus traducciones.

## ¿Qué son los Typed Translation Accessors?

Los Typed Translation Accessors permiten definir **clases TypeScript-like para tus traducciones** que especifican exactamente qué estructura deben tener. Laravel valida automáticamente que tus archivos de idioma coincidan con estos tipos.

### El problema sin Typed Accessors

Tradicionalmente, si tienes un archivo de traducción `resources/lang/es/messages.php`:

```php
return [
    'welcome' => 'Bienvenido',
    'user' => [
        'name' => 'Nombre',
        'email' => 'Correo electrónico',
    ],
];
```

Accedes a él así:

```php
$message = __('messages.welcome');
$userName = __('messages.user.name');
```

**Los problemas:**
- No hay validación en tiempo de compilación
- Typos en las claves no se detectan hasta runtime
- No sabes qué estructura esperan tus vistas
- El IDE no puede autocompletar

### La solución: Typed Translation Accessors

Con esta nueva característica, defines la estructura esperada en una clase de tipo:

```php
// app/Translations/Messages.php
namespace App\Translations;

use Illuminate\Translation\Translator;

class Messages
{
    public function __construct(private Translator $translator) {}

    public function welcome(): string
    {
        return $this->translator->get('messages.welcome');
    }

    public function userName(): string
    {
        return $this->translator->get('messages.user.name');
    }

    public function userEmail(): string
    {
        return $this->translator->get('messages.user.email');
    }
}
```

## Configuración Inicial

### Paso 1: Crear la clase de tipos

Crea una carpeta para tus traductores tipados:

```bash
mkdir app/Translations
```

Luego crea una clase para cada grupo de traducciones:

```php
// app/Translations/Auth.php
namespace App\Translations;

use Illuminate\Translation\Translator;

class Auth
{
    public function __construct(private Translator $translator) {}

    public function login(): string
    {
        return $this->translator->get('auth.login');
    }

    public function loginFailed(): string
    {
        return $this->translator->get('auth.login_failed');
    }

    public function resetPassword(): string
    {
        return $this->translator->get('auth.reset_password');
    }
}
```

### Paso 2: Registrar en el Service Provider

En tu `app/Providers/AppServiceProvider.php`:

```php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Translations\Auth;
use App\Translations\Messages;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(Auth::class);
        $this->app->singleton(Messages::class);
    }
}
```

### Paso 3: Crear los archivos de idioma

Asegúrate de que tus archivos de idioma existan y tengan las claves correctas:

```php
// resources/lang/es/auth.php
return [
    'login' => 'Iniciar sesión',
    'login_failed' => 'Las credenciales son inválidas',
    'reset_password' => 'Restablecer contraseña',
];
```

## Uso en Controladores

Ahora puedes inyectar tu clase de traducción tipada en controladores:

```php
// app/Http/Controllers/LoginController.php
namespace App\Http\Controllers;

use App\Translations\Auth;
use Illuminate\View\View;

class LoginController extends Controller
{
    public function show(Auth $auth): View
    {
        return view('auth.login', [
            'loginButton' => $auth->login(),
            'resetLink' => $auth->resetPassword(),
        ]);
    }

    public function attempt(Auth $auth)
    {
        // Lógica de autenticación
        if (!$credentials) {
            return back()->withError($auth->loginFailed());
        }
    }
}
```

## Casos de uso avanzados

### Traducciones con parámetros

Puedes pasar parámetros a tus traducciones:

```php
// resources/lang/es/messages.php
return [
    'welcome_user' => 'Bienvenido, :name',
    'order_shipped' => 'Tu pedido #:id fue enviado el :date',
];
```

En tu clase:

```php
// app/Translations/Messages.php
class Messages
{
    public function welcomeUser(string $name): string
    {
        return $this->translator->get('messages.welcome_user', ['name' => $name]);
    }

    public function orderShipped(int $orderId, string $date): string
    {
        return $this->translator->get('messages.order_shipped', [
            'id' => $orderId,
            'date' => $date,
        ]);
    }
}
```

Uso:

```php
echo $messages->welcomeUser('Juan'); // Bienvenido, Juan
echo $messages->orderShipped(123, '2025-06-11'); // Tu pedido #123 fue enviado el 2025-06-11
```

### Traducciones plurales

Para pluralizaciones:

```php
// resources/lang/es/messages.php
return [
    'apples' => '{0} No hay manzanas|{1} Una manzana|[2,*] :count manzanas',
];
```

En tu clase:

```php
class Messages
{
    public function apples(int $count): string
    {
        return $this->translator->choice('messages.apples', $count, ['count' => $count]);
    }
}
```

Uso:

```php
echo $messages->apples(0);  // No hay manzanas
echo $messages->apples(1);  // Una manzana
echo $messages->apples(5);  // 5 manzanas
```

### Estructuras complejas

Para traducciones con estructura anidada:

```php
// resources/lang/es/validation.php
return [
    'required' => 'El campo :attribute es requerido',
    'email' => 'El campo :attribute debe ser un email válido',
    'min' => 'El campo :attribute debe tener al menos :min caracteres',
];
```

Clase especializada:

```php
// app/Translations/Validation.php
namespace App\Translations;

use Illuminate\Translation\Translator;

class Validation
{
    public function __construct(private Translator $translator) {}

    public function required(string $attribute): string
    {
        return $this->translator->get('validation.required', ['attribute' => $attribute]);
    }

    public function email(string $attribute): string
    {
        return $this->translator->get('validation.email', ['attribute' => $attribute]);
    }

    public function min(string $attribute, int $min): string
    {
        return $this->translator->get('validation.min', [
            'attribute' => $attribute,
            'min' => $min,
        ]);
    }
}
```

## Integración con vistas Blade

Puedes usar tus traducciones tipadas en Blade:

```blade
<!-- resources/views/auth/login.blade.php -->
@php
use App\Translations\Auth;
$auth = app(Auth::class);
@endphp

<div class="form-group">
    <label>{{ $auth->login() }}</label>
    <input type="text" name="email" placeholder="Correo">
</div>

<button type="submit">{{ $auth->login() }}</button>
```

O creando un helper:

```php
// app/helpers.php
function trans(string $class): object
{
    return app($class);
}
```

Uso en Blade:

```blade
<button>{{ trans('App\\Translations\\Auth')->login() }}</button>
```

## Validación automática

Laravel puede validar que tus archivos de idioma coincidan con tus tipos. Crea un comando Artisan:

```php
// app/Console/Commands/ValidateTranslations.php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Translation\Translator;
use ReflectionClass;

class ValidateTranslations extends Command
{
    protected $signature = 'translations:validate';
    protected $description = 'Valida que las traducciones coincidan con los tipos';

    public function handle(Translator $translator)
    {
        $translationClasses = [
            \App\Translations\Auth::class,
            \App\Translations\Messages::class,
        ];

        foreach ($translationClasses as $class) {
            $this->validateClass($class, $translator);
        }

        $this->info('✓ Todas las traducciones son válidas');
    }

    private function validateClass(string $class, Translator $translator)
    {
        $reflection = new ReflectionClass($class);
        $methods = $reflection->getMethods();

        foreach ($methods as $method) {
            if ($method->isPublic() && $method->getDeclaringClass()->getName() === $class) {
                // Validar que el método pueda ejecutarse sin errores
                try {
                    $instance = app($class);
                    $method->invoke($instance);
                } catch (\Exception $e) {
                    $this->error("Error en {$class}::{$method->getName()}: " . $e->getMessage());
                }
            }
        }
    }
}
```

Ejecuta:

```bash
php artisan translations:validate
```

## Mejores prácticas

### 1. Organiza por módulo

```
app/
  Translations/
    Auth/
      Login.php
      Reset.php
    Dashboard/
      Widget.php
    Common/
      Buttons.php
      Messages.php
```

### 2. Documenta con PHPDoc

```php
class Auth
{
    /**
     * Obtiene el mensaje de error de login fallido
     * 
     * Clave: auth.login_failed
     * Idiomas soportados: es, en, fr
     */
    public function loginFailed(): string
    {
        return $this->translator->get('auth.login_failed');
    }
}
```

### 3. Usa constantes para claves

```php
class Messages
{
    public const WELCOME = 'messages.welcome';
    public const USER_NAME = 'messages.user.name';

    public function welcome(): string
    {
        return $this->translator->get(self::WELCOME);
    }
}
```

### 4. Cachea traducciones en producción

```php
public function welcomeUser(string $name): string
{
    return cache()->remember(
        "translation.messages.welcome_user.{$name}",
        now()->addDay(),
        fn() => $this->translator->get('messages.welcome_user', ['name' => $name])
    );
}
```

## Testing

Prueba tus traducciones:

```php
// tests/Unit/Translations/AuthTest.php
namespace Tests\Unit\Translations;

use App\Translations\Auth;
use Tests\TestCase;

class AuthTest extends TestCase
{
    public function test_login_translation_exists()
    {
        $auth = app(Auth::class);
        $result = $auth->login();

        $this->assertIsString($result);
        $this->assertNotEmpty($result);
    }

    public function test_all_languages_have_translations()
    {
        $languages = ['es', 'en', 'fr'];
        
        foreach ($languages as $lang) {
            app('translator')->setLocale($lang);
            $auth = app(Auth::class);
            
            $this->assertNotEmpty($auth->login());
        }
    }
}
```

## Conclusión

Los **Typed Translation Accessors** en Laravel 13.15.0 representan un salto significativo en la calidad y mantenibilidad del código de internacionalización. Al proporcionar tipado fuerte y autocomplete del IDE, eliminan toda una clase de errores que antes solo se detectaban en producción.

Esta característica es especialmente valiosa en proyectos grandes con múltiples idiomas, equipos distribuidos y requisitos estrictos de calidad. Implementarla desde el inicio te ahorrará horas de debugging y facilitará la colaboración entre desarrolladores.

### Puntos clave

- Los Typed Translation Accessors permiten definir clases con métodos tipados para acceder a traducciones
- Proporcionan autocompletado del IDE y validación en tiempo de compilación
- Se registran como singletons en el Service Provider para inyección de dependencias
- Soportan parámetros, pluralizaciones y estructuras complejas
- Pueden ser validados automáticamente mediante comandos Artisan personalizados
- Mejoran significativamente la mantenibilidad en proyectos multiidioma
- Se integran perfectamente con Blade y pueden ser testeados como cualquier otra clase
- Siguen el principio DRY evitando repetición de claves de traducción
- Son especialmente útiles en aplicaciones SaaS globales y plataformas multiidioma
- Reducen errores en producción relacionados con traducciones faltantes o incorrectas