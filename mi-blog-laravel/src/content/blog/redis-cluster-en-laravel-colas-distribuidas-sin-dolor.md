---
title: 'Redis Cluster en Laravel: Colas distribuidas sin dolor'
description: 'Aprende a configurar Redis Cluster para colas en Laravel 13.5. Guía completa con ejemplos de código para producción.'
pubDate: '2025-01-15'
tags: ['laravel', 'redis', 'queues', 'devops']
---

# Redis Cluster en Laravel: Colas distribuidas sin dolor

Si trabajas con aplicaciones Laravel en producción y tus colas comienzan a ser un cuello de botella, **Redis Cluster es tu solución**. Laravel 13.5 acaba de agregar soporte oficial para Redis Cluster en colas, eliminando las limitaciones de una instancia Redis simple.

En este artículo te mostraré cómo configurar, debuggear y optimizar colas distribuidas con Redis Cluster. Te ahorraré horas de investigación en la documentación oficial.

## ¿Por qué Redis Cluster y no una instancia simple?

Una instancia Redis simple tiene límites claros:

- **Throughput máximo**: ~100k operaciones/segundo en hardware decente
- **Memoria limitada**: Aunque tengas mucho RAM, todo está centralizado
- **Sin redundancia**: Si cae Redis, tus colas se pierden
- **Escalabilidad horizontal**: Imposible sin cambiar toda tu arquitectura

Redis Cluster resuelve todo esto:

```
┌─────────────────────────────────────────┐
│         Tu aplicación Laravel            │
├─────────────────────────────────────────┤
│   Queue, Cache, Sessions, etc.          │
├─────────────────────────────────────────┤
│  Redis Cluster (3-7 nodos mínimo)       │
├──────┬──────────────┬──────┬───────────┤
│Node1 │    Node2     │Node3 │   ...     │
│Shard │    Shard     │Shard │   Shard   │
└──────┴──────────────┴──────┴───────────┘
```

Con Cluster obtienes:
- **Particionamiento automático** de datos
- **Failover automático** si un nodo cae
- **Alta disponibilidad**
- **Escalabilidad real**

## Configuración básica de Redis Cluster

### Instalación de Redis Cluster

Primero, necesitas 3 nodos mínimo (recomendado 6: 3 maestros + 3 replicas).

**Con Docker Compose** (opción más rápida):

```yaml
version: '3.8'

services:
  redis-node-1:
    image: redis:7-alpine
    command: redis-server --port 6379 --cluster-enabled yes --cluster-config-file nodes-1.conf
    ports:
      - "6379:6379"
    volumes:
      - redis-1-data:/data

  redis-node-2:
    image: redis:7-alpine
    command: redis-server --port 6380 --cluster-enabled yes --cluster-config-file nodes-2.conf
    ports:
      - "6380:6380"
    volumes:
      - redis-2-data:/data

  redis-node-3:
    image: redis:7-alpine
    command: redis-server --port 6381 --cluster-enabled yes --cluster-config-file nodes-3.conf
    ports:
      - "6381:6381"
    volumes:
      - redis-3-data:/data

volumes:
  redis-1-data:
  redis-2-data:
  redis-3-data:
```

Levanta los nodos:

```bash
docker-compose up -d
```

Crea el cluster:

```bash
docker-compose exec redis-node-1 redis-cli --cluster create \
  127.0.0.1:6379 127.0.0.1:6380 127.0.0.1:6381 \
  --cluster-replicas 0
```

### Configuración en Laravel

Abre tu `.env`:

```env
QUEUE_CONNECTION=redis
REDIS_CLUSTER=true

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null
```

Luego configura `config/database.php`:

```php
'redis' => [
    'client' => env('REDIS_CLIENT', 'phpredis'),
    'options' => [
        'cluster' => env('REDIS_CLUSTER', false) ? 'cluster' : null,
    ],

    'cluster' => [
        [
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD', null),
            'port' => env('REDIS_PORT', 6379),
        ],
        [
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD', null),
            'port' => 6380,
        ],
        [
            'host' => env('REDIS_HOST', '127.0.0.1'),
            'password' => env('REDIS_PASSWORD', null),
            'port' => 6381,
        ],
    ],
],
```

