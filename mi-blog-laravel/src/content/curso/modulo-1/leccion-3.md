---
modulo: 1
leccion: 3
title: 'Estructura de carpetas explicada'
description: 'Aprende qué hace cada carpeta y archivo en un proyecto Laravel recién creado: app, routes, resources, config, database y más.'
duracion: '15 min'
quiz:
  - pregunta: '¿En qué carpeta se colocan los controladores de una aplicación Laravel?'
    opciones:
      - 'app/Http/Controllers'
      - 'app/Controllers'
      - 'routes/controllers'
      - 'src/Http/Controllers'
    correcta: 0
    explicacion: 'Los controladores viven en app/Http/Controllers. Laravel sigue convenciones claras de organización: todo el código de la aplicación va dentro de la carpeta "app", y los controladores específicamente en la subcarpeta Http/Controllers.'
  - pregunta: '¿Dónde se definen las rutas web de una aplicación Laravel?'
    opciones:
      - 'app/routes.php'
      - 'config/routes.php'
      - 'routes/web.php'
      - 'resources/routes/web.php'
    correcta: 2
    explicacion: 'Las rutas web (las que devuelven HTML para el navegador) se definen en routes/web.php. Las rutas de API van en routes/api.php. Esta separación permite aplicar middleware diferente a cada tipo de ruta.'
  - pregunta: '¿Qué carpeta contiene las plantillas Blade (vistas) de la aplicación?'
    opciones:
      - 'app/Views'
      - 'public/views'
      - 'src/templates'
      - 'resources/views'
    correcta: 3
    explicacion: 'Las vistas Blade se almacenan en resources/views. La carpeta "resources" contiene todos los assets sin procesar: vistas, archivos de idioma (lang), CSS y JavaScript antes de compilar.'
---

## La estructura de un proyecto Laravel

Cuando creas un nuevo proyecto Laravel con `composer create-project laravel/laravel mi-proyecto`, obtienes una estructura de carpetas bien definida. Al principio puede parecer abrumadora, pero cada carpeta tiene un propósito muy claro. En esta lección la recorreremos completa.

Abre tu proyecto en el editor y verás algo así:

```
mi-proyecto/
├── app/
├── bootstrap/
├── config/
├── database/
├── public/
├── resources/
├── routes/
├── storage/
├── tests/
├── vendor/
├── .env
├── .env.example
├── artisan
├── composer.json
├── composer.lock
├── package.json
└── vite.config.js
```

Vamos carpeta por carpeta.

---

## La carpeta `app/`

Esta es la carpeta más importante. Contiene **todo el código de tu aplicación**: modelos, controladores, middleware, servicios, etc.

```
app/
├── Http/
│   ├── Controllers/
│   │   └── Controller.php
│   ├── Middleware/
│   └── Requests/
├── Models/
│   └── User.php
├── Providers/
│   └── AppServiceProvider.php
└── Exceptions/
    └── Handler.php
```

### `app/Http/Controllers/`

Aquí viven tus **controladores**. Un controlador recibe una petición HTTP, hace lo que necesita (consultar la base de datos, procesar datos) y devuelve una respuesta.

```php
// app/Http/Controllers/ArticleController.php
namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\Request;

class ArticleController extends Controller
{
    public function index()
    {
        $articles = Article::latest()->paginate(10);
        return view('articles.index', compact('articles'));
    }
}
```

### `app/Http/Middleware/`

Los **middleware** son clases que procesan la petición antes o después de que llegue al controlador. Por ejemplo, el middleware de autenticación comprueba si el usuario ha iniciado sesión antes de permitirle acceder a una ruta.

### `app/Http/Requests/`

Los **Form Requests** son clases especializadas para validar formularios. Permiten sacar la lógica de validación fuera del controlador.

```php
// app/Http/Requests/StoreArticleRequest.php
public function rules(): array
{
    return [
        'title' => 'required|max:255',
        'body'  => 'required|min:100',
    ];
}
```

### `app/Models/`

Aquí van tus **modelos Eloquent**. Cada modelo representa una tabla de la base de datos.

```php
// app/Models/Article.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Article extends Model
{
    protected $fillable = ['title', 'body', 'user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
```

### `app/Providers/`

Los **Service Providers** son el punto central de arranque de Laravel. Aquí se registran servicios, bindings y configuraciones globales. El más importante es `AppServiceProvider.php`.

---

## La carpeta `routes/`

Aquí se definen todas las **rutas** de tu aplicación:

```
routes/
├── web.php      ← rutas con sesión, cookies, CSRF
├── api.php      ← rutas para API REST (sin estado)
├── console.php  ← comandos Artisan propios
└── channels.php ← canales de broadcasting (WebSockets)
```

### `routes/web.php`

Es el archivo de rutas más usado. Define las rutas que responden a peticiones del navegador:

```php
// routes/web.php
use App\Http\Controllers\ArticleController;

Route::get('/', function () {
    return view('welcome');
});

Route::resource('articles', ArticleController::class);
```

### `routes/api.php`

Para APIs REST. Las rutas aquí tienen el prefijo `/api/` automáticamente y usan el middleware `api` (sin sesiones):

```php
// routes/api.php
Route::get('/articles', [ArticleController::class, 'index']);
Route::post('/articles', [ArticleController::class, 'store']);
```

---

## La carpeta `resources/`

Contiene los **assets sin procesar**: vistas, idiomas, CSS y JavaScript antes de compilar.

