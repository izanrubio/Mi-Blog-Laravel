---
title: 'JSON Schema en Laravel: Validación Robusta de Tipos'
description: 'Domina JSON Schema en Laravel 13: valida estructuras de datos complejas, deserialización de arrays y asegura tipos en tu aplicación.'
pubDate: '2026-06-10'
tags: ['laravel', 'validacion', 'json-schema', 'laravel-13']
---

## JSON Schema en Laravel: Validación Robusta de Tipos

Uno de los desafíos más comunes al trabajar con APIs y datos estructurados en Laravel es garantizar que los datos que recibes cumplen con una estructura esperada. Laravel 13.14 introduce mejoras significativas a su soporte para **JSON Schema**, permitiéndote validar y deserializar estructuras complejas de forma robusta y elegante.

En este artículo exploraremos cómo aprovechar JSON Schema en Laravel, cómo funciona la deserialización de arrays y cómo integrar esto en tus aplicaciones para validar datos con confianza.

## ¿Qué es JSON Schema y por qué debería importarte?

JSON Schema es un estándar abierto para describir la estructura, formato y restricciones de un documento JSON. Es como un "contrato" que define qué campos debe tener un JSON, de qué tipos deben ser, y qué restricciones deben cumplir.

### Ventajas de usar JSON Schema en Laravel

- **Validación automática**: Valida estructuras complejas sin escribir lógica manual
- **Documentación clara**: El schema sirve como documentación ejecutable
- **Reutilización**: Define una vez, utiliza en múltiples lugares
- **Seguridad de tipos**: Asegura que los datos tienen los tipos esperados
- **Mensajes de error descriptivos**: Errores claros cuando la validación falla

Esto es especialmente valioso cuando trabajas con APIs, imports de datos o procesamiento de webhooks donde la estructura del JSON puede variar.

## Fundamentos de JSON Schema en Laravel

Laravel utiliza el componente `JsonSchema` desde `Illuminate\Http\JsonSchema` para trabajar con esquemas. La forma más básica de definir un schema es usando arrays de tipo PHP.

### Estructura básica de un JSON Schema

```php
use Illuminate\Http\JsonSchema;

// Definir un schema básico
$schema = [
    'type' => 'object',
    'properties' => [
        'id' => ['type' => 'integer'],
        'name' => ['type' => 'string'],
        'email' => ['type' => 'string', 'format' => 'email'],
        'age' => ['type' => 'integer', 'minimum' => 0],
    ],
    'required' => ['id', 'name', 'email'],
];

// Convertir el array en un objeto Type
$type = JsonSchema::fromArray($schema);
```

La novedad en Laravel 13.14 es precisamente el método `fromArray()`, que permite convertir arrays de PHP en objetos `Type` de forma nativa, facilitando la deserialización.

## Validación de estructuras JSON complejas

Uno de los casos de uso más prácticos es validar datos que llegan a través de formularios o APIs. Considera un sistema de e-commerce donde necesitas validar pedidos complejos:

```php
// Esquema para validar un pedido
$orderSchema = [
    'type' => 'object',
    'properties' => [
        'order_id' => ['type' => 'string'],
        'customer' => [
            'type' => 'object',
            'properties' => [
                'name' => ['type' => 'string'],
                'email' => ['type' => 'string', 'format' => 'email'],
                'phone' => ['type' => 'string'],
            ],
            'required' => ['name', 'email'],
        ],
        'items' => [
            'type' => 'array',
            'items' => [
                'type' => 'object',
                'properties' => [
                    'product_id' => ['type' => 'integer'],
                    'quantity' => ['type' => 'integer', 'minimum' => 1],
                    'price' => ['type' => 'number', 'minimum' => 0],
                ],
                'required' => ['product_id', 'quantity', 'price'],
            ],
        ],
        'total' => ['type' => 'number', 'minimum' => 0],
    ],
    'required' => ['order_id', 'customer', 'items', 'total'],
];
```

Este schema define una estructura anidada donde un pedido tiene un cliente (objeto) e items (array de objetos).

## Uso en Controladores con validación de Laravel

Puedes integrar JSON Schema con el sistema de validación nativo de Laravel:

