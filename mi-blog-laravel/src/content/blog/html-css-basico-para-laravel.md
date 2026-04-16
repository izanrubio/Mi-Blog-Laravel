---
title: 'HTML y CSS básico para desarrolladores Laravel'
description: 'Aprende los fundamentos de HTML y CSS que necesitas para construir vistas con Laravel Blade. Formularios, estructura semántica y estilos básicos explicados paso a paso.'
pubDate: '2026-04-16'
tags: ['laravel', 'html', 'css', 'roadmap']
---

Laravel se encarga del backend: lógica de negocio, base de datos, autenticación. Pero lo que el usuario ve en el navegador lo genera HTML, y el aspecto visual lo controla CSS. Si vas a construir las vistas de tu aplicación Laravel con Blade, necesitas entender estos dos lenguajes. No hace falta ser diseñador, pero sí conocer la estructura y los patrones básicos.

## Estructura de un documento HTML

Todo documento HTML tiene la misma estructura base:

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi aplicación Laravel</title>
    <link rel="stylesheet" href="/css/app.css">
</head>
<body>

    <header>
        <nav>...</nav>
    </header>

    <main>
        <h1>Bienvenido</h1>
        <p>Contenido principal aquí.</p>
    </main>

    <footer>
        <p>&copy; 2026 Mi Blog</p>
    </footer>

    <script src="/js/app.js"></script>
</body>
</html>
```

Elementos clave:

- `<!DOCTYPE html>`: declara que es HTML5.
- `<meta charset="UTF-8">`: necesario para tildes y caracteres especiales en español.
- `<meta name="viewport">`: hace la página responsiva en móviles.
- Los scripts van al final de `<body>` para no bloquear la carga de la página.

En Laravel, este esqueleto suele vivir en `resources/views/layouts/app.blade.php` y las vistas hijas lo heredan mediante `@extends`.

## Elementos semánticos HTML5

HTML5 introdujo etiquetas con significado propio. Úsalos en lugar de `<div>` cuando el contexto lo justifique:

```html
<header>
    <!-- Cabecera de la página o de una sección -->
    <nav>
        <ul>
            <li><a href="/">Inicio</a></li>
            <li><a href="/blog">Blog</a></li>
            <li><a href="/contacto">Contacto</a></li>
        </ul>
    </nav>
</header>

<main>
    <!-- Contenido principal, único por página -->

    <section>
        <!-- Grupo temático de contenido -->
        <h2>Últimos artículos</h2>

        <article>
            <!-- Contenido independiente y reutilizable -->
            <header>
                <h3>Cómo usar Eloquent</h3>
                <time datetime="2026-04-16">16 de abril de 2026</time>
            </header>
            <p>Eloquent es el ORM de Laravel...</p>
        </article>
    </section>

    <aside>
        <!-- Contenido secundario, relacionado pero prescindible -->
        <h3>Categorías</h3>
    </aside>
</main>

<footer>
    <!-- Pie de página -->
    <p>Hecho con Laravel</p>
</footer>
```

Usar semántica correcta mejora la accesibilidad y el SEO, algo importante si tu blog o aplicación quiere posicionarse en buscadores.

## Formularios: el puente entre el usuario y Laravel

Los formularios son el mecanismo principal para enviar datos al servidor. En Laravel, las rutas POST procesan esos datos.

```html
<form action="/contacto" method="POST">
    <!-- Campo de texto -->
    <div>
        <label for="nombre">Nombre</label>
        <input type="text" id="nombre" name="nombre" required placeholder="Tu nombre">
    </div>

    <!-- Email -->
    <div>
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
    </div>

    <!-- Número -->
    <div>
        <label for="edad">Edad</label>
        <input type="number" id="edad" name="edad" min="18" max="120">
    </div>

    <!-- Contraseña -->
    <div>
        <label for="password">Contraseña</label>
        <input type="password" id="password" name="password" minlength="8">
    </div>

    <!-- Textarea -->
    <div>
        <label for="mensaje">Mensaje</label>
        <textarea id="mensaje" name="mensaje" rows="4"></textarea>
    </div>

    <!-- Select -->
    <div>
        <label for="categoria">Categoría</label>
        <select id="categoria" name="categoria">
            <option value="">-- Elige --</option>
            <option value="laravel">Laravel</option>
            <option value="php">PHP</option>
        </select>
    </div>

    <!-- Checkbox -->
    <div>
        <input type="checkbox" id="terminos" name="terminos" value="1">
        <label for="terminos">Acepto los términos</label>
    </div>

    <button type="submit">Enviar</button>
</form>
```

### CSRF en Laravel Blade

Cuando uses `method="POST"` en un formulario dentro de Blade, **siempre** añade la directiva `@csrf`. Sin ella Laravel rechazará la petición con un error 419:

```html
<form action="{{ route('contacto.store') }}" method="POST">
    @csrf

    <input type="text" name="nombre">
    <button type="submit">Enviar</button>
