---
title: 'Scheduler List en Laravel: Gestiona Tareas Programadas sin CLI'
description: 'Aprende a usar Scheduler List para visualizar, filtrar y ejecutar tareas programadas en Laravel desde una interfaz web intuitiva tipo Pulse.'
pubDate: '2026-06-06'
tags: ['laravel', 'scheduler', 'tareas-programadas', 'herramientas']
---

## Introducción

Las tareas programadas en Laravel son fundamentales para mantener una aplicación funcionando sin intervención manual. Sin embargo, gestionar el archivo `kernel.php` y ejecutar tareas manualmente desde la CLI puede ser tedioso, especialmente en equipos grandes o cuando necesitas auditar qué tareas se ejecutan y cuándo.

**Scheduler List** es un package que añade un dashboard web estilo Pulse a tu aplicación Laravel, permitiéndote visualizar todas tus tareas programadas, filtrarlas, buscarlas y ejecutarlas bajo demanda mientras ves la salida en tiempo real.

Este artículo te mostrará cómo instalar, configurar y dominar Scheduler List para mejorar tu flujo de trabajo con el scheduler de Laravel.

## ¿Qué es Scheduler List?

Scheduler List es un paquete desarrollado por la comunidad Laravel que proporciona una interfaz web moderna para gestionar el scheduler de Laravel. A diferencia de trabajar directamente con la CLI (`artisan schedule:list`), obtienes:

- **Dashboard visual** de todas tus tareas programadas
- **Búsqueda y filtrado** avanzado por nombre, descripción o expresión cron
- **Ejecución bajo demanda** de tareas sin esperar al próximo ciclo
- **Visualización de salida** en tiempo real mientras se ejecutan
- **Historial de ejecuciones** (en versiones avanzadas)
- **Integración con Pulse** para consistencia visual

## Instalación y Configuración

### Instalación del paquete

Instala Scheduler List vía Composer:

```bash
composer require spatie/laravel-scheduler-list
```

Si usas Laravel con autoregistry de service providers, el paquete se registrará automáticamente. Si no, añádelo manualmente en `config/app.php`:

```php
'providers' => [
    // ...
    Spatie\SchedulerList\SchedulerListServiceProvider::class,
],
```

### Publicar assets y config

Publica los assets y archivos de configuración:

```bash
php artisan vendor:publish --provider="Spatie\SchedulerList\SchedulerListServiceProvider"
```

Esto creará:
- `config/scheduler-list.php` - Configuración del paquete
- Assets y vistas necesarios

### Configuración básica

Abre `config/scheduler-list.php` y configura los parámetros:

```php
return [
    // Prefijo de rutas del dashboard
    'route_prefix' => 'scheduler-list',
    
    // Middlewares a aplicar (autenticación, etc)
    'middleware' => ['web', 'auth'],
    
    // Controlar acceso por usuario
    'can_access' => function (Request $request) {
        return $request->user()?->isAdmin();
    },
    
    // Actualizar intervalo de polling (ms)
    'refresh_interval' => 5000,
];
```

## Accediendo al Dashboard

Una vez configurado, accede al dashboard en:

```
http://tu-app.local/scheduler-list
```

Verás una lista de todas las tareas programadas definidas en `app/Console/Kernel.php`. El dashboard muestra:

- **Nombre de la tarea** (comando o callable)
- **Expresión Cron** (ej: `0 * * * *` para cada hora)
- **Descripción** (si la incluiste)
- **Última ejecución**
- **Próxima ejecución** calculada
- **Estado** (pendiente, ejecutando, completado)

## Definir Tareas para el Dashboard

Para que tus tareas aparezcan correctamente en Scheduler List, define el nombre y descripción en `app/Console/Kernel.php`:

