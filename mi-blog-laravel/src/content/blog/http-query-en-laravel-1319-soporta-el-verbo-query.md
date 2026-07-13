---
title: 'HTTP QUERY en Laravel 13.19: Soporta el Verbo QUERY'
description: 'Aprende a usar el nuevo método Http::query() en Laravel 13.19 para trabajar con el verbo HTTP QUERY. Guía completa con ejemplos prácticos.'
pubDate: '2025-01-15'
tags: ['laravel', 'http', 'api', 'laravel-13']
---

## HTTP QUERY en Laravel 13.19: Soporta el Verbo QUERY

El verbo HTTP QUERY es un estándar RFC 9110 que permite realizar consultas seguras sin efectos secundarios, similar a GET pero con la capacidad de enviar un cuerpo en la solicitud. Laravel 13.19 acaba de introducir soporte nativo para este verbo HTTP con el nuevo método `Http::query()` y helpers de testing. En este artículo descubrirás cómo implementarlo correctamente en tus aplicaciones.

## ¿Qué es el verbo HTTP QUERY?

El verbo HTTP QUERY es una alternativa moderna a GET cuando necesitas enviar datos complejos en el cuerpo de una solicitud sin modificar el servidor. A diferencia de POST, QUERY es idempotente y seguro: múltiples solicitudes idénticas producen el mismo resultado sin efectos secundarios.

### Casos de uso comunes

- **Búsquedas avanzadas**: Filtros complejos que no caben en query strings
- **APIs de terceros**: Servicios que requieren datos estructurados sin mutar estado
- **Consultas de auditoría**: Logs y búsquedas sin modificar registros
- **Análisis de datos**: Consultas grandes a data warehouses

### Ventajas sobre POST y GET

```
┌─────────────────────────────────────────────────┐
│ Característica    │ GET  │ POST │ QUERY          │
├──────────────────┼──────┼──────┼────────────────┤
│ Idempotente      │ Sí   │ No   │ Sí             │
│ Seguro           │ Sí   │ No   │ Sí             │
│ Cuerpo           │ No   │ Sí   │ Sí             │
│ Cacheable        │ Sí   │ No   │ Sí (opcional)  │
└─────────────────────────────────────────────────┘
```

## Usando Http::query() en Laravel 13.19

El nuevo método `Http::query()` simplifica el envío de solicitudes QUERY con la misma API familiar que los otros métodos HTTP de Laravel.

### Sintaxis básica

```php
<?php

use Illuminate\Support\Facades\Http;

// Solicitud QUERY simple
$response = Http::query('https://api.ejemplo.com/search', [
    'filters' => [
        'status' => 'active',
        'category' => 'premium'
    ],
    'limit' => 50,
]);

// Con autenticación
$response = Http::withBasicAuth('user', 'pass')
    ->query('https://api.ejemplo.com/search', [
        'query' => 'laravel',
        'sort' => 'relevancia'
    ]);

// Con headers personalizados
$response = Http::withHeaders([
    'X-Custom-Header' => 'valor',
    'Authorization' => 'Bearer token'
])->query('https://api.ejemplo.com/search', [
    'advanced' => true
]);
```

### Ejemplo práctico: API de búsqueda de productos

Imagina que necesitas consultar un API que no permite filtros en query strings. Con QUERY puedes enviar datos estructurados:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ProductSearchService
{
    public function search(array $filters)
    {
        $response = Http::query('https://api.tienda.com/v1/products/search', [
            'filters' => [
                'price' => [
                    'min' => $filters['min_price'] ?? 0,
                    'max' => $filters['max_price'] ?? 10000,
                ],
                'categories' => $filters['categories'] ?? [],
                'brands' => $filters['brands'] ?? [],
                'inStock' => $filters['in_stock'] ?? true,
            ],
            'pagination' => [
                'page' => $filters['page'] ?? 1,
                'perPage' => $filters['per_page'] ?? 20,
            ],
            'sort' => [
                'field' => $filters['sort_field'] ?? 'relevancia',
                'order' => $filters['sort_order'] ?? 'desc',
            ]
        ]);

        if ($response->failed()) {
            throw new \Exception('Error en búsqueda: ' . $response->status());
        }

        return $response->json();
    }
}
```

### Uso en controladores

```php
<?php

