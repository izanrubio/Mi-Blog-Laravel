---
title: 'Laravel Chores: Operaciones Masivas Reanudables sin Pérdida'
description: 'Domina Laravel Chores para ejecutar backfills y limpiezas de datos en lotes recuperables que sobreviven deploys y crashes'
pubDate: '2026-08-19'
tags: ['laravel', 'jobs', 'chores', 'data-operations']
---

## Laravel Chores: Operaciones Masivas Reanudables sin Pérdida de Datos

Una de las tareas más complejas en aplicaciones Laravel es ejecutar operaciones de datos a gran escala sin perder progreso cuando algo falla. Migrar millones de registros, limpiar datos obsoletos o actualizar campos en backgrounds puede resultar en pérdida de datos o ejecución incompleta si tu servidor se cae o realizas un deploy en mitad del proceso.

**Laravel Chores** soluciona este problema exactamente: te permite ejecutar backfills, limpiezas y purgas de datos en lotes verificados que recuerdan exactamente dónde se quedaron, incluso después de un crash o redeploy. Es como un trabajador que toma notas sobre su progreso.

## ¿Qué es Laravel Chores y por qué la necesitas?

Laravel Chores es un paquete que transforma tus operaciones de datos masivas en procesos resilientes y monitoreables. En lugar de ejecutar una única query gigante que puede bloquear tu base de datos durante minutos, Chores divide el trabajo en lotes pequeños, cada uno con un checkpoint que verifica "he llegado hasta aquí".

**Casos de uso reales:**

- Migración de datos durante actualización de esquema
- Limpiar registros duplicados o obsoletos
- Actualizar campos calculados en millones de filas
- Purgar datos de auditoría o logs antiguos
- Reindexar o reorganizar datos sin downtime

Sin Chores, si tu job falla a mitad de proceso, tendrías que:
1. Identificar dónde se quedó (difícil sin logging manual)
2. Reanudar desde ese punto (casi imposible sin código custom)
3. Evitar procesar lo mismo dos veces (requiere lógica compleja)

Con Chores, todo esto es automático.

## Instalación y Configuración Básica

Primero, instala el paquete:

```bash
composer require laravel/chores
```

Luego publica la configuración:

```bash
php artisan vendor:publish --provider="Laravel\Chores\ChorersServiceProvider"
```

Esto crea el archivo `config/chores.php` donde defines el tamaño de lotes y comportamiento:

```php
// config/chores.php
return [
    'batch_size' => 1000, // Procesa 1000 registros a la vez
    'timeout' => 3600,    // 1 hora máximo por ejecución
    'retry_after' => 300, // Reintentar tras 5 minutos si falla
];
```

## Crear tu Primer Chore

Un "chore" es una clase que hereda de `Chore` y define qué hacer con cada lote. Crea uno con:

```bash
php artisan make:chore MigrateUserPhoneNumbers
```

Esto genera:

```php
namespace App\Chores;

use Laravel\Chores\Chore;

class MigrateUserPhoneNumbers extends Chore
{
    /**
     * Procesa cada lote de datos
     */
    public function handle()
    {
        // Aquí va tu lógica
    }
}
```

### Ejemplo 1: Limpiar Registros Duplicados

Imagina que tienes usuarios duplicados en tu base de datos y necesitas eliminar los segundos occurrences:

```php
namespace App\Chores;

use Laravel\Chores\Chore;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RemoveDuplicateUsers extends Chore
{
    public function handle()
    {
        // Encuentra usuarios con el mismo email, mantén el primero
        $duplicates = DB::table('users')
            ->selectRaw('email, MIN(id) as keep_id')
            ->groupBy('email')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            User::where('email', $duplicate->email)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
            
            $this->checkpoint($duplicate->email);
        }
    }
}
```

**¿Qué sucede aquí?**

1. Encuentra todos los emails duplicados
2. Para cada grupo duplicado, elimina todos excepto el primero
3. Llama a `$this->checkpoint()` después de procesar cada lote
4. Si el chore falla, se reanuda desde el último checkpoint

### Ejemplo 2: Migrar Datos a Nueva Tabla

Necesitas mover datos a una tabla nueva durante una refactorización:

```php
namespace App\Chores;

use Laravel\Chores\Chore;
use App\Models\LegacyOrder;
use App\Models\Order;

class MigrateLegacyOrders extends Chore
{
    public function handle()
    {
        LegacyOrder::query()
            ->orderBy('id')
            ->chunk(500, function ($orders) {
                foreach ($orders as $legacyOrder) {
                    Order::create([
                        'order_number' => $legacyOrder->number,
                        'customer_id' => $legacyOrder->user_id,
                        'total' => $legacyOrder->amount,
                        'status' => $this->mapStatus($legacyOrder->state),
                        'created_at' => $legacyOrder->created_at,
                    ]);
                    
                    $this->checkpoint($legacyOrder->id);
                }
            });
    }

    private function mapStatus($oldStatus): string
    {
        return match($oldStatus) {
            'pending' => 'awaiting_payment',
            'completed' => 'shipped',
            'cancelled' => 'cancelled',
            default => 'unknown',
        };
    }
}
```

Este chore:
- Lee la tabla legacy en lotes de 500
- Mapea campos automáticamente
- Marca progreso después de cada registro
- Si falla en el registro 15,000, reanuda desde 15,001

### Ejemplo 3: Actualizar Campos Calculados

Necesitas recalcular el saldo de cuentas basado en transacciones:

