---
title: 'Rutas en Laravel: guía completa de web.php y api.php'
description: 'Aprende a definir rutas en Laravel desde cero. GET, POST, PUT, DELETE, rutas con parámetros, grupos, nombres y middlewares explicados con ejemplos reales.'
pubDate: '2026-04-16'
tags: ['laravel', 'rutas', 'conceptos', 'roadmap']
---

Las rutas son el punto de entrada de cualquier aplicación Laravel. Cada URL que visita un usuario pasa primero por el sistema de rutas, que decide qué controlador o closure debe manejar esa petición. Entender bien cómo funcionan las rutas es fundamental para construir apps bien organizadas.

En esta guía veremos desde las rutas más básicas hasta grupos, middlewares, route model binding y las diferencias entre `web.php` y `api.php`.

## Rutas básicas: GET, POST, PUT, DELETE

Las rutas se definen en los archivos dentro de `routes/`. Las más simples devuelven una respuesta directamente desde un closure:

```php
use Illuminate\Support\Facades\Route;

// GET: mostrar contenido
Route::get('/productos', function () {
    return 'Lista de productos';
});

// POST: recibir datos de un formulario
Route::post('/productos', function () {
    return 'Producto creado';
});

// PUT/PATCH: actualizar un recurso
Route::put('/productos/{id}', function ($id) {
    return "Actualizando producto {$id}";
});

// DELETE: eliminar un recurso
Route::delete('/productos/{id}', function ($id) {
    return "Eliminando producto {$id}";
});
```

En la práctica, en lugar de closures usarás controladores. La sintaxis es:

```php
use App\Http\Controllers\ProductController;

Route::get('/productos', [ProductController::class, 'index']);
Route::post('/productos', [ProductController::class, 'store']);
Route::get('/productos/{product}', [ProductController::class, 'show']);
Route::put('/productos/{product}', [ProductController::class, 'update']);
Route::delete('/productos/{product}', [ProductController::class, 'destroy']);
```

## Route::resource y Route::apiResource

En lugar de definir las 7 rutas CRUD manualmente, usa `Route::resource`:

```php
Route::resource('productos', ProductController::class);
```

Esto registra automáticamente:

| Verbo     | URI                       | Método del controlador | Nombre de ruta         |
|-----------|---------------------------|------------------------|------------------------|
| GET       | /productos                | index                  | productos.index        |
| GET       | /productos/create         | create                 | productos.create       |
| POST      | /productos                | store                  | productos.store        |
| GET       | /productos/{producto}     | show                   | productos.show         |
| GET       | /productos/{producto}/edit | edit                  | productos.edit         |
| PUT/PATCH | /productos/{producto}     | update                 | productos.update       |
| DELETE    | /productos/{producto}     | destroy                | productos.destroy      |

Para APIs, donde no necesitas las rutas `create` y `edit` (que muestran formularios HTML):

```php
Route::apiResource('productos', ProductController::class);
```

Puedes registrar múltiples resources a la vez:

```php
Route::resources([
    'productos' => ProductController::class,
    'categorias' => CategoryController::class,
]);
```

## Parámetros en rutas

### Parámetros obligatorios

```php
// {id} es obligatorio, siempre debe estar en la URL
Route::get('/usuarios/{id}', function ($id) {
    return "Usuario: {$id}";
});

// Múltiples parámetros
Route::get('/posts/{post}/comentarios/{comentario}', function ($postId, $comentarioId) {
    return "Post {$postId}, comentario {$comentarioId}";
});
```

### Parámetros opcionales

```php
// El ? hace el parámetro opcional; dale un valor por defecto en la función
Route::get('/usuarios/{nombre?}', function ($nombre = 'invitado') {
    return "Hola, {$nombre}";
});
```

### Restricciones con expresiones regulares

```php
// Solo acepta IDs numéricos
Route::get('/productos/{id}', [ProductController::class, 'show'])
    ->where('id', '[0-9]+');

// Solo acepta slugs con letras y guiones
Route::get('/blog/{slug}', [PostController::class, 'show'])
    ->where('slug', '[a-z0-9-]+');

// Shorthand helpers
Route::get('/usuarios/{id}', [UserController::class, 'show'])
    ->whereNumber('id');

Route::get('/categorias/{nombre}', [CategoryController::class, 'show'])
    ->whereAlpha('nombre');
```

## Rutas con nombre (named routes)

Nombrar tus rutas es esencial para no tener URLs hardcodeadas en tu código:

```php
Route::get('/productos', [ProductController::class, 'index'])->name('productos.index');
Route::get('/productos/{product}', [ProductController::class, 'show'])->name('productos.show');
```

Ahora puedes generar URLs usando el nombre:

```php
// En un controlador o en código PHP
$url = route('productos.index');
// http://tu-app.com/productos

// Con parámetros
$url = route('productos.show', ['product' => 42]);
// http://tu-app.com/productos/42

// Redirección con nombre de ruta
return redirect()->route('productos.index');
```

Y en las vistas Blade:

```html
<a href="{{ route('productos.index') }}">Ver productos</a>
<a href="{{ route('productos.show', $product) }}">Ver producto</a>
```

