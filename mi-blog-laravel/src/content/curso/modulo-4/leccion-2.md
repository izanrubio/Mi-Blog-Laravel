---
modulo: 4
leccion: 2
title: 'Resource Controllers'
description: 'Domina los Resource Controllers de Laravel para crear CRUD completos con un solo comando y rutas automáticas para tus modelos.'
duracion: '20 min'
quiz:
  - pregunta: '¿Qué comando Artisan crea un Resource Controller?'
    opciones:
      - 'php artisan make:controller ProductoController --resource'
      - 'php artisan make:resource ProductoController'
      - 'php artisan make:controller ProductoController --crud'
      - 'php artisan make:controller ProductoController --all'
    correcta: 0
    explicacion: 'El flag --resource indica a Artisan que genere el controlador con los 7 métodos CRUD estándar de Laravel.'
  - pregunta: '¿Cuántos métodos incluye un Resource Controller completo en Laravel?'
    opciones:
      - '4 métodos (index, show, store, destroy)'
      - '5 métodos (index, create, store, show, destroy)'
      - '7 métodos (index, create, store, show, edit, update, destroy)'
      - '6 métodos (index, create, store, show, update, destroy)'
    correcta: 2
    explicacion: 'Un Resource Controller completo tiene 7 métodos: index, create, store, show, edit, update y destroy, cubriendo todas las operaciones CRUD.'
  - pregunta: '¿Cómo se registra una ruta de recurso completo en routes/web.php?'
    opciones:
      - 'Route::crud("/productos", ProductoController::class);'
      - 'Route::resource("/productos", ProductoController::class);'
      - 'Route::all("/productos", ProductoController::class);'
      - 'Route::controller("/productos", ProductoController::class);'
    correcta: 1
    explicacion: 'Route::resource() registra automáticamente las 7 rutas RESTful que mapean con los métodos del Resource Controller.'
---

## ¿Qué es un Resource Controller?

En la lección anterior creamos controladores y métodos manualmente. Pero Laravel tiene un patrón muy común para aplicaciones web: el CRUD (Create, Read, Update, Delete). Casi todas las secciones de una app web siguen este patrón: crear artículos, editarlos, verlos y eliminarlos.

Un **Resource Controller** es un controlador que ya viene con los 7 métodos estándar para gestionar un recurso, siguiendo las convenciones REST de Laravel. Y con una sola línea en las rutas, registras las 7 URLs necesarias de forma automática.

## Crear un Resource Controller

```bash
php artisan make:controller ProductoController --resource
```

Esto genera `app/Http/Controllers/ProductoController.php` con esta estructura:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProductoController extends Controller
{
    public function index()
    {
        //
    }

    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        //
    }

    public function show(string $id)
    {
        //
    }

    public function edit(string $id)
    {
        //
    }

    public function update(Request $request, string $id)
    {
        //
    }

    public function destroy(string $id)
    {
        //
    }
}
```

## Los 7 Métodos y su Significado

Cada método tiene un rol bien definido:

| Método | Verbo HTTP | URL | Descripción |
|--------|-----------|-----|-------------|
| `index` | GET | /productos | Lista todos los productos |
| `create` | GET | /productos/create | Muestra el formulario de creación |
| `store` | POST | /productos | Guarda un nuevo producto |
| `show` | GET | /productos/{id} | Muestra un producto específico |
| `edit` | GET | /productos/{id}/edit | Muestra el formulario de edición |
| `update` | PUT/PATCH | /productos/{id} | Actualiza un producto |
| `destroy` | DELETE | /productos/{id} | Elimina un producto |

## Registrar las Rutas con Route::resource

En `routes/web.php`:

```php
use App\Http\Controllers\ProductoController;

Route::resource('productos', ProductoController::class);
```

Esta sola línea registra las 7 rutas automáticamente. Puedes verificarlas ejecutando:

```bash
php artisan route:list
```

Verás algo como:

```
GET|HEAD   productos ..................... productos.index
GET|HEAD   productos/create ............. productos.create
POST       productos ..................... productos.store
GET|HEAD   productos/{producto} ......... productos.show
GET|HEAD   productos/{producto}/edit .... productos.edit
PUT|PATCH  productos/{producto} ......... productos.update
DELETE     productos/{producto} ......... productos.destroy
```

## Implementar los Métodos con Modelos

Veamos una implementación real usando el modelo `Producto`. Primero asumimos que tienes el modelo (lo crearemos en módulos posteriores):

```php
<?php

namespace App\Http\Controllers;

use App\Models\Producto;
use Illuminate\Http\Request;

class ProductoController extends Controller
{
    // GET /productos
    public function index()
    {
        $productos = Producto::all();
        return view('productos.index', compact('productos'));
    }

    // GET /productos/create
    public function create()
    {
        return view('productos.create');
    }

