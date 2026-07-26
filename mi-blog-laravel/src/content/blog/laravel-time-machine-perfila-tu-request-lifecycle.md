---
title: 'Laravel Time Machine: Perfila tu Request Lifecycle'
description: 'Perfila cada etapa del ciclo de vida de Laravel. Detecta cuellos de botella, optimiza queries y mejora el rendimiento de tu aplicación.'
pubDate: '2026-07-22'
tags: ['laravel', 'performance', 'debugging', 'profiling']
---

## Laravel Time Machine: Perfila tu Request Lifecycle

Cuando desarrollamos aplicaciones Laravel, a menudo nos preguntamos: "¿Por qué esta request es tan lenta?". Las respuestas pueden venir de múltiples lugares: bootstrapping, middlewares, queries SQL, eventos, o lógica de aplicación. Laravel Time Machine es una herramienta que responde exactamente a esta pregunta, permitiéndote ver en detalle cada etapa del ciclo de vida de una request.

En este artículo, te mostraremos cómo usar Laravel Time Machine para identificar y resolver problemas de rendimiento en tus aplicaciones, con ejemplos prácticos que puedes implementar hoy mismo.

## ¿Qué es Laravel Time Machine?

Laravel Time Machine es un profiler especializado que captura y visualiza cada fase del ciclo de vida de una request HTTP en Laravel. Desde el bootstrap inicial hasta la terminación de la respuesta, esta herramienta te proporciona un timeline detallado con:

- **Duración de cada etapa** del ciclo de vida
- **Queries SQL** ejecutadas y su tiempo
- **Eventos** disparados
- **Middlewares** y su tiempo de ejecución
- **Memoria utilizada** en cada punto

A diferencia de tools genéricas como Telescope, Time Machine se enfoca específicamente en el flujo temporal de una request, lo que lo hace ideal para debugging de performance.

## Instalación y Configuración

Para comenzar, instala el paquete mediante Composer:

```bash
composer require --dev laravel/time-machine
```

Luego, publica la configuración:

```bash
php artisan vendor:publish --provider="Laravel\TimeMachine\TimeMachineServiceProvider"
```

Esto creará un archivo de configuración en `config/time-machine.php`:

```php
<?php

return [
    'enabled' => env('TIME_MACHINE_ENABLED', true),
    
    'storage' => env('TIME_MACHINE_STORAGE', 'file'),
    
    'file_path' => storage_path('time-machine'),
    
    'retention_days' => 7,
    
    'sample_rate' => env('TIME_MACHINE_SAMPLE_RATE', 100),
    
    'capture_queries' => true,
    
    'capture_events' => true,
    
    'slow_threshold' => env('TIME_MACHINE_SLOW_THRESHOLD', 1000),
];
```

## Accediendo al Dashboard

Una vez instalado, accede al dashboard en:

```
http://tu-app.local/time-machine
```

El dashboard te mostrará un timeline interactivo de todas las requests capturadas. Puedes hacer clic en cualquier request para ver sus detalles completos.

## Usando Time Machine en tu Aplicación

### Captura Manual de Checkpoints

Aunque Time Machine captura automáticamente las etapas principales, puedes agregar checkpoints personalizados en tu código:

```php
<?php

namespace App\Http\Controllers;

use TimeMachine;

class ProductController extends Controller
{
    public function index()
    {
        TimeMachine::checkpoint('fetching_products');
        
        $products = Product::with('category')->get();
        
        TimeMachine::checkpoint('processing_products');
        
        $formatted = $products->map(function ($product) {
            return [
                'id' => $product->id,
                'name' => $product->name,
                'price' => $product->price,
                'category' => $product->category->name,
            ];
        });
        
        TimeMachine::checkpoint('formatting_complete');
        
        return response()->json($formatted);
    }
}
```

Los checkpoints se mostrarán en el timeline, permitiéndote ver exactamente dónde se consume más tiempo.

