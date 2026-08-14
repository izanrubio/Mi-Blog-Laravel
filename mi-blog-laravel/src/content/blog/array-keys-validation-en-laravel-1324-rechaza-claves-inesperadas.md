---
title: 'Array Keys Validation en Laravel 13.24: Rechaza Claves Inesperadas'
description: 'Descubre cómo usar la nueva regla array_keys en Laravel 13.24 para validar arrays y rechazar claves no autorizadas con mensajes descriptivos.'
pubDate: '2026-08-10'
tags: ['laravel', 'validación', 'php', 'laravel-13']
---

## Array Keys Validation en Laravel 13.24: Rechaza Claves Inesperadas

Laravel 13.24 introduce una nueva regla de validación llamada `array_keys` que te permite validar no solo los valores de un array, sino también controlar qué claves están permitidas. Esta funcionalidad es especialmente útil cuando trabajas con APIs REST, formularios complejos o integraciones externas donde necesitas garantizar que los datos recibidos solo contengan las claves esperadas.

### ¿Por qué necesitas validación de claves de array?

Imagina que tu API REST acepta datos de usuario con una estructura específica:

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+34 666 777 888"
}
```

Sin la validación de claves, un cliente malintencionado podría enviar:

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+34 666 777 888",
  "is_admin": true,
  "role": "superadmin",
  "bypass_security": true
}
```

Antes de Laravel 13.24, tenías que confiar en que tu aplicación ignoraría esas claves extras. Ahora puedes rechazar explícitamente cualquier clave que no esté autorizada, mejorando tu seguridad y claridad del contrato de tu API.

### Sintaxis básica de array_keys

La nueva regla `array_keys` es simple pero poderosa:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class UserController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'user' => ['array', 'array_keys:name,email,phone'],
            'user.name' => ['required', 'string'],
            'user.email' => ['required', 'email'],
            'user.phone' => ['nullable', 'string'],
        ]);

        // Solo se aceptan: name, email, phone
        // Cualquier otra clave será rechazada
    }
}
```

Si el cliente envía una clave no autorizada, Laravel lanzará un error de validación especificando exactamente qué claves fueron rechazadas.

### Casos de uso prácticos

#### 1. APIs REST con estructura fija

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateProductRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'product' => ['required', 'array', 'array_keys:title,description,price,sku,category_id'],
            'product.title' => ['required', 'string', 'max:255'],
            'product.description' => ['required', 'string'],
            'product.price' => ['required', 'numeric', 'min:0.01'],
            'product.sku' => ['required', 'string', 'unique:products'],
            'product.category_id' => ['required', 'integer', 'exists:categories,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'product.array_keys' => 'El producto contiene claves no permitidas. Solo se aceptan: title, description, price, sku, category_id',
        ];
    }
}
```

#### 2. Integración con webhooks externos

Cuando recibes webhooks de servicios externos como Stripe o PayPal, validar las claves esperadas te protege de datos malformados:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WebhookController extends Controller
{
    public function handleStripeWebhook(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'id' => ['required', 'string'],
            'object' => ['required', 'string'],
            'data' => ['required', 'array', 'array_keys:object,previous_attributes'],
            'data.object' => ['required', 'array'],
            'data.previous_attributes' => ['array'],
            'type' => ['required', 'string'],
            'created' => ['required', 'integer'],
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()], 422);
        }

        // Procesar webhook seguro
        $event = $validator->validated();
        
        return response()->json(['success' => true]);
    }
}
```

#### 3. Configuración de filtros dinámicos

Cuando aceptas filtros en búsquedas, es útil validar que solo uses los filtros permitidos:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Product;

class ProductSearchController extends Controller
{
    public function search(Request $request)
    {
        $validated = $request->validate([
            'filters' => ['nullable', 'array', 'array_keys:price_min,price_max,category,brand,in_stock'],
            'filters.price_min' => ['nullable', 'numeric', 'min:0'],
            'filters.price_max' => ['nullable', 'numeric', 'min:0'],
            'filters.category' => ['nullable', 'string', 'exists:categories,slug'],
            'filters.brand' => ['nullable', 'string', 'exists:brands,slug'],
            'filters.in_stock' => ['nullable', 'boolean'],
        ]);

        $query = Product::query();

        if (!empty($validated['filters'])) {
            $filters = $validated['filters'];
            
            if (isset($filters['price_min'])) {
                $query->where('price', '>=', $filters['price_min']);
            }
            if (isset($filters['price_max'])) {
                $query->where('price', '<=', $filters['price_max']);
            }
            if (isset($filters['category'])) {
                $query->whereHas('category', fn($q) => $q->where('slug', $filters['category']));
            }
            if (isset($filters['brand'])) {
                $query->whereHas('brand', fn($q) => $q->where('slug', $filters['brand']));
            }
            if (isset($filters['in_stock']) && $filters['in_stock']) {
                $query->where('stock', '>', 0);
            }
        }

        return $query->paginate();
    }
}
```

