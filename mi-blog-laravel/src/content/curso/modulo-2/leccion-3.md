---
modulo: 2
leccion: 3
title: 'Layouts y componentes Blade'
description: 'Domina la herencia de plantillas con @extends y @section, y crea componentes Blade reutilizables para estructurar tus vistas de forma limpia.'
duracion: '18 min'
quiz:
  - pregunta: '¿Qué directiva se usa en una vista hija para indicar de qué layout hereda?'
    opciones:
      - '@layout'
      - '@parent'
      - '@extends'
      - '@include'
    correcta: 2
    explicacion: 'La directiva @extends indica que la vista hereda de otra plantilla (el layout). Recibe como argumento el nombre de la vista padre.'
  - pregunta: '¿Qué directiva define en el layout el lugar donde las vistas hijas inyectarán su contenido?'
    opciones:
      - '@section'
      - '@yield'
      - '@slot'
      - '@content'
    correcta: 1
    explicacion: '@yield define en el layout un marcador de posición con nombre. Las vistas hijas usan @section con el mismo nombre para inyectar contenido ahí.'
  - pregunta: '¿Cómo se crea un componente Blade anónimo desde la línea de comandos?'
    opciones:
      - 'php artisan make:view component'
      - 'php artisan make:component Alert --view'
      - 'php artisan blade:component Alert'
      - 'php artisan make:component Alert'
    correcta: 3
    explicacion: 'El comando php artisan make:component Alert genera tanto la clase del componente en app/View/Components/ como su vista en resources/views/components/.'
---

## La necesidad de los layouts

Cuando desarrollas una aplicación web, casi todas las páginas comparten la misma estructura: una barra de navegación, un pie de página, los mismos estilos CSS, los mismos scripts JavaScript. Sin una forma de reutilizar esa estructura, acabarías copiando y pegando el mismo HTML en cada vista, lo que convierte cualquier cambio en un trabajo tedioso y propenso a errores.

Blade resuelve este problema con el sistema de **herencia de plantillas**: defines un layout principal con los elementos comunes y las vistas individuales simplemente "heredan" ese layout y rellenan las secciones específicas.

## Crear un layout con @yield

Un layout es una vista Blade normal que usa la directiva `@yield` para marcar los lugares donde las vistas hijas insertarán su contenido. Por convención, los layouts se guardan en `resources/views/layouts/`.

Crea el archivo `resources/views/layouts/app.blade.php`:

```blade
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@yield('titulo', 'Mi Aplicación Laravel')</title>
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    @yield('estilos')
</head>
<body>
    <nav class="navbar">
        <a href="/">Inicio</a>
        <a href="/posts">Blog</a>
        <a href="/contacto">Contacto</a>
    </nav>

    <main class="contenedor">
        @yield('contenido')
    </main>

    <footer>
        <p>&copy; {{ date('Y') }} Mi Aplicación. Todos los derechos reservados.</p>
    </footer>

    <script src="{{ asset('js/app.js') }}"></script>
    @yield('scripts')
</body>
</html>
```

`@yield('contenido')` es el marcador principal donde cada página insertará su HTML único. Los `@yield` adicionales para `estilos` y `scripts` permiten que páginas específicas añadan recursos adicionales sin modificar el layout.

El segundo argumento de `@yield` es el valor por defecto que se mostrará si la vista hija no define esa sección:

```blade
@yield('titulo', 'Mi Aplicación Laravel')
```

## Heredar el layout con @extends y @section

Una vez que tienes el layout, las vistas hijas usan `@extends` para indicar que heredan de él, y `@section` para definir el contenido de cada sección.

Crea `resources/views/posts/index.blade.php`:

```blade
@extends('layouts.app')

@section('titulo', 'Listado de artículos')

@section('contenido')
    <h1>Todos los artículos</h1>

    @forelse ($posts as $post)
        <article class="tarjeta">
            <h2>{{ $post->titulo }}</h2>
            <p>{{ $post->resumen }}</p>
            <a href="/posts/{{ $post->id }}">Leer más</a>
        </article>
    @empty
        <p>No hay artículos publicados todavía.</p>
    @endforelse
@endsection

@section('scripts')
    <script>
        console.log('Página de listado cargada.');
    </script>
@endsection
```

Cuando Laravel renderiza esta vista, fusiona el contenido de cada `@section` con el `@yield` correspondiente del layout, generando el HTML completo.

## @parent: heredar y ampliar

Si en lugar de reemplazar una sección quieres añadir contenido **a lo que ya tiene el layout**, usa `@parent` dentro de tu sección. Esto es útil cuando el layout ya define algún contenido por defecto en una sección y la vista hija quiere conservarlo y añadir más:

