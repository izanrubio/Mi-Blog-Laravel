---
modulo: 4
leccion: 5
title: 'Validación de formularios'
description: 'Aprende a validar datos de formularios en Laravel usando reglas integradas, Form Requests y cómo mostrar los errores en las vistas Blade.'
duracion: '20 min'
quiz:
  - pregunta: '¿Qué método de Request se usa para validar datos directamente en el controlador?'
    opciones:
      - '$request->check()'
      - '$request->sanitize()'
      - '$request->validate()'
      - '$request->rules()'
    correcta: 2
    explicacion: 'El método validate() de la clase Request permite validar los datos de la petición directamente en el controlador con las reglas especificadas.'
  - pregunta: '¿Qué directiva Blade muestra todos los errores de validación?'
    opciones:
      - '@errors'
      - '@if($errors->any())'
      - '@showErrors'
      - '@validation'
    correcta: 1
    explicacion: 'La directiva @if($errors->any()) comprueba si hay errores de validación. Dentro se puede usar $errors->all() para obtener la lista de errores.'
  - pregunta: '¿Cuál es el comando Artisan para crear un Form Request?'
    opciones:
      - 'php artisan make:form GuardarProductoRequest'
      - 'php artisan make:request GuardarProductoRequest'
      - 'php artisan make:validation GuardarProductoRequest'
      - 'php artisan make:rules GuardarProductoRequest'
    correcta: 1
    explicacion: 'El comando php artisan make:request crea una clase Form Request en app/Http/Requests/ con los métodos authorize() y rules().'
---

## La Importancia de Validar

Una de las reglas de oro del desarrollo web es: **nunca confíes en los datos del usuario**. Un formulario de registro puede recibir un email inválido, un precio negativo, un campo vacío que se esperaba obligatorio, o incluso código malicioso. Validar los datos antes de procesarlos es imprescindible.

Laravel ofrece un sistema de validación extremadamente completo y fácil de usar. Tiene decenas de reglas predefinidas, soporte para mensajes personalizados y una integración perfecta con las vistas Blade.

## Validación Básica en el Controlador

La forma más rápida de validar es usando el método `validate()` del objeto `Request`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class ProductoController extends Controller
{
    public function store(Request $request)
    {
        $request->validate([
            'nombre'      => 'required|string|max:255',
            'precio'      => 'required|numeric|min:0',
            'descripcion' => 'nullable|string|max:1000',
            'categoria'   => 'required|in:electronica,ropa,hogar',
        ]);

        // Si la validación falla, Laravel redirige automáticamente al formulario
        // con los errores y los datos del formulario (old input)

        // Si llega aquí, los datos son válidos
        Producto::create($request->only(['nombre', 'precio', 'descripcion', 'categoria']));

        return redirect()->route('productos.index')
            ->with('success', 'Producto creado correctamente.');
    }
}
```

Si la validación falla, Laravel automáticamente:
1. Redirige al usuario de vuelta al formulario.
2. Almacena los errores en la sesión.
3. Almacena los datos del formulario (old input) para repopular los campos.

## Reglas de Validación más Usadas

Laravel tiene decenas de reglas. Aquí están las más comunes:

```php
$rules = [
    // Obligatorio y no vacío
    'nombre'        => 'required',

    // Tipo de dato
    'edad'          => 'integer',
    'precio'        => 'numeric',
    'activo'        => 'boolean',
    'email'         => 'email',
    'web'           => 'url',
    'imagen'        => 'image',   // archivo de imagen
    'documento'     => 'file',

    // Longitud
    'nombre'        => 'min:3|max:255',
    'descripcion'   => 'max:1000',

    // Unicidad en base de datos
    'email'         => 'unique:users',           // único en tabla users
    'email'         => 'unique:users,email',     // especificando columna

    // Existencia en base de datos
    'categoria_id'  => 'exists:categorias,id',   // debe existir en tabla

    // Valores permitidos
    'estado'        => 'in:activo,inactivo,pendiente',
    'rol'           => 'in:admin,usuario,moderador',

    // Puede ser nulo
    'telefono'      => 'nullable|string|max:20',

    // Confirmación (requiere campo _confirmation)
    'password'      => 'required|confirmed|min:8',

    // Formato específico
    'fecha'         => 'date',
    'fecha'         => 'date_format:Y-m-d',
    'codigo_postal' => 'regex:/^[0-9]{5}$/',
];
```

## Combinar Reglas

Puedes combinar reglas de varias formas:

```php
// Con pipe |
'email' => 'required|email|max:255|unique:users'

// Con array (más legible para muchas reglas)
'email' => ['required', 'email', 'max:255', 'unique:users']

// Mezclando
'password' => ['required', 'string', 'min:8', 'confirmed']
```

## Mostrar Errores en la Vista Blade

Aquí está la vista del formulario con manejo de errores:

```html
{{-- resources/views/productos/create.blade.php --}}

