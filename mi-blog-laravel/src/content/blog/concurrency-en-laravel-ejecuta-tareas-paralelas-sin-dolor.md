---
title: 'Concurrency en Laravel: Ejecuta Tareas Paralelas sin Dolor'
description: 'Domina el Concurrency Manager de Laravel 13 para ejecutar tareas en paralelo. Guía completa con ejemplos reales y mejores prácticas.'
pubDate: '2026-05-03'
tags: ['laravel', 'performance', 'concurrency', 'php']
---

## Introducción

Uno de los mayores desafíos en desarrollo web es manejar múltiples operaciones que dependen unas de otras sin bloquear la ejecución. Laravel 13 introduce **Concurrency Manager**, una herramienta poderosa que permite ejecutar tareas en paralelo de manera sencilla y elegante.

Si alguna vez has necesitado:
- Llamar a múltiples APIs externas al mismo tiempo
- Procesar archivos en paralelo
- Consultar varias bases de datos simultáneamente
- Esperar que múltiples operaciones terminen antes de continuar

Entonces este artículo es para ti. Veremos cómo usar Concurrency de forma práctica y cómo evitar los errores más comunes.

## ¿Qué es Concurrency en Laravel?

Concurrency Manager es un patrón que te permite ejecutar múltiples tareas de forma asincrónica sin necesidad de usar colas o WebSockets. Es perfecto para operaciones síncronas que necesitan paralelismo temporal.

**Diferencia importante:**
- **Queues/Jobs:** Para tareas que no necesitan respuesta inmediata
- **Concurrency:** Para ejecutar múltiples operaciones y obtener resultados antes de continuar

Es como la diferencia entre enviar emails en background (colas) vs esperar respuestas de múltiples APIs al mismo tiempo (concurrency).

## Instalación y Configuración Básica

Concurrency viene incluido en Laravel 13. Si vienes de una versión anterior, asegúrate de actualizar:

```bash
composer update laravel/framework
```

No requiere configuración adicional. Está listo para usar inmediatamente en tus controladores, jobs o comandos.

## Tu Primer Ejemplo: Concurrency Básico

Imagina que necesitas obtener información de usuario desde múltiples servicios:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Concurrency\ConcurrencyManager;
use Illuminate\Support\Facades\Http;

class UserProfileController extends Controller
{
    public function show($userId)
    {
        $manager = new ConcurrencyManager();

        // Ejecutar múltiples tareas en paralelo
        [$user, $posts, $comments] = $manager->run([
            fn() => $this->fetchUser($userId),
            fn() => $this->fetchPosts($userId),
            fn() => $this->fetchComments($userId),
        ]);

        return view('profile', [
            'user' => $user,
            'posts' => $posts,
            'comments' => $comments,
        ]);
    }

    private function fetchUser($userId)
    {
        return Http::get("https://api.example.com/users/{$userId}")->json();
    }

    private function fetchPosts($userId)
    {
        return Http::get("https://api.example.com/users/{$userId}/posts")->json();
    }

    private function fetchComments($userId)
    {
        return Http::get("https://api.example.com/users/{$userId}/comments")->json();
    }
}
```

**¿Qué sucede aquí?**

1. `ConcurrencyManager::run()` recibe un array de closures
2. Ejecuta todas las tareas en paralelo
3. Espera a que todas terminen
4. Retorna los resultados en el mismo orden

Sin concurrency, esto tomaría ~3 segundos (suma de todas las peticiones). Con concurrency, toma solo ~1 segundo (el tiempo de la petición más lenta).

## Manejo de Errores en Operaciones Paralelas

Cuando trabajas con múltiples operaciones, los errores se vuelven críticos. Veamos cómo manejarlos:

### Opción 1: Try-Catch Dentro de Cada Closure

```php
$results = $manager->run([
    fn() => try {
        return Http::timeout(5)->get('https://api1.example.com/data')->json();
    } catch (Exception $e) {
        return ['error' => $e->getMessage()];
    },
    fn() => try {
        return Http::timeout(5)->get('https://api2.example.com/data')->json();
    } catch (Exception $e) {
        return ['error' => $e->getMessage()];
    },
]);

