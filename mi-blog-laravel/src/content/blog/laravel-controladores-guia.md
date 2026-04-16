---
title: 'Controladores en Laravel: guía completa para principiantes'
description: 'Aprende a crear y usar controladores en Laravel. Controladores resource, inyección de dependencias, Form Requests y organización del código explicados con ejemplos.'
pubDate: '2026-04-16'
tags: ['laravel', 'controladores', 'conceptos', 'roadmap']
---

Cuando empiezas con Laravel, es tentador escribir toda la lógica directamente en los closures de `routes/web.php`. Funciona para ejemplos pequeños, pero en cuanto la app crece se vuelve un caos. Los controladores son la solución: clases PHP dedicadas a manejar las peticiones HTTP y orquestar la respuesta.

En esta guía aprenderás a crear controladores desde cero, cuándo usar cada tipo y cómo seguir las convenciones de Laravel para tener código limpio y mantenible.

## ¿Qué es un controlador y por qué usarlo?

Un controlador es una clase PHP que agrupa métodos relacionados para manejar peticiones HTTP. En lugar de tener la lógica en las rutas, la mueves a clases organizadas por recurso o funcionalidad.

Sin controlador (lógica en rutas):

```php
// routes/web.php — difícil de mantener cuando crece
Route::get('/productos', function () {
    $products = Product::with('category')->paginate(15);
    return view('productos.index', compact('products'));
});

Route::post('/productos', function (Request $request) {
    $request->validate([
        'nombre' => 'required|string|max:255',
        'precio' => 'required|numeric|min:0',
    ]);
    Product::create($request->all());
    return redirect()->route('productos.index');
});
```

Con controlador (organizado y reutilizable):

```php
// routes/web.php — limpio y legible
Route::resource('productos', ProductController::class);
```

```php
// app/Http/Controllers/ProductController.php — toda la lógica aquí
class ProductController extends Controller
{
    public function index() { /* ... */ }
    public function store(Request $request) { /* ... */ }
}
```

## Crear un controlador con Artisan

```bash
# Controlador básico vacío
php artisan make:controller ProductController

# Controlador con los 7 métodos resource generados
php artisan make:controller ProductController --resource

# Controlador resource con el modelo ya inyectado en la firma
php artisan make:controller ProductController --resource --model=Product

# Controlador de acción única
php artisan make:controller ShowDashboardController --invokable
```

El archivo se crea en `app/Http/Controllers/`.

## Estructura básica de un controlador

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ProductController extends Controller
{
    public function index(): View
    {
        $products = Product::latest()->paginate(15);

        return view('productos.index', compact('products'));
    }

    public function show(Product $product): View
    {
        return view('productos.show', compact('product'));
    }
}
```

Todo controlador extiende `App\Http\Controllers\Controller`, la clase base que incluye helpers de autorización y validación.

## Controladores Resource

Un controlador resource sigue una convención de 7 métodos, cada uno asociado a una operación CRUD:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Illuminate\View\View;

class ProductController extends Controller
{
    // GET /productos — listar todos
    public function index(): View
    {
        $products = Product::with('category')->latest()->paginate(15);

        return view('productos.index', compact('products'));
    }

    // GET /productos/create — mostrar formulario de creación
    public function create(): View
    {
        $categories = Category::all();

        return view('productos.create', compact('categories'));
    }

    // POST /productos — guardar nuevo producto
    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'nombre'       => 'required|string|max:255',
            'descripcion'  => 'nullable|string',
            'precio'       => 'required|numeric|min:0',
            'category_id'  => 'required|exists:categories,id',
        ]);

        Product::create($validated);

        return redirect()
            ->route('productos.index')
            ->with('success', 'Producto creado correctamente.');
    }

    // GET /productos/{product} — ver detalle
    public function show(Product $product): View
    {
        return view('productos.show', compact('product'));
    }

    // GET /productos/{product}/edit — formulario de edición
    public function edit(Product $product): View
    {
        $categories = Category::all();

        return view('productos.edit', compact('product', 'categories'));
    }

    // PUT /productos/{product} — actualizar
    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate([
            'nombre'       => 'required|string|max:255',
            'descripcion'  => 'nullable|string',
            'precio'       => 'required|numeric|min:0',
            'category_id'  => 'required|exists:categories,id',
        ]);

        $product->update($validated);

        return redirect()
            ->route('productos.show', $product)
            ->with('success', 'Producto actualizado.');
    }

    // DELETE /productos/{product} — eliminar
    public function destroy(Product $product): RedirectResponse
    {
        $product->delete();

        return redirect()
            ->route('productos.index')
            ->with('success', 'Producto eliminado.');
    }
}
```

## Controladores de acción única (__invoke)

Para acciones que no pertenecen a un recurso concreto, un controlador con un solo método `__invoke` es más limpio:

```bash
php artisan make:controller ShowDashboardController --invokable
```

```php
<?php

namespace App\Http\Controllers;

use Illuminate\View\View;

class ShowDashboardController extends Controller
{
    public function __invoke(): View
    {
        $stats = [
            'total_products' => Product::count(),
            'total_orders'   => Order::count(),
            'revenue'        => Order::sum('total'),
        ];

        return view('dashboard', compact('stats'));
    }
}
```

La ruta se define sin especificar el método:

```php
Route::get('/dashboard', ShowDashboardController::class);
```

## Inyección de dependencias en el constructor

