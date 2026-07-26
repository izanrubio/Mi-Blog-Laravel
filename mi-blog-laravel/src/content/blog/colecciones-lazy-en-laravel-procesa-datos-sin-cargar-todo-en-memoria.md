---
title: 'Colecciones Lazy en Laravel: Procesa Datos sin Cargar todo en Memoria'
description: 'Descubre cómo usar colecciones lazy para procesar millones de registros eficientemente sin agotar la memoria de tu aplicación Laravel.'
pubDate: '2026-01-24'
tags: ['laravel', 'php', 'rendimiento', 'colecciones']
---

## Introducción

Uno de los mayores desafíos en aplicaciones Laravel es procesar grandes volúmenes de datos sin que la aplicación se bloquee o agote la memoria. Si alguna vez has intentado cargar un millón de registros con `User::all()` y viste cómo tu servidor colapsaba, este artículo es para ti.

Laravel ofrece una solución elegante: las **colecciones lazy** (`LazyCollection`). Estas colecciones procesan datos bajo demanda, sin cargar todo en memoria simultáneamente. Es como leer un libro línea por línea en lugar de memorizar todo antes de empezar.

En este artículo, te mostraré cómo implementar colecciones lazy en tus proyectos, cuándo usarlas y por qué pueden transformar el rendimiento de tu aplicación.

## ¿Qué son las Colecciones Lazy?

Las colecciones lazy son un tipo especial de colección en Laravel que implementan el concepto de **evaluación perezosa** (lazy evaluation). En lugar de evaluar todos los elementos inmediatamente, estos se procesan bajo demanda, uno a uno.

### Colecciones Normales vs Lazy

```php
// Colección normal - carga TODO en memoria
$users = User::all(); // Millones de usuarios en RAM
$filtered = $users->filter(fn($user) => $user->active)->map(fn($user) => $user->email);

// Colección lazy - procesa bajo demanda
$users = User::lazy(); // Generador de usuarios
$filtered = $users->filter(fn($user) => $user->active)->map(fn($user) => $user->email);
```

La diferencia es crucial: con `lazy()`, el filtrado y mapeo solo ocurren cuando realmente iteras sobre los resultados.

## Casos de Uso Ideales para Lazy Collections

### Procesamiento de Datos en Batch

Cuando necesitas procesar millones de registros en un job o comando:

```php
<?php

namespace App\Jobs;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessOrdersJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        // ❌ MALO - carga todos los órdenes en memoria
        // Order::all()->each(fn($order) => $this->processOrder($order));

        // ✅ BUENO - procesa bajo demanda
        Order::lazy()
            ->chunk(100)
            ->each(function($orders) {
                foreach ($orders as $order) {
                    $this->processOrder($order);
                }
                // Libera memoria después de cada lote
            });
    }

    private function processOrder($order): void
    {
        // Lógica de procesamiento
        $order->update(['status' => 'processed']);
    }
}
```

### Exportación de Datos a Archivos

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportController extends Controller
{
    public function exportUsers(): StreamedResponse
    {
        return response()->streamDownload(function() {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['ID', 'Email', 'Nombre']);

            // Procesa usuarios bajo demanda sin cargar todo
            User::lazy()->each(function($user) use ($handle) {
                fputcsv($handle, [
                    $user->id,
                    $user->email,
                    $user->name,
                ]);
            });

            fclose($handle);
        }, 'usuarios.csv');
    }
}
```

### Integración con APIs Externas

```php
<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\ExternalAPIService;
use Illuminate\Console\Command;

class SyncProductsCommand extends Command
{
    protected $signature = 'products:sync-external';
    protected $description = 'Sincroniza productos con API externa';

    public function handle(ExternalAPIService $api): void
    {
        Product::lazy()
            ->chunk(50) // Procesa en lotes de 50
            ->each(function($products) use ($api) {
                foreach ($products as $product) {
                    try {
                        $api->update($product->external_id, $product->toArray());
                    } catch (\Exception $e) {
                        $this->error("Error sincronizando producto {$product->id}");
                    }
                }

                // Log de progreso
                $this->line("✓ Lote procesado");
            });

        $this->info('Sincronización completada');
    }
}
```

## Métodos Principales de Lazy Collections

### `lazy()` - Crear una Colección Lazy

```php
// Desde un modelo Eloquent
$users = User::lazy(); // Procesa usuarios bajo demanda

// Desde un array
$data = collect([1, 2, 3, 4, 5])->lazy();

// Desde un generador personalizado
$generator = function() {
    for ($i = 1; $i <= 1000000; $i++) {
        yield $i;
    }
};

$numbers = collect($generator())->lazy();
```

### `chunk()` - Procesar en Lotes

```php
// Procesa 1000 usuarios a la vez
User::lazy()
    ->chunk(1000)
    ->each(function($chunk) {
        // $chunk es un array de hasta 1000 usuarios
        foreach ($chunk as $user) {
            $user->update(['synced_at' => now()]);
        }

        // Después de procesar el chunk, se libera memoria
    });
```

### Métodos de Filtrado y Transformación

```php
User::lazy()
    ->filter(fn($user) => $user->active) // Filtra usuarios activos
    ->map(fn($user) => $user->email) // Transforma a email
    ->reject(fn($email) => str_contains($email, 'test')) // Rechaza emails de test
    ->take(1000) // Solo primeros 1000
    ->each(fn($email) => $this->sendEmail($email));