// Procesar resultados
foreach ($results as $result) {
    if (isset($result['error'])) {
        Log::warning('API Error: ' . $result['error']);
    }
}
```

### Opción 2: Usar Métodos Helper

```php
class ApiService
{
    public function safeApiCall($url, $timeout = 5)
    {
        try {
            return Http::timeout($timeout)->get($url)->json();
        } catch (\Exception $e) {
            report($e);
            return null;
        }
    }
}

// En el controlador
$service = app(ApiService::class);
$results = $manager->run([
    fn() => $service->safeApiCall('https://api1.example.com/data'),
    fn() => $service->safeApiCall('https://api2.example.com/data'),
    fn() => $service->safeApiCall('https://api3.example.com/data'),
]);
```

## Caso Real: Procesamiento de Múltiples Archivos

Supongamos que necesitas procesar varias imágenes y generar thumbnails en paralelo:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Concurrency\ConcurrencyManager;
use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;

class ImageProcessingController extends Controller
{
    public function processImages($productId)
    {
        $files = request()->file('images');
        $manager = new ConcurrencyManager();

        // Crear array de closures para procesar cada imagen
        $processingTasks = collect($files)->map(function ($file, $index) {
            return fn() => $this->processImage($file, $productId, $index);
        })->toArray();

        // Ejecutar todo en paralelo
        $results = $manager->run($processingTasks);

        // Guardar información en base de datos
        foreach ($results as $result) {
            if ($result['success']) {
                Product::find($result['product_id'])->images()->create([
                    'path' => $result['path'],
                    'thumbnail_path' => $result['thumbnail_path'],
                ]);
            }
        }

        return response()->json(['processed' => count($results)]);
    }

    private function processImage($file, $productId, $index)
    {
        try {
            $originalPath = "products/{$productId}/images/{$index}.jpg";
            $thumbnailPath = "products/{$productId}/thumbnails/{$index}.jpg";

            // Procesar imagen original
            $image = Image::make($file);
            Storage::put($originalPath, $image->encode('jpg', 80));

            // Generar thumbnail
            $thumbnail = $image->resize(200, 200);
            Storage::put($thumbnailPath, $thumbnail->encode('jpg', 80));

            return [
                'success' => true,
                'product_id' => $productId,
                'path' => $originalPath,
                'thumbnail_path' => $thumbnailPath,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
```

## Combinando Concurrency con Queues

A veces necesitas lo mejor de ambos mundos: procesar múltiples operaciones en paralelo **y** ejecutarlas en background.

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Concurrency\ConcurrencyManager;

class ProcessReportJob implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $reportId) {}

    public function handle()
    {
        $manager = new ConcurrencyManager();

        // Ejecutar múltiples subcálculos en paralelo
        [$sales, $expenses, $revenue] = $manager->run([
            fn() => $this->calculateSales(),
            fn() => $this->calculateExpenses(),
            fn() => $this->calculateRevenue(),
        ]);

        // Guardar resultado consolidado
        Report::find($this->reportId)->update([
            'sales' => $sales,
            'expenses' => $expenses,
            'revenue' => $revenue,
            'processed_at' => now(),
        ]);
    }

    private function calculateSales()
    {
        return Order::where('status', 'completed')
            ->sum('total');
    }

    private function calculateExpenses()
    {
        return Expense::sum('amount');
    }

    private function calculateRevenue()
    {
        return Invoice::where('paid', true)
            ->sum('amount');
    }
}
```

## Limitaciones y Consideraciones Importantes

### 1. Concurrency != Multithreading Real

Laravel's Concurrency no crea threads del sistema operativo. Es una forma elegante de orquestar operaciones I/O bound (HTTP calls, database queries) de forma no bloqueante.

```php
// ❌ Esto NO será más rápido con concurrency
$manager->run([
    fn() => expensiveCalculation(), // CPU-bound
    fn() => expensiveCalculation(), // CPU-bound
]);

