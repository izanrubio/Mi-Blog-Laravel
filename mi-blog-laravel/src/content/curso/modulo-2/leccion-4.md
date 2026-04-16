---
modulo: 2
leccion: 4
title: 'Pasar datos a las vistas'
description: 'Aprende todas las formas de enviar datos desde controladores y rutas a las vistas en Laravel: arrays, compact(), with() y variables globales.'
duracion: '15 min'
quiz:
  - pregunta: '¿Cuál de estas opciones pasa datos a una vista mediante el helper view()?'
    opciones:
      - 'view("inicio", $datos)'
      - 'view("inicio")->send($datos)'
      - 'view("inicio", ["clave" => $valor])'
      - 'view("inicio")->push($datos)'
    correcta: 2
    explicacion: 'El segundo argumento del helper view() es un array asociativo donde cada clave se convierte en una variable disponible dentro de la vista.'
  - pregunta: '¿Qué hace la función compact() de PHP cuando se usa con view()?'
    opciones:
      - 'Minifica el HTML de la vista'
      - 'Crea un array asociativo a partir de nombres de variables locales'
      - 'Comprime los datos antes de enviarlos a la vista'
      - 'Convierte el array en una colección de Laravel'
    correcta: 1
    explicacion: 'compact() toma nombres de variables como strings y crea un array asociativo usando esos nombres como claves y sus valores actuales como valores.'
  - pregunta: '¿Qué facade se usa para compartir datos con todas las vistas de la aplicación?'
    opciones:
      - 'Config::share()'
      - 'Route::share()'
      - 'View::share()'
      - 'App::share()'
    correcta: 2
    explicacion: 'View::share() permite definir variables globales accesibles en todas las vistas. Se suele llamar desde un AppServiceProvider o un ViewServiceProvider.'
---

## ¿Por qué necesitamos pasar datos a las vistas?

Las vistas por sí solas solo muestran HTML estático. El poder real de una aplicación web viene de presentar datos dinámicos: los artículos del blog, el nombre del usuario autenticado, los productos de una tienda. Para que la vista pueda mostrar esos datos, el controlador (o la ruta) debe enviárselos explícitamente.

Laravel ofrece varias formas de pasar datos a las vistas, desde la más directa hasta opciones más elegantes. En esta lección las veremos todas.

## Método 1: Array como segundo argumento de view()

La forma más directa es pasar un array asociativo como segundo argumento del helper `view()`. Cada clave del array se convierte en una variable disponible dentro de la vista:

```php
// routes/web.php

Route::get('/bienvenida', function () {
    return view('bienvenida', [
        'nombre' => 'Ana García',
        'rol'    => 'Administradora',
        'fecha'  => now()->format('d/m/Y'),
    ]);
});
```

En la vista `resources/views/bienvenida.blade.php` puedes usar directamente `$nombre`, `$rol` y `$fecha`:

```blade
<h1>Bienvenida, {{ $nombre }}</h1>
<p>Tu rol es: <strong>{{ $rol }}</strong></p>
<p>Fecha de acceso: {{ $fecha }}</p>
```

## Método 2: compact()

Cuando tienes las variables ya definidas con nombres que coinciden con lo que quieres en la vista, la función nativa de PHP `compact()` resulta muy conveniente. Recibe los nombres de las variables como strings y construye el array asociativo por ti:

```php
// app/Http/Controllers/PostController.php

public function show($id)
{
    $post       = Post::findOrFail($id);
    $comentarios = $post->comentarios()->latest()->get();
    $autor      = $post->usuario;

    return view('posts.show', compact('post', 'comentarios', 'autor'));
}
```

Esto es exactamente equivalente a:

```php
return view('posts.show', [
    'post'        => $post,
    'comentarios' => $comentarios,
    'autor'       => $autor,
]);
```

`compact()` es la opción más popular en código Laravel real porque es concisa y evita repetir el nombre de cada variable dos veces.

## Método 3: Encadenamiento con with()

El método `with()` se encadena sobre el objeto de vista y permite añadir variables de una en una. Esto puede mejorar la legibilidad cuando tienes pocos datos o cuando quieres construir el conjunto de datos condicionalmente:

```php
public function index()
{
    $posts = Post::publicados()->latest()->paginate(10);

    return view('posts.index')
        ->with('posts', $posts)
        ->with('titulo', 'Todos los artículos')
        ->with('totalPosts', Post::publicados()->count());
}
```

También puedes pasar un array completo a `with()`:

```php
return view('posts.index')->with([
    'posts'      => $posts,
    'titulo'     => 'Todos los artículos',
    'totalPosts' => Post::publicados()->count(),
]);
```

## Ejemplo completo con controlador

