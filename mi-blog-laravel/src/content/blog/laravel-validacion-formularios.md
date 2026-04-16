---
title: 'Validación de formularios en Laravel: guía completa'
description: 'Aprende a validar datos en Laravel con $request->validate(), Form Requests y reglas personalizadas. Muestra errores en Blade y maneja la validación como un profesional.'
pubDate: '2026-04-16'
tags: ['laravel', 'validacion', 'conceptos', 'roadmap']
---

Nunca confíes en los datos que llegan del usuario. Esta es una de las reglas más importantes en el desarrollo web, y Laravel lo sabe muy bien. Por eso incluye un sistema de validación extremadamente potente y fácil de usar. En este artículo vamos a repasar todo lo que necesitas saber para validar formularios de forma profesional.

## ¿Por qué validar los datos?

La validación no es opcional. Sin ella, tu aplicación es vulnerable a:

- Datos incorrectos que rompen la lógica de negocio
- Inyección SQL o XSS si los datos llegan directamente a la base de datos o al HTML
- Errores en tiempo de ejecución por tipos de datos inesperados
- Registros duplicados o inconsistentes en la base de datos

Laravel ofrece tres formas principales de validar: directamente en el controlador con `$request->validate()`, con clases Form Request, y con el Validator facade.

## Validación básica en el controlador

La forma más rápida de validar es llamar a `validate()` directamente sobre el objeto request:

```php
// app/Http/Controllers/PostController.php
public function store(Request $request): RedirectResponse
{
    $validated = $request->validate([
        'title'   => ['required', 'string', 'max:255'],
        'body'    => ['required', 'string', 'min:50'],
        'email'   => ['required', 'email', 'unique:users,email'],
        'slug'    => ['required', 'unique:posts,slug'],
        'status'  => ['required', 'in:draft,published,archived'],
    ]);

    Post::create($validated);

    return redirect()->route('posts.index')->with('success', 'Publicación creada.');
}
```

Si la validación falla, Laravel lanza automáticamente una excepción `ValidationException` que redirige al usuario de vuelta al formulario con los errores y los datos introducidos. Para peticiones AJAX, devuelve una respuesta JSON con los errores y código HTTP 422.

## Reglas de validación más usadas

Laravel incluye más de 90 reglas. Estas son las que usarás con más frecuencia:

```php
$request->validate([
    // Presencia
    'nombre'        => ['required'],
    'apellido'      => ['nullable', 'string'],    // Permite nulo
    'bio'           => ['sometimes', 'string'],   // Solo valida si está presente

    // Tipos y formato
    'email'         => ['required', 'email'],
    'web'           => ['nullable', 'url'],
    'edad'          => ['required', 'integer', 'min:18', 'max:120'],
    'precio'        => ['required', 'numeric', 'min:0'],
    'nacimiento'    => ['required', 'date', 'before:today'],
    'codigo_postal' => ['required', 'digits:5'],
    'telefono'      => ['required', 'regex:/^[0-9]{9}$/'],

    // Strings
    'titulo'        => ['required', 'string', 'min:5', 'max:255'],
    'contenido'     => ['required', 'string', 'min:100'],

    // Base de datos
    'email'         => ['required', 'email', 'unique:users,email'],          // Único en la tabla
    'categoria_id'  => ['required', 'exists:categories,id'],                  // Debe existir

    // Confirmación de campos
    'password'      => ['required', 'string', 'min:8', 'confirmed'],          // Necesita password_confirmation
    'password_confirmation' => ['required'],

    // Arrays
    'tags'          => ['required', 'array', 'min:1', 'max:5'],
    'tags.*'        => ['required', 'string', 'max:50'],

    // Archivos
    'avatar'        => ['nullable', 'image', 'mimes:jpg,png,webp', 'max:2048'],
    'documento'     => ['required', 'file', 'mimes:pdf', 'max:5120'],

    // Booleanos
    'activo'        => ['required', 'boolean'],
    'acepta_terminos' => ['required', 'accepted'],
]);
```

