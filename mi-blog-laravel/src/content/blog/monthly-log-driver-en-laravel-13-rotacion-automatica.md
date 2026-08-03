---
title: 'Monthly Log Driver en Laravel 13: Rotación Automática'
description: 'Descubre cómo usar el nuevo monthly log driver en Laravel 13 para rotación automática de logs por mes. Configura, personaliza y optimiza tu estrategia de logging.'
pubDate: '2026-07-28'
tags: ['laravel', 'logging', 'devops']
---

## Introducción

Uno de los desafíos más comunes en aplicaciones en producción es gestionar adecuadamente los archivos de logs. Cuando tu aplicación genera miles de eventos diarios, los logs pueden crecer exponencialmente, consumiendo espacio en disco y dificultando la búsqueda de errores críticos.

Laravel 13 introduce el **monthly log driver**, una solución elegante que automatiza la rotación de logs agrupándolos por mes. A diferencia del driver `daily` que crea un archivo por día, el driver `monthly` consolida todos los logs de un mes en un único archivo, reduciendo la fragmentación y mejorando la organización de tus registros.

En este artículo aprenderás a configurar, personalizar y aprovechar al máximo esta nueva funcionalidad para optimizar tu estrategia de logging en producción.

## Qué es el Monthly Log Driver

El **monthly log driver** es un gestor de canales de logging que automáticamente rota los archivos de logs en base a períodos mensuales. Cada mes genera un nuevo archivo de log, lo que resulta en:

- **Menos fragmentación**: Un archivo por mes vs. uno por día
- **Mejor organización**: Logs agrupados por período contable o administrativo
- **Menor consumo de inodos**: Crucial en sistemas de archivos con límites
- **Facilita auditoría**: Acceso rápido a logs históricos por período

### Diferencias con otros drivers

```
daily:    app-2026-01-15.log (1 archivo/día)
single:   laravel.log (1 archivo único)
monthly:  laravel-2026-01.log (1 archivo/mes) ← NUEVO
```

## Configuración Básica del Monthly Driver

### Paso 1: Actualizar a Laravel 13.23+

Primero, asegúrate de tener la versión correcta:

```bash
composer update laravel/framework
```

Verifica que tengas Laravel 13.23.0 o superior:

```bash
php artisan --version
```

### Paso 2: Configurar en config/logging.php

Abre tu archivo de configuración de logging y añade el nuevo canal:

```php
// config/logging.php

'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['single', 'daily'],
        'ignore_exceptions' => false,
    ],

    'single' => [
        'driver' => 'single',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
    ],

    'daily' => [
        'driver' => 'daily',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
        'days' => 14,
    ],

    // ← NUEVO DRIVER MONTHLY
    'monthly' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
    ],
],
```

### Paso 3: Activar el Monthly Driver

Cambia tu variable de entorno para usar el nuevo driver:

```env
# .env
LOG_CHANNEL=monthly
LOG_LEVEL=debug
```

## Configuración Avanzada del Monthly Driver

### Personalizar la ruta de almacenamiento

Es recomendable usar rutas más descriptivas para identificar fácilmente el período:

```php
// config/logging.php

'monthly' => [
    'driver' => 'monthly',
    'path' => storage_path('logs/monthly/laravel.log'),
    'level' => env('LOG_LEVEL', 'debug'),
    'permission' => 0644,
],
```

Esto generará archivos como:
```
storage/logs/monthly/laravel-2026-01.log
storage/logs/monthly/laravel-2026-02.log
storage/logs/monthly/laravel-2026-03.log
```

### Configurar múltiples canales con stack

Una estrategia común es mantener un archivo de todos los logs y otro separado para errores:

```php
// config/logging.php

'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['monthly', 'monthly_errors'],
        'ignore_exceptions' => false,
    ],

    'monthly' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/laravel.log'),
        'level' => env('LOG_LEVEL', 'debug'),
    ],

    'monthly_errors' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/errors.log'),
        'level' => 'error',
    ],
],
```

## Casos de Uso Prácticos

### Caso 1: Logging Diferenciado por Nivel

Mantén logs de depuración separados de los críticos:

```php
// config/logging.php

'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['monthly_debug', 'monthly_errors'],
    ],

    'monthly_debug' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/debug.log'),
        'level' => 'debug',
    ],

    'monthly_errors' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/errors.log'),
        'level' => 'error',
    ],
],
```

### Caso 2: Logging por Módulo

Separa logs de diferentes partes de tu aplicación:

```php
// config/logging.php

'channels' => [
    'payments' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/payments.log'),
        'level' => 'info',
    ],

    'api' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/api.log'),
        'level' => 'debug',
    ],

    'auth' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/monthly/auth.log'),
        'level' => 'info',
    ],
],
```

Luego usa en tu código:

```php
// En un controlador de pagos
Log::channel('payments')->info('Pago procesado', [
    'order_id' => $orderId,
    'amount' => $amount,
]);

// En un controlador de API
Log::channel('api')->debug('Request recibido', [
    'endpoint' => $request->path(),
    'method' => $request->method(),
]);

// En un controlador de autenticación
Log::channel('auth')->warning('Intento fallido de login', [
    'email' => $email,
    'ip' => $request->ip(),
]);
```

### Caso 3: Stack Híbrido (Daily + Monthly)

Mantén logs del día actual en archivos diarios pero guardacopia mensual:

```php
// config/logging.php

'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['daily', 'monthly_archive'],
    ],

    'daily' => [
        'driver' => 'daily',
        'path' => storage_path('logs/laravel.log'),
        'days' => 7,
    ],

    'monthly_archive' => [
        'driver' => 'monthly',
        'path' => storage_path('logs/archive/laravel.log'),
        'level' => 'notice',
    ],
],
```

## Limpiar Logs Antiguos

Con el monthly driver, es menos crítico, pero aún es buena práctica limpiar logs mensuales antiguos. Crea un comando personalizado:

```bash
php artisan make:command CleanOldMonthlyLogs
```

```php
// app/Console/Commands/CleanOldMonthlyLogs.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Carbon\Carbon;
use File;

class CleanOldMonthlyLogs extends Command
{
    protected $signature = 'logs:clean-old-monthly {--months=12 : Mantener logs de últimos N meses}';
    protected $description = 'Elimina logs mensuales más antiguos que N meses';

    public function handle()
    {
        $monthsToKeep = $this->option('months');
        $cutoffDate = Carbon::now()->subMonths($monthsToKeep);
        
        $logPath = storage_path('logs/monthly');
        
        if (!is_dir($logPath)) {
            $this->info('No hay directorio de logs mensuales.');
            return;
        }

        $files = File::files($logPath);
        $deleted = 0;

        foreach ($files as $file) {
            $filename = $file->getFilename();
            
            // Extrae el período del nombre: laravel-2026-01.log
            if (preg_match('/(\d{4})-(\d{2})\.log$/', $filename, $matches)) {
                $logDate = Carbon::createFromFormat('Y-m', $matches[1] . '-' . $matches[2]);
                
                if ($logDate->lessThan($cutoffDate)) {
                    File::delete($file->getRealPath());
                    $deleted++;
                    $this->line("Eliminado: {$filename}");
                }
            }
        }

        $this->info("Se eliminaron {$deleted} archivos de log.");
    }
}
```

Programa su ejecución automática:

```php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    // Limpiar logs mensuales mayores a 12 meses el primer día de cada mes
    $schedule->command('logs:clean-old-monthly --months=12')
        ->monthlyOn(1, '02:00');
}
```

## Monitorear Uso de Disco

Crea un comando para vigilar el espacio ocupado por logs:

```bash
php artisan make:command CheckLogDiskUsage
```

```php
// app/Console/Commands/CheckLogDiskUsage.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use File;

class CheckLogDiskUsage extends Command
{
    protected $signature = 'logs:disk-usage';
    protected $description = 'Muestra uso de disco de logs';

    public function handle()
    {
        $logsPath = storage_path('logs');
        $totalSize = 0;
        $files = [];

        foreach (File::allFiles($logsPath) as $file) {
            $size = $file->getSize();
            $totalSize += $size;
            
            $files[] = [
                'Archivo' => $file->getFilename(),
                'Tamaño' => $this->formatBytes($size),
                'Ruta' => $file->getRelativePath(),
            ];
        }

        $this->table(
            ['Archivo', 'Tamaño', 'Ruta'],
            $files
        );

        $this->info("\nTamaño total: " . $this->formatBytes($totalSize));
    }

    private function formatBytes($bytes)
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= (1 << (10 * $pow));

        return round($bytes, 2) . ' ' . $units[$pow];
    }
}
```

## Integración con Servicios Externos

El monthly driver es ideal para exportar logs a servicios externos:

```php
// app/Console/Commands/ExportMonthlyLogs.php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use File;
use AWS\S3\S3Client;

class ExportMonthlyLogs extends Command
{
    public function handle()
    {
        $logsPath = storage_path('logs/monthly');
        $s3 = new S3Client([
            'version' => 'latest',
            'region' => env('AWS_DEFAULT_REGION'),
        ]);

        foreach (File::files($logsPath) as $file) {
            $s3->putObject([
                'Bucket' => env('AWS_BUCKET'),
                'Key' => 'logs/archive/' . $file->getFilename(),
                'Body' => fopen($file->getRealPath(), 'r'),
            ]);

            $this->info("Exportado: " . $file->getFilename());
        }
    }
}
```

## Troubleshooting y Mejores Prácticas

### Permisos de archivos

Asegúrate de que el directorio tiene permisos correctos:

```bash
chmod -R 775 storage/logs/monthly
chown -R www-data:www-data storage/logs/monthly
```

### Rotación no ocurre

Si los logs no están rotando mensualmente:

```php
// Verifica la configuración
php artisan config:show logging.channels.monthly
```

### Performance con logs muy grandes

Para aplicaciones con alto volumen, usa múltiples canales:

```php
'stack' => [
    'driver' => 'stack',
    'channels' => ['monthly', 'monthly_errors', 'monthly_slow'],
],
```

## Puntos clave

- El **monthly log driver** automatiza la rotación de logs por período mensual
- Reduce fragmentación y mejora organización frente al driver `daily`
- Ideal para aplicaciones con alto volumen de logs que requieren auditoría
- Configurable en `config/logging.php` con múltiples canales personalizados
- Combina con stacks para logging diferenciado por nivel, módulo o propósito
- Implementa limpieza automática de logs antiguos con scheduled commands
- Monitorea uso de disco regularmente para evitar saturación
- Intégrable con servicios cloud (AWS S3, Google Cloud Storage, etc.)
- Soporta múltiples canales simultáneamente para casos de uso complejos
- Requiere Laravel 13.23.0 o superior para acceso a esta funcionalidad