    // POST /productos
    public function store(Request $request)
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'precio' => 'required|numeric|min:0',
        ]);

        Producto::create($request->only(['nombre', 'precio']));

        return redirect()->route('productos.index')
            ->with('success', 'Producto creado correctamente.');
    }

    // GET /productos/{producto}
    public function show(Producto $producto)
    {
        return view('productos.show', compact('producto'));
    }

    // GET /productos/{producto}/edit
    public function edit(Producto $producto)
    {
        return view('productos.edit', compact('producto'));
    }

    // PUT /productos/{producto}
    public function update(Request $request, Producto $producto)
    {
        $request->validate([
            'nombre' => 'required|string|max:255',
            'precio' => 'required|numeric|min:0',
        ]);

        $producto->update($request->only(['nombre', 'precio']));

        return redirect()->route('productos.index')
            ->with('success', 'Producto actualizado correctamente.');
    }

    // DELETE /productos/{producto}
    public function destroy(Producto $producto)
    {
        $producto->delete();

        return redirect()->route('productos.index')
            ->with('success', 'Producto eliminado correctamente.');
    }
}
```

Nota el uso de **Route Model Binding**: en lugar de recibir `string $id` y buscar el modelo manualmente, simplemente declaras `Producto $producto` y Laravel lo busca automáticamente en la base de datos. Si no existe, devuelve un error 404 automáticamente.

## Rutas de Recursos Parciales

No siempre necesitas los 7 métodos. Si tu recurso solo necesita listar y mostrar (sin crear ni eliminar), puedes limitar las rutas:

```php
// Solo estas rutas
Route::resource('productos', ProductoController::class)->only([
    'index', 'show'
]);

// Todas excepto estas
Route::resource('productos', ProductoController::class)->except([
    'create', 'edit'
]);
```

## Recursos para APIs

Cuando construyes una API, los métodos `create` y `edit` no tienen sentido (no hay formularios HTML). Laravel tiene `apiResource` para esto:

```php
Route::apiResource('productos', ProductoController::class);
```

Esto registra solo 5 rutas (omite `create` y `edit`). Y puedes crear el controlador ya preparado para API:

```bash
php artisan make:controller Api/ProductoController --api
```

## Nombres de Rutas Automáticos

Con `Route::resource`, cada ruta obtiene automáticamente un nombre que puedes usar en tus vistas y controladores:

```php
// En una vista Blade, generar la URL del listado:
<a href="{{ route('productos.index') }}">Ver todos los productos</a>

// Para mostrar un producto específico:
<a href="{{ route('productos.show', $producto->id) }}">Ver producto</a>

// Para el formulario de edición:
<a href="{{ route('productos.edit', $producto->id) }}">Editar</a>

// Redirigir después de guardar:
return redirect()->route('productos.index');
```

Usar nombres de ruta en lugar de URLs hardcodeadas es una buena práctica: si cambias la URL en un futuro, solo cambias las rutas y el resto del código sigue funcionando.

## Combinar Resource Controller con Model

Puedes crear el modelo, la migración y el resource controller todo de una vez:

```bash
php artisan make:model Producto -mcr
```

Los flags significan:
- `-m`: crea la migración de base de datos
- `-c`: crea el controlador
- `-r`: hace que el controlador sea de tipo resource

Esto te ahorra varios comandos y crea todos los archivos necesarios de golpe.

## Formularios HTML y el Método Spoofing

Los formularios HTML solo soportan `GET` y `POST`. Para las peticiones `PUT`, `PATCH` y `DELETE` que necesitan los métodos `update` y `destroy`, Laravel usa **method spoofing**:

```html
<!-- Formulario de edición -->
<form action="{{ route('productos.update', $producto->id) }}" method="POST">
    @csrf
    @method('PUT')
    
    <input type="text" name="nombre" value="{{ $producto->nombre }}">
    <input type="number" name="precio" value="{{ $producto->precio }}">
    
    <button type="submit">Actualizar</button>
</form>

<!-- Botón de eliminar -->
<form action="{{ route('productos.destroy', $producto->id) }}" method="POST">
    @csrf
    @method('DELETE')
    <button type="submit">Eliminar</button>
</form>
```

La directiva `@method('PUT')` añade un campo oculto que Laravel lee para saber que debe tratar la petición como PUT aunque el formulario use POST.

## Personalizar el Nombre del Parámetro de Ruta

Por defecto, el parámetro en la URL se llama igual que el modelo en singular (ej: `{producto}`). Puedes personalizarlo:

```php
Route::resource('productos', ProductoController::class)
    ->parameters(['productos' => 'item']);
```

Ahora la URL sería `/productos/{item}` y el método del controlador recibiría `Producto $item`.

## Resumen

Los Resource Controllers son una de las características más productivas de Laravel. Con un solo comando Artisan y una sola línea de rutas, tienes un CRUD completo y bien organizado. Siguiendo las convenciones de nomenclatura, tu código será legible y predecible para cualquier desarrollador Laravel. En la siguiente lección exploraremos las rutas avanzadas: grupos, prefijos y nombres.