También configura `config/queue.php`:

```php
'redis' => [
    'driver' => 'redis',
    'connection' => 'default',
    'queue' => env('REDIS_QUEUE', 'default'),
    'retry_after' => 90,
    'block_for' => null,
    'migration' => 'migrations',
    'cluster' => env('REDIS_CLUSTER', false),
],
```

## Creando colas para Cluster

Ahora que Cluster está configurado, crea un Job de ejemplo:

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\Middleware\RateLimited;
use Illuminate\Queue\Middleware\WithoutOverlapping;

class ProcessPayment implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $orderId,
        public float $amount
    ) {
        $this->onQueue('payments');
        $this->delay(5); // Espera 5 segundos
    }

    /**
     * Middlewares para controlar concurrencia
     */
    public function middleware(): array
    {
        return [
            new RateLimited('payments'),
            new WithoutOverlapping("payment-{$this->orderId}"),
        ];
    }

    public function handle(): void
    {
        logger()->info("Processing payment: {$this->orderId}");
        
        try {
            // Simula procesamiento
            sleep(2);
            logger()->info("Payment processed: {$this->orderId}");
        } catch (\Exception $e) {
            logger()->error("Payment failed: {$e->getMessage()}");
            throw $e;
        }
    }

    public function failed(\Throwable $exception): void
    {
        logger()->critical("Payment job permanently failed", [
            'order_id' => $this->orderId,
            'error' => $exception->getMessage(),
        ]);
    }
}
```

Despáchalo desde tu controlador:

```php
<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessPayment;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $order = Order::create($request->validated());

        // Despacha el job a la cola "payments"
        ProcessPayment::dispatch($order->id, $order->total)
            ->onQueue('payments');

        return response()->json(['id' => $order->id]);
    }
}
```

## Monitoreo de colas con Cluster

### Inspeccionar estado de colas

Laravel 13.4+ agregó métodos de inspección mejorados:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Queue;

class QueueStatus extends Command
{
    protected $signature = 'queue:status';

    public function handle()
    {
        $queue = Queue::connection('redis');

        // Total de jobs en cola
        $pending = $this->getQueueSize('default');
        $this->info("Pending jobs: {$pending}");

        // Jobs fallidos
        if (method_exists($queue, 'failed')) {
            $failed = $queue->getConnection()->llen('queues:failed');
            $this->info("Failed jobs: {$failed}");
        }

        return 0;
    }

    private function getQueueSize(string $queue): int
    {
        return \DB::connection('redis')
            ->llen("queues:{$queue}");
    }
}
```

Ejecútalo:

```bash
php artisan queue:status
```

### Dashboard en tiempo real

Crea un controlador para un dashboard:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Redis;

class QueueDashboard extends Controller
{
    public function index()
    {
        $redis = Redis::connection();
        
        $queues = ['default', 'payments', 'emails'];
        $stats = [];

        foreach ($queues as $queue) {
            $pending = $redis->llen("queues:{$queue}");
            $reserved = $redis->llen("queues:{$queue}:reserved");
            
            $stats[$queue] = [
                'pending' => $pending,
                'reserved' => $reserved,
                'total' => $pending + $reserved,
            ];
        }

        return view('queue-dashboard', ['stats' => $stats]);
    }
}
```

Vista Blade:

```blade
<div class="grid grid-cols-3 gap-4">
    @foreach ($stats as $queue => $data)
        <div class="bg-white p-4 rounded">
            <h3 class="font-bold">{{ $queue }}</h3>
            <p>Pending: <span class="text-blue-600">{{ $data['pending'] }}</span></p>
            <p>Reserved: <span class="text-orange-600">{{ $data['reserved'] }}</span></p>
            <p>Total: <span class="text-green-600">{{ $data['total'] }}</span></p>
        </div>
    @endforeach
</div>
```

## Configuración avanzada para Cluster

### Balanceo de colas

Distribuye diferentes tipos de jobs entre colas especializadas:

```php
// config/queue.php
'queues' => [
    'default' => env('REDIS_QUEUE', 'default'),
    'payments' => 'payments',        // Alta prioridad
    'emails' => 'emails',            // Baja prioridad
    'reports' => 'reports',          // Procesamiento pesado
],
```

Despácha según prioridad:

```php
// Job crítico
ProcessPayment::dispatch($order->id, $amount)
    ->onQueue('payments');

