---
title: 'Validación Wildcard en Laravel: Optimiza el rendimiento O(n²)'
description: 'Descubre por qué la validación wildcard en Laravel es O(n²) y cómo optimizarla para mejorar rendimiento en imports masivos'
pubDate: '2026-04-13'
tags: ['laravel', 'performance', 'validacion', 'optimizacion']
---

## Validación Wildcard en Laravel: Optimiza el rendimiento O(n²)

La validación de datos es uno de los pilares fundamentales en cualquier aplicación Laravel. Sin embargo, hay un problema silencioso que puede estar destruyendo el rendimiento de tus endpoints cuando trabajas con datos masivos: **la complejidad O(n²) de la validación wildcard**.

Si alguna vez has notado que un endpoint que valida cientos de registros se vuelve increíblemente lento, probablemente estés enfrentando este problema. En este artículo te mostraré exactamente qué está pasando, por qué sucede y cómo puedes solucionarlo.

## ¿Qué es la validación wildcard en Laravel?

La validación wildcard es una característica conveniente de Laravel que te permite validar arrays de datos de forma elegante. Por ejemplo:

```php
$validated = request()->validate([
    'items.*.name' => 'required|string|max:255',
    'items.*.email' => 'required|email',
    'items.*.age' => 'required|integer|min:18',
]);
```

Este patrón es especialmente útil cuando trabajas con formularios dinámicos, imports de CSV o cualquier operación masiva. Laravel automáticamente expande estas reglas a todos los elementos del array `items`.

## El problema: Complejidad O(n²)

Ahora viene la parte complicada. Cuando Laravel procesa estas reglas wildcard, internamente hace algo así:

1. **Aplana los datos** usando `Arr::dot()` para convertir arrays anidados en una estructura de punto
2. **Itera sobre cada regla wildcard** y usa regex para encontrar qué campos concretos coinciden
3. Repite el proceso para **cada regla** que tengas definida

Para datos con 100 registros, 47 campos cada uno y validaciones complejas como `exclude_unless` y `required_if`, el tiempo de validación puede alcanzar **3.2 segundos** de los 3.4 segundos totales que toma el endpoint.

Veamos por qué sucede esto con un ejemplo concreto:

```php
// Datos de entrada
$data = [
    'items' => [
        ['name' => 'Item 1', 'email' => 'test1@example.com', /* 45 campos más */],
        ['name' => 'Item 2', 'email' => 'test2@example.com', /* 45 campos más */],
        // ... 98 items más
    ]
];

// Después de Arr::dot(), tienes ~4700 claves:
// items.0.name, items.0.email, items.0.field3, ...
// items.1.name, items.1.email, items.1.field3, ...
// items.99.name, items.99.email, items.99.field3, ...

// Reglas wildcard
[
    'items.*.name' => 'required|string|max:255',
    'items.*.email' => 'required|email',
    'items.*.phone' => 'nullable|string',
    'items.*.exclude_unless:status,active' => 'sometimes|confirmed',
    // ... 47 reglas más
]
```

El validador de Laravel entonces:
- Toma la regla `items.*.name`
- Convierte el wildcard a un regex: `/^items\.\d+\.name$/`
- **Itera sobre las 4700+ claves** comparándolas contra este regex
- Repite para cada una de las 47 reglas

**Resultado: 4700 × 47 = 220,900 comparaciones de regex**. Es por eso que ves esos segundos de espera.

## Solución 1: Validación en bucle (La más simple)

La forma más directa de evitar este problema es validar cada registro individualmente:

```php
public function importItems(Request $request)
{
    $items = $request->input('items');
    $validated = [];
    
    foreach ($items as $index => $item) {
        $itemValidated = validator(
            $item,
            [
                'name' => 'required|string|max:255',
                'email' => 'required|email',
                'age' => 'required|integer|min:18',
            ],
            [],
            ['name' => "items.{$index}.name", 'email' => "items.{$index}.email"]
        )->validate();
        
        $validated[] = $itemValidated;
    }
    
    return response()->json(['success' => true, 'items' => $validated]);
}
```

**Ventajas:**
- Complejidad O(n) en lugar de O(n²)
- Fácil de entender y mantener
- Los mensajes de error mantienen referencias correctas a índices

**Desventajas:**
- Código más verbose
- Requiere refactoring si ya usas Form Requests

## Solución 2: Form Request con validación en bucle