namespace App\Http\Controllers;

use App\Services\ProductSearchService;

class SearchController extends Controller
{
    public function __construct(
        private ProductSearchService $searchService
    ) {}

    public function products()
    {
        $filters = request()->validate([
            'min_price' => 'nullable|numeric|min:0',
            'max_price' => 'nullable|numeric|min:0',
            'categories' => 'nullable|array',
            'categories.*' => 'string',
            'brands' => 'nullable|array',
            'brands.*' => 'string',
            'in_stock' => 'nullable|boolean',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'sort_field' => 'nullable|string|in:precio,relevancia,nuevos',
            'sort_order' => 'nullable|string|in:asc,desc',
        ]);

        $results = $this->searchService->search($filters);

        return response()->json([
            'success' => true,
            'data' => $results,
        ]);
    }
}
```

## Testing con queryJson()

Laravel 13.19 introduce el helper `queryJson()` para testear solicitudes QUERY. Esto es crucial para verificar que tu cliente HTTP funciona correctamente.

### Testing básico

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ProductSearchTest extends TestCase
{
    public function test_product_search_with_filters()
    {
        Http::fake([
            'api.tienda.com/v1/products/search' => Http::response([
                'products' => [
                    ['id' => 1, 'name' => 'Laptop', 'price' => 999],
                    ['id' => 2, 'name' => 'Mouse', 'price' => 29],
                ],
                'total' => 2
            ], 200),
        ]);

        $response = $this->getJson('/api/products/search?min_price=0&max_price=1000');

        $response->assertStatus(200)
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.total', 2);

        // Verificar que se realizó la solicitud QUERY correctamente
        Http::assertSent(function ($request) {
            return $request->method() === 'QUERY'
                && $request->url() === 'https://api.tienda.com/v1/products/search';
        });
    }
}
```

### Testing avanzado con queryJson()

```php
<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class AdvancedSearchTest extends TestCase
{
    public function test_query_with_complex_filters()
    {
        Http::fake();

        Http::queryJson('https://api.tienda.com/v1/search', [
            'filters' => [
                'status' => 'active',
                'nested' => [
                    'value' => 'test'
                ]
            ]
        ]);

        // Verificar que se envió correctamente
        Http::assertSent(function ($request) {
            return $request->method() === 'QUERY'
                && collect($request->data())->get('filters.status') === 'active';
        });
    }

    public function test_query_response_handling()
    {
        Http::fake([
            '*' => Http::sequence()
                ->push(['data' => 'first'], 200)
                ->push(['error' => 'Not found'], 404)
        ]);

        $first = Http::query('https://api.test.com/search', ['q' => 'test']);
        $second = Http::query('https://api.test.com/search', ['q' => 'fail']);

        $this->assertTrue($first->successful());
        $this->assertTrue($second->notFound());
    }
}
```

## Casos de uso reales en producción

### 1. Sistema de reportes con filtros dinámicos

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Http;

class ReportController extends Controller
{
    public function generate()
    {
        $filters = request()->validate([
            'date_from' => 'date',
            'date_to' => 'date',
            'departments' => 'array',
            'metrics' => 'array|required',
        ]);

        $response = Http::timeout(60)
            ->query('https://analytics.empresa.com/api/reports', [
                'filters' => [
                    'dateRange' => [
                        'from' => $filters['date_from'],
                        'to' => $filters['date_to'],
                    ],
                    'departments' => $filters['departments'],
                ],
                'metrics' => $filters['metrics'],
                'format' => 'json',
                'cache' => false, // QUERY se cachea, pero podemos forzar no-cache
            ]);

        return response()->json($response->json());
    }
}
```

### 2. Integración con motores de búsqueda

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class ElasticsearchService
{
    public function search(string $index, array $query)
    {
        $response = Http::query(
            "https://elasticsearch.ejemplo.com/{$index}/_search",
            [
                'query' => $query,
                'size' => 100,
                'aggs' => [
                    'categories' => [
                        'terms' => ['field' => 'category.keyword']
                    ]
                ]
            ]
        );

        return $response->json();
    }

    public function aggregateByCategory(array $filters)
    {
        return $this->search('products', [
            'bool' => [
                'must' => [
                    ['match' => ['status' => 'published']],
                    ['range' => ['price' => $filters['price_range']]]
                ],
                'filter' => [
                    ['terms' => ['category' => $filters['categories']]]
                ]
            ]
        ]);
    }
}
```