### Etiquetando Información Contextual

Puedes agregar contexto adicional a tus checkpoints:

```php
TimeMachine::checkpoint('cache_lookup', [
    'key' => 'user_' . auth()->id(),
    'hit' => true,
    'time_saved_ms' => 45,
]);

TimeMachine::checkpoint('database_query', [
    'query' => 'SELECT * FROM products WHERE category = ?',
    'bindings' => ['electronics'],
    'rows_affected' => 245,
]);
```

## Identificando Cuellos de Botella

### Caso 1: Queries N+1

Una situación común es el problema N+1, donde ejecutamos múltiples queries innecesarias:

```php
// ❌ LENTO: N+1 queries
public function getUsersWithPosts()
{
    TimeMachine::checkpoint('start_user_fetch');
    
    $users = User::all(); // 1 query
    
    TimeMachine::checkpoint('users_fetched', ['count' => $users->count()]);
    
    foreach ($users as $user) {
        $posts = $user->posts; // N queries más (una por usuario)
    }
    
    TimeMachine::checkpoint('posts_loaded', ['total_queries' => count($users) + 1]);
}

// ✅ RÁPIDO: Eager loading
public function getUsersWithPosts()
{
    TimeMachine::checkpoint('start_user_fetch');
    
    $users = User::with('posts')->get(); // Solo 2 queries
    
    TimeMachine::checkpoint('data_loaded', ['queries' => 2]);
}
```

Al ver el timeline en el dashboard, verás inmediatamente la diferencia de tiempo entre ambos enfoques.

### Caso 2: Procesamiento Lento en el Loop

```php
// ❌ LENTO: Procesamiento síncrono pesado
public function importProducts(array $data)
{
    TimeMachine::checkpoint('import_start');
    
    foreach ($data as $item) {
        $product = new Product($item);
        $product->save();
        
        // Operación pesada en cada iteración
        $this->generateThumbnail($product->image);
        $this->updateSearchIndex($product);
    }
    
    TimeMachine::checkpoint('import_complete');
}

// ✅ RÁPIDO: Despacho a colas
public function importProducts(array $data)
{
    TimeMachine::checkpoint('import_start');
    
    Product::insert($data); // Inserción en batch
    
    TimeMachine::checkpoint('data_inserted');
    
    // Despachar trabajos pesados a cola
    Bus::batch($data)
        ->dispatch()
        ->then(function (Batch $batch) {
            TimeMachine::checkpoint('batch_jobs_queued');
        });
}
```

## Analizando el Timeline en Detalle

El dashboard de Time Machine muestra varias capas de información:

```
┌─ REQUEST TIMELINE ────────────────────────────────────────┐
│ 0ms      Bootstrap                           [████████] 45ms │
│ 45ms     Routing                             [██] 8ms        │
│ 53ms     Middleware Stack                    [████████] 42ms │
│ 95ms     Controller Execution                [██████████] 87ms│
│ 182ms    Response Rendering                  [███] 23ms      │
│ 205ms    TOTAL REQUEST TIME                                 │
└───────────────────────────────────────────────────────────┘
```

Dentro de "Controller Execution", verías tus checkpoints personalizados:

```
├─ start_user_fetch              0ms
├─ users_fetched                 45ms (25 usuarios)
├─ database_query_posts          82ms (25 queries)
└─ posts_loaded                  87ms (total 26 queries)
```

## Monitoreo de Memoria

Time Machine también rastrea el uso de memoria:

```php
public function processLargeFile($filePath)
{
    TimeMachine::checkpoint('start', [
        'memory_usage_mb' => memory_get_usage(true) / 1024 / 1024,
    ]);
    
    $file = fopen($filePath, 'r');
    
    while ($line = fgets($file)) {
        // Procesar línea por línea para mantener memoria baja
        $this->processLine($line);
    }
    
    fclose($file);
    
    TimeMachine::checkpoint('complete', [
        'memory_peak_mb' => memory_get_peak_usage(true) / 1024 / 1024,
        'memory_current_mb' => memory_get_usage(true) / 1024 / 1024,
    ]);
}
```

