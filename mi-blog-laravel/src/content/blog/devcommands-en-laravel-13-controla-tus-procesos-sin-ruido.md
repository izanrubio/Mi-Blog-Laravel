---
title: 'DevCommands en Laravel 13: Controla tus Procesos sin Ruido'
description: 'Aprende a usar withoutVendorCommands() y withoutDefaultCommands() para limpiar php artisan dev de procesos innecesarios'
pubDate: '2025-01-15'
tags: ['laravel', 'artisan', 'desarrollo', 'laravel-13']
---

# DevCommands en Laravel 13: Controla tus Procesos sin Ruido

Cuando trabajas en proyectos Laravel con múltiples dependencias, el comando `php artisan dev` puede volverse caótico. Entre los procesos por defecto del framework, los comandos de paquetes vendedor y tus propias integraciones, la salida se convierte en un desorden difícil de seguir.

Laravel 13.30 introduce un control granular sobre qué procesos ejecuta `php artisan dev` mediante dos métodos nuevos en la clase `DevCommands`: `withoutVendorCommands()` y `withoutDefaultCommands()`. En esta guía, aprenderás cómo usarlos para crear un entorno de desarrollo limpio y enfocado.

## ¿Qué es DevCommands y por qué importa?

El archivo `bootstrap/dev.php` es el corazón del comando `php artisan dev`. Este archivo define todos los procesos que Laravel ejecuta en paralelo durante el desarrollo: Vite, base de datos en caché, colas, y más.

Antes de Laravel 13.30, tu configuración lucía así:

```php
use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            \Illuminate\Foundation\Inspiring::class,
            // Tus comandos aquí
        ],
    );
```

El problema es que acumulabas procesos de terceros que ralentizaban tu desarrollo o generaban ruido en la salida.

## Filtrando Comandos Vendedor

Los paquetes Composer a menudo registran sus propios comandos dev. Por ejemplo, si instalas un paquete que incluye un servidor de desarrollo, probablemente no lo necesites si ya tienes Vite corriendo.

Con `withoutVendorCommands()`, puedes deshacerte de ellos en una sola línea:

```php
use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            \Illuminate\Foundation\Inspiring::class,
        ],
    )
    ->withoutVendorCommands();
```

Ahora solo ejecutarán los comandos que tú registres explícitamente. Esto es especialmente útil si trabajas con:

- **Paquetes de testing**: que incluyen servidores de prueba
- **Herramientas de análisis**: que monitorean archivos
- **Servidores complementarios**: que pueden conflictuar con tu stack

## Desactivando Comandos por Defecto

Laravel incluye varios comandos por defecto en `php artisan dev`:

- Vite (compilación de assets)
- Redis (si lo usas para caché/sesiones)
- Pila de trabajo de colas
- Inspiración de Taylor Otwell (motivación matutina 😄)

Si prefieres un control total, `withoutDefaultCommands()` los elimina todos:

```php
use Illuminate\Foundation\Application;

return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            \Illuminate\Foundation\Inspiring::class,
        ],
    )
    ->withoutDefaultCommands();
```

Luego registras manualmente solo lo que necesitas:

```php
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Commands\ServeCommand;
use Illuminate\Queue\Console\WorkCommand;

return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            ServeCommand::class,
            WorkCommand::class,
        ],
    )
    ->withoutDefaultCommands();
```

## Combinando Ambas Opciones

La verdadera potencia surge cuando combinas ambos métodos. Imagina un proyecto donde:

1. Necesitas solo tu servidor Vite
2. Una cola de background jobs
3. Un comando personalizado de sincronización de datos

```php
use Illuminate\Foundation\Application;
use App\Console\Commands\SyncDataCommand;
use Illuminate\Queue\Console\WorkCommand;

return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            SyncDataCommand::class,
            WorkCommand::class,
        ],
    )
    ->withoutVendorCommands()
    ->withoutDefaultCommands();
```

Al ejecutar `php artisan dev`, verás solo estos tres procesos, con una salida limpia y controlable.

## Casos de Uso Prácticos

### Desarrollo Frontend Puro

Si trabajas principalmente en el frontend y no necesitas colas:

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(commands: [])
    ->withoutVendorCommands()
    ->withoutDefaultCommands();
```

Luego ejecuta solo Vite manualmente:

```bash
npm run dev
```

### Microservicios

En una arquitectura de microservicios, cada servicio necesita procesos diferentes:

```php
// Servicio de autenticación
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            CacheCommand::class,
            WorkCommand::class,
        ],
    )
    ->withoutDefaultCommands()
    ->withoutVendorCommands();

