---
title: 'Laravel Blade: guía completa del motor de plantillas'
description: 'Domina Blade, el motor de plantillas de Laravel. Variables, directivas @if, @foreach, layouts con @extends y @section, componentes y slots explicados con ejemplos.'
pubDate: '2026-04-16'
tags: ['laravel', 'blade', 'conceptos', 'roadmap']
---

Blade es el motor de plantillas incluido en Laravel. Te permite escribir HTML limpio con una sintaxis especial que se compila a PHP puro y se cachea automáticamente. El resultado es que obtienes la comodidad de directivas expresivas sin sacrificar rendimiento.

En esta guía recorremos Blade desde lo más básico hasta layouts, componentes y directivas avanzadas.

## Blade vs PHP puro

Sin Blade tendrías que escribir PHP mezclado con HTML de forma explícita:

```php
<?php if ($user->isAdmin()): ?>
    <p>Bienvenido, administrador.</p>
<?php endif; ?>

<?php foreach ($products as $product): ?>
    <li><?php echo htmlspecialchars($product->nombre); ?></li>
<?php endforeach; ?>
```

Con Blade el mismo código es:

```html
@if ($user->isAdmin())
    <p>Bienvenido, administrador.</p>
@endif

@foreach ($products as $product)
    <li>{{ $product->nombre }}</li>
@endforeach
```

Mucho más legible. Y Blade no añade overhead: las plantillas se compilan a PHP puro y se cachean en `storage/framework/views/`.

Los archivos Blade tienen la extensión `.blade.php` y se guardan en `resources/views/`.

## Mostrar variables: {{ }} y {!! !!}

La forma más común de mostrar datos es con doble llave. Blade escapa automáticamente los caracteres HTML para prevenir ataques XSS:

```html
<!-- Muestra el nombre escapando caracteres peligrosos (<, >, ", etc.) -->
<h1>{{ $product->nombre }}</h1>

<!-- Con expresión PHP -->
<p>Precio: {{ number_format($product->precio, 2) }} €</p>

<!-- Valor por defecto si la variable es null -->
<p>{{ $descripcion ?? 'Sin descripción' }}</p>

<!-- Operador ternario -->
<span>{{ $product->stock > 0 ? 'En stock' : 'Agotado' }}</span>
```

Si necesitas renderizar HTML sin escapar (por ejemplo, contenido de un editor WYSIWYG), usa las llaves triples o `{!! !!}`. **Solo úsalo con datos de confianza:**

```html
<!-- HTML sin escapar (peligroso con datos de usuarios) -->
{!! $articulo->contenido_html !!}
```

Para mostrar llaves literales `{{ }}` en la salida (por ejemplo en código Vue.js), usa `@`:

```html
<!-- Esto no será procesado por Blade -->
@{{ message }}
```

## Pasar datos a las vistas

Desde el controlador puedes pasar datos a la vista de varias formas:

```php
// Array asociativo
return view('productos.show', ['product' => $product, 'related' => $related]);

// Función compact (más cómoda)
return view('productos.show', compact('product', 'related'));

// Encadenando with()
return view('productos.show')
    ->with('product', $product)
    ->with('related', $related);
```

## Directivas condicionales

### @if, @elseif, @else, @endif

```html
@if ($product->stock > 10)
    <span class="badge badge-success">Disponible</span>
@elseif ($product->stock > 0)
    <span class="badge badge-warning">Pocas unidades</span>
@else
    <span class="badge badge-danger">Agotado</span>
@endif
```

### @isset y @empty

```html
<!-- Solo muestra el bloque si $descuento no es null -->
@isset($descuento)
    <p>Descuento aplicado: {{ $descuento }}%</p>
@endisset

<!-- Muestra el bloque si $items está vacío o no definido -->
@empty($items)
    <p>No hay elementos que mostrar.</p>
@endempty
```

### @unless (lo contrario de @if)

```html
@unless ($user->isPremium())
    <div class="banner-premium">
        Hazte Premium y elimina los anuncios.
    </div>
@endunless
```

### @switch y @case

```html
@switch($pedido->estado)
    @case('pendiente')
        <span>Pendiente de pago</span>
        @break

    @case('procesando')
        <span>En preparación</span>
        @break

    @case('enviado')
        <span>En camino</span>
        @break

    @default
        <span>Estado desconocido</span>
@endswitch
```

