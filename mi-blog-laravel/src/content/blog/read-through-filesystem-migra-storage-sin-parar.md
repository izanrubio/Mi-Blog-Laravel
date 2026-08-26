---
title: 'Read-Through Filesystem: Migra Storage sin Parar'
description: 'Descubre cómo usar el nuevo driver read-through de Laravel para migrar almacenamiento sin downtime ni sincronización masiva manual.'
pubDate: '2025-01-20'
tags: ['laravel', 'storage', 'filesystem', 'migraciones']
---

# Read-Through Filesystem: Migra Storage sin Parar tu Aplicación

Uno de los desafíos más complejos en aplicaciones Laravel en producción es migrar archivos de un sistema de almacenamiento a otro sin causar downtime. Ya sea que cambies de un disco local a S3, de S3 a un servicio CDN, o de un proveedor cloud a otro, el proceso tradicional requiere:

1. Crear un script que sincronice todos los archivos
2. Esperar a que termine (horas o días según el volumen)
3. Validar que nada se haya perdido
4. Esperar la ventana de mantenimiento
5. Apagar la aplicación
6. Cambiar la configuración
7. Rearancar

Pues bien, **Laravel 13.26 introduce el driver read-through filesystem**, que elimina completamente esta complejidad. Es una solución elegante que te permite migrar de forma gradual, transparente y sin intervención manual.

## ¿Qué es un Read-Through Filesystem?

El patrón read-through (también conocido como "lazy loading" o "copy-on-read") es un patrón arquitectónico donde:

- **Disco primario**: Tu almacenamiento nuevo (el destino)
- **Disco de fallback**: Tu almacenamiento antiguo (el origen)
- **Comportamiento**: Si un archivo no existe en el primario, lo busca en el fallback y lo copia automáticamente

Es decir: los archivos se migran solos, bajo demanda, la primera vez que se acceden. Sin scripts masivos, sin downtime, sin sincronización manual.

```php
// Configuración en config/filesystems.php
'disks' => [
    'primary' => [
        'driver' => 's3',
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION'),
        'bucket' => env('AWS_BUCKET'),
    ],
    
    'legacy' => [
        'driver' => 'local',
        'root' => storage_path('app'),
    ],
    
    // El nuevo driver read-through
    'files' => [
        'driver' => 'read-through',
        'primary' => 'primary',
        'fallback' => 'legacy',
    ],
];
```

Así de simple. Ahora, cuando tu aplicación necesite un archivo:

1. Busca en el disco `primary` (S3 en este caso)
2. Si no está, busca en `legacy` (almacenamiento local)
3. Si existe en `legacy`, lo copia a `primary`
4. Retorna el archivo desde `primary`

La próxima vez que se acceda, estará listo en el almacenamiento nuevo.

## Caso de Uso Real: Migración de Producción

Imagina que tienes una aplicación Laravel con 500 GB de fotos de usuarios en un servidor local. Necesitas migrar a AWS S3 porque tu servidor está a punto de quedarse sin espacio.

**Sin read-through filesystem:**
```bash
# Esto tarda horas
aws s3 sync /storage/app s3://mi-bucket/files

# Esperas verificación y validación...
# Actualizas la configuración
# Paras la aplicación
# Los usuarios ven error 503
# Reinicia cuando termina
```

**Con read-through filesystem:**
```php
// Cambias la config hace 10 segundos
// Tu aplicación sigue funcionando perfectamente
// Los usuarios no ven nada raro

Storage::disk('files')->get('fotos/perfil/user-123.jpg');
// → Busca en S3 (no existe)
// → Busca en local (existe)
// → Copia a S3
// → Retorna desde S3
```

## Implementación Paso a Paso

### 1. Configura ambos discos

```php
// config/filesystems.php

'disks' => [
    // Tu nuevo almacenamiento (destino)
    's3' => [
        'driver' => 's3',
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION'),
        'bucket' => env('AWS_BUCKET'),
        'url' => env('AWS_URL'),
        'endpoint' => env('AWS_ENDPOINT'),
    ],
    
    // Tu almacenamiento actual (origen)
    'local' => [
        'driver' => 'local',
        'root' => storage_path('app'),
        'url' => env('APP_URL') . '/storage',
        'visibility' => 'public',
    ],
    
    // El nuevo layer read-through
    'storage' => [
        'driver' => 'read-through',
        'primary' => 's3',
        'fallback' => 'local',
    ],
];

// También actualiza el default
'default' => env('FILESYSTEM_DISK', 'storage'),
```