// ✅ Esto SÍ será más rápido
$manager->run([
    fn() => Http::get('https://api1.com'),  // I/O-bound
    fn() => Http::get('https://api2.com'),  // I/O-bound
]);
```

### 2. Timeouts y Limites

Por defecto, no hay timeout global. Debes configurar timeouts en cada operación:

```php
$manager->run([
    fn() => Http::timeout(10)->get('url1'),
    fn() => Http::timeout(10)->get('url2'),
]);
```

### 3. Uso de Memoria

Ejecutar muchas operaciones pesadas en paralelo puede consumir mucha memoria. Siempre monitorea:

```php
$heavyTasks = [];
for ($i = 0; $i < 100; $i++) {
    $heavyTasks[] = fn() => $this->processLargeDataset($i);
}

// Dividir en chunks si es necesario
collect($heavyTasks)->chunk(10)->each(function ($chunk) {
    $manager->run($chunk->toArray());
});
```

## Comparativa: Antes vs Después

```php
// ❌ ANTES: Secuencial (3 segundos)
$start = microtime(true);

$user = Http::get('https://api.example.com/user/1')->json();
$posts = Http::get('https://api.example.com/posts/user/1')->json();
$comments = Http::get('https://api.example.com/comments/user/1')->json();

$duration = microtime(true) - $start; // ~3s

// ✅ DESPUÉS: Paralelo (1 segundo)
$start = microtime(true);

$manager = new ConcurrencyManager();
[$user, $posts, $comments] = $manager->run([
    fn() => Http::get('https://api.example.com/user/1')->json(),
    fn() => Http::get('https://api.example.com/posts/user/1')->json(),
    fn() => Http::get('https://api.example.com/comments/user/1')->json(),
]);

$duration = microtime(true) - $start; // ~1s
```

## Testing de Código con Concurrency

Al testear, necesitas asegurarte de que tus operaciones paralelas funcionan correctamente:

```php
<?php

namespace Tests\Feature;

use Illuminate\Concurrency\ConcurrencyManager;
use Tests\TestCase;

class ConcurrencyTest extends TestCase
{
    public function test_concurrent_operations_complete_successfully()
    {
        $manager = new ConcurrencyManager();

        $results = $manager->run([
            fn() => 1 + 1,
            fn() => 2 + 2,
            fn() => 3 + 3,
        ]);

        $this->assertEquals([2, 4, 6], $results);
    }

    public function test_concurrent_api_calls_handle_errors()
    {
        $manager = new ConcurrencyManager();

        // Usar Http::fake() para simular respuestas
        Http::fake([
            'api1.com/*' => Http::response(['status' => 'ok']),
            'api2.com/*' => Http::response(null, 500),
        ]);

        $results = $manager->run([
            fn() => try {
                return Http::get('https://api1.com/data')->json();
            } catch (\Exception $e) {
                return null;
            },
            fn() => try {
                return Http::get('https://api2.com/data')->json();
            } catch (\Exception $e) {
                return null;
            },
        ]);

        $this->assertNotNull($results[0]);
        $this->assertNull($results[1]);
    }
}
```

## Puntos Clave

- **Concurrency Manager** permite ejecutar múltiples tareas en paralelo y obtener resultados consolidados
- Es ideal para operaciones **I/O-bound** (HTTP calls, database queries), no para cálculos CPU-intensivos
- Siempre envuelve operaciones en try-catch para manejar errores de forma elegante
- Configura timeouts explícitos en cada operación para evitar bloqueos indefinidos
- Divide tareas pesadas en chunks si vas a procesar cientos de operaciones
- Usa concurrency dentro de jobs para combinar paralelismo con procesamiento en background
- Monitorea memoria cuando ejecutas muchas operaciones simultáneamente
- En tests, usa `Http::fake()` para simular respuestas y validar comportamiento
- Recuerda que no es multithreading real, sino orquestación eficiente de I/O