## Bucles

### @foreach y @forelse

```html
<!-- Bucle básico -->
@foreach ($products as $product)
    <div class="product-card">
        <h3>{{ $product->nombre }}</h3>
        <p>{{ $product->precio }} €</p>
    </div>
@endforeach

<!-- forelse: incluye un bloque para cuando el array está vacío -->
@forelse ($products as $product)
    <div class="product-card">
        <h3>{{ $product->nombre }}</h3>
    </div>
@empty
    <p>No hay productos disponibles.</p>
@endforelse
```

Dentro de un `@foreach`, Blade inyecta la variable `$loop` con información del bucle:

```html
@foreach ($products as $product)
    <div class="{{ $loop->even ? 'fila-par' : 'fila-impar' }}">
        <!-- $loop->index — índice basado en 0 -->
        <!-- $loop->iteration — iteración actual (basada en 1) -->
        <!-- $loop->count — total de elementos -->
        <!-- $loop->first — true si es el primero -->
        <!-- $loop->last — true si es el último -->
        <span>{{ $loop->iteration }} / {{ $loop->count }}</span>
        <span>{{ $product->nombre }}</span>
    </div>
@endforeach
```

### @for y @while

```html
@for ($i = 0; $i < 5; $i++)
    <p>Elemento {{ $i }}</p>
@endfor

@while ($condicion)
    <p>Iterando...</p>
@endwhile
```

## Layouts con @extends, @section y @yield

El sistema de layouts de Blade permite definir una plantilla base y que cada vista "herede" de ella.

### La plantilla base (layout)

```html
<!-- resources/views/layouts/app.blade.php -->
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>@yield('title', 'Mi Tienda')</title>
    <link rel="stylesheet" href="{{ asset('css/app.css') }}">
    @stack('styles')
</head>
<body>
    <header>
        <nav>
            <a href="{{ route('home') }}">Inicio</a>
            <a href="{{ route('productos.index') }}">Productos</a>
        </nav>
    </header>

    <main>
        @if (session('success'))
            <div class="alert alert-success">
                {{ session('success') }}
            </div>
        @endif

        @yield('content')
    </main>

    <footer>
        <p>&copy; {{ date('Y') }} Mi Tienda</p>
    </footer>

    <script src="{{ asset('js/app.js') }}"></script>
    @stack('scripts')
</body>
</html>
```

### Una vista que hereda el layout

```html
<!-- resources/views/productos/index.blade.php -->
@extends('layouts.app')

@section('title', 'Catálogo de Productos')

@section('content')
    <h1>Nuestros Productos</h1>

    <div class="product-grid">
        @forelse ($products as $product)
            <div class="card">
                <h3>{{ $product->nombre }}</h3>
                <p>{{ $product->precio }} €</p>
                <a href="{{ route('productos.show', $product) }}">Ver detalle</a>
            </div>
        @empty
            <p>No hay productos disponibles.</p>
        @endforelse
    </div>

    {{ $products->links() }}
@endsection

@push('styles')
    <link rel="stylesheet" href="{{ asset('css/productos.css') }}">
@endpush
```

`@yield('content')` en el layout es el hueco donde se inserta el contenido de cada vista.
`@stack('scripts')` recopila todo lo que las vistas hayan añadido con `@push('scripts')`.

## @include para reutilizar fragmentos

```html
<!-- Incluir una vista parcial -->
@include('partials.navbar')

<!-- Incluir y pasar datos adicionales -->
@include('partials.product-card', ['product' => $product, 'showPrice' => true])

<!-- Incluir solo si la vista existe -->
@includeIf('partials.banner-promo')

<!-- Incluir condicionalmente -->
@includeWhen($user->isAdmin(), 'partials.admin-toolbar')
```

## Componentes Blade (x-components)

Los componentes son la forma moderna de crear elementos reutilizables en Blade. Mucho más potentes que `@include`.

Crear un componente:

```bash
php artisan make:component Alert
```

Genera dos archivos:
- `app/View/Components/Alert.php` — la clase PHP
- `resources/views/components/alert.blade.php` — la vista