// Job normal
SendOrderEmail::dispatch($order->id)
    ->onQueue('emails')
    ->delay(now()->addMinute());

// Job pesado
GenerateReport::dispatch($year)
    ->onQueue('reports')
    ->delay(now()->addHours(2));
```

Ejecuta workers separados para cada cola:

```bash
# Terminal 1: Pagos (prioridad máxima)
php artisan queue:work redis --queue=payments --tries=3

# Terminal 2: Emails (prioridad media)
php artisan queue:work redis --queue=emails --tries=1

# Terminal 3: Reportes (prioridad baja)
php artisan queue:work redis --queue=reports --tries=5 --timeout=600
```

### Configuración SSL para Cluster en producción

Si usas Cluster en producción, protege las conexiones:

```php
// config/database.php
'redis' => [
    'client' => 'phpredis',
    'options' => [
        'cluster' => 'cluster',
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
            'allow_self_signed' => false,
        ],
    ],
    'cluster' => [
        [
            'scheme' => 'rediss', // Nota: rediss para SSL
            'host' => 'redis-1.example.com',
            'port' => 6379,
            'password' => env('REDIS_PASSWORD'),
        ],
        // ... más nodos
    ],
],
```

### Manejo de excepciones en Cluster

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Contracts\Queue\ShouldQueue;

class ClusterAwareJob implements ShouldQueue
{
    use InteractsWithQueue, Queueable, SerializesModels;

    public function handle()
    {
        try {
            // Tu lógica aquí
        } catch (\RedisException $e) {
            // Reintentar después
            logger()->warning("Redis connection lost: {$e->getMessage()}");
            $this->release(10); // Reintenta en 10 segundos
        }
    }

    /**
     * Máximo de intentos
     */
    public $tries = 5;

    /**
     * Tiempo antes de asumir que falló
     */
    public $timeout = 120;
}
```

## Testing con Redis Cluster

```php
<?php

namespace Tests\Feature;

use App\Jobs\ProcessPayment;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueueTest extends TestCase
{
    public function test_payment_job_dispatched_to_cluster()
    {
        Queue::fake();

        ProcessPayment::dispatch(123, 99.99);

        Queue::assertPushed(ProcessPayment::class, function ($job) {
            return $job->orderId === 123;
        });
    }

    public function test_cluster_handles_payment_processing()
    {
        // Test integración real con Cluster
        Queue::connection('redis')->push(
            new ProcessPayment(456, 199.99)
        );

        $this->artisan('queue:work', [
            '--max-jobs' => 1,
            '--max-time' => 60,
        ]);

        // Verifica que se procesó
        $this->assertTrue(true);
    }
}
```

## Troubleshooting común

### "Connection refused" en Cluster

Verifica que todos los nodos están activos:

```bash
redis-cli -p 6379 ping
redis-cli -p 6380 ping
redis-cli -p 6381 ping
```

Deberían responder `PONG`.

### Jobs se duplican entre nodos

Asegúrate de que cada worker proceso usa una conexión separada:

```bash
php artisan queue:work redis --sleep=3 --max-jobs=100
```

### Rendimiento degradado

Monitorea la latencia de red entre nodos:

```bash
redis-cli -p 6379 --latency
```

Si ves >10ms, investiga tu infraestructura de red.

## Puntos clave

- **Redis Cluster distribuye datos** automáticamente entre nodos usando hash slots
- **Failover automático**: Si un nodo cae, los replicas toman su lugar sin intervención
- **Configuración en Laravel 13.5+** es simple: solo activa `REDIS_CLUSTER=true`
- **Múltiples colas** (`payments`, `emails`, `reports`) permite priorizar jobs críticos
- **Monitoreo continuo** es esencial: revisa pending jobs, reserved, y failed
- **SSL en producción** protege tu conexión Redis contra ataques man-in-the-middle
- **Testing con Cluster** requiere conexión real, no solo Queue::fake()
- **Escalabilidad horizontal**: Agrega nodos sin parar tu aplicación