---
title: 'Watchtower en Laravel: Dashboard de Control Total'
description: 'Monitorea schedules, queues y errores en producción con Watchtower. Controla tareas, reintenta jobs y resuelve errores desde un dashboard integrado.'
pubDate: '2026-06-24'
tags: ['laravel', 'monitoring', 'queues', 'scheduling', 'production']
---

# Watchtower en Laravel: Dashboard de Control Total para Schedules, Queues y Errores

Si gestionar tareas programadas, colas de trabajo y errores en producción se siente como estar en la oscuridad, **Watchtower** es exactamente lo que necesitas. Este paquete Laravel transforma la forma en que monitorizas y controlas la ejecución de tu aplicación, brindándote un dashboard centralizado donde ves todo lo que sucede.

A diferencia de soluciones como **Vigilance** (que comentamos en artículos anteriores), Watchtower va más allá: no solo registra, sino que **actúa**. Reintenta jobs masivamente, ejecuta tareas programadas bajo demanda y resuelve errores directamente desde la interfaz.

## ¿Qué es Watchtower y por qué lo necesitas?

**Watchtower** es un paquete creado por Devifyo que consolida el monitoreo de tres aspectos críticos de cualquier aplicación Laravel:

1. **Scheduled Tasks** — Tareas cron que se ejecutan regularmente
2. **Queues & Jobs** — Trabajos en segundo plano
3. **Exceptions** — Errores y fallos en la aplicación

Mientras que Laravel Horizon es excelente para colas Redis, Watchtower funciona con **cualquier driver de colas** (Sync, Database, Redis, SQS, etc.) y añade un nivel de control que Horizon no proporciona: la capacidad de ejecutar tareas bajo demanda y reintentarlas en lote.

### Diferencia con Vigilance

Ambos dashboards son self-hosted y producción-ready, pero:

- **Vigilance**: Enfocado en auditoría y observabilidad con sampling para producción
- **Watchtower**: Enfocado en control activo: ejecuta, reintenta y resuelve directamente desde el dashboard

## Instalación y configuración inicial

La instalación es sencilla como cualquier paquete Laravel:

```bash
composer require devifyo/watchtower
```

Luego publica los assets y migraciones:

```bash
php artisan vendor:publish --provider="Devifyo\Watchtower\WatchtowerServiceProvider"
php artisan migrate
```

Registra el proveedor en `config/app.php` si no se añade automáticamente:

```php
'providers' => [
    // ...
    Devifyo\Watchtower\WatchtowerServiceProvider::class,
],
```

Finalmente, accede al dashboard en `http://tuapp.com/watchtower`.

### Configuración básica

Watchtower se configura a través del archivo `config/watchtower.php` que se genera automáticamente:

```php
return [
    'enabled' => env('WATCHTOWER_ENABLED', true),
    'path' => env('WATCHTOWER_PATH', 'watchtower'),
    'middleware' => ['web', 'auth'],
    
    // Qué tipo de eventos registrar
    'monitor' => [
        'scheduled_tasks' => true,
        'queued_jobs' => true,
        'exceptions' => true,
    ],
    
    // Retención de datos (en días)
    'retention' => [
        'events' => 30,
        'exceptions' => 60,
    ],
];
```

Lo más importante: **protege el dashboard** con middleware de autenticación. Si lo necesitas en producción, añade un middleware custom:

```php
'middleware' => ['web', 'auth', 'can:access-watchtower'],
```

## Monitoreo de Scheduled Tasks

Una de las grandes ventajas de Watchtower es que **ves todas tus tareas programadas en tiempo real**.

### Registrar automáticamente tus schedules

Si utilizas el `Schedule` de Laravel en `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('sync:users')
        ->daily()
        ->name('Sincronizar usuarios');
    
    $schedule->job(new ProcessLargeExport())
        ->hourly()
        ->name('Exportar datos');
    
    $schedule->call(function () {
        Cache::forget('stats');
    })
        ->everyFiveMinutes()
        ->name('Limpiar caché de estadísticas');
}
```

Watchtower captura automáticamente estas tareas y muestra:

- Cuándo se ejecutó la última vez
- Si completó exitosamente o falló
- Tiempo de ejecución
- Output y errores

### Ejecutar tareas bajo demanda desde el dashboard

