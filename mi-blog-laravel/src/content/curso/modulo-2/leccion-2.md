---
modulo: 2
leccion: 2
title: 'Blade: el motor de plantillas'
description: 'Descubre Blade, el potente motor de plantillas de Laravel: su sintaxis, cómo funciona por debajo y por qué facilita el desarrollo de vistas.'
duracion: '20 min'
quiz:
  - pregunta: '¿Cómo se imprime una variable en Blade de forma segura (escapando HTML)?'
    opciones:
      - '<?= $variable ?>'
      - '{{ $variable }}'
      - '{!! $variable !!}'
      - '<% $variable %>'
    correcta: 1
    explicacion: 'La sintaxis {{ $variable }} en Blade imprime el valor escapando caracteres HTML peligrosos, lo que protege contra ataques XSS.'
  - pregunta: '¿Dónde guarda Laravel las vistas compiladas de Blade?'
    opciones:
      - 'resources/cache'
      - 'app/cache/views'
      - 'storage/framework/views'
      - 'bootstrap/cache/views'
    correcta: 2
    explicacion: 'Laravel compila las plantillas Blade a PHP puro y almacena el resultado en storage/framework/views para reutilizarlas en sucesivas peticiones.'
  - pregunta: '¿Qué sintaxis se usa para imprimir HTML sin escapar en Blade?'
    opciones:
      - '{{ $html }}'
      - '{% $html %}'
      - '{!! $html !!}'
      - '<raw>$html</raw>'
    correcta: 2
    explicacion: 'La sintaxis {!! $html !!} imprime el contenido sin escapar. Úsala solo con datos de confianza, ya que puede exponer la aplicación a ataques XSS.'
---

## ¿Qué es Blade?

**Blade** es el motor de plantillas incluido por defecto en Laravel. Su objetivo es permitir escribir vistas con una sintaxis más clara y expresiva que el PHP puro, sin sacrificar rendimiento. A diferencia de otros motores de plantillas, Blade no te obliga a abandonar PHP: puedes usar cualquier expresión PHP dentro de tus plantillas Blade.

La gran ventaja de Blade es que compila las plantillas a PHP puro y las guarda en caché. Eso significa que en producción no hay sobrecarga por parsear la sintaxis especial: el servidor ejecuta directamente el PHP compilado, exactamente igual que si hubiera escrito el PHP a mano.

## Cómo funciona por debajo

Cuando Laravel recibe una petición y debe renderizar una vista Blade:

1. Comprueba si ya existe una versión compilada en `storage/framework/views/`.
2. Si no existe o el archivo original ha cambiado, compila la plantilla a PHP puro.
3. Ejecuta el PHP compilado y envía el HTML resultante al navegador.

Para ver cómo luce una plantilla compilada puedes abrir cualquier archivo dentro de `storage/framework/views/`. Verás PHP estándar con toda la lógica de Blade traducida.

Si en algún momento quieres limpiar la caché de vistas compiladas, puedes ejecutar:

```bash
php artisan view:clear
```

## Imprimir variables con {{ }}

La sintaxis más básica de Blade es la doble llave para imprimir valores:

```blade
<p>Hola, {{ $nombre }}</p>
```

Esta sintaxis es equivalente a `<?= htmlspecialchars($nombre, ENT_QUOTES, 'UTF-8') ?>`. Es decir, **escapa automáticamente los caracteres HTML**, lo que protege tu aplicación contra ataques de tipo XSS (Cross-Site Scripting). Siempre que muestres datos que vienen del usuario, usa `{{ }}`.

También puedes escribir expresiones PHP dentro de las llaves:

```blade
<p>El precio es: {{ number_format($precio, 2) }} €</p>
<p>Hoy es: {{ date('d/m/Y') }}</p>
<p>Elementos: {{ count($items) }}</p>
```

### Imprimir un valor por defecto

Blade hereda la sintaxis del operador `??` de PHP para proporcionar valores por defecto:

```blade
<p>{{ $titulo ?? 'Sin título' }}</p>
```

Si `$titulo` no existe o es `null`, Blade imprimirá `'Sin título'`.

## HTML sin escapar con {!! !!}

En ocasiones necesitas imprimir HTML que ya has procesado y del que confías en su contenido, como texto enriquecido almacenado en la base de datos:

```blade
<div class="contenido">
    {!! $articulo->contenido_html !!}
</div>
```

La sintaxis `{!! !!}` imprime el valor **sin escapar**. Usa esta opción con extremo cuidado: nunca la apliques a datos introducidos directamente por los usuarios, ya que abre la puerta a ataques XSS.

## Comentarios en Blade

