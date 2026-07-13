---
title: 'Cache Locks en Laravel: Sincroniza Procesos sin Dolor'
description: 'Domina los cache locks en Laravel para evitar condiciones de carrera. Guía práctica con ejemplos reales de sincronización entre workers.'
pubDate: '2026-07-12'
tags: ['laravel', 'php', 'cache', 'concurrencia', 'performance']
---

## Cache Locks en Laravel: Sincroniza Procesos sin Dolor

Cuando trabajas con múltiples workers, colas paralelas o requests simultáneas, inevitablemente te encuentras con condiciones de carrera (race conditions). Dos procesos intentan modificar el mismo recurso al mismo tiempo, y el caos se desata.

Laravel ofrece una solución elegante y poco conocida: los **cache locks**. En este artículo te mostraré cómo usarlos correctamente para sincronizar acceso a recursos compartidos sin complicaciones.

## ¿Qué son los Cache Locks?

Un cache lock es un mecanismo de bloqueo distribuido que aprovecha tu sistema de caché (Redis, Memcached, etc.) para garantizar que solo un proceso acceda a una sección crítica de código a la vez.

A diferencia de los locks del sistema operativo, los cache locks funcionan incluso cuando tus procesos corren en servidores diferentes, siempre que compartan la misma instancia de caché.

```php
// Sin cache lock: dos workers pueden ejecutar esto simultáneamente
$user = User::find(1);
$user->balance -= 100;
$user->save();
```

```php
// Con cache lock: garantiza acceso exclusivo
Cache::lock('user-1-balance', timeout: 10)->block(5, function () {
    $user = User::find(1);
    $user->balance -= 100;
    $user->save();
});
```

## Sintaxis Básica de Cache Locks

### Creando un Lock

```php
use Illuminate\Support\Facades\Cache;

// Sintaxis básica
$lock = Cache::lock('mi-lock');

// Con opciones
$lock = Cache::lock(
    key: 'transferencia-bancaria',
    timeout: 30,           // Segundos hasta que se libera automáticamente
    owner: 'worker-1'      // Identificador opcional
);
```

El parámetro `timeout` es crucial: si el proceso se cuelga y no libera el lock, este se libera automáticamente después de los segundos especificados.

### Métodos de Bloqueo

#### 1. `block()` - Bloqueo Bloqueante

```php
Cache::lock('exportar-datos')->block(timeout: 30, callback: function () {
    // Este código solo se ejecuta cuando se obtiene el lock
    // Si el lock está ocupado, espera hasta 30 segundos
    
    \Log::info('Exportando datos...');
    ExportData::dispatch();
});
```

El proceso esperará hasta que:
- Se libere el lock (mejor caso)
- Expire el timeout del lock anterior
- Se agote el tiempo de espera especificado

#### 2. `get()` - Bloqueo No Bloqueante

```php
$lock = Cache::lock('procesar-pago');

// Intenta obtener el lock inmediatamente
if ($lock->get()) {
    try {
        ProcesarPago::ejecutar();
    } finally {
        $lock->release();
    }
} else {
    \Log::warning('No se pudo obtener el lock de pago');
    // Reintentar más tarde
}
```

## Casos de Uso Reales

### 1. Evitar Procesamiento Duplicado en Colas

```php
// En tu Job
class ProcessarPedido implements ShouldQueue
{
    public function handle()
    {
        // Solo un worker procesa cada pedido
        Cache::lock("pedido-{$this->pedido->id}", timeout: 60)
            ->block(30, function () {
                if ($this->pedido->ya_procesado) {
                    return; // Otro worker ya lo hizo
                }

                $this->pedido->procesar();
                $this->pedido->marcar_como_completado();
            });
    }
}
```

### 2. Sincronizar Operaciones Bancarias

```php
class TransferirDinero
{
    public static function transferir(User $origen, User $destino, float $monto)
    {
        // Garantiza que las transferencias de este usuario son secuenciales
        return Cache::lock(
            "usuario-{$origen->id}-transacciones",
            timeout: 60
        )->block(30, function () use ($origen, $destino, $monto) {
            $origen->refresh();
            
            if ($origen->balance < $monto) {
                throw new InsufficientFundsException();
            }

            DB::transaction(function () use ($origen, $destino, $monto) {
                $origen->decrement('balance', $monto);
                $destino->increment('balance', $monto);
                
                Transaccion::create([
                    'origen_id' => $origen->id,
                    'destino_id' => $destino->id,
                    'monto' => $monto,
                    'estado' => 'completada',
                ]);
            });
        });
    }
}
```

### 3. Generar Números Secuenciales Únicos

```php
class GenerarNumeroFactura
{
    public static function siguiente(): string
    {
        return Cache::lock('numero-factura', timeout: 10)->block(5, function () {
            $ultimaFactura = Factura::orderByDesc('numero')
                ->first();
            
            $numero = ($ultimaFactura->numero ?? 1000) + 1;
            
            return str_pad($numero, 8, '0', STR_PAD_LEFT);
        });
    }
}

// Uso
$numeroFactura = GenerarNumeroFactura::siguiente(); // FAC-0001001
```

## Evitar Deadlocks y Problemas Comunes

### Problema: Locks que Nunca se Liberan

