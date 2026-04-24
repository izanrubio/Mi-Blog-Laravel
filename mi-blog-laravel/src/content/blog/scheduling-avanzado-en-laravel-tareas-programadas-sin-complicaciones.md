---
title: 'Scheduling Avanzado en Laravel: Tareas Programadas sin Complicaciones'
description: 'Domina el scheduler de Laravel más allá de lo básico: subtareas, sincronización, manejo de solapamientos y debugging de cron jobs.'
pubDate: '2026-04-24'
tags: ['laravel', 'scheduling', 'cron', 'tareas-programadas']
---

## Scheduling Avanzado en Laravel: Tareas Programadas sin Complicaciones

El scheduler de Laravel es una herramienta poderosa que permite automatizar tareas sin necesidad de configurar cron jobs manualmente. Sin embargo, muchos desarrolladores solo rascan la superficie, usando `->daily()` o `->hourly()` sin aprovechar todo su potencial. En este artículo exploraremos las funcionalidades avanzadas del scheduler que te ayudarán a construir sistemas de tareas más robustos, eficientes y fáciles de mantener.

## ¿Por qué va más allá del scheduling básico?

Cuando tus aplicaciones Laravel crecen, las tareas programadas también se vuelven más complejas. Necesitas:

- Evitar que tareas se solapen cuando toman demasiado tiempo
- Ejecutar subtareas condicionadas en cadena
- Sincronizar ejecuciones entre servidores
- Manejar fallos y reintentos automáticos
- Debuggear por qué un job no se ejecutó

El scheduler de Laravel tiene todas estas capacidades, pero necesitas conocerlas.

## Estructura básica del Scheduler

Antes de entrar en lo avanzado, recordemos donde vive el scheduler:

```php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    $schedule->command('inspire')->hourly();
    $schedule->call(function () {
        Log::info('Task executed');
    })->daily();
}
```

En producción, necesitas un único cron job que dispare el scheduler cada minuto:

```bash
* * * * * cd /path-to-laravel && php artisan schedule:run >> /dev/null 2>&1
```

## Evitando solapamientos de tareas: WithoutOverlapping

Uno de los problemas más comunes es que una tarea tarde más de lo esperado y se solape con la siguiente ejecución. Imagina un comando que procesa 10,000 registros pero a veces tarda 2 horas:

```php
// SIN PROTECCIÓN - Problema real
$schedule->command('process:orders')
    ->everyMinute();

// Si el comando tarda 15 minutos, se ejecutará 15 instancias simultáneamente
// Esto causa bloqueos, uso excesivo de memoria y datos corruptos
```

La solución es `withoutOverlapping()`:

```php
$schedule->command('process:orders')
    ->everyMinute()
    ->withoutOverlapping();
```

Esto usa un lock en el filesystem (o base de datos) para garantizar que solo una instancia se ejecuta. Puedes personalizar el timeout del lock:

```php
$schedule->command('process:orders')
    ->everyMinute()
    ->withoutOverlapping(minutes: 30);
```

Si después de 30 minutos el lock sigue activo, se ignorará y se ejecutará de nuevo (útil si el proceso anterior falló).

### Sincronización entre múltiples servidores

Si ejecutas Laravel en varios servidores, cada uno tiene su propio cron. Para evitar duplicación:

```php
$schedule->command('backup:database')
    ->daily()
    ->withoutOverlapping()
    ->onOneServer();
```

`onOneServer()` usa Redis o la base de datos para coordinar que solo un servidor ejecute la tarea. Requiere configuración previa:

```php
// config/cache.php - usar Redis como store
'default' => env('CACHE_DRIVER', 'redis'),

// O en el .env
CACHE_DRIVER=redis
REDIS_HOST=127.0.0.1
```

## Chaining de tareas con entonces/then

Laravel 13 mejoró significativamente las tareas encadenadas. Puedes ejecutar una tarea y luego otra si la primera tiene éxito:

```php
$schedule->command('reports:generate')
    ->daily()
    ->then(function () {
        Log::info('Report generated successfully');
        // Aquí puedes enviar emails, notificaciones, etc.
    });
```

Para cadenas más complejas:

```php
$schedule->command('data:sync')
    ->hourly()
    ->then(function () {
        \App\Models\SyncLog::create([
            'status' => 'completed',
            'timestamp' => now(),
        ]);
    })
    ->thenWithOutput(function ($output) {
        // Capturar la salida del comando
        Log::info('Sync output: ' . $output);
    });
```

### Ejecutar múltiples comandos en secuencia

Si necesitas ejecutar varios comandos uno tras otro:

```php
$schedule->call(function () {
    Artisan::call('command:one');
    Artisan::call('command:two');
    Artisan::call('command:three');
})->daily();
```

O mejor aún, crea un comando específico que orqueste:

```php
// app/Console/Commands/DailyPipeline.php

class DailyPipeline extends Command
{
    protected $signature = 'pipeline:daily';

    public function handle()
    {
        $this->call('command:one');
        $this->info('Command one completed');

        $this->call('command:two');
        $this->info('Command two completed');

        $this->call('command:three');
        $this->info('Command three completed');
    }
}
```

Luego en el scheduler:

```php
$schedule->command('pipeline:daily')->daily();
```

## Callbacks condicionales: only(), skip() y when()

A veces necesitas que una tarea se ejecute solo bajo ciertas condiciones:

```php
// Ejecutar solo en producción
$schedule->command('emails:send')
    ->daily()
    ->onlyInProduction();

// Ejecutar solo en desarrollo
$schedule->command('debug:tasks')
    ->everyMinute()
    ->onlyInDebugMode();

// Condicional personalizado
$schedule->command('process:heavy')
    ->daily()
    ->when(function () {
        return Cache::get('heavy_processing_enabled', false);
    });

// Lo opuesto: skip() para omitir bajo ciertas condiciones
$schedule->command('maintenance:cleanup')
    ->daily()
    ->skip(function () {
        return MaintenanceMode::isEnabled();
    });
```

Caso de uso real: ejecutar un comando costoso solo si ciertos criterios se cumplen:

```php
$schedule->call(function () {
    $pendingOrders = Order::where('status', 'pending')
        ->where('created_at', '<', now()->subHours(24))
        ->count();

    if ($pendingOrders > 100) {
        Artisan::call('orders:process-old');
    }
})->everyTenMinutes();
```

## Manejo de Fallos y Reintentos

Laravel 13 introdujo el atributo `#[Delay]` para controlar reintentos de tareas en cola. Para el scheduler, puedes usar:

```php
$schedule->command('data:validate')
    ->daily()
    ->onFailure(function () {
        Log::error('Data validation failed!');
        // Enviar notificación
        Notification::send(
            User::admins(),
            new TaskFailedNotification('data:validate')
        );
    })
    ->onSuccess(function () {
        Log::info('Data validation completed');
    });
```

### Reintentar automáticamente

Para reintentar si falla:

```php
$schedule->call(function () {
    try {
        Artisan::call('risky:command');
    } catch (Exception $e) {
        Log::error('Command failed: ' . $e->getMessage());
        // Reintentar después de 5 minutos
        dispatch(new RetryCommand())
            ->delay(now()->addMinutes(5));
    }
})->daily();
```

## Timing Avanzado: Más allá de daily() y hourly()

El scheduler permite especificar tiempos muy precisos:

```php
// Cada 5 minutos
$schedule->command('process:queue')
    ->everyFiveMinutes();

// Cada 10 minutos
$schedule->command('sync:data')
    ->everyTenMinutes();

// Cada 15 minutos
$schedule->command('update:cache')
    ->everyFifteenMinutes();

// Cada 30 minutos
$schedule->command('health:check')
    ->everyThirtyMinutes();

// Expresión cron personalizada
$schedule->command('custom:task')
    ->cron('0 0 1 * *'); // Primer día de cada mes a las 00:00

// Entre horas específicas
$schedule->command('process:emails')
    ->everyMinute()
    ->between('09:00', '17:00'); // Solo durante horario laboral

// Excepto entre horas
$schedule->command('system:backup')
    ->daily()
    ->unlessBetween('12:00', '14:00'); // No durante la comida
```

### Expresiones cron comunes

```php
// Cada lunes a las 9 AM
$schedule->command('weekly:report')
    ->weeklyOn(1, '9:00');

// Cada primer lunes del mes
$schedule->command('monthly:meeting')
    ->cron('0 9 * * 1 && day(1)'); // No funciona exacto, usa esto:
    ->monthlyOn(1, '09:00')
    ->dayOfWeek(1);

// Cada 6 horas
$schedule->command('frequent:task')
    ->cron('0 */6 * * *');

// Cada 15 minutos
$schedule->command('very:frequent')
    ->cron('*/15 * * * *');
```

## Debugging del Scheduler

¿Por qué tu tarea no se ejecuta? Aquí hay varias estrategias:

### 1. Verificar que el cron está corriendo

```bash
# Comprobar si hay un cron en el servidor
crontab -l

# Si no ves nada, instalar:
crontab -e
# Agregar:
* * * * * cd /path-to-laravel && php artisan schedule:run >> /dev/null 2>&1
```

