---
title: 'Concurrencia en Laravel 13: Executa Tareas Paralelas Eficientemente'
description: 'Aprende a ejecutar múltiples tareas en paralelo en Laravel 13 usando el gestor de concurrencia. Guía completa con ejemplos prácticos.'
pubDate: '2025-05-08'
tags: ['laravel', 'performance', 'concurrencia', 'php']
---

## Introducción

La concurrencia es uno de los desafíos más importantes en el desarrollo web moderno. Cuando necesitas ejecutar múltiples operaciones sin bloquear el flujo de tu aplicación, Laravel ofrece soluciones elegantes y poderosas.

Laravel 13 introduce mejoras significativas en el gestor de concurrencia, permitiéndote ejecutar tareas paralelas de forma segura y eficiente. Ya sea que necesites realizar múltiples llamadas a APIs, procesar datos en lotes o ejecutar operaciones de base de datos complejas, el sistema de concurrencia de Laravel te permite hacerlo sin complicaciones.

En esta guía, exploraremos cómo implementar concurrencia en tus proyectos Laravel, cuándo usarla y las mejores prácticas para evitar problemas comunes.

## ¿Qué es la Concurrencia en Laravel?

La concurrencia en Laravel se refiere a la capacidad de ejecutar múltiples tareas simultáneamente sin que una bloquee a la otra. Es importante distinguir entre:

**Concurrencia**: Múltiples tareas se ejecutan intercalándose (una después de otra muy rápidamente).

**Paralelismo**: Múltiples tareas se ejecutan realmente al mismo tiempo en diferentes núcleos del procesador.

Laravel abstrae estos detalles y proporciona una API unificada para trabajar con ambos escenarios. El framework detecta automáticamente qué driver usar basándose en tu configuración.

## Drivers de Concurrencia Disponibles

### Driver Sync (Por defecto)

Es el más simple pero también el más limitado. Ejecuta todas las tareas secuencialmente, una tras otra.

```php
use Illuminate\Support\Concurrent;

$results = Concurrent::run([
    'user' => fn () => User::find(1),
    'posts' => fn () => Post::where('user_id', 1)->get(),
    'comments' => fn () => Comment::where('user_id', 1)->get(),
]);

// Todos se ejecutan secuencialmente
dd($results);
```

### Driver Process

Utiliza procesos de PHP para ejecutar tareas en paralelo real. Es la opción más poderosa para concurrencia verdadera.

```php
// config/concurrency.php
'default' => env('CONCURRENCY_DRIVER', 'process'),

'drivers' => [
    'process' => [
        'driver' => 'process',
    ],
]
```

### Driver Fibers (PHP 8.1+)

Proporciona una forma más eficiente de manejar concurrencia usando Fibers, con menos sobrecarga que los procesos.

```php
// config/concurrency.php
'drivers' => [
    'fiber' => [
        'driver' => 'fiber',
    ],
]
```

## Implementación Básica de Concurrencia

### Ejecutar Tareas Paralelas Simples

El método `Concurrent::run()` es la forma más directa de ejecutar múltiples tareas en paralelo:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Concurrent;
use App\Models\User;
use App\Models\Post;

class DashboardController extends Controller
{
    public function index()
    {
        $results = Concurrent::run([
            'user' => fn () => User::find(auth()->id()),
            'recent_posts' => fn () => Post::latest()
                ->limit(10)
                ->get(),
            'total_likes' => fn () => Post::where('user_id', auth()->id())
                ->sum('likes_count'),
            'followers' => fn () => User::find(auth()->id())
                ->followers()
                ->count(),
        ]);

        return view('dashboard', $results);
    }
}
```

En este ejemplo, todas cuatro operaciones se ejecutan en paralelo, no secuencialmente. El tiempo total será aproximadamente el tiempo de la operación más lenta, no la suma de todas.

### Usando try-catch en Tareas Paralelas

Es crucial manejar excepciones correctamente en concurrencia:

```php
use Illuminate\Support\Concurrent;
use Illuminate\Concurrency\Manager;