Blade tiene su propia sintaxis para comentarios. A diferencia de los comentarios HTML (`<!-- -->`), los comentarios Blade **no se incluyen en el HTML enviado al navegador**:

```blade
{{-- Este comentario no aparece en el HTML final --}}

<!-- Este comentario SÍ aparece en el HTML final -->
```

Esto es útil para documentar la plantilla sin exponer notas internas al cliente.

## Ejecutar PHP en Blade

Aunque la filosofía de Blade es mantener la lógica fuera de las vistas, a veces necesitas ejecutar código PHP sin imprimir nada. Para ello existe la directiva `@php`:

```blade
@php
    $descuento = $precio * 0.1;
    $precioFinal = $precio - $descuento;
@endphp

<p>Precio final: {{ number_format($precioFinal, 2) }} €</p>
```

Úsala con moderación. Si te encuentras escribiendo lógica compleja dentro de `@php`, es señal de que esa lógica debería estar en el controlador o en un método del modelo.

## Estructuras de control básicas

Blade proporciona directivas que sustituyen las estructuras de control de PHP con una sintaxis más limpia.

### Condicionales

```blade
@if ($usuario->esAdmin())
    <span class="badge">Administrador</span>
@elseif ($usuario->esModerador())
    <span class="badge">Moderador</span>
@else
    <span class="badge">Usuario</span>
@endif
```

También existe `@unless`, que es el opuesto de `@if`:

```blade
@unless ($usuario->estaVerificado())
    <p>Por favor, verifica tu cuenta de correo.</p>
@endunless
```

### Bucles

```blade
@foreach ($posts as $post)
    <article>
        <h2>{{ $post->titulo }}</h2>
        <p>{{ $post->resumen }}</p>
    </article>
@endforeach
```

```blade
@for ($i = 0; $i < 5; $i++)
    <p>Elemento {{ $i }}</p>
@endfor
```

```blade
@while ($condicion)
    <p>Procesando...</p>
@endwhile
```

### La variable $loop

Dentro de `@foreach` y `@forelse`, Blade expone automáticamente la variable `$loop` con información útil sobre la iteración actual:

```blade
@foreach ($posts as $post)
    <div class="{{ $loop->even ? 'fondo-gris' : '' }}">
        <span>{{ $loop->iteration }} de {{ $loop->count }}</span>
        <h2>{{ $post->titulo }}</h2>

        @if ($loop->first)
            <span class="badge">Destacado</span>
        @endif
    </div>
@endforeach
```

Propiedades más usadas de `$loop`:

| Propiedad | Descripción |
|---|---|
| `$loop->index` | Índice actual (empieza en 0) |
| `$loop->iteration` | Iteración actual (empieza en 1) |
| `$loop->count` | Total de elementos |
| `$loop->first` | `true` si es el primer elemento |
| `$loop->last` | `true` si es el último elemento |
| `$loop->even` / `$loop->odd` | Si la iteración es par o impar |

### @forelse para colecciones vacías

`@forelse` combina `@foreach` con un bloque `@empty` para manejar colecciones vacías de forma elegante:

```blade
@forelse ($posts as $post)
    <article>
        <h2>{{ $post->titulo }}</h2>
    </article>
@empty
    <p>No hay artículos publicados aún.</p>
@endforelse
```

## Comparación: PHP puro vs Blade

Para apreciar la mejora de legibilidad, mira la misma lógica escrita en PHP puro y en Blade:

**PHP puro:**

```php
<?php if ($usuario): ?>
    <p>Hola, <?= htmlspecialchars($usuario->nombre) ?></p>
    <?php foreach ($usuario->posts as $post): ?>
        <h2><?= htmlspecialchars($post->titulo) ?></h2>
    <?php endforeach; ?>
<?php else: ?>
    <p>No has iniciado sesión.</p>
<?php endif; ?>
```

**Blade:**

```blade
@if ($usuario)
    <p>Hola, {{ $usuario->nombre }}</p>
    @foreach ($usuario->posts as $post)
        <h2>{{ $post->titulo }}</h2>
    @endforeach
@else
    <p>No has iniciado sesión.</p>
@endif
```

El resultado es el mismo, pero Blade es considerablemente más legible.

## Resumen

Blade es el motor de plantillas de Laravel que compila las vistas a PHP puro para un rendimiento óptimo. Sus dos sintaxis principales son `{{ }}` para imprimir con escape HTML seguro y `{!! !!}` para HTML sin escapar. Ofrece directivas limpias para condicionales y bucles, y expone la variable `$loop` para facilitar el trabajo con colecciones. En las próximas lecciones veremos cómo Blade permite crear layouts reutilizables y componentes que simplifican enormemente la gestión de plantillas complejas.