Si prefieres mantener la elegancia de los Form Requests, puedes hacerlo así:

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ImportItemsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Aquí NO definas reglas wildcard
        return [];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function ($validator) {
            $items = $this->input('items');
            
            if (!is_array($items)) {
                $validator->errors()->add('items', 'Items debe ser un array');
                return;
            }

            foreach ($items as $index => $item) {
                // Validar cada item individualmente
                $itemValidator = validator(
                    $item,
                    [
                        'name' => 'required|string|max:255',
                        'email' => 'required|email',
                        'age' => 'required|integer|min:18',
                    ]
                );

                if ($itemValidator->fails()) {
                    foreach ($itemValidator->errors()->all() as $error) {
                        $validator->errors()->add(
                            "items.{$index}",
                            $error
                        );
                    }
                }
            }
        });
    }
}
```

Luego en tu controlador:

```php
public function import(ImportItemsRequest $request)
{
    $validated = $request->validated();
    // Procesar items validados
}
```

## Solución 3: Custom Rule para validación específica

Para casos más complejos, crea una regla personalizada:

```php
namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class ValidateItemArray implements ValidationRule
{
    public function validate(
        string $attribute,
        mixed $value,
        Closure $fail
    ): void {
        if (!is_array($value)) {
            $fail('El atributo debe ser un array.');
            return;
        }

        foreach ($value as $index => $item) {
            // Validar estructura de cada item
            if (!isset($item['name'])) {
                $fail("El item {$index} no tiene 'name'.");
                continue;
            }

            if (strlen($item['name']) > 255) {
                $fail("El nombre en item {$index} es demasiado largo.");
            }

            if (!filter_var($item['email'] ?? '', FILTER_VALIDATE_EMAIL)) {
                $fail("Email inválido en item {$index}.");
            }

            if (!is_int($item['age'] ?? null) || $item['age'] < 18) {
                $fail("Edad inválida en item {$index}.");
            }
        }
    }
}
```

Uso en Form Request:

```php
public function rules(): array
{
    return [
        'items' => ['required', 'array', new ValidateItemArray()],
    ];
}
```

## Benchmarking: Comparativa real

Aquí te dejo un script simple para medir el impacto:

```php
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Arr;

// Generar datos de prueba
$data = [];
for ($i = 0; $i < 100; $i++) {
    $data['items'][] = [
        'name' => "Item {$i}",
        'email' => "user{$i}@example.com",
        'age' => 25,
    ];
}

// Método 1: Wildcard (LENTO)
$start = microtime(true);
Validator::make($data, [
    'items.*.name' => 'required|string|max:255',
    'items.*.email' => 'required|email',
    'items.*.age' => 'required|integer|min:18',
])->validate();
$wildcardTime = microtime(true) - $start;

// Método 2: Bucle (RÁPIDO)
$start = microtime(true);
foreach ($data['items'] as $index => $item) {
    Validator::make($item, [
        'name' => 'required|string|max:255',
        'email' => 'required|email',
        'age' => 'required|integer|min:18',
    ])->validate();
}
$loopTime = microtime(true) - $start;

echo "Wildcard: {$wildcardTime}s\n";
echo "Bucle: {$loopTime}s\n";
echo "Mejora: " . round(($wildcardTime / $loopTime), 2) . "x más rápido\n";
```

En un servidor típico, verás resultados como:
- Wildcard: 0.8s
- Bucle: 0.15s
- **Mejora: 5.3x más rápido**

## Cuándo usar cada enfoque

**Usa validación wildcard cuando:**
- Tienes menos de 20 registros
- Las validaciones son muy simples
- El rendimiento no es crítico

**Usa validación en bucle cuando:**
- Procesas cientos o miles de registros
- Necesitas máximo rendimiento
- Las validaciones son complejas con reglas condicionales

## Puntos clave

- Laravel's validación wildcard usa `Arr::dot()` y regex, resultando en complejidad O(n²)
- Con 100 registros × 47 campos × 47 reglas = 220,900 comparaciones innecesarias
- La validación en bucle reduce esto a O(n) y puede ser **5x+ más rápida**
- Los Form Requests con `withValidator()` mantienen la elegancia sin el costo de rendimiento
- Las Custom Rules ofrecen una solución limpia y reutilizable
- Mide siempre el impacto con datos realistas antes de optimizar
- Para imports masivos, la validación en bucle es prácticamente obligatoria
- Considera usar jobs en queue para validaciones ultra-pesadas con cientos de miles de registros