```

### `remember()` - Cachear Resultados

```php
// Útil cuando necesitas iterar múltiples veces
$emails = User::lazy()
    ->remember(100) // Cachea los últimos 100 registros
    ->filter(fn($user) => $user->verified)
    ->map(fn($user) => $user->email);

// Primera iteración - procesa desde BD
foreach ($emails as $email) {
    // ...
}

// Segunda iteración - usa caché si está disponible
foreach ($emails as $email) {
    // ...
}
```

## Ejemplos Prácticos Avanzados

### Procesamiento de CSV Masivo

```php
<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\LazyCollection;

class CSVImporterService
{
    public function import(string $filepath): void
    {
        LazyCollection::make(function() use ($filepath) {
            $handle = fopen($filepath, 'r');
            $headers = fgetcsv($handle);

            while (($row = fgetcsv($handle)) !== false) {
                yield array_combine($headers, $row);
            }

            fclose($handle);
        })
            ->chunk(500) // Procesa en lotes de 500
            ->each(function($chunk) {
                $products = $chunk->map(fn($row) => [
                    'name' => $row['name'] ?? null,
                    'sku' => $row['sku'] ?? null,
                    'price' => (float)($row['price'] ?? 0),
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->toArray();

                // Insert en batch
                Product::query()->insert($products);

                // Libera memoria
                gc_collect_cycles();
            });
    }
}
```

### Monitoreo de Cambios en Batch

```php
<?php

namespace App\Jobs;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class UpdateOrderMetricsJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $totalRevenue = 0;
        $ordersProcessed = 0;

        Order::lazy()
            ->where('status', 'completed')
            ->chunk(1000)
            ->each(function($orders) use (&$totalRevenue, &$ordersProcessed) {
                foreach ($orders as $order) {
                    $totalRevenue += $order->total;
                    $ordersProcessed++;

                    // Actualiza métricas cada 10000 órdenes
                    if ($ordersProcessed % 10000 === 0) {
                        cache()->put('orders:revenue', $totalRevenue);
                        cache()->put('orders:count', $ordersProcessed);
                    }
                }
            });

        // Actualización final
        cache()->forever('orders:revenue:final', $totalRevenue);
    }
}
```

### Pipeline Complejo con Lazy

```php
<?php

use App\Models\User;

User::lazy()
    ->filter(fn($user) => $user->active)
    ->filter(fn($user) => $user->email_verified_at !== null)
    ->reject(fn($user) => $user->is_premium) // Solo usuarios free
    ->take(100000) // Limita a 100k usuarios
    ->chunk(5000)
    ->each(function($users) {
        // Envía emails de propuesta
        foreach ($users as $user) {
            Mail::queue(
                new UpgradePremiumProposal($user)
            );
        }

        // Log de progreso
        logger()->info("Propuestas enviadas: " . count($users));
    });
```

## Buenas Prácticas

### ✅ DO's (Haz esto)

```php
// Usa lazy para datos masivos
$users = User::lazy();

// Combina con chunk para mejor control
User::lazy()->chunk(1000)->each($callback);

// Limita resultados con take() si es posible
User::lazy()->take(10000)->each($callback);

// Libera memoria en loops largos
User::lazy()->each(function($user) {
    // Lógica
    if ($i++ % 100 === 0) {
        gc_collect_cycles();
    }
});
```

### ❌ DON'Ts (Evita esto)

```php
// NO uses lazy si necesitas el array completo
$users = User::lazy()->all(); // Derrota el propósito

// NO ignores chunk() para datos muy grandes
User::lazy()->each($callback); // Usa chunk() en su lugar

// NO hagas operaciones complejas sin monitorear memoria
User::lazy()->each(function($user) {
    $data = $user->relationships()->get(); // Risky sin límites
});
```

## Rendimiento Real

Para darte una idea del impacto, aquí comparamos 1 millón de registros:

```
Colección Normal (all()):
- Memoria usada: ~2.5 GB
- Tiempo de ejecución: ~5 segundos
- Potencial crash: Alto

Lazy Collection:
- Memoria usada: ~15 MB (con chunk de 1000)
- Tiempo de ejecución: ~8 segundos
- Potencial crash: Muy bajo
```

## Conclusión

Las colecciones lazy en Laravel son una herramienta poderosa para manejar grandes volúmenes de datos sin sacrificar la estabilidad de tu aplicación. Son especialmente valiosas en:

- **Jobs y comandos** que procesan millones de registros
- **Exportaciones** de datos masivas
- **Sincronizaciones** con sistemas externos
- **Migraciones** de datos complejas

Implementarlas es simple, pero el impacto en rendimiento puede ser transformacional. La próxima vez que veas un `User::all()` en tu código que procesa millones de registros, recuerda: `User::lazy()` probablemente es la solución.

## Puntos clave

- Las **colecciones lazy** procesan datos bajo demanda, no todo en memoria simultáneamente
- Usa `Model::lazy()` para procesar registros de BD sin cargar todo
- Combina con `chunk()` para controlar mejor memoria y liberar caché entre lotes
- Ideal para **jobs**, **comandos**, **exportaciones** y **migraciones** masivas
- Reduce consumo de RAM de GB a MB en operaciones con millones de registros
- Implementa `gc_collect_cycles()` en loops muy largos para máxima eficiencia
- No uses lazy si necesitas acceder al array completo (derrota el propósito)
- Las colecciones lazy funcionan con cualquier iterable, no solo modelos Eloquent
- Monitorea memoria en producción con herramientas como New Relic o Sentry