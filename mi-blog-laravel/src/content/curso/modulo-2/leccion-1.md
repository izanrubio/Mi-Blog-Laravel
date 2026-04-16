---
modulo: 2
leccion: 1
title: 'Introducción a las vistas en Laravel'
description: 'Aprende qué son las vistas en Laravel, cómo se organizan en el sistema de archivos y cómo retornarlas desde rutas y controladores.'
duracion: '12 min'
quiz:
  - pregunta: '¿En qué directorio se almacenan las vistas en Laravel?'
    opciones:
      - 'app/views'
      - 'resources/views'
      - 'public/views'
      - 'storage/views'
    correcta: 1
    explicacion: 'Las vistas en Laravel se guardan en la carpeta resources/views, que es donde el framework las busca por defecto.'
  - pregunta: '¿Qué extensión tienen los archivos de vista de Blade en Laravel?'
    opciones:
      - '.html'
      - '.php'
      - '.blade.php'
      - '.twig'
    correcta: 2
    explicacion: 'Los archivos de Blade usan la extensión .blade.php, lo que permite al motor de plantillas procesarlos antes de renderizarlos.'
  - pregunta: '¿Qué helper se usa para retornar una vista desde una ruta o controlador?'
    opciones:
      - 'render()'
      - 'show()'
      - 'view()'
      - 'display()'
    correcta: 2
    explicacion: 'El helper view() es la función estándar de Laravel para retornar una vista. Recibe el nombre del archivo como primer argumento.'
---

## ¿Qué son las vistas en Laravel?

En el patrón MVC (Modelo-Vista-Controlador) que sigue Laravel, las **vistas** son la capa responsable de la presentación: todo lo que el usuario ve en el navegador. Una vista contiene el HTML que se envía como respuesta, y puede combinar marcado estático con datos dinámicos provenientes de la aplicación.

Laravel separa de forma clara la lógica de negocio (controladores y modelos) de la presentación (vistas). Esta separación facilita el mantenimiento, permite que diseñadores y programadores trabajen en paralelo y hace el código mucho más legible.

## Dónde viven las vistas

Todas las vistas de un proyecto Laravel se almacenan dentro de la carpeta:

```
resources/views/
```

Esta carpeta puede contener archivos individuales o subdirectorios para organizar las vistas por sección o módulo. Por ejemplo, una aplicación típica podría tener la siguiente estructura:

```
resources/
└── views/
    ├── welcome.blade.php
    ├── layouts/
    │   └── app.blade.php
    ├── auth/
    │   ├── login.blade.php
    │   └── register.blade.php
    └── posts/
        ├── index.blade.php
        ├── show.blade.php
        └── create.blade.php
```

Organizar las vistas en subcarpetas es una buena práctica desde el inicio del proyecto. A medida que la aplicación crece, mantener todo en la raíz de `views/` se vuelve difícil de gestionar.

## La extensión .blade.php

Laravel incluye su propio motor de plantillas llamado **Blade**. Los archivos que usan este motor tienen la extensión `.blade.php`. Aunque también es posible usar archivos `.php` puros, lo recomendable es usar Blade porque ofrece una sintaxis más limpia, herencia de plantillas, componentes y muchas directivas útiles que veremos en las siguientes lecciones.

## Retornar una vista desde una ruta

La forma más directa de mostrar una vista es retornarla directamente desde una ruta en el archivo `routes/web.php`. Para ello se usa el helper global `view()`:

```php
// routes/web.php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});
```

En este ejemplo, cuando el usuario visita la URL raíz `/`, Laravel busca el archivo `resources/views/welcome.blade.php` y lo renderiza como respuesta HTML.

El nombre que se pasa a `view()` es la ruta relativa dentro de `resources/views/`, sin la extensión `.blade.php`. Para referencias a vistas dentro de subcarpetas se usa la notación de punto:

```php
Route::get('/posts', function () {
    return view('posts.index');
});

Route::get('/login', function () {
    return view('auth.login');
});
```

El punto (`.`) equivale a una barra de directorio (`/`). Así, `'posts.index'` apunta al archivo `resources/views/posts/index.blade.php`.

## Retornar una vista desde un controlador

En aplicaciones reales rara vez se retornan vistas directamente desde las rutas. Lo habitual es delegar esa responsabilidad a un **controlador**. El controlador también usa el helper `view()`:

```php
// app/Http/Controllers/PostController.php

namespace App\Http\Controllers;

class PostController extends Controller
{
    public function index()
    {
        return view('posts.index');
    }

    public function show($id)
    {
        return view('posts.show');
    }
}
```

Y en las rutas simplemente se enlaza la URL con el método del controlador:

```php
// routes/web.php

use App\Http\Controllers\PostController;

Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/{id}', [PostController::class, 'show']);
```

## Crear tu primera vista

Vamos a crear un ejemplo completo desde cero. Primero, crea el archivo de vista:

```bash
# Crea el directorio si no existe
mkdir -p resources/views/paginas

# Crea el archivo de vista
touch resources/views/paginas/inicio.blade.php
```

Ahora edita el archivo `resources/views/paginas/inicio.blade.php` con contenido HTML básico:

```blade
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Mi primera vista</title>
</head>
<body>
    <h1>¡Bienvenido a mi aplicación Laravel!</h1>
    <p>Esta es mi primera vista creada manualmente.</p>
</body>
</html>
```

Después, registra la ruta en `routes/web.php`:

```php
Route::get('/inicio', function () {
    return view('paginas.inicio');
});
```

Visita `http://localhost:8000/inicio` (asegúrate de que el servidor de desarrollo esté corriendo con `php artisan serve`) y verás tu primera vista en acción.

## Verificar que una vista existe

Laravel ofrece el método `View::exists()` para comprobar si una vista existe antes de intentar cargarla. Esto puede ser útil en situaciones donde el nombre de la vista es dinámico:

```php
use Illuminate\Support\Facades\View;

if (View::exists('paginas.inicio')) {
    return view('paginas.inicio');
}

return response('Vista no encontrada', 404);
```

## Buenas prácticas al nombrar vistas

- Usa nombres en **minúsculas** y con guiones si es necesario: `mi-vista.blade.php`.
- Agrupa las vistas relacionadas en **subdirectorios** con nombres descriptivos.
- Nombra las vistas de forma que reflejen su propósito: `posts/create.blade.php`, `users/profile.blade.php`.
- Evita mezclar lógica PHP compleja dentro de las vistas; para eso están los controladores y los modelos.

## Resumen

En esta lección aprendiste que las vistas en Laravel son los archivos HTML que el usuario ve, que se guardan en `resources/views/`, y que usan la extensión `.blade.php` para aprovechar el motor de plantillas Blade. Viste cómo retornarlas desde rutas y controladores usando el helper `view()`, y cómo organizar los archivos en subdirectorios usando la notación de punto.

En la siguiente lección profundizaremos en Blade, el motor de plantillas que hace que las vistas de Laravel sean tan potentes y expresivas.