### 3. Auditoría con búsqueda compleja

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AuditLogService
{
    public function searchLogs(array $criteria)
    {
        return Http::withBasicAuth(
            config('services.audit.user'),
            config('services.audit.password')
        )
        ->query('https://audit-server.ejemplo.com/search', [
            'query' => [
                'user_id' => $criteria['user_id'] ?? null,
                'action' => $criteria['action'] ?? null,
                'resource_type' => $criteria['resource_type'] ?? null,
                'date_range' => [
                    'from' => $criteria['from_date'],
                    'to' => $criteria['to_date'],
                ],
                'status_codes' => $criteria['status_codes'] ?? [],
            ],
            'pagination' => [
                'page' => $criteria['page'] ?? 1,
                'limit' => min($criteria['limit'] ?? 50, 100),
            ]
        ])->json();
    }
}
```

## Configuración y mejores prácticas

### Timeout y reintentos

```php
<?php

// Configurar timeout
$response = Http::timeout(30)
    ->query('https://api.ejemplo.com/search', $data);

// Con reintentos automáticos
$response = Http::retry(3, 100) // 3 intentos con 100ms entre ellos
    ->query('https://api.ejemplo.com/search', $data);

// Combinado
$response = Http::timeout(30)
    ->retry(3, 100)
    ->query('https://api.ejemplo.com/search', $data);
```

### Compresión y encoding

```php
<?php

// Gzip compression
$response = Http::withHeaders([
    'Content-Encoding' => 'gzip',
    'Accept-Encoding' => 'gzip',
])
->query('https://api.ejemplo.com/search', $data);

// JSON encoding (por defecto)
$response = Http::asJson()
    ->query('https://api.ejemplo.com/search', $data);

// Form data encoding
$response = Http::asForm()
    ->query('https://api.ejemplo.com/search', $data);
```

### Logging y debugging

```php
<?php

// Registrar toda la solicitud
$response = Http::tap(function ($request) {
    \Log::info('QUERY Request', [
        'url' => $request->url(),
        'body' => $request->body(),
    ]);
})
->tap(function ($request, $response) {
    \Log::info('QUERY Response', [
        'status' => $response->status(),
        'time' => $response->getTransferTime(),
    ]);
})
->query('https://api.ejemplo.com/search', $data);
```

## Compatibilidad y soporte

El verbo QUERY está bien soportado en la mayoría de servidores modernos:

| Servidor | Soporte | Versión |
|----------|---------|---------|
| nginx    | ✅ Sí   | 1.11+   |
| Apache   | ✅ Sí   | 2.4.8+  |
| PHP FPM  | ✅ Sí   | 7.0+    |
| Laravel  | ✅ Sí   | 13.19+  |

Sin embargo, algunos proxies antiguos podrían no soportarlo. Siempre proporciona un fallback a POST si es necesario:

```php
<?php

public function searchWithFallback(array $data)
{
    try {
        return Http::query('https://api.ejemplo.com/search', $data);
    } catch (\Exception $e) {
        // Fallback a POST si QUERY no funciona
        \Log::warning('QUERY not supported, falling back to POST');
        return Http::post('https://api.ejemplo.com/search', $data);
    }
}
```

## Conclusión

El soporte para HTTP QUERY en Laravel 13.19 abre nuevas posibilidades para trabajar con APIs modernas que requieren enviar datos estructurados sin efectos secundarios. Es especialmente útil en búsquedas avanzadas, reportes complejos y consultas a servicios externos.

Recuerda que QUERY es idempotente y seguro, lo que lo hace ideal para operaciones de lectura con payloads complejos. Combina esta característica con los helpers de testing de Laravel para crear aplicaciones robustas y mantenibles.

## Puntos clave

- **QUERY es un verbo HTTP estándar** para consultas seguras e idempotentes con cuerpo
- **Http::query()** en Laravel 13.19 simplifica el envío de solicitudes