La magia ocurre cuando necesitas ejecutar una tarea **ahora mismo**, sin esperar al siguiente ciclo. En el dashboard de Watchtower:

1. Localiza la tarea en la lista
2. Haz clic en "Run Now"
3. Observa la ejecución en tiempo real
4. Revisa el output y resultado

Programáticamente, también puedes trigger eventos:

```php
use Devifyo\Watchtower\Events\ScheduleExecuted;

// Desde un controlador o comando
ScheduleExecuted::dispatch($scheduleName, true);
```

## Control de Colas y Jobs

Watchtower transforma la forma en que gestionas colas, especialmente en producción.

### Registrar jobs automáticamente

Tus jobs se registran automáticamente sin configuración extra:

```php
// app/Jobs/SendNewsletterEmail.php
class SendNewsletterEmail implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public Newsletter $newsletter
    ) {}

    public function handle()
    {
        // Enviar newsletter...
    }
}
```

Una vez despachado:

```php
SendNewsletterEmail::dispatch($newsletter);
```

Watchtower registra:

- **Estado**: Pendiente, en proceso, completado, fallido
- **Intentos**: Cuántos reintentarás
- **Próxima ejecución**: Si está programado reintentar
- **Queue**: En qué cola está
- **Errores**: Stack trace completo si falló

### Reintentos masivos desde el dashboard

El poder real está en **reintentar jobs fallidos en lote**:

1. Navega a la sección "Failed Jobs"
2. Filtra por tipo, fecha o queue
3. Selecciona los jobs que deseas reintentar
4. Haz clic en "Retry Selected"

Sin tocar CLI, sin escribir comandos custom, sin downtime.

### Monitoreo avanzado de jobs

Puedes crear eventos custom para registrar progreso de jobs largos:

```php
class ProcessLargeDataset implements ShouldQueue
{
    public function handle()
    {
        $items = Item::all();
        $total = $items->count();
        
        $items->each(function ($item, $index) use ($total) {
            // Procesar item
            $item->process();
            
            // Registrar progreso en Watchtower
            event(new JobProgress(
                jobId: $this->job->getJobId(),
                progress: ($index / $total) * 100,
                message: "Procesados {$index} de {$total} items"
            ));
        });
    }
}
```

En el dashboard, ves el progreso en tiempo real.

## Gestión de Excepciones y Errores

### Captura automática de errores

Watchtower integra con el exception handler de Laravel:

```php
// app/Exceptions/Handler.php
use Devifyo\Watchtower\Facades\Watchtower;

public function register()
{
    $this->reportable(function (Exception $exception) {
        Watchtower::recordException($exception);
    });
}
```

En el dashboard ves:

- **Stack trace completo** — línea exacta del error
- **Contexto** — usuario, URL, método HTTP
- **Frecuencia** — cuántas veces ocurrió
- **Última ocurrencia** — cuándo pasó
- **Resolución** — marcarlo como resuelto

### Filtrar y buscar errores

El dashboard permite filtrar excepciones por:

```
- Tipo de excepción (ValidationException, ModelNotFoundException, etc.)
- Página/ruta donde ocurrió
- Usuario afectado
- Rango de fechas
```

### Alertas automáticas

Puedes configurar alertas cuando ocurren ciertos errores críticos:

```php
// config/watchtower.php
'alerts' => [
    'exceptions' => [
        'QueryException' => 'email:admin@app.com',
        'PaymentException' => 'slack:critical-errors',
        '*' => 'database', // Registrar todo en base de datos
    ],
],
```

## Casos de uso en producción

### Escenario 1: Sincronización fallida

Tu tarea programada que sincroniza datos con una API externa falló:

```
Sin Watchtower: Descubres a las 9 AM que falló a las 2 AM y ya perdiste 7 horas de sincronización
Con Watchtower: Ves el error al instante, lo investigas, lo corriges y ejecutas "Run Now" para recuperar datos
```

### Escenario 2: Job queue saturada

Tienes 10,000 jobs en tu queue de "envío de emails":

```
Sin Watchtower: Usas CLI → php artisan queue:work, esperas, ves errores en logs si tienes suerte
Con Watchtower: Dashboard muestra qué tipo de jobs fallan, aplicas un filtro, reintenta los 532 que fallaron por timeout
```

### Escenario 3: Error crítico detectado