</form>
```

`@csrf` genera un campo oculto con un token que Laravel verifica para protegerte de ataques Cross-Site Request Forgery. Blade lo convierte en:

```html
<input type="hidden" name="_token" value="AbCdEf123...">
```

Para métodos HTTP que los formularios no soportan nativamente (PUT, PATCH, DELETE), usa también `@method`:

```html
<form action="{{ route('posts.update', $post) }}" method="POST">
    @csrf
    @method('PUT')

    <!-- campos del formulario -->
</form>
```

## Tablas HTML

Para mostrar datos tabulares, como listas de registros de la base de datos:

```html
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Acciones</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($usuarios as $usuario)
        <tr>
            <td>{{ $usuario->id }}</td>
            <td>{{ $usuario->nombre }}</td>
            <td>{{ $usuario->email }}</td>
            <td>
                <a href="{{ route('usuarios.edit', $usuario) }}">Editar</a>
            </td>
        </tr>
        @endforeach
    </tbody>
</table>
```

## CSS: selectores y especificidad

CSS selecciona elementos HTML y les aplica estilos. Los selectores principales son:

```css
/* Selector de etiqueta */
p {
    color: #333;
    line-height: 1.6;
}

/* Selector de clase */
.card {
    background: white;
    padding: 1rem;
    border-radius: 8px;
}

/* Selector de ID */
#header {
    background: #1a1a2e;
    color: white;
}

/* Selector descendiente */
nav ul li a {
    text-decoration: none;
    color: inherit;
}

/* Selector de pseudo-clase */
a:hover {
    color: #e91e63;
    text-decoration: underline;
}

/* Selector de atributo */
input[type="email"] {
    border: 1px solid #ddd;
}
```

La **especificidad** determina qué regla gana cuando varias aplican al mismo elemento. Orden de mayor a menor: estilos en línea > ID > clase/atributo/pseudo-clase > etiqueta. Cuando el código crece, evita los ID para estilos; las clases son más reutilizables y predecibles.

## Flexbox básico

Flexbox es el sistema de layout más usado para alinear y distribuir elementos:

```css
/* Contenedor flex */
.navbar {
    display: flex;
    justify-content: space-between; /* distribuye horizontalmente */
    align-items: center;            /* centra verticalmente */
    padding: 0 1rem;
}

/* Columnas iguales */
.grid-3 {
    display: flex;
    gap: 1rem;
}

.grid-3 > * {
    flex: 1; /* cada hijo ocupa el mismo espacio */
}

/* Centrar un elemento */
.hero {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    flex-direction: column;
}

/* Wrap para múltiples filas */
.cards-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
}

.card {
    flex: 0 1 calc(33.333% - 1rem); /* 3 columnas con gap */
}
```

## Meta viewport y diseño responsivo

La etiqueta `<meta name="viewport">` es obligatoria para que el diseño funcione en móviles:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

Sin ella, los móviles renderizan la página con el ancho de un escritorio y luego la escalan, rompiendo el diseño. Con ella, el ancho de la página coincide con el ancho del dispositivo.

Las media queries permiten adaptar los estilos según el tamaño de pantalla:

```css
/* Estilos base (móvil primero) */
.card {
    width: 100%;
    margin-bottom: 1rem;
}

/* Tableta */
@media (min-width: 768px) {
    .cards-container {
        display: flex;
        gap: 1rem;
    }
    .card {
        width: calc(50% - 0.5rem);
    }
}

/* Escritorio */
@media (min-width: 1024px) {
    .card {
        width: calc(33.333% - 0.75rem);
    }
}
```

## Cómo Blade genera HTML

Las vistas Blade son plantillas PHP que se compilan a HTML. Laravel procesa las directivas y las expresiones, y el resultado es HTML estático que el navegador interpreta:

```html
{{-- resources/views/posts/index.blade.php --}}
@extends('layouts.app')

@section('content')
<main class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Blog</h1>

    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        @forelse ($posts as $post)
            <article class="card">
                <h2 class="text-xl font-semibold">
                    <a href="{{ route('posts.show', $post->slug) }}">
                        {{ $post->titulo }}
                    </a>
                </h2>
                <p class="text-gray-600">{{ $post->descripcion }}</p>
                <time class="text-sm text-gray-400">
                    {{ $post->created_at->format('d/m/Y') }}
                </time>
            </article>
        @empty
            <p>No hay artículos todavía.</p>
        @endforelse
    </div>
</main>
@endsection
```

Blade compila esto a PHP puro, y PHP genera el HTML final. Las dobles llaves `{{ }}` escapan el contenido automáticamente para prevenir ataques XSS. Cuando necesitas HTML sin escapar (con datos de confianza), usa `{!! !!}`.

## Conclusión

HTML y CSS son los cimientos de cualquier interfaz web. No necesitas dominarlos al nivel de un diseñador frontend, pero sí entender la estructura de documentos, cómo funcionan los formularios con POST y CSRF, los selectores CSS básicos y el modelo de caja y flexbox. Con esto puedes construir vistas funcionales y bien estructuradas en Blade, que es exactamente lo que necesitas para desarrollar aplicaciones Laravel completas.
