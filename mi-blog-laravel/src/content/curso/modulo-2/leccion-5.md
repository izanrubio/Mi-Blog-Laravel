---
modulo: 2
leccion: 5
title: 'Directivas Blade más usadas'
description: 'Domina las directivas Blade esenciales: @auth, @guest, @isset, @empty, @switch, @each y cómo crear tus propias directivas personalizadas.'
duracion: '20 min'
quiz:
  - pregunta: '¿Qué directiva Blade muestra contenido solo cuando el usuario ha iniciado sesión?'
    opciones:
      - '@loggedin'
      - '@user'
      - '@authenticated'
      - '@auth'
    correcta: 3
    explicacion: 'La directiva @auth ejecuta el bloque de contenido solo si hay un usuario autenticado en la sesión. Su opuesto es @guest, para usuarios no autenticados.'
  - pregunta: '¿Cuál es la directiva correcta para verificar si una variable está definida y no es null?'
    opciones:
      - '@defined($variable)'
      - '@isset($variable)'
      - '@exists($variable)'
      - '@check($variable)'
    correcta: 1
    explicacion: '@isset($variable) es equivalente a @if(isset($variable)). Comprueba que la variable exista y no sea null antes de ejecutar el bloque.'
  - pregunta: '¿Qué método de la facade Blade se usa para registrar una directiva personalizada?'
    opciones:
      - 'Blade::register()'
      - 'Blade::extend()'
      - 'Blade::directive()'
      - 'Blade::add()'
    correcta: 2
    explicacion: 'Blade::directive() recibe el nombre de la directiva y un closure que recibe la expresión como string y retorna el PHP que debe ejecutarse.'
---

## Las directivas como vocabulario de Blade

Las directivas Blade son instrucciones que comienzan con `@` y que el motor de plantillas compila a PHP puro antes de renderizar la vista. Ya conoces las básicas como `@if`, `@foreach` y `@extends`. En esta lección exploraremos las directivas más útiles del día a día que hacen el código de las vistas más expresivo y seguro.

## Directivas de autenticación: @auth y @guest

Una de las necesidades más comunes en cualquier aplicación web es mostrar contenido diferente según si el usuario ha iniciado sesión o no. Blade proporciona dos directivas para esto:

```blade
@auth
    <p>Bienvenido, {{ auth()->user()->nombre }}.</p>
    <a href="/dashboard">Ir al panel</a>
    <form method="POST" action="/logout">
        @csrf
        <button type="submit">Cerrar sesión</button>
    </form>
@endauth

@guest
    <a href="/login">Iniciar sesión</a>
    <a href="/register">Registrarse</a>
@endguest
```

Estas directivas son mucho más legibles que `@if(auth()->check())` y comunican la intención directamente.

También puedes combinarlas con `@else`:

```blade
@auth
    <span>Panel de usuario</span>
@else
    <a href="/login">Acceder</a>
@endauth
```

Si tu aplicación usa múltiples guards de autenticación, puedes especificar cuál usar:

```blade
@auth('admin')
    <p>Estás autenticado como administrador.</p>
@endauth
```

## Directivas de comprobación: @isset y @empty

`@isset` comprueba que una variable exista y no sea `null`. Es ideal cuando no puedes garantizar que el controlador siempre envíe esa variable:

```blade
@isset($post->imagen)
    <img src="{{ asset('storage/' . $post->imagen) }}" alt="{{ $post->titulo }}">
@endisset
```

`@empty` comprueba si una variable está vacía (string vacío, array vacío, `null`, `0`, etc.):

```blade
@empty($post->etiquetas)
    <span>Sin etiquetas</span>
@else
    @foreach ($post->etiquetas as $etiqueta)
        <span class="tag">{{ $etiqueta->nombre }}</span>
    @endforeach
@endempty
```

## Directiva @switch

Para múltiples condiciones sobre el mismo valor, `@switch` es más limpio que una cadena de `@elseif`:

```blade
@switch($post->estado)
    @case('publicado')
        <span class="badge verde">Publicado</span>
        @break

    @case('borrador')
        <span class="badge gris">Borrador</span>
        @break

    @case('archivado')
        <span class="badge rojo">Archivado</span>
        @break

    @default
        <span class="badge">Desconocido</span>
@endswitch
```

## Directiva @checked, @selected y @disabled

Estas directivas de formulario, disponibles desde Laravel 9, simplifican la gestión de estado en campos de formulario:

```blade
{{-- @checked imprime checked="checked" si la condición es verdadera --}}
<input type="checkbox" name="activo" @checked($usuario->activo)>

{{-- @selected imprime selected="selected" si los valores coinciden --}}
<select name="categoria_id">
    @foreach ($categorias as $categoria)
        <option value="{{ $categoria->id }}" @selected($post->categoria_id === $categoria->id)>
            {{ $categoria->nombre }}
        </option>
    @endforeach
</select>

{{-- @disabled imprime disabled si la condición es verdadera --}}
<button type="submit" @disabled($formulario->enviando)>
    Guardar cambios
</button>

{{-- @readonly imprime readonly si la condición es verdadera --}}
<input type="text" name="email" value="{{ $usuario->email }}" @readonly($usuario->verificado)>
```

## Directiva @env

Permite mostrar contenido solo en determinados entornos. Útil para mostrar herramientas de depuración solo en desarrollo:

```blade
@env('local')
    <div class="debug-bar">
        Entorno: local | Queries: {{ DB::getQueryLog() | count }}
    </div>
@endenv

@env(['staging', 'production'])
    <!-- Google Analytics solo en staging y producción -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=UA-XXXXX"></script>
@endenv
```

## Directiva @each

`@each` es un atajo para iterar sobre una colección y renderizar una vista parcial por cada elemento. Recibe cuatro argumentos: la vista a renderizar, la colección, el nombre de la variable en la vista y (opcionalmente) la vista a mostrar si la colección está vacía:

```blade
{{-- Equivalente a un @foreach con @include --}}
@each('partials.tarjeta-post', $posts, 'post', 'partials.sin-posts')
```

La vista `resources/views/partials/tarjeta-post.blade.php` recibirá cada elemento como `$post`.

## Directivas de CSRF y método HTTP

Estas dos directivas son esenciales en cualquier formulario Laravel:

```blade
<form method="POST" action="/posts">
    @csrf

    <input type="text" name="titulo" placeholder="Título del artículo">
    <textarea name="contenido"></textarea>
    <button type="submit">Publicar</button>
</form>
```

`@csrf` genera un campo oculto con el token de seguridad que Laravel usa para validar que el formulario fue enviado desde tu propia aplicación y no desde un sitio externo (protección CSRF).

Para formularios que necesitan enviar peticiones PUT, PATCH o DELETE (que HTML no soporta nativamente), se usa `@method`:

```blade
<form method="POST" action="/posts/{{ $post->id }}">
    @csrf
    @method('PUT')

    <input type="text" name="titulo" value="{{ $post->titulo }}">
    <button type="submit">Actualizar</button>
</form>
```

## Directiva @error

Blade incluye una directiva específica para mostrar errores de validación de formularios, muy integrada con el sistema de validación de Laravel:

```blade
<div class="campo">
    <label for="titulo">Título</label>
    <input
        type="text"
        id="titulo"
        name="titulo"
        value="{{ old('titulo') }}"
        class="@error('titulo') campo-error @enderror"
    >
    @error('titulo')
        <span class="mensaje-error">{{ $message }}</span>
    @enderror
</div>
```

`@error('campo')` comprueba si existe un error de validación para ese campo. Si existe, la variable `$message` contiene el mensaje de error. `old('titulo')` recupera el valor que el usuario había introducido antes de que fallara la validación.

## Directiva @include con condición: @includeIf y @includeWhen

```blade
{{-- Solo incluye si el archivo existe (no lanza error si no) --}}
@includeIf('partials.anuncio-beta')

{{-- Solo incluye si la condición es verdadera --}}
@includeWhen($usuario->esPremium(), 'partials.contenido-premium', ['usuario' => $usuario])

{{-- Solo incluye si la condición es FALSA --}}
@includeUnless($usuario->estaVerificado(), 'partials.alerta-verificacion')
```

## Crear directivas personalizadas

Si necesitas una directiva que no existe en Blade, puedes crearla registrándola en el método `boot()` de un proveedor de servicios con `Blade::directive()`:

```php
// app/Providers/AppServiceProvider.php

use Illuminate\Support\Facades\Blade;

public function boot(): void
{
    // Directiva para formatear fechas en español
    Blade::directive('fecha', function (string $expression) {
        return "<?php echo \Carbon\Carbon::parse($expression)->locale('es')->isoFormat('D [de] MMMM [de] YYYY'); ?>";
    });

    // Directiva para precio formateado en euros
    Blade::directive('precio', function (string $expression) {
        return "<?php echo number_format($expression, 2, ',', '.') . ' €'; ?>";
    });

    // Directiva de apertura y cierre
    Blade::directive('tarjeta', function () {
        return '<div class="tarjeta">';
    });

    Blade::directive('endtarjeta', function () {
        return '</div>';
    });
}
```

Uso en las vistas:

```blade
<p>Publicado: @fecha($post->created_at)</p>
<p>Precio: @precio($producto->precio)</p>

@tarjeta
    <h2>{{ $post->titulo }}</h2>
@endtarjeta
```

## Tabla resumen de directivas esenciales

| Directiva | Uso |
|---|---|
| `@auth` / `@guest` | Contenido según estado de autenticación |
| `@isset($var)` | Variable existe y no es null |
| `@empty($var)` | Variable está vacía |
| `@switch` / `@case` | Condicional de múltiples ramas |
| `@checked` | Atributo checked en checkboxes |
| `@selected` | Atributo selected en opciones |
| `@disabled` | Atributo disabled |
| `@csrf` | Token de protección CSRF |
| `@method('PUT')` | Simular métodos HTTP |
| `@error('campo')` | Mostrar errores de validación |
| `@env('local')` | Contenido por entorno |
| `@includeWhen($cond, 'vista')` | Include condicional |

## Resumen

En esta lección repasaste el conjunto de directivas Blade más utilizadas en aplicaciones Laravel reales: desde `@auth` y `@guest` para el control de acceso, pasando por `@isset`, `@empty` y `@switch` para la lógica condicional, hasta las directivas de formulario como `@csrf`, `@method` y `@error`. También aprendiste a crear tus propias directivas con `Blade::directive()` para encapsular lógica de presentación personalizada. Con todo lo visto en este módulo tienes una base sólida para construir interfaces Blade profesionales en cualquier proyecto Laravel.