```blade
@section('estilos')
    @parent
    <link rel="stylesheet" href="{{ asset('css/posts.css') }}">
@endsection
```

## Incluir sub-vistas con @include

La directiva `@include` permite incluir una vista dentro de otra, como si fuera un fragmento reutilizable. Es ideal para elementos que se repiten en múltiples vistas pero que no son un layout completo:

```blade
{{-- resources/views/posts/show.blade.php --}}

@extends('layouts.app')

@section('contenido')
    <article>
        <h1>{{ $post->titulo }}</h1>
        <p>{{ $post->contenido }}</p>
    </article>

    @include('partials.comentarios', ['comentarios' => $post->comentarios])
    @include('partials.compartir', ['url' => request()->url()])
@endsection
```

Las vistas incluidas con `@include` tienen acceso a todas las variables de la vista padre, y además puedes pasarles variables adicionales como segundo argumento.

## Componentes Blade

Los **componentes Blade** son la evolución moderna de `@include`. Permiten encapsular un fragmento de interfaz junto con su lógica en una unidad reutilizable con una sintaxis similar a HTML.

### Crear un componente

Usa Artisan para generar un componente:

```bash
php artisan make:component Alert
```

Esto genera dos archivos:
- `app/View/Components/Alert.php` — la clase del componente
- `resources/views/components/alert.blade.php` — la vista del componente

### Definir la clase del componente

```php
// app/View/Components/Alert.php

namespace App\View\Components;

use Illuminate\View\Component;

class Alert extends Component
{
    public string $tipo;
    public string $mensaje;

    public function __construct(string $tipo = 'info', string $mensaje = '')
    {
        $this->tipo = $tipo;
        $this->mensaje = $mensaje;
    }

    public function render()
    {
        return view('components.alert');
    }
}
```

### Definir la vista del componente

```blade
{{-- resources/views/components/alert.blade.php --}}

<div class="alert alert-{{ $tipo }}">
    <strong>
        @if ($tipo === 'error') ¡Error!
        @elseif ($tipo === 'exito') ¡Éxito!
        @else Información
        @endif
    </strong>
    {{ $mensaje }}
    {{ $slot }}
</div>
```

La variable `$slot` contiene el contenido que se ponga entre las etiquetas de apertura y cierre del componente.

### Usar el componente en una vista

Los componentes se usan con la sintaxis `<x-nombre-componente>`:

```blade
{{-- Componente con atributos --}}
<x-alert tipo="exito" mensaje="El artículo se ha guardado correctamente." />

{{-- Componente con contenido en el slot --}}
<x-alert tipo="error">
    No se pudo procesar la solicitud. Por favor, inténtalo de nuevo más tarde.
</x-alert>
```

### Componentes anónimos

Para casos simples donde no necesitas lógica en la clase PHP, puedes crear un **componente anónimo**: simplemente un archivo en `resources/views/components/` sin clase asociada.

```bash
# Crear manualmente el archivo
touch resources/views/components/tarjeta.blade.php
```

```blade
{{-- resources/views/components/tarjeta.blade.php --}}

<div class="tarjeta">
    <div class="tarjeta-cabecera">
        {{ $titulo }}
    </div>
    <div class="tarjeta-cuerpo">
        {{ $slot }}
    </div>
</div>
```

Uso en una vista:

```blade
<x-tarjeta>
    <x-slot:titulo>Últimas noticias</x-slot:titulo>

    <p>Aquí va el contenido principal de la tarjeta.</p>
</x-tarjeta>
```

## Estructura recomendada de vistas

Una estructura típica bien organizada para un proyecto Laravel mediano:

```
resources/views/
├── layouts/
│   ├── app.blade.php        ← Layout principal
│   └── admin.blade.php      ← Layout para panel de administración
├── components/
│   ├── alert.blade.php      ← Componente de alerta
│   ├── tarjeta.blade.php    ← Componente de tarjeta
│   └── modal.blade.php      ← Componente de modal
├── partials/
│   ├── nav.blade.php        ← Barra de navegación
│   └── footer.blade.php     ← Pie de página
└── posts/
    ├── index.blade.php
    ├── show.blade.php
    └── create.blade.php
```

## Resumen

En esta lección aprendiste a crear layouts con `@yield` y heredarlos desde vistas hijas usando `@extends` y `@section`. Viste cómo `@include` permite reutilizar fragmentos de vista y cómo los **componentes Blade** ofrecen una forma más moderna y encapsulada de hacerlo. Con estas herramientas puedes construir aplicaciones con vistas perfectamente organizadas y sin repetición de código.