```php
namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule)
    {
        // Tarea con nombre y descripción descriptiva
        $schedule->command('inspire')
            ->hourly()
            ->name('inspirational-quote')
            ->description('Obtiene una cita inspiradora cada hora');
        
        // Procesar envíos de emails
        $schedule->command('queue:work --once')
            ->everyFiveMinutes()
            ->name('process-emails')
            ->description('Procesa la cola de emails');
        
        // Limpiar caché expirado
        $schedule->command('cache:clear')
            ->daily()
            ->at('02:00')
            ->name('clean-cache')
            ->description('Limpia caché expirado diariamente');
        
        // Generar reportes
        $schedule->call(function () {
            \App\Jobs\GenerateMonthlyReport::dispatch();
        })
            ->monthlyOn(1, '03:00')
            ->name('monthly-report')
            ->description('Genera reporte mensual');
    }
}
```

### Ejecutar tareas bajo demanda desde el dashboard

Una de las características más poderosas es ejecutar tareas manualmente desde la interfaz:

Haz clic en el botón "Run" en el dashboard y la tarea se ejecutará inmediatamente. La salida aparecerá en una ventana modal en tiempo real.

```bash
# En la CLI, esto sería equivalente a:
php artisan inspire
```

Pero ahora puedes hacerlo desde el navegador sin acceso a la terminal.

## Casos de uso avanzados

### Filtrar por nombre o expresión cron

El dashboard incluye un buscador integrado. Escribe para filtrar:

```
# Buscar por nombre
"monthly" → muestra solo tareas con "monthly" en el nombre

# Buscar por horario
"* * * *" → muestra tareas que coincidan con esa expresión cron
```

### Proteger el acceso con autorización

Configura quién puede acceder al dashboard:

```php
// config/scheduler-list.php
'can_access' => function (Request $request) {
    // Solo administradores
    return $request->user()?->hasRole('admin');
    
    // O verificar por email
    // return in_array($request->user()?->email, [
    //     'admin@example.com',
    //     'dev-lead@example.com'
    // ]);
},
```

### Usar con múltiples hosts

Si tienes múltiples servidores ejecutando el scheduler, considera qué máquina debería ejecutar cada tarea:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->command('backup:run')
        ->daily()
        ->name('database-backup')
        ->onOneServer() // Solo en un servidor
        ->description('Respaldo diario de BD');
    
    $schedule->command('notifications:send')
        ->everyMinute()
        ->name('send-notifications')
        ->description('Envía notificaciones pendientes');
        // Se ejecuta en todos los servidores
}
```

## Monitoreo y debugging

### Ver logs de ejecuciones

Scheduler List rastrea automáticamente cuándo se ejecutan las tareas. Consulta los logs en:

```
storage/logs/laravel.log
```

Busca líneas como:
```
[2026-06-06 14:30:00] local.INFO: inspire completed in 145ms
```

### Debuggear tareas que fallan

Si una tarea falla, verás el error en el dashboard. Para mayor detalle:

```php
$schedule->command('problematic-command')
    ->hourly()
    ->name('debug-task')
    ->description('Tarea problemática')
    ->onFailure(function () {
        \Log::error('La tarea debug-task falló');
        \Notification::send(
            \App\Models\User::admins(),
            new \App\Notifications\ScheduledTaskFailed()
        );
    });
```

### Limitar overlapping

Evita que una tarea se ejecute si ya hay una en progreso:

```php
$schedule->command('long-running-task')
    ->hourly()
    ->name('long-task')
    ->withoutOverlapping() // Máx 24 horas de espera
    ->description('Tarea que puede tomar mucho tiempo');
```

## Integración con el resto de tu aplicación

### Despachando jobs en lugar de comandos

Es una buena práctica usar jobs en lugar de comandos directamente:

```php
protected function schedule(Schedule $schedule)
{
    $schedule->job(new \App\Jobs\SendDailyReport())
        ->daily()
        ->at('08:00')
        ->name('daily-email-report')
        ->description('Envía reporte diario por email');
    
    $schedule->job(new \App\Jobs\CleanupOldFiles(), 'high')
        ->dailyAt('03:00')
        ->name('cleanup-files')
        ->description('Limpia archivos antiguos');
}
```

### Monitorear con Laravel Pulse

Scheduler List se integra con Pulse. Configura el componente de scheduler en tu dashboard Pulse:

```php
// resources/views/pulse/dashboard.blade.php
<div class="grid gap-6 lg:grid-cols-3">
    <x-pulse.scheduler />
