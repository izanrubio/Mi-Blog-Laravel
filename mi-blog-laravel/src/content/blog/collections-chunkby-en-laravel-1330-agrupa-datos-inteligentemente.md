---
title: 'Collections chunkBy() en Laravel 13.30: Agrupa Datos Inteligentemente'
description: 'Domina chunkBy() en Laravel 13.30 para agrupar colecciones por criterios dinámicos. Guía completa con ejemplos prácticos y casos de uso reales.'
pubDate: '2025-01-15'
tags: ['laravel', 'collections', 'php', 'laravel-13']
---

# Collections chunkBy() en Laravel 13.30: Agrupa Datos Inteligentemente

Laravel 13.30 introduce un método poderoso para las colecciones: `chunkBy()`. Este nuevo método revoluciona cómo agrupamos y dividimos datos en fragmentos basados en criterios personalizados, permitiendo operaciones más eficientes y código más legible.

Si trabajas frecuentemente con colecciones grandes o necesitas agrupar datos de forma dinámica, este método te ahorrará horas de código repetitivo.

## ¿Qué es chunkBy() y por qué lo necesitas?

Antes de Laravel 13.30, agrupar colecciones por criterios específicos requería bucles manuales o usar `chunk()` combinado con otras operaciones. `chunkBy()` simplifica este patrón común.

El método `chunkBy()` divide una colección en múltiples fragmentos, pero a diferencia de `chunk()` que divide por cantidad fija de elementos, `chunkBy()` agrupa elementos basándose en el resultado de una función callback.

**Caso de uso real:** Imagina que tienes una lista de transacciones y necesitas agruparlas por cliente. Con `chunkBy()`, obtienes fragmentos donde cada uno contiene solo las transacciones del mismo cliente, en el orden que aparecen en la colección.

## Sintaxis básica de chunkBy()

La sintaxis es straightforward:

```php
$collection->chunkBy(callable $callback): Collection
```

El callback recibe el elemento actual y debe retornar una clave para agrupar. Elementos consecutivos con la misma clave se agrupan en el mismo fragmento.

## Ejemplo 1: Agrupar por estado de transacciones

Veamos un caso práctico con transacciones financieras:

```php
use App\Models\Transaction;
use Illuminate\Support\Collection;

$transactions = collect([
    ['id' => 1, 'status' => 'completed', 'amount' => 100],
    ['id' => 2, 'status' => 'completed', 'amount' => 150],
    ['id' => 3, 'status' => 'pending', 'amount' => 200],
    ['id' => 4, 'status' => 'pending', 'amount' => 75],
    ['id' => 5, 'status' => 'completed', 'amount' => 300],
]);

$grouped = $transactions->chunkBy(fn($item) => $item['status']);

// Resultado:
// [
//     [
//         ['id' => 1, 'status' => 'completed', 'amount' => 100],
//         ['id' => 2, 'status' => 'completed', 'amount' => 150],
//     ],
//     [
//         ['id' => 3, 'status' => 'pending', 'amount' => 200],
//         ['id' => 4, 'status' => 'pending', 'amount' => 75],
//     ],
//     [
//         ['id' => 5, 'status' => 'completed', 'amount' => 300],
//     ],
// ]

foreach ($grouped as $chunk) {
    $status = $chunk->first()['status'];
    $total = $chunk->sum('amount');
    
    echo "Estado: $status, Total: $total\n";
}
```

**Punto importante:** `chunkBy()` mantiene el orden. Cuando el valor de agrupación cambia, se crea un nuevo fragmento. En el ejemplo anterior, aunque hay dos grupos "completed", se crean fragmentos separados porque hay un "pending" en el medio.

## Ejemplo 2: Agrupar logs por nivel de error

Un caso de uso real: procesar logs de aplicación y agruparlos por nivel consecutivo:

```php
$logs = collect([
    ['timestamp' => '10:00', 'level' => 'info', 'message' => 'Usuario conectado'],
    ['timestamp' => '10:01', 'level' => 'info', 'message' => 'Datos cargados'],
    ['timestamp' => '10:02', 'level' => 'warning', 'message' => 'Respuesta lenta'],
    ['timestamp' => '10:03', 'level' => 'warning', 'message' => 'Cache expirado'],
    ['timestamp' => '10:04', 'level' => 'error', 'message' => 'Conexión perdida'],
    ['timestamp' => '10:05', 'level' => 'error', 'message' => 'Reintentando...'],
    ['timestamp' => '10:06', 'level' => 'info', 'message' => 'Reconectado'],
]);

$logGroups = $logs->chunkBy(fn($log) => $log['level']);

// Procesa cada grupo de logs consecutivos del mismo nivel
$summary = $logGroups->map(function($group) {
    return [
        'level' => $group->first()['level'],
        'count' => $group->count(),
        'start_time' => $group->first()['timestamp'],
        'end_time' => $group->last()['timestamp'],
        'messages' => $group->pluck('message')->toArray(),
    ];
})->toArray();

// Resultado: Array con resúmenes de cada grupo de logs consecutivos
```

## Ejemplo 3: Agrupar pedidos por cliente en una lista de compras

Caso de uso en e-commerce: tienes una lista de items de múltiples clientes y necesitas procesarlos por cliente:

```php
$items = collect([
    ['customer_id' => 1, 'product' => 'Laptop', 'price' => 1000],
    ['customer_id' => 1, 'product' => 'Mouse', 'price' => 25],
    ['customer_id' => 2, 'product' => 'Teclado', 'price' => 80],
    ['customer_id' => 2, 'product' => 'Monitor', 'price' => 300],
    ['customer_id' => 2, 'product' => 'Cable HDMI', 'price' => 15],
    ['customer_id' => 1, 'product' => 'Mousepad', 'price' => 20],
]);

$customerOrders = $items->chunkBy(fn($item) => $item['customer_id']);

foreach ($customerOrders as $order) {
    $customerId = $order->first()['customer_id'];
    $total = $order->sum('price');
    $itemCount = $order->count();
    
    echo "Cliente: $customerId | Items: $itemCount | Total: \$$total\n";
}
// Output:
// Cliente: 1 | Items: 2 | Total: $1025
// Cliente: 2 | Items: 3 | Total: $395
// Cliente: 1 | Items: 1 | Total: $20
```

## Ejemplo 4: Procesar datos en batch por tipo

Supongamos que tienes eventos de usuario y necesitas procesarlos por tipo consecutivo:

```php
$events = collect([
    ['type' => 'click', 'element' => 'button-1', 'timestamp' => 1000],
    ['type' => 'click', 'element' => 'button-2', 'timestamp' => 1100],
    ['type' => 'scroll', 'element' => 'page', 'timestamp' => 1200],
    ['type' => 'scroll', 'element' => 'page', 'timestamp' => 1300],
    ['type' => 'scroll', 'element' => 'page', 'timestamp' => 1400],
    ['type' => 'click', 'element' => 'link', 'timestamp' => 1500],
]);

$eventBatches = $events->chunkBy(fn($event) => $event['type'])
    ->map(function($batch) {
        $type = $batch->first()['type'];
        $duration = $batch->last()['timestamp'] - $batch->first()['timestamp'];
        
        return [
            'type' => $type,
            'count' => $batch->count(),
            'duration_ms' => $duration,
            'elements' => $batch->pluck('element')->unique()->values()->toArray(),
        ];
    });

// Resultado perfecto para análisis de comportamiento de usuario
```

## Comparativa: chunkBy() vs chunk() vs groupBy()

Es importante entender cuándo usar cada método:

```php
$data = collect([1, 2, 3, 4, 5, 6]);

// chunk(): divide en trozos de N elementos
$data->chunk(2);
// [[1, 2], [3, 4], [5, 6]]

// groupBy(): agrupa por clave (sin importar orden)
$data->groupBy(fn($x) => $x % 2);
// [0 => [2, 4, 6], 1 => [1, 3, 5]]

// chunkBy(): agrupa por clave CONSECUTIVOS
$data->chunkBy(fn($x) => $x % 2);
// [[1], [2, 4, 6], [3, 5]]
```

**Regla práctica:**
- `chunk()`: cuando necesitas trozos de tamaño fijo
- `groupBy()`: cuando necesitas todos los elementos agrupados sin importar orden
- `chunkBy()`: cuando necesitas agrupar elementos CONSECUTIVOS con el mismo criterio