```php
// app/View/Components/Alert.php
namespace App\View\Components;

use Illuminate\View\Component;

class Alert extends Component
{
    public function __construct(
        public string $type = 'info',
        public string $message = ''
    ) {}

    public function render()
    {
        return view('components.alert');
    }
}
```

```html
<!-- resources/views/components/alert.blade.php -->
<div class="alert alert-{{ $type }}" role="alert">
    {{ $message }}

    <!-- $slot es el contenido que se pone entre las etiquetas del componente -->
    {{ $slot }}
</div>
```

Usar el componente en una vista:

```html
<!-- Con atributo prop -->
<x-alert type="success" message="Producto guardado correctamente." />

<!-- Con contenido en el slot -->
<x-alert type="danger">
    Ha ocurrido un error. Por favor, inténtalo de nuevo.
</x-alert>
```

### Componentes anónimos (solo vista, sin clase PHP)

Para componentes simples que no necesitan lógica:

```html
<!-- resources/views/components/badge.blade.php -->
<span class="badge badge-{{ $color ?? 'secondary' }}">
    {{ $slot }}
</span>
```

```html
<!-- Uso -->
<x-badge color="success">Activo</x-badge>
<x-badge color="danger">Inactivo</x-badge>
```

## Directivas de autenticación

```html
<!-- Solo visible para usuarios autenticados -->
@auth
    <a href="{{ route('perfil') }}">Mi perfil ({{ auth()->user()->name }})</a>
    <form action="{{ route('logout') }}" method="POST">
        @csrf
        <button type="submit">Cerrar sesión</button>
    </form>
@endauth

<!-- Solo visible para invitados (no autenticados) -->
@guest
    <a href="{{ route('login') }}">Iniciar sesión</a>
    <a href="{{ route('register') }}">Registrarse</a>
@endguest
```

## @csrf y @method

Los formularios en Laravel necesitan el token CSRF y, para métodos PUT/PATCH/DELETE, un campo `_method` oculto:

```html
<!-- Formulario de creación (POST) -->
<form action="{{ route('productos.store') }}" method="POST">
    @csrf
    <input type="text" name="nombre" />
    <button type="submit">Crear</button>
</form>

<!-- Formulario de actualización (PUT) -->
<form action="{{ route('productos.update', $product) }}" method="POST">
    @csrf
    @method('PUT')
    <input type="text" name="nombre" value="{{ $product->nombre }}" />
    <button type="submit">Actualizar</button>
</form>

<!-- Formulario de eliminación (DELETE) -->
<form action="{{ route('productos.destroy', $product) }}" method="POST">
    @csrf
    @method('DELETE')
    <button type="submit">Eliminar</button>
</form>
```

`@csrf` genera `<input type="hidden" name="_token" value="...">` y `@method('PUT')` genera `<input type="hidden" name="_method" value="PUT">`.

## Mostrar errores de validación

```html
<form action="{{ route('productos.store') }}" method="POST">
    @csrf

    <div class="form-group">
        <label for="nombre">Nombre</label>
        <input
            type="text"
            id="nombre"
            name="nombre"
            value="{{ old('nombre') }}"
            class="{{ $errors->has('nombre') ? 'is-invalid' : '' }}"
        />
        @error('nombre')
            <div class="invalid-feedback">{{ $message }}</div>
        @enderror
    </div>

    <div class="form-group">
        <label for="precio">Precio</label>
        <input
            type="number"
            id="precio"
            name="precio"
            value="{{ old('precio') }}"
        />
        @error('precio')
            <p class="text-danger">{{ $message }}</p>
        @enderror
    </div>

    <button type="submit">Guardar</button>
</form>
```

`old('nombre')` recupera el valor que el usuario introdujo antes de que fallara la validación, evitando que tenga que rellenar el formulario desde cero.

## Consejos de rendimiento

Las vistas compiladas se guardan en `storage/framework/views/`. Puedes limpiarlas con:

```bash
php artisan view:clear
```

En producción, compílalas todas de una vez para que el primer usuario no pague el coste de compilación:

```bash
php artisan view:cache
```

Blade es suficientemente potente para la mayoría de aplicaciones. Cuando necesites lógica más compleja en el frontend considera combinar Blade con Livewire (para interactividad sin JavaScript pesado) o Alpine.js (para pequeñas interacciones reactivas).
