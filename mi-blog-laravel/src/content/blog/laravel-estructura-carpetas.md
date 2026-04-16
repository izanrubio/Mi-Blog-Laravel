---
title: 'Estructura de carpetas de Laravel explicada'
description: 'Guía completa de la estructura de directorios de Laravel. Qué hay en cada carpeta, para qué sirve y dónde poner tu código. Con ejemplos prácticos.'
pubDate: '2026-04-16'
tags: ['laravel', 'conceptos', 'roadmap']
---

Cuando creas un proyecto Laravel nuevo con `composer create-project`, te encuentras con decenas de archivos y carpetas. Para alguien que llega por primera vez, la estructura puede parecer abrumadora. En realidad cada directorio tiene un propósito muy concreto y una vez que lo entiendes sabes exactamente dónde poner cada cosa. Este artículo lo explica todo.

## Visión general

```
mi-proyecto/
├── app/
│   ├── Console/
│   ├── Exceptions/
│   ├── Http/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   └── Requests/
│   ├── Models/
│   ├── Providers/
│   └── Services/           ← tú lo creas
├── bootstrap/
├── config/
├── database/
│   ├── factories/
│   ├── migrations/
│   └── seeders/
├── public/
├── resources/
│   ├── css/
│   ├── js/
│   ├── lang/
│   └── views/
├── routes/
│   ├── api.php
│   ├── console.php
│   └── web.php
├── storage/
│   ├── app/
│   ├── framework/
│   └── logs/
├── tests/
│   ├── Feature/
│   └── Unit/
├── vendor/
├── .env
├── artisan
└── composer.json
```

## La carpeta app/

Aquí vive el código principal de tu aplicación. Es donde pasas la mayor parte del tiempo.

### app/Http/Controllers/

Los controladores manejan las peticiones HTTP entrantes. Reciben la request, invocan la lógica de negocio y retornan una respuesta:

```php
<?php
// app/Http/Controllers/PostController.php

namespace App\Http\Controllers;

use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PostController extends Controller
{
    public function index(): View
    {
        $posts = Post::with('category')->latest()->paginate(10);

        return view('posts.index', compact('posts'));
    }

    public function show(Post $post): View
    {
        return view('posts.show', compact('post'));
    }
}
```

Crea controladores con Artisan:

```bash
php artisan make:controller PostController
php artisan make:controller PostController --resource  # CRUD completo
php artisan make:controller PostController --model=Post --resource
```

### app/Models/

Los modelos representan las tablas de la base de datos y encapsulan la lógica de datos. Un modelo por cada tabla principal:

```php
<?php
// app/Models/Post.php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'titulo',
        'slug',
        'contenido',
        'publicado',
        'user_id',
    ];

    protected $casts = [
        'publicado' => 'boolean',
        'published_at' => 'datetime',
    ];

    public function autor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function comentarios(): HasMany
    {
        return $this->hasMany(Comentario::class);
    }
}
```

```bash
php artisan make:model Post
php artisan make:model Post -m    # con migración
php artisan make:model Post -mfc  # con migración, factory y controlador
```

### app/Http/Middleware/

El middleware actúa como filtro para las peticiones HTTP. Se ejecuta antes o después de que el controlador maneje la request:

```php
<?php
// app/Http/Middleware/EnsureUserIsAdmin.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->user() || ! $request->user()->es_admin) {
            abort(403, 'Acceso denegado.');
        }

        return $next($request);
    }
}
```

```bash
php artisan make:middleware EnsureUserIsAdmin
```

### app/Http/Requests/

Los Form Requests encapsulan la validación de formularios fuera del controlador:

```php
<?php
// app/Http/Requests/StorePostRequest.php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StorePostRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'titulo'    => ['required', 'string', 'max:255'],
            'slug'      => ['required', 'string', 'unique:posts,slug'],
            'contenido' => ['required', 'string', 'min:100'],
        ];
    }

    public function messages(): array
    {
        return [
            'titulo.required' => 'El título es obligatorio.',
            'contenido.min'   => 'El contenido debe tener al menos 100 caracteres.',
        ];
    }
}
```

```bash
php artisan make:request StorePostRequest
```

### app/Providers/

Los Service Providers son la clase de arranque de Laravel. Registran bindings en el contenedor de servicios, configuran eventos y realizan bootstrapping. El más importante para personalizar es `AppServiceProvider`:

