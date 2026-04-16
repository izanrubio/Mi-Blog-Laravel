---
modulo: 4
leccion: 3
title: 'Rutas avanzadas — grupos, prefijos, nombres'
description: 'Aprende a organizar las rutas de Laravel con grupos, prefijos y nombres para mantener tu archivo de rutas limpio y escalable.'
duracion: '18 min'
quiz:
  - pregunta: '¿Cuál es la forma correcta de aplicar un prefijo "/admin" a un grupo de rutas?'
    opciones:
      - 'Route::prefix("admin")->group(function() { ... });'
      - 'Route::group("admin", function() { ... });'
      - 'Route::namespace("admin")->group(function() { ... });'
      - 'Route::url("/admin")->group(function() { ... });'
    correcta: 0
    explicacion: 'Route::prefix() encadena con ->group() para aplicar un prefijo de URL a todas las rutas dentro del grupo.'
  - pregunta: '¿Cómo se genera una URL usando el nombre de una ruta en Blade?'
    opciones:
      - '{{ url("nombre.ruta") }}'
      - '{{ path("nombre.ruta") }}'
      - '{{ link("nombre.ruta") }}'
      - '{{ route("nombre.ruta") }}'
    correcta: 3
    explicacion: 'La función route() genera la URL completa a partir del nombre de la ruta, lo que facilita el mantenimiento cuando cambian las URLs.'
  - pregunta: '¿Qué método se usa para asignar un nombre a una ruta en Laravel?'
    opciones:
      - '->alias("nombre")'
      - '->name("nombre")'
      - '->as("nombre")'
      - '->label("nombre")'
    correcta: 1
    explicacion: 'El método ->name() encadenado a una ruta le asigna un nombre que luego se puede usar con la función route() en vistas y controladores.'
---

## Por qué necesitas rutas avanzadas

Cuando una aplicación crece, el archivo `routes/web.php` puede convertirse en un caos. Decenas o cientos de rutas sin organización hacen que sea difícil encontrar lo que buscas, y mucho peor, dificultan cambiar las URLs en el futuro sin romper otras partes del código.

Laravel ofrece herramientas muy potentes para organizar las rutas: **grupos**, **prefijos**, **nombres** y **middlewares** (estos últimos en la siguiente lección). Dominar estas herramientas es fundamental para mantener proyectos grandes.

## Nombrar Rutas

Lo primero que deberías hacer es darle un nombre a cada ruta. En lugar de generar URLs con cadenas de texto directas, usas el nombre:

```php
// Sin nombre (problemático)
Route::get('/productos', [ProductoController::class, 'index']);

// Con nombre (recomendado)
Route::get('/productos', [ProductoController::class, 'index'])->name('productos.index');
```

En tus vistas y controladores usas la función `route()`:

```php
// En Blade
<a href="{{ route('productos.index') }}">Ver productos</a>

// En un controlador
return redirect()->route('productos.index');
```

Si algún día decides cambiar `/productos` por `/catalogo`, solo modificas la definición de la ruta. Todos los `route('productos.index')` en el código seguirán funcionando sin tocar nada más.

## Pasar Parámetros a Rutas Nombradas

Cuando la ruta tiene parámetros, los pasas como segundo argumento:

```php
Route::get('/productos/{id}', [ProductoController::class, 'show'])->name('productos.show');
Route::get('/productos/{id}/edit', [ProductoController::class, 'edit'])->name('productos.edit');
```

```php
// Con un parámetro
<a href="{{ route('productos.show', ['id' => $producto->id]) }}">Ver</a>

// Forma abreviada (valor directamente)
<a href="{{ route('productos.show', $producto->id) }}">Ver</a>

// Con múltiples parámetros
<a href="{{ route('productos.comentarios.show', ['producto' => 1, 'comentario' => 5]) }}">
    Ver comentario
</a>
```

## Agrupar Rutas con Route::group

El método `Route::group` te permite aplicar atributos comunes a un conjunto de rutas:

```php
Route::group(['prefix' => 'admin', 'as' => 'admin.'], function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
    Route::get('/usuarios', [UsuarioController::class, 'index'])->name('usuarios');
    Route::get('/productos', [ProductoController::class, 'index'])->name('productos');
});
```

En este ejemplo:
- Todas las rutas tendrán el prefijo `/admin` en la URL.
- Todos los nombres de ruta empezarán con `admin.`.
- El nombre completo del dashboard sería `admin.dashboard`.

## Prefijos de URL

Si solo necesitas un prefijo en la URL sin más atributos, la sintaxis encadenada es más limpia:

```php
Route::prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    // URL resultante: /admin/dashboard

    Route::get('/usuarios', [UsuarioController::class, 'index']);
    // URL resultante: /admin/usuarios

    Route::get('/configuracion', [ConfigController::class, 'index']);
    // URL resultante: /admin/configuracion
});
```

## Prefijos de Nombres con name()

Para que los nombres de ruta también tengan un prefijo común:

```php
Route::name('admin.')->prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
    // Nombre completo: admin.dashboard

    Route::get('/usuarios', [UsuarioController::class, 'index'])->name('usuarios');
    // Nombre completo: admin.usuarios
});
```

Ahora en tus vistas:

```php
<a href="{{ route('admin.dashboard') }}">Dashboard</a>
<a href="{{ route('admin.usuarios') }}">Gestión de usuarios</a>
```

## Grupos Anidados

Los grupos se pueden anidar para estructuras más complejas:

```php
Route::prefix('admin')->name('admin.')->group(function () {
    // Rutas generales de admin
    Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');

    // Sub-grupo para la tienda
    Route::prefix('tienda')->name('tienda.')->group(function () {
        Route::get('/productos', [ProductoController::class, 'index'])->name('productos');
        // URL: /admin/tienda/productos
        // Nombre: admin.tienda.productos

        Route::get('/categorias', [CategoriaController::class, 'index'])->name('categorias');
        // URL: /admin/tienda/categorias
        // Nombre: admin.tienda.categorias
    });

    // Sub-grupo para usuarios
    Route::prefix('usuarios')->name('usuarios.')->group(function () {
        Route::get('/', [UsuarioController::class, 'index'])->name('index');
        // URL: /admin/usuarios
        // Nombre: admin.usuarios.index

        Route::get('/{id}', [UsuarioController::class, 'show'])->name('show');
        // URL: /admin/usuarios/{id}
        // Nombre: admin.usuarios.show
    });
});
```

## Restricciones en Parámetros de Rutas

Puedes indicar qué formato deben tener los parámetros de ruta usando expresiones regulares:

```php
// Solo números
Route::get('/productos/{id}', [ProductoController::class, 'show'])
    ->where('id', '[0-9]+')
    ->name('productos.show');

// Solo letras y guiones (slug)
Route::get('/blog/{slug}', [BlogController::class, 'show'])
    ->where('slug', '[a-z0-9-]+')
    ->name('blog.show');

// Varios parámetros
Route::get('/usuarios/{id}/pedidos/{pedido}', [PedidoController::class, 'show'])
    ->where(['id' => '[0-9]+', 'pedido' => '[0-9]+']);
```

Laravel también tiene métodos de ayuda para restricciones comunes:

```php
Route::get('/productos/{id}', [ProductoController::class, 'show'])
    ->whereNumber('id');

Route::get('/blog/{slug}', [BlogController::class, 'show'])
    ->whereAlphaNumeric('slug');
```

## Rutas Fallback

Si ninguna ruta coincide con la URL, Laravel devuelve un 404. Puedes personalizar ese comportamiento con una ruta fallback:

```php
Route::fallback(function () {
    return view('errores.404');
});
```

Coloca siempre la ruta fallback al final del archivo de rutas.

## Rutas con Namespaces de Controladores

En proyectos grandes, puedes organizar los controladores en subdirectorios y usar el método `namespace` en los grupos para evitar imports repetitivos:

```php
// Sin namespace en el grupo (tienes que importar cada controlador)
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\UsuarioController;

Route::prefix('admin')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/usuarios', [UsuarioController::class, 'index']);
});

// Con namespace en el grupo (más limpio para grupos grandes)
// Nota: en Laravel 8+ se prefiere usar los imports directos
```

## Organizar Rutas en Múltiples Archivos

Cuando tu aplicación tiene muchas rutas, puedes separarlas en múltiples archivos y cargarlos desde `RouteServiceProvider` o directamente desde `web.php`:

```php
// routes/web.php
require __DIR__.'/admin.php';
require __DIR__.'/api-web.php';
```

```php
// routes/admin.php
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\UsuarioController;

Route::prefix('admin')->name('admin.')->middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::resource('usuarios', UsuarioController::class);
});
```

## Verificar las Rutas Registradas

Una de las herramientas más útiles de Artisan para trabajar con rutas:

```bash
# Ver todas las rutas
php artisan route:list

# Filtrar por nombre
php artisan route:list --name=admin

# Filtrar por método HTTP
php artisan route:list --method=GET

# Ver solo rutas con un path específico
php artisan route:list --path=productos
```

## Rutas con Parámetros Opcionales

A veces un parámetro es opcional. Se indica con `?` y se debe definir un valor por defecto en el controlador:

```php
Route::get('/usuarios/{nombre?}', function (?string $nombre = 'invitado') {
    return "Hola, {$nombre}";
})->name('saludo');

// /usuarios       → "Hola, invitado"
// /usuarios/Juan  → "Hola, Juan"
```

## Resumen

Las rutas avanzadas de Laravel te dan el control total sobre cómo está estructurada tu aplicación. Usar nombres en las rutas protege tu código frente a cambios de URL. Los grupos con prefijos y nombres anidados mantienen el archivo de rutas organizado y legible. Invertir tiempo en organizar bien las rutas desde el principio te ahorrará muchos dolores de cabeza cuando el proyecto crezca.