```
resources/
├── views/          ← plantillas Blade (.blade.php)
│   ├── layouts/
│   ├── articles/
│   └── welcome.blade.php
├── js/             ← JavaScript (Entry point: app.js)
│   └── app.js
├── css/            ← CSS (Entry point: app.css)
│   └── app.css
└── lang/           ← archivos de traducción
    └── es/
```

### `resources/views/`

Las **vistas Blade** se organizan por secciones. Es buena práctica tener una carpeta `layouts/` para las plantillas base:

```
resources/views/
├── layouts/
│   └── app.blade.php    ← plantilla principal
├── articles/
│   ├── index.blade.php
│   ├── show.blade.php
│   └── create.blade.php
└── welcome.blade.php
```

---

## La carpeta `config/`

Contiene todos los **archivos de configuración** de la aplicación:

```
config/
├── app.php       ← nombre de la app, timezone, locale...
├── database.php  ← conexiones a bases de datos
├── mail.php      ← configuración de correo
├── cache.php     ← drivers de caché
├── queue.php     ← colas de trabajos
├── session.php   ← manejo de sesiones
└── filesystems.php ← discos de almacenamiento
```

Estos archivos leen sus valores del archivo `.env`. Por ejemplo, `config/database.php` tiene:

```php
'mysql' => [
    'driver'   => 'mysql',
    'host'     => env('DB_HOST', '127.0.0.1'),
    'port'     => env('DB_PORT', '3306'),
    'database' => env('DB_DATABASE', 'laravel'),
    'username' => env('DB_USERNAME', 'root'),
    'password' => env('DB_PASSWORD', ''),
],
```

---

## La carpeta `database/`

Todo lo relacionado con la base de datos:

```
database/
├── migrations/   ← historial de cambios en la BD
├── seeders/      ← datos de prueba / iniciales
└── factories/    ← generadores de datos falsos para tests
```

### Migrations

Las migraciones son como un control de versiones para tu base de datos:

```php
// database/migrations/2024_01_01_create_articles_table.php
public function up(): void
{
    Schema::create('articles', function (Blueprint $table) {
        $table->id();
        $table->string('title');
        $table->text('body');
        $table->foreignId('user_id')->constrained()->cascadeOnDelete();
        $table->timestamps();
    });
}
```

### Seeders

Los seeders insertan datos de prueba:

```php
// database/seeders/ArticleSeeder.php
public function run(): void
{
    Article::factory(50)->create();
}
```

### Factories

Las factories generan datos falsos usando Faker:

```php
// database/factories/ArticleFactory.php
public function definition(): array
{
    return [
        'title'   => fake()->sentence(),
        'body'    => fake()->paragraphs(5, true),
        'user_id' => User::factory(),
    ];
}
```

---

## La carpeta `public/`

Es el **único directorio accesible públicamente desde el navegador**. Tu servidor web (Apache, Nginx) debe apuntar aquí.

```
public/
├── index.php   ← punto de entrada de toda la aplicación
├── favicon.ico
└── build/      ← assets compilados por Vite (CSS, JS)
```

`public/index.php` es el front controller: todas las peticiones HTTP pasan por él. Este archivo arranca el framework de Laravel.

---

## La carpeta `storage/`

Laravel guarda archivos aquí:

```
storage/
├── app/         ← archivos subidos por usuarios
│   └── public/  ← archivos accesibles desde la web
├── framework/   ← caché de vistas, sesiones, caché del framework
│   ├── cache/
│   ├── sessions/
│   └── views/
└── logs/
    └── laravel.log  ← todos los logs de la aplicación
```

Para acceder a archivos en `storage/app/public/` desde el navegador, necesitas crear el enlace simbólico:

```bash
php artisan storage:link
```

---

## La carpeta `bootstrap/`

Contiene el archivo `app.php` que arranca el framework. A partir de Laravel 11 también incluye `providers.php`. Normalmente no necesitarás tocar nada aquí.

---

## La carpeta `tests/`

Aquí van los **tests** de tu aplicación:

```
tests/
├── Feature/    ← tests de integración (flujos completos)
└── Unit/       ← tests unitarios (funciones individuales)
```

---

## La carpeta `vendor/`

Contiene todas las **dependencias de PHP instaladas por Composer**. Nunca debes modificar archivos aquí ni incluir esta carpeta en tu repositorio Git (ya está en `.gitignore`).

---

## Archivos en la raíz del proyecto

| Archivo | Propósito |
|---|---|
| `.env` | Variables de entorno (credenciales, configuración local) |
| `.env.example` | Plantilla del .env para compartir con el equipo |
| `artisan` | CLI de Laravel |
| `composer.json` | Dependencias PHP del proyecto |
| `composer.lock` | Versiones exactas instaladas |
| `package.json` | Dependencias JavaScript (Vite, Tailwind...) |
| `vite.config.js` | Configuración del bundler de assets |

---

## Resumen visual

```
mi-proyecto/
├── app/           ← Tu código (controllers, models, middleware)
├── config/        ← Configuración del framework
├── database/      ← Migraciones, seeders, factories
├── public/        ← Punto de entrada web (index.php)
├── resources/     ← Vistas Blade, CSS, JS sin compilar
├── routes/        ← Definición de URLs de la aplicación
├── storage/       ← Logs, caché, archivos subidos
├── tests/         ← Tests automatizados
└── vendor/        ← Dependencias de Composer (no tocar)
```

Con esta visión general ya sabes dónde vive cada pieza de tu aplicación. En la próxima lección veremos el archivo `.env`, que es donde configuras las credenciales y el comportamiento de tu entorno local.