En el dashboard, verás cómo evoluciona la memoria a lo largo del ciclo de vida.

## Exportando Datos de Profiling

Para análisis más profundos, puedes exportar los datos del timeline:

```php
// En un comando o controlador
use TimeMachine;

$timeline = TimeMachine::getLastRequest();

$csv = "Checkpoint,Time (ms),Memory (MB),Context\n";
foreach ($timeline->checkpoints() as $checkpoint) {
    $csv .= sprintf(
        "%s,%d,%.2f,%s\n",
        $checkpoint->name,
        $checkpoint->elapsedMs(),
        $checkpoint->memoryMb(),
        json_encode($checkpoint->context())
    );
}

Storage::disk('local')->put('timeline.csv', $csv);
```

## Mejores Prácticas

### 1. Habilita Solo en Desarrollo

```php
// config/time-machine.php
'enabled' => app()->isLocal(),
```

### 2. Usa Sample Rate en Producción (si está habilitado)

```php
// Captura solo el 5% de requests
'sample_rate' => env('TIME_MACHINE_SAMPLE_RATE', 5),
```

### 3. Establece Thresholds para Alertas

```php
TimeMachine::setSlow(1000); // Alert si request > 1 segundo

// En tu middleware
if (TimeMachine::getLastRequest()->totalMs() > 1000) {
    Log::warning('Slow request detected', [
        'url' => request()->url(),
        'time' => TimeMachine::getLastRequest()->totalMs() . 'ms',
    ]);
}
```

### 4. Integra con tu Sistema de Monitoreo

```php
// En AppServiceProvider
use TimeMachine;

public function boot()
{
    if (app()->isProduction()) {
        TimeMachine::listen(function ($timeline) {
            if ($timeline->totalMs() > 2000) {
                // Enviar a tu sistema de monitoring
                Sentry::captureMessage('Slow request', [
                    'level' => 'warning',
                    'extra' => $timeline->toArray(),
                ]);
            }
        });
    }
}
```

## Ventajas sobre Otras Herramientas

| Característica | Time Machine | Telescope | Blackfire | Xdebug |
|---|---|---|---|---|
| Timeline visual | ✅ | ✅ | ✅ | ❌ |
| Overhead bajo | ✅ | ⚠️ | ❌ | ❌ |
| Focused en timing | ✅ | ❌ | ✅ | ❌ |
| SQL capture | ✅ | ✅ | ✅ | ⚠️ |
| Fácil de usar | ✅ | ✅ | ❌ | ❌ |

## Conclusión

Laravel Time Machine es una herramienta invaluable para desarrolladores que quieren entender y optimizar el rendimiento de sus aplicaciones. Proporcionando una vista clara y detallada del ciclo de vida de cada request, te permite identificar cuellos de botella con precisión quirúrgica.

Ya sea que estés depurando una aplicación lenta o simplemente quieras asegurar que tu código es eficiente, Time Machine te proporciona los datos visuales que necesitas para tomar decisiones informadas sobre optimización.

## Puntos clave

- **Laravel Time Machine** perfila cada etapa del ciclo de vida de una request
- Usa **checkpoints personalizados** para medir secciones específicas de tu código
- El **dashboard interactivo** facilita la identificación de cuellos de botella
- Integra con tu sistema de **monitoreo existente** para alertas automáticas
- **Sample rate** permite usar en producción con overhead mínimo
- Detecta problemas **N+1**, procesamiento lento y fugas de memoria
- La **visualización temporal** es superior a herramientas genéricas para profiling
- Exporta datos para análisis más profundos y reporting
- Mejor para desarrollo; con cuidado puedes usarlo en producción
- Combínalo con **eager loading** y **job dispatching** para máximo rendimiento