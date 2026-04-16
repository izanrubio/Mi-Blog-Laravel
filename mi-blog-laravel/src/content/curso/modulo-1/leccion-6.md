---
modulo: 1
leccion: 6
title: 'Tu primera ruta y respuesta'
description: 'Aprende a definir rutas en Laravel, tipos de respuestas (texto, JSON, vistas), parámetros de ruta, rutas con nombre y cómo organizar tus primeras URLs.'
duracion: '20 min'
quiz:
  - pregunta: '¿Cómo se define una ruta GET en Laravel que responde en la URL "/about"?'
    opciones:
      - 'Route::get("/about", fn() => "Sobre nosotros");'
      - 'Router::get("/about", fn() => "Sobre nosotros");'
      - 'Route::on("/about", "GET", fn() => "Sobre nosotros");'
      - 'get("/about", fn() => "Sobre nosotros");'
    correcta: 0
    explicacion: 'En Laravel las rutas se definen con la facade Route y el método HTTP correspondiente. Route::get("/about", fn() => "texto") es la sintaxis correcta. También puedes usar una función anónima completa o un array [Controller::class, "method"] como segundo argumento.'
  - pregunta: '¿Cómo se define un parámetro obligatorio en una ruta de Laravel?'
    opciones:
      - 'Route::get("/user/:id", ...)'
      - 'Route::get("/user/{id}", ...)'
      - 'Route::get("/user/[id]", ...)'
      - 'Route::get("/user/<id>", ...)'
    correcta: 1
    explicacion: 'Los parámetros de ruta en Laravel se definen con llaves: {id}. Para parámetros opcionales se añade un signo de interrogación: {id?}. El valor del parámetro se pasa automáticamente a la función o método del controlador.'
  - pregunta: '¿Qué método se usa para generar la URL de una ruta con nombre?'
    opciones:
      - 'url("nombre.ruta")'
      - 'link("nombre.ruta")'
      - 'route("nombre.ruta")'
      - 'href("nombre.ruta")'
    correcta: 2
    explicacion: 'El helper route() genera la URL completa de una ruta con nombre: route("articles.show", ["id" => 1]). Las rutas con nombre son muy útiles porque si cambias la URL en el futuro, solo tienes que cambiarla en un lugar (routes/web.php), no en todos los enlaces de las vistas.'
---

## Las rutas en Laravel

Las **rutas** son la puerta de entrada a tu aplicación. Definen qué URLs responde tu aplicación y qué debe devolver cuando alguien visita esa URL. Toda la magia empieza aquí.

En Laravel, las rutas se definen principalmente en dos archivos:

- `routes/web.php` — para rutas web (responden a navegadores, tienen sesiones y CSRF)
- `routes/api.php` — para rutas de API REST (sin estado, sin sesiones)

Abre `routes/web.php`. Verás la ruta de bienvenida que viene por defecto:

```php
<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
```

Esto le dice a Laravel: "cuando alguien haga una petición GET a la raíz `/`, ejecuta esta función y devuelve la vista `welcome`".

---

## Verbos HTTP disponibles

Laravel soporta todos los verbos HTTP estándar:

```php
Route::get($uri, $callback);      // Obtener datos
Route::post($uri, $callback);     // Enviar/crear datos
Route::put($uri, $callback);      // Actualizar (reemplazo completo)
Route::patch($uri, $callback);    // Actualizar (modificación parcial)
Route::delete($uri, $callback);   // Eliminar
Route::options($uri, $callback);  // Opciones CORS
```

Para que una ruta responda a **cualquier verbo**:

```php
Route::any('/ping', function () {
    return 'pong';
});
```

Para que responda a **varios verbos específicos**:

```php
Route::match(['get', 'post'], '/formulario', function () {
    return 'Esto responde a GET y POST';
});
```

---

## Tipos de respuestas

### Responder con texto plano

```php
Route::get('/hola', function () {
    return 'Hola, mundo!';
});
```

### Responder con JSON

```php
Route::get('/api/info', function () {
    return response()->json([
        'app'     => 'Mi Blog',
        'version' => '1.0',
        'status'  => 'ok',
    ]);
});
```