## Caso de uso avanzado: Procesamiento de cambios de estado

Aquí viene un ejemplo poderoso para detectar transiciones de estado:

```php
class OrderStatusTracker
{
    public static function analyzeStatusChanges(Collection $orders): Collection
    {
        return $orders
            ->sortBy('created_at')
            ->chunkBy(fn($order) => $order->customer_id)
            ->flatMap(function($customerOrders) {
                return [
                    'customer_id' => $customerOrders->first()->customer_id,
                    'orders' => $customerOrders->count(),
                    'status_transitions' => self::trackTransitions($customerOrders),
                ];
            });
    }
    
    private static function trackTransitions(Collection $orders): array
    {
        return $orders
            ->map(fn($order) => $order->status)
            ->chunkBy(fn($status) => $status)
            ->map(fn($group) => [
                'status' => $group->first(),
                'consecutive_count' => $group->count(),
            ])
            ->toArray();
    }
}

// Uso:
$analysis = OrderStatusTracker::analyzeStatusChanges(
    Order::all()
);
```

## Optimización y rendimiento

Algunos consejos para usar `chunkBy()` eficientemente:

```php
// ✅ BUENO: Usar en datos ya cargados en memoria
$data = collect($items)->chunkBy(fn($item) => $item->type);

// ❌ EVITAR: Cargar millones de registros en memoria
$items = Item::all()->chunkBy(...); // Muy pesado

// ✅ MEJOR: Usar en chunks de la base de datos
Item::lazy()
    ->chunk(1000)
    ->each(function($chunk) {
        $grouped = $chunk->chunkBy(fn($item) => $item->type);
        // Procesar cada grupo
    });

// ✅ ÓPTIMO: Agrupar en BD cuando sea posible
$grouped = Item::select('type')
    ->groupBy('type')
    ->get();
```

## Integración con Jobs de Cola

Un patrón útil es procesar chunks en jobs:

```php
namespace App\Jobs;

use Illuminate\Support\Collection;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class ProcessOrdersByStatus implements ShouldQueue
{
    use Queueable;
    
    public function __construct(private Collection $orders) {}
    
    public function handle(): void
    {
        $this->orders
            ->chunkBy(fn($order) => $order->status)
            ->each(function($statusGroup) {
                $status = $statusGroup->first()->status;
                
                // Despachar un job específico para cada estado
                ProcessOrderStatus::dispatch(
                    $status,
                    $statusGroup->pluck('id')->toArray()
                );
            });
    }
}
```

## Consideraciones de memoria

`chunkBy()` mantiene toda la colección en memoria. Para datasets muy grandes:

```php
// Para millones de registros, procesa en streaming:
DB::table('transactions')
    ->lazy(1000)
    ->chunkBy(function($transaction) {
        return $transaction->status;
    })
    ->each(function($statusGroup) {
        // Procesar grupo sin cargar todo en memoria
        Log::info("Procesando {$statusGroup->count()} transacciones");
    });
```

## Conclusión

El método `chunkBy()` en Laravel 13.30 es una adición elegante que simplifica un patrón común en procesamiento de datos. Es especialmente útil cuando necesitas:

- Agrupar elementos consecutivos por criterio
- Detectar cambios de estado o valor
- Procesar datos en lotes temáticos
- Hacer análisis de secuencias

Aunque `chunk()` y `groupBy()` cubrían muchos casos, `chunkBy()` es más intuitivo y eficiente para situaciones donde el orden y la consecutividad importan.

## Puntos clave

- **`chunkBy()`** agrupa elementos CONSECUTIVOS con el mismo valor de criterio
- Mantiene el **orden original** de los datos
- Crea un nuevo fragmento cuando el **criterio cambia**
- Ideal para procesar **cambios de estado, logs y eventos**
- No es lo mismo que **`groupBy()`** que agrupa sin importar orden
- Útil en **combinación con Jobs y Queues** para procesamiento
- Mejor que **`chunk()`** cuando el criterio es dinámico
- **Rendimiento**: Carga datos en memoria, úsalo con datos ya cargados
- Combina bien con **`lazy()`** para datasets muy grandes
- Retorna una **Colección de Colecciones** para procesamiento flexible