### 2. Actualiza tu .env

```bash
FILESYSTEM_DISK=storage

# Configuración S3
AWS_ACCESS_KEY_ID=tu_key
AWS_SECRET_ACCESS_KEY=tu_secret
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=mi-bucket
AWS_URL=https://mi-bucket.s3.amazonaws.com
```

### 3. Usa Storage como siempre

```php
namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function download($id)
    {
        // Funciona igual que antes
        // Pero automáticamente migra bajo demanda
        return Storage::download("documents/$id.pdf");
    }
    
    public function preview($id)
    {
        // Si el archivo está en local, se copia a S3
        // La próxima vez estará ahí directamente
        $path = "documents/$id.pdf";
        
        if (Storage::exists($path)) {
            return response()->file(
                Storage::path($path)
            );
        }
        
        return response()->noContent(404);
    }
}
```

## Casos de Uso Avanzados

### Migración con Validación

```php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class ValidateMigration extends Command
{
    protected $signature = 'migrate:validate';
    
    public function handle()
    {
        $fallback = Storage::disk('local');
        $primary = Storage::disk('s3');
        
        $allFiles = $fallback->allFiles();
        $total = count($allFiles);
        
        $this->output->progressStart($total);
        
        foreach ($allFiles as $file) {
            // Simular acceso para forzar copia
            Storage::disk('storage')->exists($file);
            
            $this->output->progressAdvance();
        }
        
        $this->output->progressFinish();
        
        // Verificar que todos están en S3
        $migratedCount = count($primary->allFiles());
        
        $this->info("Archivos originales: $total");
        $this->info("Archivos en S3: $migratedCount");
        
        if ($total === $migratedCount) {
            $this->info('✓ Migración completada exitosamente');
        }
    }
}
```

### Limpieza de Fallback Después de Migración

Una vez que hayas migrado todos los archivos, puedes limpiar el almacenamiento antiguo:

```php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class CleanupLegacyStorage extends Command
{
    protected $signature = 'migrate:cleanup';
    protected $description = 'Elimina archivos del almacenamiento antiguo ya migrados';
    
    public function handle()
    {
        $primary = Storage::disk('s3');
        $fallback = Storage::disk('local');
        
        $allFiles = $fallback->allFiles();
        
        $this->output->progressStart(count($allFiles));
        
        foreach ($allFiles as $file) {
            // Solo elimina si existe en primario
            if ($primary->exists($file)) {
                $fallback->delete($file);
                $this->output->progressAdvance();
            }
        }
        
        $this->output->progressFinish();
        
        $this->info('Limpieza completada');
    }
}
```

### Monitoreo de Migración

```php
namespace App\Services;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class MigrationMonitor
{
    public function getProgress()
    {
        $primary = Storage::disk('s3');
        $fallback = Storage::disk('local');
        
        $total = count($fallback->allFiles());
        $migrated = count($primary->allFiles());
        
        return [
            'total' => $total,
            'migrated' => $migrated,
            'pending' => $total - $migrated,
            'percentage' => $total > 0 ? round(($migrated / $total) * 100, 2) : 0,
        ];
    }
}
```

### Uso en Controladores

```php
namespace App\Http\Controllers;

use App\Services\MigrationMonitor;
use Illuminate\Support\Facades\Storage;

class AdminController extends Controller
{
    public function migrationStatus(MigrationMonitor $monitor)
    {
        return response()->json($monitor->getProgress());
    }
    
    public function downloadStats()
    {
        $fallback = Storage::disk('local');
        
        return response()->json([
            'total_size' => $fallback->directorySize(''),
            'file_count' => count($fallback->allFiles()),
            'largest_file' => $this->getLargestFile($fallback),
        ]);
    }
    
    private function getLargestFile($disk)
    {
        $files = collect($disk->allFiles())
            ->map(fn($file) => [
                'path' => $file,
                'size' => $disk->size($file),
            ])
            ->sortByDesc('size')
            ->first();
        
        return $files;
    }
}
```

