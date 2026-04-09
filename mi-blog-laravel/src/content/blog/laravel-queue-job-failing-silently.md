---
title: 'Queue job failing silently en Laravel — Cómo debuggear'
description: 'Aprende a debuggear jobs de cola que fallan silenciosamente en Laravel: failed_jobs table, QUEUE_FAILED_DRIVER, logging, retry y manejo de excepciones.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'queues', 'debug']
---

Los jobs de cola que fallan silenciosamente son especialmente frustrantes: el job se despacha, parece que se procesa, pero el resultado esperado nunca ocurre. No hay error visible, no hay excepción en la pantalla. Vamos a ver cómo detectar, debuggear y manejar estos fallos correctamente.

## Configurar la tabla failed_jobs

Lo primero es asegurarte de que tienes configurada la tabla de jobs fallidos:

```bash
# Crear la migración de failed_jobs (si no existe)
php artisan queue:failed-table

# Migrar
php artisan migrate
```

En el archivo `.env`:

```bash
QUEUE_CONNECTION=database
QUEUE_FAILED_DRIVER=database-uuids  # O simplemente 'database'
```

Con esto, cualquier job que falle después de agotar sus intentos se guardará en la tabla `failed_jobs` con el mensaje de error.

## Ver jobs fallidos

```bash
# Listar todos los jobs fallidos
php artisan queue:failed

# Ver el detalle de un job específico (por su ID)
php artisan queue:failed --queue=default

# Reintentar un job fallido específico
php artisan queue:retry abc-uuid-aqui

# Reintentar todos los jobs fallidos
php artisan queue:retry all

# Borrar un job fallido
php artisan queue:forget abc-uuid-aqui

# Borrar todos los jobs fallidos
php artisan queue:flush
```

La información más valiosa está en la columna `exception` de la tabla `failed_jobs`. Ahí encontrarás el stack trace completo del error.

## Ejecutar el worker con --verbose

En desarrollo, ejecuta el worker con el flag verbose para ver todo lo que pasa:

```bash
# Ver todos los eventos del worker
php artisan queue:work --verbose

# Procesar solo un job y parar (útil para debugging)
php artisan queue:work --once

# Con más detalle de errores
php artisan queue:work --verbose --tries=1
```

También puedes usar el driver `sync` en desarrollo para que los jobs se ejecuten de forma síncrona (sin cola real), lo que facilita ver los errores directamente:

```bash
# .env en desarrollo
QUEUE_CONNECTION=sync
```

Con `sync`, el job se ejecuta inmediatamente y cualquier excepción aparece en la respuesta HTTP o en la terminal.

## Implementar el método failed() en el Job

El método `failed()` del job se llama automáticamente cuando el job agota todos sus intentos:

```php
<?php

namespace App\Jobs;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Throwable;

class ProcessOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Número de intentos antes de marcar como fallido
    public int $tries = 3;

    // Timeout en segundos
    public int $timeout = 120;

    // Tiempo entre reintentos (en segundos)
    public int $backoff = 60;

    public function __construct(
        public Order $order
    ) {}

    public function handle(): void
    {
        // Lógica del job
        $this->processPayment($this->order);
        $this->sendConfirmationEmail($this->order);
    }

    /**
     * Manejo del fallo del job
     */
    public function failed(Throwable $exception): void
    {
        // Loguear el error
        \Log::error("Job ProcessOrderJob falló para order #{$this->order->id}", [
            'exception' => $exception->getMessage(),
            'trace'     => $exception->getTraceAsString(),
        ]);

        // Notificar al equipo
        // Notification::route('slack', config('services.slack.webhook'))
        //     ->notify(new JobFailedNotification($this->order, $exception));

        // Actualizar estado en la BD
        $this->order->update(['status' => 'payment_failed']);
    }

    private function processPayment(Order $order): void
    {
        // Llamada a servicio de pago
    }

    private function sendConfirmationEmail(Order $order): void
    {
        // Envío de email
    }
}
```

## Configurar backoff (tiempo entre reintentos)

En lugar de reintentar inmediatamente, puedes configurar un tiempo de espera entre intentos:

```php
// Tiempo fijo entre reintentos
public int $backoff = 60; // 60 segundos entre intentos

// Backoff exponencial (1min, 2min, 4min...)
public function backoff(): array
{
    return [60, 120, 240]; // Esperas para cada reintento
}
```

## El gotcha de ShouldBeUnique

`ShouldBeUnique` evita que el mismo job se procese varias veces en paralelo. Pero si el job falla y hay un lock activo, el siguiente intento también puede fallar silenciosamente porque el lock no se liberó:

```php
use Illuminate\Contracts\Queue\ShouldBeUnique;

class ProcessOrderJob implements ShouldQueue, ShouldBeUnique
{
    // La clave única (por defecto usa el nombre de la clase)
    public function uniqueId(): string
    {
        return $this->order->id;
    }

    // Tiempo que dura el lock (en segundos)
    public int $uniqueFor = 3600; // 1 hora
}
```

Si ves que un job nunca se reintenta, comprueba si tienes `ShouldBeUnique` y el lock está bloqueando.

## Logging dentro de los jobs

Añade logs estratégicos en tus jobs para rastrear el progreso:

```php
public function handle(): void
{
    \Log::info("Iniciando ProcessOrderJob", [
        'order_id' => $this->order->id,
        'attempt'  => $this->attempts(),
    ]);

    try {
        $result = $this->processPayment($this->order);
        
        \Log::info("Pago procesado exitosamente", [
            'order_id'       => $this->order->id,
            'transaction_id' => $result->transactionId,
        ]);
    } catch (\Exception $e) {
        \Log::error("Error procesando pago", [
            'order_id' => $this->order->id,
            'error'    => $e->getMessage(),
            'attempt'  => $this->attempts(),
        ]);
        
        // Re-lanzar para que el worker lo marque como fallido
        throw $e;
    }
}
```

El `$this->attempts()` te dice en qué intento va el job, muy útil para diagnóstico.

## Reintentar con condiciones específicas

A veces quieres reintentar solo para ciertos tipos de errores:

```php
use Illuminate\Queue\Middleware\RateLimited;

public function handle(): void
{
    try {
        $this->callExternalApi();
    } catch (ApiRateLimitException $e) {
        // Reintentar en 5 minutos para rate limits
        $this->release(300);
        return;
    } catch (ApiUnavailableException $e) {
        // Reintentar en 1 minuto para errores temporales
        $this->release(60);
        return;
    } catch (\Exception $e) {
        // Para otros errores, fallar inmediatamente
        $this->fail($e);
    }
}
```

`$this->release(seconds)` devuelve el job a la cola para reintentarlo después.
`$this->fail($exception)` marca el job como fallido inmediatamente sin esperar más intentos.

## Horizon para monitorización visual

Si usas Laravel Horizon (para Redis), tienes un dashboard visual:

```bash
composer require laravel/horizon
php artisan horizon:install
php artisan horizon
```

Y accede a `tu-app.test/horizon` para ver el estado de todos los jobs, failed jobs, métricas de throughput, etc.

## Conclusión

Los jobs que fallan silenciosamente dejan de ser silenciosos cuando tienes la tabla `failed_jobs` configurada, implementas el método `failed()` en tus jobs con logging apropiado, y ejecutas el worker con `--verbose` en desarrollo. Añade siempre `tries`, `timeout` y backoff apropiados a tus jobs para controlar el comportamiento ante fallos.