$results = Concurrent::run([
    'primary_data' => function () {
        try {
            return $this->fetchFromPrimaryAPI();
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    },
    'secondary_data' => function () {
        try {
            return $this->fetchFromSecondaryAPI();
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    },
]);

// Procesa los resultados sabiendo que puede haber errores
foreach ($results as $key => $result) {
    if (isset($result['error'])) {
        Log::warning("Task $key failed: {$result['error']}");
    }
}
```

## Casos de Uso Prácticos

### Caso 1: Enriquecer Datos de Múltiples Fuentes

Imagina que necesitas construir un perfil de usuario desde múltiples APIs:

```php
<?php

namespace App\Services;

use Illuminate\Support\Concurrent;
use Illuminate\Support\Facades\Http;

class UserProfileService
{
    public function enrichUserProfile($userId)
    {
        $results = Concurrent::run([
            'github' => fn () => $this->fetchGitHubProfile($userId),
            'twitter' => fn () => $this->fetchTwitterProfile($userId),
            'linkedin' => fn () => $this->fetchLinkedInProfile($userId),
            'activity' => fn () => $this->fetchUserActivity($userId),
        ]);

        return new UserProfile(
            github: $results['github'],
            twitter: $results['twitter'],
            linkedin: $results['linkedin'],
            activity: $results['activity'],
        );
    }

    private function fetchGitHubProfile($userId)
    {
        return Http::get("https://api.github.com/users/$userId")->json();
    }

    private function fetchTwitterProfile($userId)
    {
        return Http::withToken(config('services.twitter.bearer'))
            ->get("https://api.twitter.com/2/users/$userId")
            ->json();
    }

    private function fetchLinkedInProfile($userId)
    {
        return Http::withToken(config('services.linkedin.token'))
            ->get("https://api.linkedin.com/v2/me")
            ->json();
    }

    private function fetchUserActivity($userId)
    {
        return auth()->user()
            ->activities()
            ->latest()
            ->limit(50)
            ->get();
    }
}
```

### Caso 2: Procesamiento de Lotes de Datos

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Concurrent;
use App\Models\Product;

class ProcessProductAnalytics implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function handle()
    {
        $products = Product::whereNull('analyzed_at')->get();

        // Procesa en lotes de 10 productos en paralelo
        $products->chunk(10)->each(function ($chunk) {
            $results = Concurrent::run(
                $chunk->mapWithKeys(fn ($product) => [
                    "product_{$product->id}" => fn () => $this->analyzeProduct($product),
                ])->toArray()
            );

            // Guarda resultados
            foreach ($results as $key => $analysis) {
                $productId = explode('_', $key)[1];
                Product::find($productId)->update([
                    'analysis' => $analysis,
                    'analyzed_at' => now(),
                ]);
            }
        });
    }

    private function analyzeProduct(Product $product)
    {
        return [
            'sentiment' => $this->analyzeSentiment($product->description),
            'keywords' => $this->extractKeywords($product->description),
            'category' => $this->categorizeProduct($product),
            'price_comparison' => $this->comparePrices($product),
        ];
    }

    private function analyzeSentiment($text)
    {
        // Implementar análisis de sentimiento
        return 'positive';
    }

    private function extractKeywords($text)
    {
        // Extraer palabras clave
        return explode(' ', $text);
    }

    private function categorizeProduct(Product $product)
    {
        // Categorizar producto
        return 'electronics';
    }

    private function comparePrices(Product $product)
    {
        // Comparar precios con competidores
        return 100;
    }
}
```

### Caso 3: Reportes Complejos

```php
<?php

namespace App\Services;

use Illuminate\Support\Concurrent;
use App\Models\Order;
use App\Models\Customer;
use App\Models\Product;

class ReportService
{
    public function generateMonthlyReport($year, $month)
    {
        $results = Concurrent::run([
            'sales' => fn () => $this->calculateSales($year, $month),
            'top_products' => fn () => $this->getTopProducts($year, $month),
            'customer_stats' => fn () => $this->getCustomerStatistics($year, $month),
            'revenue_by_category' => fn () => $this->getRevenueByCategory($year, $month),
            'growth_metrics' => fn () => $this->calculateGrowthMetrics($year, $month),
        ]);

        return $results;
    }

    private function calculateSales($year, $month)
    {
        return Order::whereYear('created_at', $year)
            ->whereMonth('created_at', $month)
            ->sum('total');
    }

    private function getTopProducts($year, $month)
    {
        return Product::whereHas('orders', function ($query) use ($year, $month) {
            $query->whereYear('created_at', $year)
                ->whereMonth('created_at', $month);
        })
        ->withCount(['orders' => function ($query) use ($year, $month) {
            $query->whereYear('created_at', $year)
                ->whereMonth('created_at', $month);
        }])
        ->orderByDesc('orders_count')
        ->limit(10)
        ->get();
    }

    private function getCustomerStatistics($year, $month)
    {
        return [
            'new' => Customer::whereYear('created_at', $year)
                ->whereMonth('created_at', $month)
                ->count(),
            'active' => Customer::whereHas('orders', function ($query) use ($year, $month) {
                $query->whereYear('created_at', $year)
                    ->whereMonth('created_at', $month);
            })->count(),
        ];
    }

    private function getRevenueByCategory($year, $month)
    {
        return Product::join('orders', 'products.id', '=', 'orders.product_id')
            ->whereYear('orders.created_at', $year)
            ->whereMonth('orders.created_at', $month)
            ->groupBy('products.category')
            ->selectRaw('products.category, SUM(orders.total) as revenue')
            ->get();
    }

    private function calculateGrowthMetrics($year, $month)
    {
        $currentMonth = Order::whereYear('created_at', $year)
            ->whereMonth('created_at', $month)
            ->sum('total');

        $previousMonth = Order::whereYear('created_at', $year)
            ->whereMonth('created_at', $month - 1)
            ->sum('total');

        return [
            'growth_percentage' => (($currentMonth - $previousMonth) / $previousMonth) * 100,
            'current' => $currentMonth,
            'previous' => $previousMonth,
        ];
    }
}
```

## Mejores Prácticas y Consideraciones

### 1. Evita Compartir Estado

Cada tarea debe ser independiente. No compartas variables mutables entre tareas:

```php
// ❌ MAL - Estado compartido
$counter = 0;
Concurrent::run([
    'task1' => fn () => $counter++, // Problema
    'task2' => fn () => $counter++, // Problema
]);

// ✅ BIEN - Cada tarea es independiente
Concurrent::run([
    'result1' => fn () => $this->processData($data1),
    'result2' => fn () => $this->processData($data2),
]);
```

### 2. Usa Tipos Adecuadamente

Laravel 13 mejora el soporte para tipos enum en el gestor de concurrencia:

```php
enum TaskType
{
    case Database;
    case API;
    case Cache;
}

$results = Concurrent::run([
    TaskType::Database->value => fn () => DB::query(),
    TaskType::API->value => fn () => Http::get(),
    TaskType::Cache->value => fn () => Cache::get(),
]);
```

### 3. Considera la Sobrecarga

La concurrencia no siempre es más rápida. Para operaciones muy rápidas, el overhead de crear procesos o fibers puede superar los beneficios:

```php
// ✅ Bueno para concurrencia
- Llamadas a APIs externas
- Operaciones de base de datos pesadas
- Procesamiento de imágenes
- Análisis de datos

// ❌ No recomendado para concurrencia
- Operaciones simples de cache
- Búsquedas en memoria
- Cálculos matemáticos simples
```

### 4. Monitorea y Optimiza

```php
$start = microtime(true);

$results = Concurrent::run([
    'task1' => fn () => $this->heavyOperation1(),
    'task2' => fn () => $this->heavyOperation2(),
]);

$elapsed = microtime(true) - $start;

Log::info("Concurrent tasks completed in {$elapsed}s");
```

## Integración con Queues

Para tareas más complejas, integra concurrencia con el sistema de colas:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Concurrent;
use App\Models\Report;

class GenerateReportConcurrently implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function __construct(public Report $report)
    {
    }

    public function handle()
    {
        $results = Concurrent::run([
            'section1' => fn () => $this->generateSection1(),
            'section2' => fn () => $this->generateSection2(),
            'section3' => fn () => $this->generateSection3(),
        ]);

        $this->report->update([
            'content' => $results,
            'generated_at' => now(),
        ]);
    }

    private function generateSection1() { }
    private function generateSection2() { }
    private function generateSection3() { }
}
```

## Debugging y Troubleshooting

### Problema: Las tareas se ejecutan secuencialmente

Verifica tu configuración de