Un usuario reporta "No puedo comprar". En Watchtower:

1. Busca excepciones de hoy
2. Encuentra `PaymentGatewayException` ocurrida hace 5 minutos
3. Ve que afectó a 23 usuarios
4. Revisa el stack trace: error de conexión a API
5. La API se recuperó, retira esos 23 jobs fallidos
6. Problema resuelto en 2 minutos

## Mejores prácticas

### 1. Asegura el acceso

```php
// config/watchtower.php
'middleware' => ['web', 'auth', AuthorizeWatchtower::class],
```

```php
// app/Http/Middleware/AuthorizeWatchtower.php
public function handle($request, $next)
{
    if (!$request->user()?->is_admin) {
        abort(403);
    }
    return $next($request);
}
```

### 2. Configura retención de datos

No guardes todo para siempre. Datos muy antiguos consumen recursos:

```php
'retention' => [
    'events' => 30,          // Guarda eventos 30 días
    'exceptions' => 60,      // Excepciones 60 días
    'completed_jobs' => 14,  // Jobs completados 14 días
],
```

### 3. Integra con tu sistema de alertas

```php
use Devifyo\Watchtower\Events\ExceptionRecorded;

Event::listen(ExceptionRecorded::class, function ($event) {
    if ($event->exception instanceof CriticalException) {
        Slack::message('🚨 Error crítico: ' . $event->exception->getMessage())
            ->send();
    }
});
```

### 4. Usa nombres descriptivos en tus schedules

```php
// ❌ Malo
$schedule->command('sync:users')->daily();

// ✅ Bueno
$schedule->command('sync:users')
    ->daily()
    ->name('Sincronizar usuarios de Active Directory');
```

### 5. Monitorea jobs de larga duración

```php
class ExportMonthlyReport implements ShouldQueue
{
    public function middleware(): array
    {
        return [
            (new WithoutOverlapping())
                ->releaseAfter(3600) // 1 hora máximo
                ->toManyAttempts(3),
        ];
    }
    
    public function handle()
    {
        // Tu lógica aquí
    }
}
```

## Comparativa: Watchtower vs Alternativas

| Característica | Watchtower | Horizon | Vigilance |
|---|---|---|---|
| Dashboard web | ✅ | ✅ | ✅ |
| Monitoreo queues | ✅ | ✅ | ✅ |
| Monitoreo schedules | ✅ | ❌ | ✅ |
| Monitoreo excepciones | ✅ | ❌ | ✅ |
| Ejecutar bajo demanda | ✅ | ❌ | ❌ |
| Reintentos en lote | ✅ | ⚠️ | ❌ |
| Self-hosted | ✅ | ✅ | ✅ |
| Cualquier queue driver | ✅ | ❌ | ✅ |
| Gratuito/Open source | ✅ | ✅ | ✅ |

## Conclusión

**Watchtower es un game-changer** para equipos que necesitan control real sobre sus aplicaciones Laravel en producción. No es solo un dashboard bonito que muestra qué pasó; es una herramienta que **te permite actuar inmediatamente**.

Desde reintentar 1,000 jobs con un clic, ejecutar tareas bajo demanda cuando lo necesites, hasta resolver errores sin tocar CLI, Watchtower elimina la fricción que existe en herramientas puramente observacionales.

Si tu aplicación depende de colas confiables, tareas programadas sin fallos, y visibilidad de errores, Watchtower merece estar en tu stack de producción. La instalación toma 5 minutos, y el valor que proporciona es exponencial.

## Puntos clave

- **Watchtower es un paquete all-in-one** que monitorea schedules, queues y excepciones desde un único dashboard
- **Ejecuta tareas bajo demanda** sin esperar al siguiente ciclo programado
- **Reintenta jobs masivamente** directamente desde la interfaz, sin CLI
- **Funciona con cualquier queue driver** (Redis, SQS, Database, Sync)
- **Captura excepciones automáticamente** con stack traces y contexto completo
- **Protege el acceso** con middleware y autenticación
- **Configura retención de datos** para no saturar tu base de datos
- **Integra con alertas** (Slack, email) para notificaciones en tiempo real
- **Naming descriptivo** en schedules y jobs hace el monitoreo mucho más útil
- **Complementa, no reemplaza**, herramientas como Horizon para casos más especializados