### La regla unique con excepciones

Cuando actualizas un registro, necesitas excluir el propio registro de la comprobación de unicidad:

```php
// En el método update del controlador
public function update(Request $request, User $user): RedirectResponse
{
    $request->validate([
        // Ignora el usuario actual en la comprobación de unicidad
        'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
    ]);

    // ...
}
```

## Mensajes de error personalizados

Puedes personalizar los mensajes de error pasando un segundo array a `validate()`:

```php
$request->validate(
    [
        'email'    => ['required', 'email', 'unique:users,email'],
        'password' => ['required', 'min:8', 'confirmed'],
    ],
    [
        'email.required'    => 'El correo electrónico es obligatorio.',
        'email.email'       => 'Introduce un correo electrónico válido.',
        'email.unique'      => 'Este correo ya está registrado. ¿Quieres iniciar sesión?',
        'password.required' => 'La contraseña es obligatoria.',
        'password.min'      => 'La contraseña debe tener al menos :min caracteres.',
        'password.confirmed'=> 'Las contraseñas no coinciden.',
    ]
);
```

## Mostrar errores en Blade

Laravel guarda los errores de validación en la variable `$errors` que está disponible automáticamente en todas las vistas.

### La directiva @error

```html
<form method="POST" action="/posts">
    @csrf

    <div>
        <label for="title">Título</label>
        <input
            type="text"
            id="title"
            name="title"
            value="{{ old('title') }}"
            class="{{ $errors->has('title') ? 'border-red-500' : 'border-gray-300' }}"
        >
        @error('title')
            <p class="text-red-500 text-sm mt-1">{{ $message }}</p>
        @enderror
    </div>

    <div>
        <label for="body">Contenido</label>
        <textarea
            id="body"
            name="body"
            class="{{ $errors->has('body') ? 'border-red-500' : 'border-gray-300' }}"
        >{{ old('body') }}</textarea>
        @error('body')
            <p class="text-red-500 text-sm mt-1">{{ $message }}</p>
        @enderror
    </div>

    <button type="submit">Crear publicación</button>
</form>
```

### El helper old()

`old('campo')` devuelve el valor que el usuario introdujo antes de que fallara la validación. Esto evita que el formulario se limpie y el usuario tenga que rellenar todo de nuevo.

```html
<input type="text" name="nombre" value="{{ old('nombre', $user->nombre) }}">
```

El segundo argumento de `old()` es el valor por defecto, útil cuando editas un registro existente.

### Mostrar todos los errores de golpe

```html
@if ($errors->any())
    <div class="bg-red-100 border border-red-400 p-4 rounded mb-4">
        <ul class="list-disc list-inside">
            @foreach ($errors->all() as $error)
                <li class="text-red-700">{{ $error }}</li>
            @endforeach
        </ul>
    </div>
@endif
```

## Form Request: validación en clases dedicadas

Para formularios complejos o para mantener los controladores limpios, lo mejor es crear una clase Form Request:

```bash
php artisan make:request StorePostRequest
```