Si necesitas el mismo servicio en todos los métodos del controlador, inyéctalo en el constructor. Laravel usa el contenedor de servicios para resolver automáticamente las dependencias:

```php
<?php

namespace App\Http\Controllers;

use App\Services\ProductService;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(
        private ProductService $productService
    ) {}

    public function index()
    {
        $products = $this->productService->getFeatured();

        return view('productos.index', compact('products'));
    }

    public function store(Request $request)
    {
        $product = $this->productService->create($request->validated());

        return redirect()->route('productos.index');
    }
}
```

## Acceder a los datos del Request

El objeto `Request` contiene toda la información de la petición HTTP:

```php
public function store(Request $request)
{
    // Obtener un campo específico
    $nombre = $request->input('nombre');

    // Con valor por defecto si no existe
    $pagina = $request->input('pagina', 1);

    // Todos los datos enviados (GET + POST)
    $todos = $request->all();

    // Solo los campos que especifiques
    $solo = $request->only(['nombre', 'precio', 'category_id']);

    // Todos excepto los que especifiques
    $sin = $request->except(['_token', '_method']);

    // ¿Existe un campo?
    if ($request->has('descuento')) {
        // ...
    }

    // ¿El campo tiene valor (no null, no vacío)?
    if ($request->filled('descripcion')) {
        // ...
    }

    // Acceso como propiedad
    $precio = $request->precio;

    // Método HTTP
    $metodo = $request->method(); // GET, POST, PUT...

    // URL actual
    $url = $request->url();

    // ¿Es una petición AJAX?
    if ($request->expectsJson()) {
        return response()->json(['ok' => true]);
    }
}
```

## Form Requests para validación avanzada

Cuando la lógica de validación es compleja o la reutilizas en varios lugares, extráela a un Form Request:

```bash
php artisan make:request StoreProductRequest
```

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductRequest extends FormRequest
{
    // ¿Quién puede hacer esta petición?
    public function authorize(): bool
    {
        // true = cualquiera autenticado puede
        // Aquí puedes añadir lógica de autorización
        return $this->user()->can('create', Product::class);
    }

    // Las reglas de validación
    public function rules(): array
    {
        return [
            'nombre'      => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:2000'],
            'precio'      => ['required', 'numeric', 'min:0', 'max:99999'],
            'categoria_id'=> ['required', 'exists:categorias,id'],
            'imagen'      => ['nullable', 'image', 'max:2048'],
        ];
    }

    // Mensajes de error personalizados (opcional)
    public function messages(): array
    {
        return [
            'nombre.required'      => 'El nombre del producto es obligatorio.',
            'precio.required'      => 'Debes indicar un precio.',
            'precio.min'           => 'El precio no puede ser negativo.',
            'categoria_id.exists'  => 'La categoría seleccionada no existe.',
        ];
    }
}
```

En el controlador, simplemente cambia `Request` por tu Form Request:

```php
use App\Http\Requests\StoreProductRequest;

public function store(StoreProductRequest $request): RedirectResponse
{
    // Si llegamos aquí, la validación ya pasó
    // $request->validated() devuelve solo los campos validados
    $product = Product::create($request->validated());

    return redirect()->route('productos.show', $product);
}
```

## Devolver vistas y redirecciones

```php
// Devolver una vista con datos
return view('productos.show', ['product' => $product]);
return view('productos.show', compact('product'));

// Redirección simple
return redirect('/productos');

// Redirección a ruta nombrada
return redirect()->route('productos.index');

// Redirección con parámetros
return redirect()->route('productos.show', ['product' => $product->id]);

// Redirección a la página anterior
return redirect()->back();

// Redirección con datos flash en la sesión
return redirect()->route('productos.index')
    ->with('success', 'Producto guardado correctamente.');

// Redirección con errores de validación (automático con Form Requests)
return redirect()->back()->withErrors($validator)->withInput();
```

## Middleware en controladores

Puedes aplicar middleware directamente en el controlador, en lugar de en las rutas:

```php
class ProductController extends Controller
{
    public function __construct()
    {
        // Solo usuarios autenticados pueden acceder a todos los métodos
        $this->middleware('auth');

        // Solo admins pueden crear y eliminar
        $this->middleware('role:admin')->only(['create', 'store', 'destroy']);

        // El middleware 'log.activity' se aplica a todos excepto index y show
        $this->middleware('log.activity')->except(['index', 'show']);
    }
}
```

Con PHP 8 y Laravel 11, también puedes usar el atributo `#[Middleware]`:

```php
use Illuminate\Routing\Controllers\HasMiddleware;
use Illuminate\Routing\Controllers\Middleware;

class ProductController extends Controller implements HasMiddleware
{
    public static function middleware(): array
    {
        return [
            'auth',
            new Middleware('role:admin', only: ['store', 'update', 'destroy']),
        ];
    }
}
```

## Organización en subdirectorios

Para apps grandes, organiza los controladores en subdirectorios:

```bash
php artisan make:controller Admin/ProductController --resource
php artisan make:controller Api/V1/ProductController --resource
```

Esto crea `app/Http/Controllers/Admin/ProductController.php` con el namespace `App\Http\Controllers\Admin`.

Los controladores son el núcleo de la capa HTTP en Laravel. Una buena práctica es mantenerlos delgados: su responsabilidad es recibir la petición, delegar la lógica de negocio a servicios o modelos, y devolver la respuesta. Si un método supera las 30 líneas, probablemente debería mover algo a un servicio.