Laravel convierte automáticamente los arrays a JSON si los retornas directamente:

```php
Route::get('/api/info', function () {
    return ['app' => 'Mi Blog', 'version' => '1.0'];
});
```

### Responder con una vista Blade

```php
Route::get('/sobre-nosotros', function () {
    return view('sobre-nosotros');
});

// Pasar datos a la vista
Route::get('/inicio', function () {
    $nombre = 'Ana';
    $articulos = ['Laravel', 'PHP', 'Vue.js'];

    return view('inicio', compact('nombre', 'articulos'));
    // equivalente a:
    // return view('inicio', ['nombre' => $nombre, 'articulos' => $articulos]);
});
```

### Responder con redirecciones

```php
// Redirigir a otra URL
Route::get('/viejo-link', function () {
    return redirect('/nuevo-link');
});

// Redirigir a una ruta con nombre
Route::get('/admin', function () {
    return redirect()->route('dashboard');
});

// Redirigir con código de estado
Route::get('/movido', function () {
    return redirect('/nuevo', 301);
});
```

---

## Parámetros de ruta

### Parámetros obligatorios

Los parámetros se definen entre llaves `{}` y se pasan automáticamente al callback:

```php
// Un parámetro
Route::get('/articulos/{id}', function (int $id) {
    return "Mostrando artículo número: {$id}";
});

// Varios parámetros
Route::get('/usuarios/{userId}/articulos/{articleId}', function (int $userId, int $articleId) {
    return "Usuario {$userId}, artículo {$articleId}";
});
```

Visitar `/articulos/42` devolverá: `Mostrando artículo número: 42`

### Parámetros opcionales

Añade `?` al nombre del parámetro y un valor por defecto en la función:

```php
Route::get('/articulos/{categoria?}', function (string $categoria = 'general') {
    return "Categoría: {$categoria}";
});
```

Tanto `/articulos` como `/articulos/tecnologia` funcionarán.

### Restricciones con expresiones regulares

Puedes restringir el formato del parámetro con `where`:

```php
// Solo acepta números
Route::get('/articulos/{id}', function (int $id) {
    return "Artículo #{$id}";
})->where('id', '[0-9]+');

// Solo acepta letras
Route::get('/categoria/{nombre}', function (string $nombre) {
    return "Categoría: {$nombre}";
})->where('nombre', '[a-zA-Z]+');

// Usando atajos
Route::get('/articulos/{id}', fn(int $id) => $id)->whereNumber('id');
Route::get('/categoria/{slug}', fn(string $slug) => $slug)->whereAlphaNumeric('slug');
```

---

## Rutas con nombre

Dar nombres a las rutas es una **mejor práctica fundamental**. Te permite generar URLs sin escribir la ruta directamente, lo que facilita el mantenimiento:

```php
// Definir una ruta con nombre
Route::get('/articulos/{id}', function (int $id) {
    return "Artículo #{$id}";
})->name('articulos.show');

Route::get('/articulos', function () {
    return 'Lista de artículos';
})->name('articulos.index');
```

Para generar la URL de una ruta con nombre, usa el helper `route()`:

```php
// Sin parámetros
$url = route('articulos.index');
// http://localhost:8000/articulos

// Con parámetros
$url = route('articulos.show', ['id' => 42]);
// http://localhost:8000/articulos/42

// En Blade
<a href="{{ route('articulos.index') }}">Ver todos los artículos</a>
<a href="{{ route('articulos.show', ['id' => $article->id]) }}">{{ $article->title }}</a>
```

Si algún día necesitas cambiar la URL de `/articulos` a `/posts`, solo cambias la ruta en `web.php`. Todos los `route('articulos.index')` en las vistas seguirán funcionando sin tocarlos.

---

## Agrupar rutas

Cuando tienes muchas rutas, puedes agruparlas para compartir configuración (prefijo, middleware, nombre):

### Prefijo de URL

```php
Route::prefix('admin')->group(function () {
    Route::get('/dashboard', fn() => 'Panel de admin')->name('admin.dashboard');
    Route::get('/usuarios', fn() => 'Lista de usuarios')->name('admin.users');
    Route::get('/articulos', fn() => 'Gestión de artículos')->name('admin.articles');
});
// URLs: /admin/dashboard, /admin/usuarios, /admin/articulos
```

