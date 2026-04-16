---
modulo: 4
leccion: 1
title: 'Controladores — qué son y cómo crearlos'
description: 'Aprende qué son los controladores en Laravel, cómo crearlos con Artisan y cómo conectarlos con las rutas de tu aplicación.'
duracion: '15 min'
quiz:
  - pregunta: '¿Cuál es el comando Artisan correcto para crear un controlador llamado ProductoController?'
    opciones:
      - 'php artisan make:controller ProductoController'
      - 'php artisan create:controller ProductoController'
      - 'php artisan new:controller ProductoController'
      - 'php artisan generate:controller ProductoController'
    correcta: 0
    explicacion: 'El comando correcto es php artisan make:controller. Artisan usa el prefijo make: para generar archivos de código.'
  - pregunta: '¿En qué directorio se guardan los controladores por defecto en Laravel?'
    opciones:
      - 'src/controllers/'
      - 'app/Http/Controllers/'
      - 'app/Controllers/'
      - 'routes/controllers/'
    correcta: 1
    explicacion: 'Laravel guarda los controladores en app/Http/Controllers/, siguiendo la convención de la capa HTTP de la aplicación.'
  - pregunta: '¿Qué método debe devolver un controlador que muestra una vista?'
    opciones:
      - 'Un string con el HTML directamente'
      - 'Un objeto JSON siempre'
      - 'Una Response o una vista con view()'
      - 'Un array de PHP'
    correcta: 2
    explicacion: 'Los controladores típicamente devuelven una vista usando la función view() o un objeto Response, aunque pueden devolver otros tipos según la necesidad.'
---

## ¿Qué es un Controlador?

Cuando empiezas a aprender Laravel, lo primero que ves son las rutas definidas en `routes/web.php`. Al principio es tentador poner toda la lógica ahí mismo, dentro de un closure. Y funciona... hasta que el proyecto crece.

Un **controlador** es una clase PHP que agrupa la lógica relacionada con un recurso o sección de tu aplicación. En lugar de escribir la lógica directamente en las rutas, la delegas a métodos organizados dentro de una clase.

El patrón que sigue Laravel se llama **MVC** (Modelo-Vista-Controlador):

- **Modelo**: gestiona los datos y la base de datos.
- **Vista**: presenta la información al usuario.
- **Controlador**: actúa como intermediario, recibe la petición, consulta el modelo si es necesario, y devuelve la vista.

Esta separación hace el código más legible, más fácil de mantener y más fácil de testear.

## Crear un Controlador con Artisan

Laravel incluye Artisan, su poderosa herramienta de línea de comandos. Para crear un controlador ejecutas:

```bash
php artisan make:controller ProductoController
```

Esto crea el archivo `app/Http/Controllers/ProductoController.php` con la siguiente estructura básica:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProductoController extends Controller
{
    //
}
```

Nota que el controlador extiende la clase base `Controller` que también está en el mismo directorio. Esta clase base te da acceso a funcionalidades útiles como el middleware.

## Agregar Métodos al Controlador

Un controlador vacío no sirve de mucho. Añadamos un método para mostrar una lista de productos:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProductoController extends Controller
{
    public function index()
    {
        $productos = [
            ['nombre' => 'Laptop', 'precio' => 999],
            ['nombre' => 'Mouse', 'precio' => 25],
            ['nombre' => 'Teclado', 'precio' => 45],
        ];

        return view('productos.index', compact('productos'));
    }

    public function show($id)
    {
        // En una app real buscarías en la base de datos
        $producto = ['nombre' => 'Laptop', 'precio' => 999, 'id' => $id];

        return view('productos.show', compact('producto'));
    }
}
```

El método `index()` devuelve una vista con una lista de productos. El método `show($id)` recibe un identificador y devuelve la vista de detalle de un producto.

## Conectar el Controlador con las Rutas

Una vez tienes el controlador, debes decirle a Laravel cuándo usarlo. En `routes/web.php`:

```php
use App\Http\Controllers\ProductoController;

Route::get('/productos', [ProductoController::class, 'index']);
Route::get('/productos/{id}', [ProductoController::class, 'show']);
```

La sintaxis `[ProductoController::class, 'index']` es la forma moderna (desde PHP 8) de referenciar un controlador y su método. Laravel sabrá que cuando alguien visite `/productos`, debe llamar al método `index` de `ProductoController`.

## Inyección de Dependencias en los Métodos

Una de las características más potentes de Laravel es su contenedor de servicios y la inyección de dependencias automática. Si un método de tu controlador necesita el objeto `Request` con los datos de la petición, simplemente lo declaras como parámetro:

```php
public function store(Request $request)
{
    $nombre = $request->input('nombre');
    $precio = $request->input('precio');

    // Aquí guardarías el producto en la base de datos
    // Producto::create(['nombre' => $nombre, 'precio' => $precio]);

    return redirect('/productos')->with('success', 'Producto creado correctamente');
}
```

Laravel inyectará automáticamente el objeto `Request` cuando se llame a este método. No tienes que instanciarlo manualmente.

## Controladores con un Solo Método

A veces un controlador solo necesita hacer una cosa. Para esos casos, Laravel te permite crear un controlador de acción única usando el método mágico `__invoke`:

```bash
php artisan make:controller MostrarDashboardController --invokable
```

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class MostrarDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        return view('dashboard');
    }
}
```

Y en las rutas lo usas así:

```php
Route::get('/dashboard', MostrarDashboardController::class);
```

No necesitas especificar el método porque Laravel llamará automáticamente a `__invoke`.

## Organizar Controladores en Subdirectorios

En proyectos grandes, puede que necesites organizar los controladores en subdirectorios. Por ejemplo, separar los controladores del panel de administración:

```bash
php artisan make:controller Admin/ProductoController
```

Esto crea el archivo en `app/Http/Controllers/Admin/ProductoController.php` con el namespace `App\Http\Controllers\Admin`.

En las rutas:

```php
use App\Http\Controllers\Admin\ProductoController as AdminProductoController;

Route::get('/admin/productos', [AdminProductoController::class, 'index']);
```

## Devolver Respuestas JSON

Los controladores no solo sirven vistas. En una API, puedes devolver JSON:

```php
public function index()
{
    $productos = [
        ['nombre' => 'Laptop', 'precio' => 999],
        ['nombre' => 'Mouse', 'precio' => 25],
    ];

    return response()->json($productos);
}
```

Laravel se encargará de establecer las cabeceras correctas (`Content-Type: application/json`) y convertir el array a JSON automáticamente.

## Buenas Prácticas

Algunos consejos para trabajar bien con controladores en Laravel:

**Mantén los controladores delgados.** Un controlador no debería tener demasiada lógica de negocio. Esa lógica debe ir en los modelos o en clases de servicio dedicadas. El controlador solo debe orquestar: recibir la petición, llamar al servicio o modelo correspondiente, y devolver la respuesta.

**Nombra los métodos con claridad.** Los nombres convencionales son `index`, `create`, `store`, `show`, `edit`, `update` y `destroy`. Siguiendo esta convención, tu código será más predecible y podrás usar Resource Controllers (que veremos en la siguiente lección).

**Un controlador por recurso.** No crees un controlador gigante con métodos para productos, categorías, usuarios y pedidos. Crea un controlador separado para cada recurso.

```php
// Bien: cada controlador tiene su responsabilidad
ProductoController::class
CategoriaController::class
UsuarioController::class
PedidoController::class

// Mal: un controlador que hace de todo
TiendaController::class  // con 30 métodos distintos
```

## Resumen

Los controladores son la columna vertebral de la lógica de tu aplicación Laravel. Te permiten organizar el código de forma limpia, separando las responsabilidades y haciendo el proyecto más mantenible. Créalos con `php artisan make:controller`, añade métodos que representen acciones, y conéctalos a las rutas usando la sintaxis de array. En la siguiente lección veremos los Resource Controllers, que automatizan gran parte de este proceso.