```php
// ❌ MALO: Si ocurre una excepción, el lock nunca se libera
Cache::lock('mi-lock')->block(30, function () {
    $this->hacer_algo();           // Si falla...
    $this->hacer_algo_mas();       // ...nunca llegamos aquí
});

// ✅ BUENO: Usar try-finally
$lock = Cache::lock('mi-lock');
$lock->get();
try {
    $this->hacer_algo();
    $this->hacer_algo_mas();
} finally {
    $lock->release();
}

// ✅ MEJOR: Usar bloque y confiar en timeout
Cache::lock('mi-lock', timeout: 30)->block(30, function () {
    try {
        $this->hacer_algo();
        $this->hacer_algo_mas();
    } catch (\Exception $e) {
        \Log::error('Error en lock', ['error' => $e->message]);
        throw $e;
    }
});
```

### Problema: Múltiples Locks Bloqueándose Mutuamente

```php
// ❌ MALO: Deadlock potencial
// Proceso A: obtiene lock-1, luego intenta lock-2
// Proceso B: obtiene lock-2, luego intenta lock-1

Cache::lock('lock-1')->block(10, function () {
    // Hacer algo...
    Cache::lock('lock-2')->block(10, function () {
        // Deadlock potencial
    });
});

// ✅ BUENO: Usar orden consistente de locks
Cache::locks(['lock-1', 'lock-2'])->block(10, function () {
    // Ambos locks obtenidos en orden, sin riesgo de deadlock
});
```

### Problema: Timeouts Muy Cortos

```php
// ❌ MALO: Si la operación tarda más de 5 segundos, desastre
Cache::lock('exportar-datos', timeout: 5)->block(10, function () {
    $this->exportarMillonesDeRegistros(); // Esto tarda 30 segundos
});

// ✅ BUENO: Timeout suficiente para la operación + margen
Cache::lock('exportar-datos', timeout: 60)->block(10, function () {
    $this->exportarMillonesDeRegistros();
});
```

## Nuevo en Laravel 12.63+: Refresh de Locks

Desde Laravel 12.63, puedes refrescar un lock sin liberarlo, útil para operaciones largas:

```php
$lock = Cache::lock('operacion-larga', timeout: 30);
$lock->get();

try {
    foreach ($items as $item) {
        $this->procesarItem($item);
        
        // Si pasaron 25 segundos, refrescar el lock
        // Evita que expire mientras seguimos procesando
        if (time() % 25 === 0) {
            $lock->refresh();
        }
    }
} finally {
    $lock->release();
}
```

## Integración con Service Container

```php
// En AppServiceProvider
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function boot()
    {
        // Registrar un helper para locks comunes
        app()->bind('locks.transacciones', function () {
            return Cache::store('redis');
        });
    }
}

// Uso en tus clases
class ProcesarTransaccion
{
    public function procesar(Transaccion $transaccion)
    {
        app('locks.transacciones')
            ->lock("transaccion-{$transaccion->id}", timeout: 60)
            ->block(30, function () use ($transaccion) {
                $transaccion->procesar();
            });
    }
}
```

## Testing con Cache Locks

```php
use Illuminate\Support\Facades\Cache;

class TransferenciaTest extends TestCase
{
    public function test_transferencia_es_atomica()
    {
        $usuario1 = User::factory()->create(['balance' => 1000]);
        $usuario2 = User::factory()->create(['balance' => 0]);

        // Mock el lock para simular contención
        Cache::shouldReceive('lock')
            ->andReturnSelf()
            ->shouldReceive('block')
            ->andReturnUsing(function ($timeout, $callback) {
                return $callback();
            });

        TransferirDinero::transferir($usuario1, $usuario2, 500);

        $this->assertEquals(500, $usuario1->fresh()->balance);
        $this->assertEquals(500, $usuario2->fresh()->balance);
    }
}
```

## Monitoreo y Debugging

```php
class DebugLocks
{
    public static function obtenerEstado($key): ?array
    {
        // Los cache locks se guardan en caché con prefijo
        $lockKey = config('cache.prefix') . 'lock:' . $key;
        
        return Cache::store('redis')
            ->connection()
            ->get($lockKey);
    }

    public static function limpiarLockAtascado($key): bool
    {
        Cache::forget('lock:' . $key);
        return true;
    }
}

// Uso
DebugLocks::obtenerEstado('mi-lock');
DebugLocks::limpiarLockAtascado('mi-lock');
```

## Conclusión

Los cache locks son la herramienta que necesitas para evitar pesadillas de concurrencia en Laravel. Ya sea que construyas sistemas de pagos, generadores de IDs únicos o procesos distribuidos, los locks te permiten dormir tranquilo sabiendo que tus datos están seguros.

Recuerda:
- **Mantén los locks cortos**: entra, haz lo mínimo necesario, sal
- **Siempre establece timeouts adecuados**: ni muy cortos ni infinitos
- **Usa try-finally**: garantiza la liberación incluso con excepciones
- **Testing es crítico**: prueba condiciones de contención

Con estos principios, construirás aplicaciones más robustas y confiables.

## Puntos clave

- Los cache locks sincronizan acceso a recursos compartidos entre procesos y servidores
- Usa `block()` para esperar el lock y `get()` para obtenerlo inmediatamente
- El parámetro `timeout` previene deadlocks liberando automáticamente locks olvidados
- Siempre libera locks explícitamente o encapsula en try-finally para evitar bloqueos permanentes
- Establece timeouts suficientemente largos para que tu operación complete sin problemas
- Múltiples locks deben obtenerse en orden consistente para evitar deadlocks mutuos
- Redis es el backend ideal para cache locks en producción por su velocidad y confiabilidad
- El método `refresh()` (Laravel 12.63+) permite extender la duración del lock durante operaciones largas
- Los cache locks son efectivos para evitar duplicación en colas, sincronizar operaciones críticas y generar secuencias únicas
- Monitorea locks atascados en producción implementando herramientas de debugging