### Prefijo de nombre

```php
Route::name('admin.')->prefix('admin')->group(function () {
    Route::get('/dashboard', fn() => 'Panel')->name('dashboard');
    // Nombre completo: admin.dashboard
});
```

### Middleware en grupos

```php
Route::middleware('auth')->group(function () {
    Route::get('/perfil', fn() => 'Mi perfil')->name('profile');
    Route::get('/configuracion', fn() => 'Configuración')->name('settings');
});
```

---

## Rutas de recursos (CRUD completo)

Si necesitas las 7 rutas típicas de un CRUD, Laravel las genera todas con una sola línea:

```php
Route::resource('articulos', ArticleController::class);
```

Esto genera automáticamente:

| Verbo | URL | Acción | Nombre |
|---|---|---|---|
| GET | `/articulos` | index | `articulos.index` |
| GET | `/articulos/create` | create | `articulos.create` |
| POST | `/articulos` | store | `articulos.store` |
| GET | `/articulos/{id}` | show | `articulos.show` |
| GET | `/articulos/{id}/edit` | edit | `articulos.edit` |
| PUT/PATCH | `/articulos/{id}` | update | `articulos.update` |
| DELETE | `/articulos/{id}` | destroy | `articulos.destroy` |

Para una API (sin las rutas de formulario `create` y `edit`):

```php
Route::apiResource('articulos', ArticleController::class);
```

---

## Tu primera ruta completa — práctica

Vamos a construir algo real. Añade estas rutas a `routes/web.php`:

```php
<?php

use Illuminate\Support\Facades\Route;

// Página principal
Route::get('/', function () {
    return view('welcome');
})->name('home');

// Blog - lista de artículos
Route::get('/blog', function () {
    $articulos = [
        ['id' => 1, 'titulo' => 'Introducción a Laravel', 'fecha' => '2024-01-15'],
        ['id' => 2, 'titulo' => 'Eloquent ORM explicado', 'fecha' => '2024-01-22'],
        ['id' => 3, 'titulo' => 'Blade Templates en detalle', 'fecha' => '2024-01-29'],
    ];

    return view('blog.index', compact('articulos'));
})->name('blog.index');

// Ver un artículo por ID
Route::get('/blog/{id}', function (int $id) {
    return view('blog.show', ['id' => $id]);
})->name('blog.show')->whereNumber('id');

// Página Sobre nosotros
Route::get('/sobre-nosotros', function () {
    return view('sobre-nosotros');
})->name('about');

// API - info del blog
Route::get('/api/info', function () {
    return response()->json([
        'nombre'   => config('app.name'),
        'version'  => '1.0.0',
        'articulos' => 3,
    ]);
});
```

Ahora verifica que todas las rutas se crearon correctamente:

```bash
php artisan route:list
```

Deberías ver algo como:

```
GET  /           home
GET  /blog        blog.index
GET  /blog/{id}   blog.show
GET  /sobre-nosotros   about
GET  /api/info
```

---

## Diferencia entre `routes/web.php` y `routes/api.php`

| Característica | web.php | api.php |
|---|---|---|
| Prefijo URL | Ninguno | `/api/` |
| Sesiones | Sí | No |
| Cookies | Sí | No |
| CSRF Protection | Sí | No |
| Middleware por defecto | `web` | `api` |
| Rate limiting | No | Sí (60 req/min por defecto) |
| Ideal para | Páginas HTML | Endpoints REST/JSON |

---

## Resumen

Has aprendido a:

- Definir rutas GET, POST y otros verbos HTTP.
- Devolver texto, JSON, vistas y redirecciones.
- Usar parámetros obligatorios y opcionales.
- Restringir parámetros con expresiones regulares.
- Dar nombres a las rutas y usar `route()` para generar URLs.
- Agrupar rutas con prefijos y middleware.
- Generar rutas CRUD completas con `Route::resource()`.

Las rutas son el esqueleto de tu aplicación Laravel. A partir del siguiente módulo empezarás a conectarlas con controladores y modelos para construir aplicaciones completas. ¡Sigue adelante!