</div>
```

## Errores comunes y soluciones

### El dashboard muestra tareas vacías

**Causa**: El scheduler no está ejecutándose. Verifica que tengas un cron entry:

```bash
* * * * * cd /path-to-project && php artisan schedule:run >> /dev/null 2>&1
```

### No veo mis nuevas tareas

**Causa**: Laravel cachea el schedule. Limpia el caché:

```bash
php artisan schedule:clear
```

### Error 403 al acceder al dashboard

**Causa**: El middleware `auth` rechaza tu usuario. Verifica la configuración:

```php
// config/scheduler-list.php
'can_access' => function (Request $request) {
    return true; // Temporalmente permitir todos para debuggear
},
```

## Mejores prácticas

### 1. Sempre incluye nombre y descripción

```php
// ✅ Bien
$schedule->command('process-queue')
    ->everyFiveMinutes()
    ->name('queue-processor')
    ->description('Procesa jobs de la cola cada 5 minutos');

// ❌ Evita
$schedule->command('process-queue')->everyFiveMinutes();
```

### 2. Agrupa tareas lógicamente

Organiza tus tareas por funcionalidad:

```php
protected function schedule(Schedule $schedule)
{
    // Tareas de email
    $schedule->command('mail:send-pending')
        ->everyMinute()
        ->name('pending-mails')
        ->description('Envía emails pendientes');
    
    // Tareas de mantenimiento
    $schedule->command('database:optimize')
        ->daily()
        ->at('02:00')
        ->name('optimize-db')
        ->description('Optimiza base de datos');
    
    // Tareas de reportes
    $schedule->job(new GenerateReport())
        ->weekly()
        ->sundays()
        ->at('09:00')
        ->name('weekly-report')
        ->description('Genera reporte semanal');
}
```

### 3. Maneja errores adecuadamente

```php
$schedule->command('export:data')
    ->daily()
    ->name('data-export')
    ->description('Exporta datos diarios')
    ->onFailure(function (Throwable $exception) {
        \Log::error('Export falló: ' . $exception->getMessage());
        
        // Notifica al equipo
        \Notification::route('slack', config('services.slack.webhook'))
            ->notify(new \App\Notifications\ScheduleFailure($exception));
    })
    ->onSuccess(function () {
        \Log::info('Export completado exitosamente');
    });
```

## Conclusión

Scheduler List transforma la forma en que gestionas las tareas programadas en Laravel. En lugar de depender exclusivamente de la CLI, obtienes un dashboard visual que facilita:

- **Visualizar** todas tus tareas en un solo lugar
- **Buscar y filtrar** rápidamente por nombre o horario
- **Ejecutar bajo demanda** sin esperar al próximo ciclo
- **Debuggear** directamente desde la web
- **Controlar acceso** mediante autenticación y autorización

Si trabajas con equipos o necesitas auditar regularmente tus tareas programadas, Scheduler List es una adición valiosa que mejora significativamente la experiencia de desarrollo.

## Puntos clave

- **Scheduler List** proporciona un dashboard web moderno para gestionar tareas programadas en Laravel
- Instálalo con `composer require spatie/laravel-scheduler-list` y configura el acceso mediante middleware
- Define nombres y descripciones en tus tareas para que aparezcan correctamente en el dashboard
- Ejecuta tareas bajo demanda directamente desde la interfaz web sin acceso a CLI
- Protege el acceso configurando `can_access` en el archivo de configuración
- Integra con Laravel Pulse para un monitoreo completo de tu aplicación
- Usa jobs en lugar de comandos directamente para mejor separación de responsabilidades
- Siempre incluye manejo de errores con `onFailure()` y `onSuccess()`
- Agrupa tareas lógicamente por funcionalidad para mejor mantenimiento
- Verifica que el cron entry esté activo: `* * * * * php artisan schedule:run`