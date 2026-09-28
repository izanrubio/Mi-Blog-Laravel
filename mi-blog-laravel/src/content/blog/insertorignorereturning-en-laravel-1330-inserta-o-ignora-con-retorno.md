---
title: 'insertOrIgnoreReturning en Laravel 13.30: Inserta o Ignora con Retorno'
description: 'Aprende a usar insertOrIgnoreReturning() en Laravel 13.30 para insertar registros ignorando duplicados y obteniendo datos retornados sin complejidad.'
pubDate: '2025-01-15'
tags: ['laravel', 'eloquent', 'base-datos', 'laravel-13']
---

## insertOrIgnoreReturning en Laravel 13.30: Inserta o Ignora con Retorno

Laravel 13.30 introduce `insertOrIgnoreReturning()`, un método poderoso que combina la funcionalidad de inserción condicional con la capacidad de retornar datos. Esta adición es especialmente útil cuando necesitas insertar registros únicos y simultáneamente recuperar información sobre lo que se insertó, sin recurrir a queries complejas o múltiples operaciones de base de datos.

En esta guía práctica, descubrirás cómo implementar este método en tus aplicaciones, cuándo usarlo y qué ventajas te ofrece frente a otros enfoques tradicionales.

## ¿Qué es insertOrIgnoreReturning()?

`insertOrIgnoreReturning()` es un método del Query Builder de Laravel que realiza dos operaciones simultáneamente:

1. **Intenta insertar registros** ignorando errores de integridad (como duplicados en claves únicas)
2. **Retorna los registros insertados** (o sus IDs) sin cargar la aplicación con queries adicionales

Este método es particularmente valioso en bases de datos como PostgreSQL y SQL Server que soportan cláusulas `RETURNING`.

### Diferencia con métodos anteriores

Antes de Laravel 13.30, tenías que elegir:

- **`insertOrIgnore()`**: Insertaba o ignoraba, pero no retornaba nada
- **`insert()`**: Insertaba y retornaba IDs, pero fallaba con duplicados
- **Soluciones manuales**: Queries separadas o lógica condicional en tu aplicación

Ahora, `insertOrIgnoreReturning()` unifica estos casos de uso en una sola operación atómica.

## Sintaxis básica y ejemplos prácticos

### Ejemplo 1: Insertar registros de usuarios ignorando duplicados

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
    public function bulkImport()
    {
        $users = [
            ['email' => 'juan@example.com', 'name' => 'Juan'],
            ['email' => 'maria@example.com', 'name' => 'María'],
            ['email' => 'juan@example.com', 'name' => 'Juan Duplicado'], // Será ignorado
        ];

        // insertOrIgnoreReturning() retorna los registros insertados
        $insertedIds = DB::table('users')
            ->insertOrIgnoreReturning($users, 'id');

        // $insertedIds contendrá [1, 2]
        return response()->json(['inserted' => count($insertedIds)]);
    }
}
```

En este ejemplo:
- Se intentan insertar 3 registros
- El tercero se ignora porque `email` es único
- Se retornan los IDs de los registros insertados exitosamente

### Ejemplo 2: Trabajo con Eloquent y relaciones

```php
<?php

namespace App\Services;

use App\Models\Tag;
use Illuminate\Support\Facades\DB;

class TagService
{
    /**
     * Sincroniza tags, creando solo los nuevos
     */
    public function syncTags(array $tagNames): array
    {
        $data = array_map(
            fn($name) => ['name' => $name, 'slug' => \Str::slug($name)],
            $tagNames
        );

        // Retorna los IDs de los tags nuevos insertados
        $newTagIds = DB::table('tags')
            ->insertOrIgnoreReturning($data, 'id');

        return $newTagIds;
    }
}
```

### Ejemplo 3: Sistema de suscripciones con retorno de información

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\DB;

class ProcessSubscriptions implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable;

    public function handle()
    {
        $subscriptions = [
            [
                'user_id' => 1,
                'plan_id' => 'premium',
                'email' => 'user@example.com',
                'created_at' => now(),
            ],
            [
                'user_id' => 2,
                'plan_id' => 'basic',
                'email' => 'another@example.com',
                'created_at' => now(),
            ],
        ];

        // Obtiene los registros completos insertados (no solo IDs)
        $inserted = DB::table('subscriptions')
            ->insertOrIgnoreReturning($subscriptions);

        // Ahora puedes trabajar con los datos completos
        foreach ($inserted as $subscription) {
            \Log::info("Nueva suscripción: {$subscription->email}");
        }
    }
}
```