### Combinando array_keys con otras reglas

La validación de claves funciona perfectamente combinada con otras reglas de array:

```php
<?php

$validated = request()->validate([
    // Solo permite estas claves y además el array debe tener mínimo 1 elemento
    'metadata' => ['required', 'array', 'min:1', 'array_keys:color,size,material'],
    'metadata.color' => ['required', 'string', 'in:red,blue,green,black'],
    'metadata.size' => ['required', 'string', 'in:xs,s,m,l,xl,xxl'],
    'metadata.material' => ['required', 'string', 'in:cotton,polyester,silk,wool'],
]);
```

### Manejo de errores personalizado

Puedes personalizar completamente el mensaje de error cuando se rechazan claves:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'settings' => ['required', 'array', 'array_keys:theme,notifications,privacy'],
            'settings.theme' => ['required', 'string', 'in:light,dark,auto'],
            'settings.notifications' => ['required', 'boolean'],
            'settings.privacy' => ['required', 'string', 'in:public,private,friends'],
        ];
    }

    public function messages(): array
    {
        return [
            'settings.array_keys' => 'Configuración inválida. Las claves permitidas son: theme, notifications, privacy.',
        ];
    }

    public function failedValidation(\Illuminate\Contracts\Validation\Validator $validator)
    {
        throw new \Illuminate\Validation\ValidationException(
            $validator,
            response()->json([
                'message' => 'Error de validación',
                'errors' => $validator->errors(),
            ], 422)
        );
    }
}
```

### Comparación: array_keys vs Seguridad sin validación

**Sin array_keys (antes de Laravel 13.24):**

```php
// Vulnerable: las claves extra se ignoran silenciosamente
$data = request()->validate([
    'user.name' => 'required|string',
    'user.email' => 'required|email',
]);

// Si el cliente envía is_admin=true, simplemente se ignora
// Pero ¿qué pasa si hay un mass assignment vulnerability?
```

**Con array_keys (Laravel 13.24+):**

```php
// Seguro: rechaza explícitamente cualquier clave no autorizada
$data = request()->validate([
    'user' => 'array|array_keys:name,email',
    'user.name' => 'required|string',
    'user.email' => 'required|email',
]);

// Error 422: claves inesperadas detectadas y rechazadas
```

### Ventajas clave de array_keys

1. **Seguridad**: Previene inyecciones de propiedades no autorizadas
2. **Claridad de API**: Comunica explícitamente qué campos se aceptan
3. **Debugging mejorado**: Los errores de validación indican exactamente qué claves fueron rechazadas
4. **Cumplimiento de contrato**: Garantiza que los datos recibidos cumplan la estructura esperada
5. **Integración con Form Requests**: Se integra perfectamente con el sistema de validación existente

### Cuándo no usar array_keys

- Cuando trabajas con datos muy dinámicos o sin estructura fija
- En APIs GraphQL que manejan sus propios schemas
- Cuando la estructura de datos cambia frecuentemente y necesitas máxima flexibilidad

### Rendimiento

La validación de claves es O(n) donde n es el número de claves permitidas, lo que es muy eficiente incluso con arrays grandes. Laravel lo implementa de manera óptima internamente.

## Puntos clave

- **array_keys es nueva en Laravel 13.24** y rechaza cualquier clave de array que no esté explícitamente permitida
- **Mejora la seguridad** previniendo inyecciones de propiedades no autorizadas en requests
- **Se usa combinado con `array`** en tus reglas de validación
- **Funciona perfectamente con Form Requests** para organizar la validación en clases dedicadas
- **Los mensajes de error son descriptivos** e indican qué claves fueron rechazadas
- **Es especialmente útil en APIs REST, webhooks y formularios complejos** donde necesitas estructura fija
- **Se combina con otras reglas de validación** como `min`, `max`, y validaciones de valores individuales
- **Mejora la documentación implícita** de tu API al ser explícito sobre qué campos aceptas