```php
<?php
// app/Providers/AppServiceProvider.php

namespace App\Providers;

use App\Services\PagoService;
use App\Contracts\PagoInterface;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(PagoInterface::class, PagoService::class);
    }

    public function boot(): void
    {
        // Lógica que se ejecuta tras registrar todos los providers
    }
}
```

### app/Services/ (tú lo creas)

No existe por defecto, pero es donde la mayoría de desarrolladores pone la lógica de negocio compleja para mantener los controladores delgados:

```php
<?php
// app/Services/PostService.php

namespace App\Services;

use App\Models\Post;
use Illuminate\Support\Str;

class PostService
{
    public function crear(array $datos): Post
    {
        $datos['slug'] = Str::slug($datos['titulo']);
        $datos['user_id'] = auth()->id();

        return Post::create($datos);
    }

    public function publicar(Post $post): void
    {
        $post->update([
            'publicado'    => true,
            'published_at' => now(),
        ]);
    }
}
```

## bootstrap/

Contiene el archivo `app.php` que inicializa el framework. También tiene la carpeta `cache/` donde Laravel guarda los archivos compilados de rutas y servicios para mejorar el rendimiento:

```bash
# Limpiar la caché de bootstrap
php artisan optimize:clear

# Regenerar la caché (para producción)
php artisan optimize
```

No edites nada en `bootstrap/` manualmente. Laravel lo gestiona.

## config/

Todos los archivos de configuración de Laravel viven aquí. Cada archivo corresponde a un aspecto del sistema:

- `config/app.php` — nombre, entorno, locale, timezone, providers
- `config/database.php` — conexiones de base de datos
- `config/mail.php` — configuración de email
- `config/queue.php` — configuración de colas
- `config/filesystems.php` — discos de almacenamiento

```php
// Acceder a un valor de configuración
$nombre = config('app.name');
$conexion = config('database.default');

// Con valor por defecto
$timeout = config('services.stripe.timeout', 30);
```

Los valores sensibles se definen en `.env` y se referencian desde config:

```php
// config/database.php
'mysql' => [
    'driver'   => 'mysql',
    'host'     => env('DB_HOST', '127.0.0.1'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
],
```

## database/

### database/migrations/

Las migraciones son el control de versiones de tu base de datos. Cada archivo representa un cambio en el esquema:

```php
<?php
// database/migrations/2026_04_16_000000_create_posts_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('titulo');
            $table->string('slug')->unique();
            $table->longText('contenido');
            $table->boolean('publicado')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
```

```bash
php artisan make:migration create_posts_table
php artisan migrate
php artisan migrate:rollback
php artisan migrate:fresh --seed
```

### database/seeders/

Los seeders poblan la base de datos con datos de prueba:

```php
<?php
// database/seeders/DatabaseSeeder.php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Post;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::factory(10)->create();
        Post::factory(50)->create();
    }
}
```

### database/factories/

Las factories generan datos falsos para tests y seeders usando Faker:

```php
<?php
// database/factories/PostFactory.php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PostFactory extends Factory
{
    public function definition(): array
    {
        $titulo = fake()->sentence(6);

        return [
            'user_id'   => User::factory(),
            'titulo'    => $titulo,
            'slug'      => Str::slug($titulo),
            'contenido' => fake()->paragraphs(5, true),
            'publicado' => fake()->boolean(80),
        ];
    }
}
```

## public/

Es el único directorio que debe ser accesible desde el navegador. El servidor web (Nginx/Apache) apunta aquí. Contiene:

- `index.php` — punto de entrada de toda la aplicación. No lo toques.
- `favicon.ico`, `robots.txt`
- Assets compilados: `css/app.css`, `js/app.js` (generados por Vite o Mix)

```bash
# Los assets compilados van aquí
npm run build
# → public/build/assets/app-abc123.css
# → public/build/assets/app-abc123.js
```

## resources/

### resources/views/

Las vistas Blade. La convención es organizarlas en subcarpetas por módulo:

```
resources/views/
├── layouts/
│   ├── app.blade.php
│   └── guest.blade.php
├── components/
│   ├── navbar.blade.php
│   └── post-card.blade.php
├── posts/
│   ├── index.blade.php
│   ├── show.blade.php
│   └── create.blade.php
└── auth/
    ├── login.blade.php
    └── register.blade.php
```