## Ventajas y casos de uso

### Ventaja 1: Rendimiento en operaciones masivas

```php
<?php

// ❌ Ineficiente: múltiples operaciones
$results = [];
foreach ($users as $user) {
    try {
        $created = DB::table('users')->insertOrIgnore([$user]);
        if ($created) {
            $results[] = $user['email'];
        }
    } catch (\Exception $e) {
        // Manejo de errores
    }
}

// ✅ Eficiente: una sola operación
$results = DB::table('users')
    ->insertOrIgnoreReturning($users, 'email');
```

### Ventaja 2: Atomicidad garantizada

Las transacciones se manejan a nivel de base de datos, no en tu aplicación:

```php
<?php

use Illuminate\Support\Facades\DB;

public function processOrderItems(array $items)
{
    return DB::transaction(function () use ($items) {
        $insertedIds = DB::table('order_items')
            ->insertOrIgnoreReturning($items, 'id');

        // Toda la operación es atómica
        return Order::query()
            ->create(['total_items' => count($insertedIds)]);
    });
}
```

### Ventaja 3: Compatibilidad con sistemas de caché

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class EmailSubscriberService
{
    public function addSubscribers(array $emails)
    {
        $data = array_map(
            fn($email) => ['email' => $email, 'verified' => false],
            $emails
        );

        $inserted = DB::table('subscribers')
            ->insertOrIgnoreReturning($data, 'id');

        // Invalida el caché de forma inteligente
        Cache::forget('subscribers_count');
        Cache::tags(['subscribers'])->flush();

        return $inserted;
    }
}
```

## Consideraciones técnicas importantes

### Compatibilidad con bases de datos

```php
<?php

// PostgreSQL ✅ Soporte completo
// SQL Server ✅ Soporte completo
// MySQL ✅ Pero verifica la versión (8.0+)
// SQLite ❌ No soporta RETURNING

// En MySQL 5.7 o anterior:
if ($this->databaseDoesntSupportReturning()) {
    return DB::table('users')
        ->insertOrIgnore($data);
}
```

### Manejo de errores y restricciones

```php
<?php

public function safeInsertWithFallback(array $data)
{
    try {
        $inserted = DB::table('products')
            ->insertOrIgnoreReturning($data, 'id');

        return [
            'success' => true,
            'inserted_ids' => $inserted,
            'count' => count($inserted)
        ];
    } catch (\Illuminate\Database\QueryException $e) {
        \Log::error("Insert error: " . $e->getMessage());

        return [
            'success' => false,
            'message' => 'No se pudo completar la inserción',
            'inserted_ids' => []
        ];
    }
}
```

### Performance en grandes volúmenes

```php
<?php

// Para millones de registros, usa chunks
public function processLargeDataset(array $allUsers)
{
    $chunkSize = 1000;
    $allInsertedIds = [];

    foreach (array_chunk($allUsers, $chunkSize) as $chunk) {
        $inserted = DB::table('users')
            ->insertOrIgnoreReturning($chunk, 'id');

        $allInsertedIds = array_merge($allInsertedIds, $inserted);

        // Evita saturar memoria
        gc_collect_cycles();
    }

    return $allInsertedIds;
}
```

## Integración con modelos Eloquent

### Usando eventos para registrar inserciones

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Events\Created;

class Tag extends Model
{
    protected $fillable = ['name', 'slug'];

    protected static function booted()
    {
        static::created(function ($tag) {
            \Log::info("New tag created: {$tag->name}");
        });
    }

    /**
     * Sincroniza tags usando insertOrIgnoreReturning
     */
    public static function syncFromArray(array $tags): array
    {
        $data = collect($tags)
            ->unique()
            ->map(fn($name) => [
                'name' => $name,
                'slug' => \Str::slug($name),
            ])
            ->toArray();

        return \DB::table('tags')
            ->insertOrIgnoreReturning($data, 'id');
    }
}
```