```php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonSchema;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        // Definir el schema
        $schema = [
            'type' => 'object',
            'properties' => [
                'customer_name' => ['type' => 'string'],
                'items' => [
                    'type' => 'array',
                    'items' => [
                        'type' => 'object',
                        'properties' => [
                            'id' => ['type' => 'integer'],
                            'quantity' => ['type' => 'integer', 'minimum' => 1],
                        ],
                        'required' => ['id', 'quantity'],
                    ],
                    'minItems' => 1,
                ],
            ],
            'required' => ['customer_name', 'items'],
        ];

        // Convertir a Type
        $type = JsonSchema::fromArray($schema);

        // Validar contra el schema
        // Esto requiere una implementación personalizada
        // o usar con validadores de terceros

        // Alternativa: usar validación tradicional de Laravel
        $validated = $request->validate([
            'customer_name' => 'required|string',
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer',
            'items.*.quantity' => 'required|integer|min:1',
        ]);

        // Procesar el pedido...
        return response()->json(['success' => true], 201);
    }
}
```

## Deserialización de Arrays con fromArray()

La principal novedad en Laravel 13.14 es el método `fromArray()`, que permite deserializar arrays PHP en objetos `Type`. Esto es especialmente útil cuando trabajas con datos de configuración o cuando necesitas dinámicamente construir tipos:

```php
use Illuminate\Http\JsonSchema;

// Tenemos un array de configuración que define un schema
$configSchema = [
    'type' => 'object',
    'properties' => [
        'database' => ['type' => 'string'],
        'cache' => ['type' => 'string'],
        'queue' => ['type' => 'string'],
    ],
    'required' => ['database'],
];

// Convertir el array en un Type object
$type = JsonSchema::fromArray($configSchema);

// Ahora puedes usar $type para validar datos
$data = [
    'database' => 'mysql',
    'cache' => 'redis',
    'queue' => 'sync',
];

// Validar $data contra $type
// (La implementación exacta depende de tus validadores)
```

## Trabajar con tipos unión en JSON Schema

Laravel 13.14 también añade soporte para uniones de múltiples tipos, lo que es útil cuando un campo puede tener varios tipos válidos:

```php
// Un schema que permite números enteros O strings
$flexibleSchema = [
    'type' => 'object',
    'properties' => [
        'id' => [
            'oneOf' => [
                ['type' => 'integer'],
                ['type' => 'string'],
            ],
        ],
        'value' => [
            'anyOf' => [
                ['type' => 'string'],
                ['type' => 'number'],
                ['type' => 'null'],
            ],
        ],
    ],
];

$type = JsonSchema::fromArray($flexibleSchema);
```

Los operadores clave son:
- **oneOf**: Exactamente uno de los tipos debe coincidir
- **anyOf**: Uno o más de los tipos pueden coincidir
- **allOf**: Todos los tipos deben coincidir

## Caso práctico: Validar webhooks de Stripe

Un caso real donde JSON Schema es invaluable es al procesar webhooks de servicios externos como Stripe:

```php
namespace App\Http\Controllers\Webhooks;

use Illuminate\Http\Request;
use Illuminate\Http\JsonSchema;

class StripeWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $webhookSchema = [
            'type' => 'object',
            'properties' => [
                'id' => ['type' => 'string'],
                'object' => ['type' => 'string', 'enum' => ['event']],
                'type' => ['type' => 'string'],
                'data' => [
                    'type' => 'object',
                    'properties' => [
                        'object' => ['type' => 'object'],
                    ],
                    'required' => ['object'],
                ],
                'created' => ['type' => 'integer'],
            ],
            'required' => ['id', 'object', 'type', 'data'],
        ];

        $type = JsonSchema::fromArray($webhookSchema);

        // Validar que el webhook tiene la estructura esperada
        $payload = $request->json()->all();

        // Procesar solo si es válido
        $this->processWebhook($payload);

        return response()->json(['received' => true]);
    }

    private function processWebhook(array $payload)
    {
        match ($payload['type']) {
            'payment_intent.succeeded' => $this->handlePaymentSuccess($payload),
            'charge.failed' => $this->handleChargeFailed($payload),
            default => null,
        };
    }
}
```

## Constructores personalizados y extendibilidad

Aunque JSON Schema en Laravel es poderoso, a menudo querrás crear builders personalizados para esquemas complejos:

```php
class UserSchema
{
    public static function definition(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'id' => ['type' => 'integer'],
                'name' => ['type' => 'string', 'minLength' => 3],
                'email' => ['type' => 'string', 'format' => 'email'],
                'role' => ['type' => 'string', 'enum' => ['admin', 'user', 'guest']],
                'active' => ['type' => 'boolean'],
                'created_at' => ['type' => 'string', 'format' => 'date-time'],
            ],
            'required' => ['id', 'name', 'email', 'role'],
        ];
    }

    public static function forCreation(): array
    {
        $schema = self::definition();
        
        // Quitar campos que no se pueden crear
        unset($schema['properties']['id']);
        unset($schema['properties']['created_at']);

        $schema['required'] = ['name', 'email', 'role'];

        return $schema;
    }

    public static function forUpdate(): array
    {
        $schema = self::definition();

        // Los campos son opcionales en actualizaciones
        $schema['required'] = [];

        unset($schema['properties']['id']);
        unset($schema['properties']['created_at']);

        return $schema;
    }
}

// Uso
$createSchema = UserSchema::forCreation();
$createType = JsonSchema::fromArray($createSchema);
```

## Integración con FormRequest

Una forma elegante de usar JSON Schema es crear FormRequest personalizados que validen contra el schema:

```php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use App\Schemas\UserSchema;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Usar el schema para generar reglas de validación
        return [
            'name' => 'required|string|min:3',
            'email' => 'required|email|unique:users',
            'role' => 'required|in:admin,user,guest',
        ];
    }
}
```

## Manejo de errores y validación fallida

Cuando un schema no valida, es importante capturar y presentar errores de forma clara:

```php
use Illuminate\Http\JsonSchema;
use Throwable;

class DataValidator
{
    public function validate(array $data, array $schema)
    {
        try {
            $type = JsonSchema::fromArray($schema);
            
            // Aquí vendría la lógica de validación real
            // dependiendo de tu implementación específica
            
            return ['valid' => true, 'errors' => []];
        } catch (Throwable $e) {
            return [
                'valid' => false,
                'errors' => ['schema_error' => $e->getMessage()],
            ];
        }
    }
}
```

## Mejores prácticas

### 1. Centraliza tus esquemas

Crea una clase o carpeta dedicada para almacenar todos tus esquemas JSON:

```
app/
├── Schemas/
│   ├── UserSchema.php
│   ├── OrderSchema.php
│   └── ProductSchema.php
```

### 2. Reutiliza componentes de schema

```php
class BaseSchema
{
    protected static function timestampFields(): array
    {
        return [
            'created_at' => ['type' => 'string', 'format' => 'date-time'],
            'updated_at' => ['type' => 'string', 'format' => 'date-time'],
        ];
    }
}

class UserSchema extends BaseSchema
{
    public static function definition(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                // ... campos específicos
                ...self::timestampFields(),
            ],
        ];
    }
}
```

### 3. Valida al inicio

Valida datos tan pronto como entren en tu aplicación (en controladores o middleware).

### 4. Documenta tus esquemas

Añade comentarios explicativos en tus definiciones de schema:

```php
[
    'type' => 'object',
    'properties' => [
        'email' => [
            'type' => 'string',
            'format' => 'email',
            'description' => 'Email válido del usuario, único en el sistema',
        ],
    ],
]
```

## Conclusión

JSON Schema en Laravel, especialmente con las mejoras de la versión 13.14 y el método `fromArray()`, proporciona una forma robusta y elegante de validar estructuras complejas de datos. Ya sea que estés construyendo una API, procesando webhooks o manejando importaciones de datos, JSON Schema te ayuda a:

- **Garantizar integridad de datos** sin escribir validación manual compleja
- **Documentar expectativas** de forma ejecutable
- **Reutilizar validaciones** en múltiples contextos
- **Mejorar mantenibilidad** centralizando lógica de validación

La clave es integrar JSON Schema estratégicamente en tu arquitectura, combinándolo con otras herramientas de validación de Laravel para crear aplicaciones robustas y confiables.

## Puntos clave

- JSON Schema define contratos para estructuras de datos complejas
- `JsonSchema::fromArray()` en Laravel 13.14 deserializa arrays en objetos Type
- Soporta tipos anidados, arrays y uniones con `oneOf`, `anyOf`, `allOf`
- Ideal