## Grupos de rutas

Los grupos permiten aplicar configuraciones comunes (prefijo, middleware, namespace) a varias rutas a la vez.

### Grupo con prefijo

```php
// Todas las rutas dentro tendrán el prefijo /admin
Route::prefix('admin')->group(function () {
    Route::get('/dashboard', [AdminController::class, 'dashboard']);
    Route::get('/usuarios', [AdminController::class, 'usuarios']);
    Route::get('/pedidos', [AdminController::class, 'pedidos']);
});
// Rutas resultantes: /admin/dashboard, /admin/usuarios, /admin/pedidos
```

### Grupo con middleware

```php
// Solo usuarios autenticados pueden acceder
Route::middleware('auth')->group(function () {
    Route::get('/perfil', [ProfileController::class, 'show']);
    Route::put('/perfil', [ProfileController::class, 'update']);
});

// Múltiples middlewares
Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index']);
});
```

### Grupo con prefijo y middleware combinados

```php
Route::prefix('admin')
    ->middleware(['auth', 'role:admin'])
    ->name('admin.')
    ->group(function () {
        Route::get('/dashboard', [AdminController::class, 'dashboard'])->name('dashboard');
        Route::resource('usuarios', AdminUserController::class);
    });
// Ruta: /admin/dashboard con nombre admin.dashboard
```

### Grupos anidados

```php
Route::prefix('api')->group(function () {
    Route::prefix('v1')->group(function () {
        Route::get('/productos', [ProductController::class, 'index']);
    });
    Route::prefix('v2')->group(function () {
        Route::get('/productos', [ProductV2Controller::class, 'index']);
    });
});
```

## Generación de URLs

Además de `route()`, Laravel ofrece otras helpers para generar URLs:

```php
// URL absoluta a una ruta
$url = url('/productos');
// http://tu-app.com/productos

// URL al asset (para archivos en /public)
$urlImagen = asset('images/logo.png');
// http://tu-app.com/images/logo.png

// URL anterior (para botones "Volver")
$urlAnterior = url()->previous();
```

## Route Model Binding

Esta es una de las funcionalidades más elegantes de Laravel. En lugar de buscar el modelo manualmente, Laravel lo resuelve automáticamente:

```php
// Sin route model binding (manual)
Route::get('/productos/{id}', function ($id) {
    $product = Product::findOrFail($id);
    return view('productos.show', compact('product'));
});

// Con route model binding (automático)
// El parámetro {product} se resuelve buscando Product::find($product)
Route::get('/productos/{product}', function (Product $product) {
    return view('productos.show', compact('product'));
});
```

Si el producto no existe, Laravel devuelve automáticamente un 404. Sin código extra.

### Binding por columna personalizada

Por defecto busca por `id`. Puedes cambiarlo:

```php
// Busca por la columna 'slug' en lugar de 'id'
Route::get('/blog/{post:slug}', function (Post $post) {
    return view('blog.show', compact('post'));
});
```

## web.php vs api.php

Laravel carga estos archivos automáticamente con middlewares distintos:

**`routes/web.php`** — Para rutas web tradicionales:
- Aplica el grupo de middlewares `web`
- Incluye soporte para sesiones, cookies y protección CSRF
- Las respuestas suelen ser vistas HTML

**`routes/api.php`** — Para APIs REST:
- Aplica el grupo de middlewares `api`
- Todas las rutas tienen el prefijo `/api` automáticamente
- Sin sesiones ni CSRF (usa tokens para autenticación)
- Las respuestas suelen ser JSON

```php
// routes/api.php
// Esta ruta responde en /api/productos
Route::get('/productos', [ProductController::class, 'index']);

// Con autenticación Sanctum/Passport
Route::middleware('auth:sanctum')->group(function () {
    Route::apiResource('pedidos', OrderController::class);
});
```

## Listar todas las rutas

Para ver todas las rutas registradas en tu aplicación:

```bash
# Listar todas las rutas
php artisan route:list

# Solo rutas que contengan "producto" en el nombre o URI
php artisan route:list --filter=producto

# Solo rutas de un middleware específico
php artisan route:list --middleware=auth

# Formato compacto
php artisan route:list -c
```

La salida muestra el verbo HTTP, la URI, el nombre, la acción (controlador@método) y los middlewares aplicados. Es muy útil para depurar rutas que no funcionan como esperas.

## Buenas prácticas

**Usa siempre nombres en tus rutas.** Facilita el mantenimiento: si cambias la URI, no tienes que actualizar cada enlace en la app.

**Agrupa rutas relacionadas.** Usa `prefix` y `middleware` para mantener el código limpio y sin repeticiones.

**Prefiere Route::resource para CRUD.** Reduce código y sigue las convenciones de Laravel que otros desarrolladores ya conocen.

**No pongas lógica de negocio en closures.** Los closures son útiles para prototipos rápidos, pero en producción la lógica debe estar en controladores.

**Cachea las rutas en producción.** Con `php artisan route:cache` Laravel serializa todas las rutas, acelerando cada petición. Recuerda que no puedes usar closures si quieres cachear las rutas (solo controladores).