// Servicio de reportes
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            WorkCommand::class,
            ReportGeneratorCommand::class,
        ],
    )
    ->withoutDefaultCommands()
    ->withoutVendorCommands();
```

### Testing Integrado

Para un ambiente de testing con procesos específicos:

```php
if (app()->environment('testing')) {
    return Application::configure(basePath: dirname(__DIR__))
        ->withDevCommands(
            commands: [
                TestDatabaseCommand::class,
            ],
        )
        ->withoutDefaultCommands()
        ->withoutVendorCommands();
}
```

## Depuración y Diagnostico

Si no estás seguro de qué comandos están registrados actualmente, puedes usar:

```bash
php artisan dev --help
```

También es útil revisar qué paquetes registran comandos. En `composer.json`, busca scripts con secciones `"dev"`:

```json
{
    "extra": {
        "laravel": {
            "dev": [
                "App\\Console\\Commands\\YourCommand"
            ]
        }
    }
}
```

## Consideraciones de Rendimiento

Cada proceso que ejecuta `php artisan dev` consume recursos del sistema. En máquinas con especificaciones limitadas (como una laptop con 8GB de RAM), cada proceso importa:

| Proceso | Memoria | CPU |
|---------|---------|-----|
| Vite | 150-200MB | Moderado |
| Redis | 50-100MB | Bajo |
| Queue Worker | 30-50MB | Bajo |
| Custom Commands | Varía | Varía |

Usando `withoutVendorCommands()`, podrías ahorrar fácilmente 100-200MB de RAM en desarrollo.

## Migrando desde Configuraciones Antiguas

Si tienes un proyecto en Laravel 13.29 o anterior, la migración es trivial:

**Antes:**
```php
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            // Lista manual de todos tus comandos
        ],
    );
```

**Después:**
```php
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            // Solo los que realmente necesitas
        ],
    )
    ->withoutVendorCommands();
```

No hay breaking changes; los proyectos existentes funcionan exactamente igual.

## Mejores Prácticas

1. **Documenta tu configuración**: Agrega comentarios explicando por qué excluyes comandos

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: [
            WorkCommand::class, // Necesario para jobs en background
        ],
    )
    ->withoutDefaultCommands() // Solo queremos colas, nada más
    ->withoutVendorCommands();  // Los paquetes ralentizan el inicio
```

2. **Usa variables de entorno**: Para diferentes configuraciones por entorno

```php
return Application::configure(basePath: dirname(__DIR__))
    ->withDevCommands(
        commands: config('dev.commands', []),
    )
    ->when(config('dev.without_vendor'), fn($app) => $app->withoutVendorCommands())
    ->when(config('dev.without_default'), fn($app) => $app->withoutDefaultCommands());
```

En `.env`:
```
DEV_WITHOUT_VENDOR=true
DEV_WITHOUT_DEFAULT=false
```

3. **Mantén procesos esenciales**: No elimines todo por optimizar

Un `php artisan dev` con cero procesos no es productivo. Mantén al menos:
- Vite o tu compilador de assets
- Queue worker si usas jobs
- Redis si usas caché/sesiones

## Conclusión

Los métodos `withoutVendorCommands()` y `withoutDefaultCommands()` en Laravel 13.30 representan un paso importante hacia entornos de desarrollo más flexibles. Ya no estás atrapado con la configuración monolítica; puedes personalizar exactamente qué procesos ejecutas.

Esto es especialmente valioso para equipos que trabajan en diferentes partes de la aplicación, proyectos con múltiples dependencias heredadas, o desarrolladores con recursos de hardware limitados.

## Puntos Clave

- `withoutVendorCommands()` elimina todos los comandos registrados por paquetes Composer
- `withoutDefaultCommands()` deshabilita los procesos por defecto de Laravel (Vite, Redis, colas)
- Puedes combinar ambos para control total sobre tu entorno de desarrollo
- Esto mejora significativamente el rendimiento y reduce el ruido en la salida
- Es especialmente útil en proyectos grandes, microservicios y equipos distribuidos
- No hay breaking changes; funciona perfectamente en nuevos proyectos y migraciones
- Mantén documentación clara sobre por qué excluyes procesos específicos
- Considera usar variables de entorno para diferentes configuraciones por contexto