---
title: 'Class App\\Http\\Controllers\\X does not exist en Laravel'
description: 'Soluciona el error Class Controller does not exist en Laravel: namespaces incorrectos, archivos mal ubicados y rutas apuntando a controladores que no existen.'
pubDate: '2024-02-25'
tags: ['laravel', 'errores', 'controladores', 'rutas']
---

`ReflectionException: Class "App\Http\Controllers\PostController" does not exist`. Probablemente lo has visto más de una vez, especialmente cuando estás aprendiendo Laravel. Este error puede tener varias causas, y vamos a desmenuzarlas todas para que puedas resolverlo rápidamente la próxima vez.

## Por qué ocurre este error

Laravel usa el autoloader de Composer para cargar clases automáticamente. Cuando defines una ruta que apunta a un controlador, Laravel intenta instanciar esa clase. Si no puede encontrarla, lanza este error. Las causas más comunes son:

1. El namespace de la clase está mal escrito
2. El archivo está en la ubicación incorrecta
3. Hay un typo en el nombre de la clase en la ruta
4. No ejecutaste `composer dump-autoload` después de crear el archivo manualmente

## La forma correcta de crear controladores

Siempre usa Artisan para crear controladores, nunca los crees manualmente si puedes evitarlo:

```bash
# Controlador básico
php artisan make:controller PostController

# Controlador de recurso (con todos los métodos CRUD)
php artisan make:controller PostController --resource

# Controlador de API (sin create ni edit)
php artisan make:controller PostController --api

# Controlador con modelo para route model binding
php artisan make:controller PostController --resource --model=Post

# En un subdirectorio (namespace anidado)
php artisan make:controller Admin/PostController
```

Artisan crea el archivo en el lugar correcto con el namespace correcto automáticamente.

## Anatomía de un controlador con namespace correcto

Cuando Artisan crea un controlador básico, genera algo así:

```php
<?php

namespace App\Http\Controllers;  // ← Este namespace es crítico

use Illuminate\Http\Request;

class PostController extends Controller
{
    public function index()
    {
        return view('posts.index');
    }

    public function show(Post $post)
    {
        return view('posts.show', compact('post'));
    }
}
```

Si el namespace no coincide con la ubicación del archivo, el autoloader no puede encontrar la clase.

### Subdirectorios y namespaces anidados

```php
<?php

// Archivo: app/Http/Controllers/Admin/PostController.php
namespace App\Http\Controllers\Admin;  // ← Namespace incluye el subdirectorio

use App\Http\Controllers\Controller;

class PostController extends Controller
{
    // ...
}
```

Y en las rutas:

```php
// routes/web.php
use App\Http\Controllers\Admin\PostController;

Route::resource('admin/posts', PostController::class);
```

## Cómo referenciar controladores en las rutas

En Laravel moderno (8+), la forma preferida es usar la sintaxis de clase:

```php
// FORMA MODERNA (recomendada)
use App\Http\Controllers\PostController;

Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/{post}', [PostController::class, 'show']);
Route::post('/posts', [PostController::class, 'store']);
```

```php
// FORMA ANTIGUA (todavía funciona pero no recomendada)
Route::get('/posts', 'App\Http\Controllers\PostController@index');

// O con el prefijo de namespace configurado (Laravel < 8)
Route::get('/posts', 'PostController@index');
```

La forma moderna con `::class` tiene la ventaja de que el IDE puede detectar errores de tipeo y navegar directamente al archivo.

## Route::resource y sus gotchas

Cuando usas `Route::resource`, registra automáticamente 7 rutas. El error más común es apuntar a un controlador que no tiene todos los métodos esperados:

```php
// Esto registra: index, create, store, show, edit, update, destroy
Route::resource('posts', PostController::class);

// Si PostController no tiene alguno de esos métodos,
// Laravel lanzará el error cuando se acceda a esa ruta
```

Para evitar esto, puedes usar `--resource` al crear el controlador o limitar qué rutas registras:

```php
// Solo algunas rutas
Route::resource('posts', PostController::class)->only(['index', 'show']);

// Todas excepto algunas
Route::resource('posts', PostController::class)->except(['create', 'edit']);

// Para APIs (sin create ni edit)
Route::apiResource('posts', PostController::class);
```

## El problema del namespace en Laravel 8+

En Laravel 7 y anteriores, había un prefijo de namespace configurado en `RouteServiceProvider`:

```php
// Laravel 7 - RouteServiceProvider.php
protected $namespace = 'App\Http\Controllers';
```

Esto permitía escribir rutas sin el namespace completo. En Laravel 8+, este prefijo fue eliminado por defecto. Si migras un proyecto de Laravel 7 a 8+ y empiezas a ver este error, tienes dos opciones:

```php
// Opción 1: Restaurar el comportamiento anterior (en RouteServiceProvider)
protected $namespace = 'App\\Http\\Controllers';

// Opción 2 (recomendada): Actualizar tus rutas a la sintaxis moderna
use App\Http\Controllers\PostController;
Route::get('/posts', [PostController::class, 'index']);
```

## Composer dump-autoload

Si creaste el archivo del controlador manualmente (sin Artisan), Composer puede no conocer la nueva clase hasta que regeneres el autoloader:

```bash
composer dump-autoload
```

O en modo optimizado para producción:

```bash
composer dump-autoload --optimize
```

En desarrollo esto raramente es necesario si usas Artisan, pero es útil saber cuándo aplicarlo.

## Checklist de diagnóstico

Cuando veas este error, comprueba en orden:

```bash
# 1. ¿Existe el archivo?
ls app/Http/Controllers/PostController.php

# 2. ¿El namespace del archivo es correcto?
head -3 app/Http/Controllers/PostController.php

# 3. ¿La ruta referencia el controlador correctamente?
php artisan route:list | grep post

# 4. ¿El autoloader está actualizado?
composer dump-autoload

# 5. ¿Hay caché de rutas desactualizado?
php artisan route:clear
php artisan config:clear
```

El paso 5 es especialmente importante en producción: si tienes caché de rutas (`php artisan route:cache`), los cambios en rutas no se reflejan hasta que limpies y regeneres la caché.

## Conclusión

La clave para evitar este error es usar siempre `php artisan make:controller` en lugar de crear archivos manualmente, y usar la sintaxis moderna `[ControllerClass::class, 'method']` en las rutas con el `use` correspondiente al principio del archivo. Con esos dos hábitos, este error prácticamente desaparece de tu vida.