```php
namespace App\Chores;

use Laravel\Chores\Chore;
use App\Models\Account;
use App\Models\Transaction;

class RecalculateAccountBalances extends Chore
{
    public function handle()
    {
        Account::query()
            ->orderBy('id')
            ->eachById(function (Account $account) {
                $balance = Transaction::where('account_id', $account->id)
                    ->sum('amount');
                
                $account->update(['balance' => $balance]);
                
                $this->checkpoint("account_{$account->id}");
            }, 100); // 100 cuentas a la vez
    }
}
```

## Ejecución y Monitoreo

Ejecuta tu chore directamente:

```bash
php artisan chores:run MigrateUserPhoneNumbers
```

O programalo para ejecutarse en background:

```php
// En tu scheduler
$schedule->command('chores:run MigrateUserPhoneNumbers')
    ->daily();
```

Ver el estado de chores en ejecución:

```bash
php artisan chores:list
```

Output:
```
Chore                          Status       Progress
MigrateUserPhoneNumbers        Running      45,000 / 150,000
RemoveDuplicateUsers           Completed    8,500 / 8,500
```

## Características Avanzadas

### Pausar y Reanudar

Si necesitas pausar un chore durante horas pico:

```bash
php artisan chores:pause MigrateUserPhoneNumbers
php artisan chores:resume MigrateUserPhoneNumbers
```

### Reintentos Automáticos

Si un lote falla, Chores lo reintenta automáticamente:

```php
public function handle()
{
    try {
        // Tu operación
    } catch (Exception $e) {
        $this->fail($e->getMessage());
        // Se reintentar automáticamente después de 'retry_after'
    }
}
```

### Callbacks de Progreso

Ejecuta lógica específica cuando termina:

```bash
php artisan chores:run MigrateUserPhoneNumbers \
    --callback='\App\Callbacks\NotifyCompletion'
```

### Limitar Tiempo de Ejecución

Evita que un chore monopolice recursos:

```php
class MigrateUserPhoneNumbers extends Chore
{
    protected $timeout = 1800; // 30 minutos máximo
    
    public function handle()
    {
        // ...
    }
}
```

## Integración con Jobs y Events

Chores funciona perfectamente con el ecosistema de Laravel:

```php
// Ejecutar chore desde un job
namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Laravel\Chores\Chore;

class RunMigrationChore
{
    use Queueable;

    public function handle()
    {
        (new \App\Chores\MigrateUserPhoneNumbers())->run();
    }
}

// En tu controlador
Route::post('/admin/run-migration', function () {
    dispatch(new RunMigrationChore());
    return response()->json(['message' => 'Chore iniciado']);
});
```

## Mejores Prácticas

### 1. Haz Checkpoints Frecuentes

```php
// ✅ Bien - checkpoint cada registro
foreach ($items as $item) {
    process($item);
    $this->checkpoint($item->id); // Frecuente
}

// ❌ Evitar - checkpoint cada 10,000
for ($i = 0; $i < count($items); $i++) {
    process($items[$i]);
    if ($i % 10000 === 0) $this->checkpoint($i);
}
```

### 2. Usa Batch Size Apropiado

```php
// Para operaciones pesadas (1000 registros por vez)
protected $batchSize = 1000;

// Para operaciones rápidas (5000 registros por vez)
protected $batchSize = 5000;

// Para operaciones muy pesadas (100 registros por vez)
protected $batchSize = 100;
```

### 3. Valida Antes de Ejecutar

```php
public function handle()
{
    if ($this->hasProcessedBefore()) {
        $this->skip('Ya procesado anteriormente');
        return;
    }

    // Tu lógica...
}
```

### 4. Registra Progreso Detallado

```php
public function handle()
{
    $processed = 0;
    
    User::chunk(1000, function ($users) use (&$processed) {
        foreach ($users as $user) {
            process($user);
            $processed++;
            
            if ($processed % 5000 === 0) {
                \Log::info("Procesados: {$processed} usuarios");
                $this->checkpoint($user->id);
            }
        }
    });
}
```

## Solución de Problemas Comunes

### El Chore no Reanuda

Verifica que `$this->checkpoint()` se haya llamado:

```bash
php artisan tinker
> DB::table('chores_progress')->get();
```

### Timeout en la Mitad

Aumenta el timeout en `config/chores.php`:

```php
'timeout' => 7200, // 2 horas
```

### Memoria Agotada

Reduce el batch size:

```php
protected $batchSize = 500; // Más pequeño
```

## Conclusión

**Laravel Chores** transforma operaciones de datos masivas de algo frágil y arriesgado en procesos resilientes y monitoreables. Con checkpoints automáticos, reanudación inteligente y control fino sobre recursos, puedes migrar millones de registros sin perder una noche de sueño.

Es especialmente valioso durante refactorizaciones, migraciones de base de datos, y limpiezas de datos en producción donde la confiabilidad no es negociable.

## Puntos Clave

- **Chores divide operaciones masivas en lotes recuperables** con checkpoints automáticos
- **Sobrevive deploys y crashes**, reanudando exactamente donde se quedó
- **API simple**: hereda de `Chore`, implementa `handle()`, llama `checkpoint()`
- **Control fino**: batch size, timeouts, reintentos configurables
- **Monitoreo en vivo**: lista estado, pausa/reanuda desde CLI
- **Ideal para**: migraciones, limpiezas, backfills, purgas de datos
- **Se integra perfectamente** con Jobs, Events y el ecosistema Laravel
- **Evita perder datos** durante cambios de esquema o actualizaciones