### resources/lang/

Archivos de traducción para internacionalización:

```php
// resources/lang/es/validation.php
return [
    'required' => 'El campo :attribute es obligatorio.',
    'email'    => 'El campo :attribute debe ser un email válido.',
];
```

### resources/css/ y resources/js/

Los archivos fuente de CSS y JavaScript que Vite compila y publica en `public/`:

```bash
npm run dev   # desarrollo con HMR
npm run build # compilación para producción
```

## routes/

### routes/web.php

Rutas para la interfaz web. Tienen soporte de sesión, cookies y protección CSRF:

```php
<?php
// routes/web.php

use App\Http\Controllers\PostController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn() => view('welcome'));

Route::resource('posts', PostController::class);

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', fn() => view('dashboard'))->name('dashboard');
});
```

### routes/api.php

Rutas para la API. Sin sesión ni cookies, usan autenticación por token (Sanctum o Passport):

```php
<?php
// routes/api.php

use App\Http\Controllers\Api\PostController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('posts', PostController::class);
});
```

Las rutas de API tienen el prefijo `/api` automáticamente.

### routes/console.php

Define comandos de Artisan personalizados con closures:

```php
<?php
// routes/console.php

use Illuminate\Support\Facades\Schedule;

Schedule::command('posts:publicar-programados')->everyMinute();
```

## storage/

### storage/app/

Archivos subidos por usuarios y otros archivos privados de la aplicación. Para hacerlos accesibles públicamente:

```bash
php artisan storage:link
# Crea un symlink: public/storage → storage/app/public
```

### storage/framework/

Archivos internos del framework: caché, sesiones, vistas compiladas. Laravel los gestiona automáticamente. No edites nada aquí.

### storage/logs/

Los archivos de log de la aplicación. El principal es `laravel.log`:

```bash
# Ver los últimos errores en tiempo real
tail -f storage/logs/laravel.log

# Limpiar los logs (nunca en producción sin copia)
php artisan log:clear
```

## tests/

### tests/Feature/

Tests de integración que prueban flujos completos (peticiones HTTP, base de datos):

```php
<?php
// tests/Feature/PostTest.php

namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Tests\TestCase;

class PostTest extends TestCase
{
    public function test_usuario_puede_ver_listado_de_posts(): void
    {
        Post::factory(5)->create();

        $response = $this->get('/posts');

        $response->assertStatus(200);
        $response->assertViewHas('posts');
    }
}
```

### tests/Unit/

Tests unitarios que prueban clases o métodos en aislamiento:

```bash
php artisan test
php artisan test --filter PostTest
```

## vendor/

Las dependencias instaladas por Composer. Nunca edites nada aquí: todo lo que necesitas personalizar va en `app/` o `config/`. Esta carpeta está en `.gitignore` porque se regenera con `composer install`.

## .env

Variables de entorno de la aplicación. Contiene:

```bash
APP_NAME="Mi Blog"
APP_ENV=local
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_DATABASE=mi_blog
DB_USERNAME=root
DB_PASSWORD=secret

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
```

Nunca lo subas a git. Usa `.env.example` como plantilla.

## artisan

El CLI de Laravel. Es un script PHP ejecutable:

```bash
php artisan list                  # todos los comandos
php artisan make:controller Foo   # genera código
php artisan migrate               # ejecuta migraciones
php artisan tinker                # REPL interactivo con el contexto de Laravel
php artisan route:list            # ver todas las rutas
php artisan cache:clear           # limpiar caché
```

## composer.json

Define las dependencias PHP del proyecto y la configuración de autoloading. Ya lo cubrimos en el artículo sobre Composer, pero vale recordar que aquí es donde defines qué versión de Laravel usas y qué paquetes necesitas.

## Conclusión

La estructura de Laravel no es arbitraria: cada directorio tiene una responsabilidad clara. `app/` es tu código, `config/` es la configuración, `database/` gestiona el esquema, `resources/` tiene las vistas y assets, `routes/` define las URLs y `storage/` es el almacenamiento. Cuando sepas dónde vive cada cosa, escribir y mantener una aplicación Laravel será mucho más rápido y ordenado.