### 2. Registrar toda actividad del scheduler

```php
// app/Console/Kernel.php

protected function scheduleCache()
{
    return $this->cache
        ->remember(
            'framework.schedule',
            now()->addMinutes(5),
            function () {
                return collect($this->schedule(new Schedule))
                    ->sortBy->nextRunTime
                    ->values()
                    ->all();
            }
        );
}

// En tu kernel, agrega logging:
protected function schedule(Schedule $schedule)
{
    $schedule->command('process:orders')
        ->everyMinute()
        ->onSuccess(function () {
            Log::info('Orders processed successfully', [
                'time' => now(),
            ]);
        })
        ->onFailure(function () {
            Log::error('Orders processing failed');
        });
}
```

### 3. Comando artisan para listar tareas programadas

```bash
php artisan schedule:list
```

Esto muestra todas las tareas configuradas y cuándo se ejecutarán a continuación.

### 4. Ejecutar manualmente una tarea

```bash
# Ejecutar una tarea específica
php artisan process:orders

# O forzar la ejecución del scheduler completo
php artisan schedule:run --verbose
```

### 5. Crear un comando de debugging personalizado

```php
// app/Console/Commands/DebugSchedule.php

class DebugSchedule extends Command
{
    protected $signature = 'schedule:debug';
    protected $description = 'Debug scheduled tasks';

    public function handle()
    {
        $schedule = app(Schedule::class);
        
        // Aquí Laravel no expone directamente los eventos,
        // pero puedes inspeccionar el log:
        $this->info('Checking schedule logs...');
        
        $logs = File::get(storage_path('logs/laravel.log'));
        $relevant = collect(explode("\n", $logs))
            ->filter(fn($line) => str_contains($line, 'schedule'))
            ->reverse()
            ->take(10);

        foreach ($relevant as $line) {
            $this->line($line);
        }
    }
}
```

## Ejemplo Real: Sistema de Sincronización Completo

Aquí está un caso de uso que combina muchas de las técnicas anteriores:

```php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    // Sincronización principal cada 5 minutos
    // Solo en un servidor, sin solapamientos
    $schedule->call(function () {
        $syncer = new DataSyncer();
        $syncer->sync();
    })
    ->everyFiveMinutes()
    ->withoutOverlapping(minutes: 10)
    ->onOneServer()
    ->when(function () {
        // Solo si la sincronización está habilitada
        return Setting::get('sync_enabled', true);
    })
    ->onSuccess(function () {
        // Notificar éxito
        Log::info('Data sync completed', [
            'timestamp' => now(),
            'synced_records' => Cache::get('sync_count', 0),
        ]);
    })
    ->onFailure(function () {
        // Alertar sobre fallos
        Log::error('Data sync failed');
        Notification::send(
            User::role('admin'),
            new SyncFailureNotification()
        );
    });

    // Backup diario a las 2 AM
    $schedule->command('backup:run')
        ->dailyAt('02:00')
        ->withoutOverlapping()
        ->onOneServer()
        ->then(function () {
            Log::info('Backup completed');
            Cache::put('last_backup', now(), now()->addDays(1));
        });

    // Limpieza de datos antiguos, evitar horas pico
    $schedule->command('cleanup:old-logs')
        ->daily()
        ->at('03:30')
        ->skip(function () {
            return MaintenanceMode::isEnabled();
        });

    // Reportes generados cada lunes a las 8 AM
    $schedule->command('reports:generate')
        ->weeklyOn(1, '08:00')
        ->then(function () {
            Mail::send(new WeeklyReportMail(User::admins()));
        });
}
```

## Monitoreo y Alertas

Para sitios en producción, es crítico monitorear el scheduler:

```php
// app/Console/Commands/MonitorSchedule.php

class MonitorSchedule extends Command
{
    protected $signature = 'schedule:monitor';

    public function handle()
    {
        // Verificar que al menos una tarea se ejecutó en la última hora
        $lastExecution = Cache::get('last_schedule_run');
        
        if (!$lastExecution || 
            $lastExecution->diffInMinutes(now()) > 65) {
            
            Alert::critical(
                'Scheduler not running',
                'No scheduled tasks executed in the last hour'
            );
        }

        $this->info('Scheduler is running normally');
    }
}

// Ejecutar este monitor cada minuto
$schedule->command('schedule:monitor')
    ->everyMinute();
```

## Puntos clave

- **WithoutOverlapping**: Previene que tareas se solapen usando locks de filesystem o Redis
- **OnOneServer**: Sincroniza ejecuciones entre múltiples servidores