<form action="{{ route('productos.store') }}" method="POST">
    @csrf

    {{-- Mostrar todos los errores en un bloque --}}
    @if ($errors->any())
        <div class="alert alert-danger">
            <ul>
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <div>
        <label for="nombre">Nombre del producto</label>
        <input
            type="text"
            id="nombre"
            name="nombre"
            value="{{ old('nombre') }}"
            class="{{ $errors->has('nombre') ? 'error' : '' }}"
        >
        {{-- Error específico del campo nombre --}}
        @error('nombre')
            <span class="error-message">{{ $message }}</span>
        @enderror
    </div>

    <div>
        <label for="precio">Precio</label>
        <input
            type="number"
            id="precio"
            name="precio"
            value="{{ old('precio') }}"
            step="0.01"
        >
        @error('precio')
            <span class="error-message">{{ $message }}</span>
        @enderror
    </div>

    <div>
        <label for="descripcion">Descripción (opcional)</label>
        <textarea name="descripcion">{{ old('descripcion') }}</textarea>
        @error('descripcion')
            <span class="error-message">{{ $message }}</span>
        @enderror
    </div>

    <button type="submit">Crear producto</button>
</form>
```

Puntos clave:
- `@error('campo')` muestra el error solo si ese campo falló.
- `old('campo')` recupera el valor que el usuario escribió, para no perderlo al redirigir.
- `$errors->has('campo')` devuelve `true` si ese campo tiene errores (útil para clases CSS).

## Mensajes de Error Personalizados

Por defecto los mensajes son en inglés (aunque puedes instalar el paquete de idioma español). También puedes personalizar los mensajes directamente:

```php
$request->validate(
    [
        'nombre' => 'required|string|max:255',
        'email'  => 'required|email|unique:users',
        'precio' => 'required|numeric|min:0',
    ],
    [
        'nombre.required' => 'El nombre del producto es obligatorio.',
        'nombre.max'      => 'El nombre no puede superar los 255 caracteres.',
        'email.required'  => 'El email es obligatorio.',
        'email.email'     => 'El email no tiene un formato válido.',
        'email.unique'    => 'Este email ya está registrado.',
        'precio.required' => 'El precio es obligatorio.',
        'precio.numeric'  => 'El precio debe ser un número.',
        'precio.min'      => 'El precio no puede ser negativo.',
    ]
);
```

## Form Requests — Validación Limpia y Reutilizable

Cuando un controlador tiene mucha validación, el código se vuelve difícil de leer. La solución de Laravel son los **Form Requests**: clases dedicadas exclusivamente a la validación de una petición específica.

```bash
php artisan make:request GuardarProductoRequest
```

Esto crea `app/Http/Requests/GuardarProductoRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GuardarProductoRequest extends FormRequest
{
    /**
     * Determina si el usuario está autorizado a hacer esta petición.
     */
    public function authorize(): bool
    {
        // true = todos los usuarios autorizados pueden enviar este formulario
        // Puedes poner lógica aquí: return auth()->user()->es_admin;
        return true;
    }

    /**
     * Define las reglas de validación.
     */
    public function rules(): array
    {
        return [
            'nombre'      => ['required', 'string', 'max:255'],
            'precio'      => ['required', 'numeric', 'min:0'],
            'descripcion' => ['nullable', 'string', 'max:1000'],
            'categoria'   => ['required', 'exists:categorias,id'],
        ];
    }

    /**
     * Mensajes de error personalizados.
     */
    public function messages(): array
    {
        return [
            'nombre.required'    => 'El nombre del producto es obligatorio.',
            'precio.required'    => 'El precio es obligatorio.',
            'precio.numeric'     => 'El precio debe ser un número.',
            'categoria.exists'   => 'La categoría seleccionada no existe.',
        ];
    }

    /**
     * Nombres personalizados para los atributos.
     */
    public function attributes(): array
    {
        return [
            'nombre'    => 'nombre del producto',
            'precio'    => 'precio del producto',
            'categoria' => 'categoría',
        ];
    }
}
```

Ahora en el controlador, simplemente inyectas el Form Request en lugar de `Request`:

```php
use App\Http\Requests\GuardarProductoRequest;

class ProductoController extends Controller
{
    public function store(GuardarProductoRequest $request)
    {
        // Si llega aquí, los datos ya están validados
        Producto::create($request->validated());

        return redirect()->route('productos.index')
            ->with('success', 'Producto creado correctamente.');
    }
}
```

El método `$request->validated()` devuelve solo los campos que pasaron la validación, ignorando cualquier dato extra que pudiera venir en la petición.

## Validación Condicional

A veces las reglas dependen de otros valores. Por ejemplo, si el tipo es "empresa", el CIF es obligatorio:

```php
public function rules(): array
{
    return [
        'tipo'      => ['required', 'in:persona,empresa'],
        'nombre'    => ['required', 'string'],
        'cif'       => [
            'nullable',
            Rule::requiredIf(fn () => $this->tipo === 'empresa'),
            'string',
            'max:9',
        ],
    ];
}
```

## Validación de Archivos

Para subir imágenes o documentos:

```php
'foto' => [
    'required',
    'image',           // debe ser una imagen
    'mimes:jpg,png,webp', // solo estos formatos
    'max:2048',        // máximo 2MB (en kilobytes)
],
'cv' => [
    'nullable',
    'file',
    'mimes:pdf,doc,docx',
    'max:5120',        // máximo 5MB
],
```

En el controlador para guardar el archivo:

```php
if ($request->hasFile('foto')) {
    $ruta = $request->file('foto')->store('productos', 'public');
    $producto->foto = $ruta;
}
```

## Resumen

La validación en Laravel es una de sus características más completas. Con `$request->validate()` tienes validación rápida en pocas líneas. Con Form Requests, tienes validación organizada, reutilizable y fácil de testear. La integración con Blade mediante `@error` y `old()` hace que la experiencia de usuario sea fluida, mostrando los errores y conservando los datos del formulario. Nunca envíes datos sin validar a la base de datos.