## Consideraciones Importantes

### Performance

El read-through filesystem introduce una pequeña latencia en el primer acceso a cada archivo (copia desde fallback). Para aplicaciones con muchos archivos nuevos, considera:

```php
// Pre-calentar el caché durante horas valle
php artisan migrate:validate --sleep=100 // Espera entre archivos
```

### Limpieza de Directorios Vacíos

Cuando borres archivos después de migración, podrían quedar directorios vacíos en el almacenamiento antiguo:

```php
$fallback = Storage::disk('local');

foreach ($fallback->directories() as $dir) {
    $files = $fallback->allFiles($dir);
    
    if (empty($files)) {
        $fallback->deleteDirectory($dir);
    }
}
```

### Sincronización de Metadatos

Algunos metadatos (permisos, timestamps) podrían no copiarse automáticamente:

```php
// Después de migrar, sincroniza metadatos importantes
$file = 'documents/important.pdf';

if (Storage::disk('storage')->exists($file)) {
    $mtime = Storage::disk('local')->lastModified($file);
    // Guarda en BD si necesitas rastrear cuándo se migró
    FileLog::create([
        'path' => $file,
        'migrated_at' => now(),
        'original_timestamp' => $mtime,
    ]);
}
```

## Ventajas vs Desventajas

### ✅ Ventajas

- **Cero downtime**: La aplicación sigue funcionando durante la migración
- **Bajo overhead**: Solo copia archivos que se acceden
- **Reversible**: Puedes volver a cambiar la configuración
- **Escalable**: Funciona con cualquier cantidad de archivos
- **Automático**: Sin scripts adicionales complejos

### ⚠️ Desventajas

- **Latencia inicial**: Primer acceso a cada archivo es más lento
- **Espacio duplicado**: Temporalmente ocupas espacio en ambos discos
- **Red**: Requiere ancho de banda para copiar
- **Eventual consistency**: No todos los archivos migran al instante

## Migración Completa: Checklist

```markdown
1. [ ] Configurar ambos discos en filesystems.php
2. [ ] Crear disco read-through
3. [ ] Actualizar .env con nuevas credenciales
4. [ ] Desplegar cambios en producción
5. [ ] Monitorear con MigrationMonitor
6. [ ] Esperar a que se estabilice (1-7 días según volumen)
7. [ ] Validar con migrate:validate
8. [ ] Ejecutar migrate:cleanup
9. [ ] Confirmar que todo funciona en primario
10. [ ] Eliminar fallback (almacenamiento antiguo)
```

## Conclusión

El **read-through filesystem de Laravel 13.26** es una solución elegante y pragmática para un problema que ha afectado a miles de desarrolladores. No es más magia, es arquitectura inteligente que aprovecha el acceso lazy para mover datos sin disrupción.

Ya no necesitas ventanas de mantenimiento de 6 horas, scripts de sincronización complejos, ni noches sin dormir validando que nada se perdió. Simplemente cambias la configuración, deploys, y los archivos se migran solos mientras tus usuarios siguen usando la aplicación normalmente.

Si tienes una migración de almacenamiento pendiente, este driver te ahorrará horas de trabajo y el estrés de coordinar downtime.

## Puntos clave

- **Read-through filesystem** es un patrón que busca en primario y copia de fallback automáticamente
- Se configura en `config/filesystems.php` con `driver: 'read-through'`
- Permite migraciones **sin downtime** ni sincronización masiva manual
- Los archivos se copian **bajo demanda** en el primer acceso
- Hay una pequeña latencia en ese primer acceso, pero la próxima vez está en primario
- Puedes monitorear el progreso y limpiar el almacenamiento antiguo cuando termines
- Es **reversible**: cambiar config vuelve al almacenamiento anterior
- Ideal para migraciones de local a S3, S3 a CDN, o entre proveedores cloud
- Requiere espacio en ambos discos temporalmente durante la migración
- Simplifica enormemente el flujo de trabajo en equipos grandes