Veamos un ejemplo más realista que combina las técnicas anteriores en un controlador completo:

```php
// app/Http/Controllers/PostController.php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Categoria;

class PostController extends Controller
{
    public function index()
    {
        $posts      = Post::publicados()->with('autor')->latest()->paginate(12);
        $categorias = Categoria::all();

        return view('posts.index', compact('posts', 'categorias'));
    }

    public function show($slug)
    {
        $post            = Post::where('slug', $slug)->firstOrFail();
        $postRelacionados = Post::publicados()
                                ->where('categoria_id', $post->categoria_id)
                                ->where('id', '!=', $post->id)
                                ->take(3)
                                ->get();

        return view('posts.show', compact('post', 'postRelacionados'));
    }

    public function create()
    {
        $categorias = Categoria::all();

        return view('posts.create')->with('categorias', $categorias);
    }
}
```

Y la vista correspondiente para `show`:

```blade
{{-- resources/views/posts/show.blade.php --}}

@extends('layouts.app')

@section('titulo', $post->titulo)

@section('contenido')
    <article>
        <h1>{{ $post->titulo }}</h1>
        <p class="meta">
            Por {{ $post->autor->nombre }} — {{ $post->created_at->format('d/m/Y') }}
        </p>
        <div class="contenido">
            {!! $post->contenido_html !!}
        </div>
    </article>

    @if ($postRelacionados->isNotEmpty())
        <section class="relacionados">
            <h2>También te puede interesar</h2>
            @foreach ($postRelacionados as $relacionado)
                <a href="/posts/{{ $relacionado->slug }}">{{ $relacionado->titulo }}</a>
            @endforeach
        </section>
    @endif
@endsection
```

## Compartir datos con todas las vistas

A veces necesitas que cierta información esté disponible en **todas** las vistas de la aplicación, como el nombre de la app, el usuario autenticado o las categorías del menú. Para eso existe `View::share()`.

El lugar correcto para llamarlo es en el método `boot()` de un proveedor de servicios. Puedes usar `AppServiceProvider` o crear uno dedicado:

```php
// app/Providers/AppServiceProvider.php

namespace App\Providers;

use Illuminate\Support\Facades\View;
use App\Models\Categoria;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Compartir con todas las vistas
        View::share('appNombre', config('app.name'));

        // Compartir datos que requieren consulta a la BD
        View::share('categoriasMenu', Categoria::orderBy('nombre')->get());
    }
}
```

A partir de ese momento, `$appNombre` y `$categoriasMenu` estarán disponibles en cualquier vista sin necesidad de pasarlos desde cada controlador.

## View Composers

Para casos más avanzados donde los datos compartidos dependen de lógica compleja o solo deben enviarse a un subconjunto de vistas, Laravel ofrece los **View Composers**. Son clases o closures que se ejecutan automáticamente justo antes de renderizar una vista específica:

```php
// app/Providers/AppServiceProvider.php

use Illuminate\Support\Facades\View;

public function boot(): void
{
    // Se ejecuta solo antes de renderizar 'layouts.app'
    View::composer('layouts.app', function ($view) {
        $view->with('usuarioActual', auth()->user());
    });

    // Se ejecuta antes de cualquier vista en el directorio 'posts/*'
    View::composer('posts.*', function ($view) {
        $view->with('categorias', \App\Models\Categoria::all());
    });
}
```

También puedes usar una clase dedicada en lugar de un closure:

```php
// app/View/Composers/MenuComposer.php

namespace App\View\Composers;

use Illuminate\View\View;
use App\Models\Categoria;

class MenuComposer
{
    public function compose(View $view): void
    {
        $view->with('categoriasMenu', Categoria::orderBy('nombre')->get());
    }
}
```

Y registrarla en el proveedor:

```php
View::composer('layouts.app', MenuComposer::class);
```

## Acceder a datos en la vista: buenas prácticas

- Siempre verifica si una variable podría ser `null` antes de acceder a sus propiedades: usa `{{ $post->titulo ?? 'Sin título' }}` o `@isset`.
- No proceses datos dentro de la vista. Si necesitas filtrar, ordenar o transformar datos, hazlo en el controlador antes de pasarlos.
- Nombra las variables de forma descriptiva: `$posts` en lugar de `$data`, `$usuario` en lugar de `$u`.

## Resumen

Aprendiste las tres formas principales de pasar datos a las vistas en Laravel: el array como segundo argumento de `view()`, la función `compact()` y el método encadenado `with()`. También viste cómo compartir datos con todas las vistas usando `View::share()` y cómo los View Composers permiten una gestión más granular y orientada a objetos. Con estas herramientas puedes construir vistas completamente dinámicas y bien organizadas.