Esto crea el archivo `app/Http/Requests/StorePostRequest.php`:

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePostRequest extends FormRequest
{
    /**
     * Determina si el usuario está autorizado a hacer esta petición.
     */
    public function authorize(): bool
    {
        // Retorna true si cualquier usuario puede hacer esto
        // O añade lógica de autorización:
        // return $this->user()->can('create', Post::class);
        return true;
    }

    /**
     * Las reglas de validación para la petición.
     */
    public function rules(): array
    {
        return [
            'title'       => ['required', 'string', 'max:255'],
            'slug'        => ['required', 'string', 'unique:posts,slug'],
            'body'        => ['required', 'string', 'min:100'],
            'category_id' => ['required', 'exists:categories,id'],
            'tags'        => ['nullable', 'array'],
            'tags.*'      => ['exists:tags,id'],
            'status'      => ['required', Rule::in(['draft', 'published'])],
            'published_at'=> ['nullable', 'date'],
        ];
    }

    /**
     * Mensajes de error personalizados.
     */
    public function messages(): array
    {
        return [
            'title.required'       => 'El título es obligatorio.',
            'body.min'             => 'El contenido debe tener al menos :min caracteres.',
            'category_id.exists'   => 'La categoría seleccionada no es válida.',
            'status.in'            => 'El estado debe ser borrador o publicado.',
        ];
    }

    /**
     * Nombres personalizados para los campos.
     */
    public function attributes(): array
    {
        return [
            'category_id' => 'categoría',
            'published_at' => 'fecha de publicación',
        ];
    }
}
```

Para usarlo en el controlador, simplemente reemplaza `Request` por tu Form Request:

```php
use App\Http\Requests\StorePostRequest;

public function store(StorePostRequest $request): RedirectResponse
{
    // Los datos ya están validados aquí
    $validated = $request->validated();

    Post::create($validated);

    return redirect()->route('posts.index')->with('success', 'Publicación creada.');
}
```

## Validación condicional

### sometimes: solo si está presente

```php
'telefono' => ['sometimes', 'required', 'string', 'digits:9'],
```

### required_if: requerido si otro campo tiene cierto valor

```php
$request->validate([
    'tipo_pago'       => ['required', 'in:tarjeta,transferencia'],
    'numero_tarjeta'  => ['required_if:tipo_pago,tarjeta', 'string', 'digits:16'],
    'iban'            => ['required_if:tipo_pago,transferencia', 'string'],
]);
```

### Validación condicional con Validator::sometimes()

```php
use Illuminate\Support\Facades\Validator;

$validator = Validator::make($request->all(), [
    'tipo' => ['required', 'in:empresa,particular'],
    'nombre' => ['required', 'string'],
]);

$validator->sometimes('cif', ['required', 'string', 'size:9'], function ($input) {
    return $input->tipo === 'empresa';
});

$validator->sometimes('dni', ['required', 'string', 'size:9'], function ($input) {
    return $input->tipo === 'particular';
});

if ($validator->fails()) {
    return back()->withErrors($validator)->withInput();
}
```

## Validar arrays

```php
$request->validate([
    'productos'           => ['required', 'array', 'min:1'],
    'productos.*.id'      => ['required', 'exists:products,id'],
    'productos.*.cantidad'=> ['required', 'integer', 'min:1'],
    'productos.*.precio'  => ['required', 'numeric', 'min:0'],
]);
```

## Reglas de validación personalizadas

Cuando las reglas predefinidas no son suficientes, crea la tuya propia:

```bash
php artisan make:rule NifValido
```

```php
// app/Rules/NifValido.php
namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class NifValido implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        // Lógica de validación del NIF español
        $letras = 'TRWAGMYFPDXBNJZSQVHLCKE';
        $value = strtoupper(trim($value));

        if (! preg_match('/^[0-9]{8}[A-Z]$/', $value)) {
            $fail("El :attribute no tiene el formato correcto (8 números + 1 letra).");
            return;
        }

        $numero = (int) substr($value, 0, 8);
        $letraEsperada = $letras[$numero % 23];
        $letraIntroducida = substr($value, -1);

        if ($letraIntroducida !== $letraEsperada) {
            $fail("El :attribute no es válido.");
        }
    }
}
```

Usar la regla personalizada:

```php
use App\Rules\NifValido;

$request->validate([
    'nif' => ['required', 'string', new NifValido],
]);
```

## Conclusión

La validación en Laravel es una de las partes más elegantes del framework. Desde la validación rápida en el controlador hasta las Form Requests con mensajes y autorización, tienes todas las herramientas para mantener tus datos limpios y tu código organizado. Recuerda: siempre valida los datos del usuario, sin excepciones.