### Recuperar modelos después de la inserción

```php
<?php

public function importTagsAndGetModels(array $tagNames)
{
    $insertedIds = Tag::query()
        ->getQuery()
        ->insertOrIgnoreReturning(
            collect($tagNames)->map(fn($name) => [
                'name' => $name,
                'slug' => \Str::slug($name),
            ])->toArray(),
            'id'
        );

    // Retorna los modelos Eloquent
    return Tag::query()
        ->whereIn('id', $insertedIds)
        ->get();
}
```

## Comparativa: insertOrIgnoreReturning vs otras alternativas

```php
<?php

class UserImportComparison
{
    /**
     * ❌ Alternativa antigua: múltiples queries
     */
    public function oldApproach($users)
    {
        $result = [];
        foreach ($users as $user) {
            DB::table('users')->insertOrIgnore([$user]);
            $created = DB::table('users')
                ->where('email', $user['email'])
                ->first();
            $result[] = $created->id;
        }
        return $result; // N+1 queries
    }

    /**
     * ⚠️ Alternativa intermedia: insert + recuperación
     */
    public function middleApproach($users)
    {
        DB::table('users')->insertOrIgnore($users);
        return DB::table('users')
            ->whereIn('email', array_column($users, 'email'))
            ->pluck('id');
        // 2 queries, riesgo de race conditions
    }

    /**
     * ✅ Mejor: insertOrIgnoreReturning
     */
    public function newApproach($users)
    {
        return DB::table('users')
            ->insertOrIgnoreReturning($users, 'id');
        // 1 query, atómica, retorna exactamente lo insertado
    }
}
```

## Testing de insertOrIgnoreReturning

```php
<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Support\Facades\DB;

class InsertOrIgnoreReturningTest extends TestCase
{
    public function test_inserts_new_records_and_returns_ids()
    {
        $data = [
            ['email' => 'test1@example.com', 'name' => 'Test 1'],
            ['email' => 'test2@example.com', 'name' => 'Test 2'],
        ];

        $insertedIds = DB::table('users')
            ->insertOrIgnoreReturning($data, 'id');

        $this->assertCount(2, $insertedIds);
        $this->assertDatabaseHas('users', [
            'email' => 'test1@example.com'
        ]);
    }

    public function test_ignores_duplicate_entries()
    {
        DB::table('users')->insert([
            ['email' => 'existing@example.com', 'name' => 'Existing']
        ]);

        $data = [
            ['email' => 'existing@example.com', 'name' => 'Duplicate'],
            ['email' => 'new@example.com', 'name' => 'New'],
        ];

        $insertedIds = DB::table('users')
            ->insertOrIgnoreReturning($data, 'id');

        // Solo se insertó 1 registro nuevo
        $this->assertCount(1, $insertedIds);
    }
}
```

## Puntos clave

- **insertOrIgnoreReturning()** combina inserción condicional con retorno de datos en una sola operación atómica
- Es más eficiente que múltiples queries separadas o combinaciones de `insertOrIgnore()` + selección posterior
- Funciona perfectamente con PostgreSQL y SQL Server; verifica compatibilidad en MySQL
- Ideal para importaciones masivas, sincronización de datos y operaciones donde necesitas saber exactamente qué se insertó
- Reduce race conditions y proporciona consistencia garantizada a nivel de base de datos
- Permite chunking para procesar grandes volúmenes sin sobrecargar memoria
- Compatible con transacciones para operaciones multi-tabla complejas
- Mejora el rendimiento al eliminar N+1 queries en bucles de inserción
- Registra el campo específico que deseas retornar como segundo parámetro
- Siempre verifica la compatibilidad de tu base de datos antes de usar en producción