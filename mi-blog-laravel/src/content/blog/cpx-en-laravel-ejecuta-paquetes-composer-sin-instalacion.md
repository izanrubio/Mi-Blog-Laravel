---
title: 'CPX en Laravel: Ejecuta Paquetes Composer sin Instalación'
description: 'Domina CPX 2.0 para ejecutar comandos de paquetes Composer sin agregarlos al proyecto. Ideal para agentes IA y herramientas aisladas.'
pubDate: '2026-08-01'
tags: ['laravel', 'composer', 'herramientas', 'devops']
---

## Introducción

Uno de los problemas más comunes en proyectos Laravel es la contaminación de dependencias. Cuando necesitas ejecutar una herramienta específica, generalmente tienes dos opciones poco ideales: instalar el paquete en tu `composer.json` (aumentando el peso del proyecto) o mantener scripts shell complejos.

**CPX** (Composer Package Executor) resuelve este problema de manera elegante. Con su versión 2.0, puedes ejecutar comandos desde cualquier paquete Composer sin instalarlo en tu proyecto, integrándose perfectamente con agentes IA y automatización.

En este artículo, aprenderás cómo instalar y utilizar CPX en tus proyectos Laravel para crear workflows más limpios y eficientes.

## ¿Qué es CPX y por qué es revolucionario?

CPX es una herramienta que actúa como intermediaria entre tu proyecto y los paquetes Composer. En lugar de instalar cada dependencia, CPX las ejecuta bajo demanda.

### Ventajas principales

**Sin contaminación del proyecto**
```bash
# Sin CPX: composer require análisis-código/tools
# Con CPX:
cpx phpstan/phpstan -- analyse src/
```

**Preferencia por binarios locales**
Si tu proyecto ya tiene `phpstan` instalado, CPX lo usa. Si no, descarga la versión especificada.

**Salida JSON para agentes IA**
Los agentes IA pueden automatizar análisis sin parsear strings complejos:

```bash
cpx phpstan/phpstan --output-format=json -- analyse src/
```

**Ejecución paralela**
Perfect para pipelines CI/CD donde necesitas múltiples herramientas sin sobrecarga.

## Instalación de CPX

### Requisitos previos

- PHP 8.1+
- Composer 2.0+
- Laravel 10+ (opcional, pero recomendado)

### Instalación global

```bash
composer global require phpstan/phpstan-shim:2.0
```

O si prefieres una instalación más limpia:

```bash
composer global require composer-executable/cpx:^2.0
```

Verifica la instalación:

```bash
cpx --version
# Output: CPX 2.0.0
```

### Configuración en tu proyecto Laravel

Aunque CPX es una herramienta global, puedes crear un archivo de configuración local:

```bash
touch cpx.json
```

Contenido básico:

```json
{
  "prefer-local": true,
  "cache": true,
  "timeout": 300
}
```

## Casos de uso en Laravel

### Caso 1: Análisis de código sin dependencia

Ejecuta PHPStan sin agregarlo a tu `composer.json`:

```bash
cpx phpstan/phpstan -- analyse app/ --level=9
```

**En un Job de Laravel:**

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Symfony\Component\Process\Process;

class AnalyzeCodeQuality implements ShouldQueue
{
    use Dispatchable, Queueable;

    public function handle()
    {
        $process = new Process([
            'cpx',
            'phpstan/phpstan',
            '--',
            'analyse',
            'app/',
            '--level=9'
        ]);

        $process->run();

        if (!$process->isSuccessful()) {
            throw new \RuntimeException(
                $process->getErrorOutput()
            );
        }

        \Log::info('Análisis completado', [
            'output' => $process->getOutput()
        ]);
    }
}
```

Despacha el job:

```php
AnalyzeCodeQuality::dispatch();
```

### Caso 2: Formateo de código con Pint alternativo

CPX permite usar múltiples herramientas de formateo:

```bash
cpx pint-orm/phpcs-fixer -- fix src/
cpx squizlabs/php_codesniffer -- check src/
```

**Integración en tu pipeline:**

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class AnalyzeCode extends Command
{
    protected $signature = 'code:analyze 
                          {--phpstan : Ejecutar PHPStan}
                          {--psalm : Ejecutar Psalm}
                          {--rector : Verificar Rector}';

    public function handle()
    {
        if ($this->option('phpstan')) {
            $this->runAnalyzer('phpstan/phpstan', 
                ['analyse', 'app/', '--level=9']
            );
        }

        if ($this->option('psalm')) {
            $this->runAnalyzer('vimeo/psalm', 
                ['--output-format=json']
            );
        }

        if ($this->option('rector')) {
            $this->runAnalyzer('rector/rector', 
                ['process', 'app/', '--dry-run']
            );
        }
    }

    private function runAnalyzer(string $package, array $args)
    {
        $process = new Process(
            array_merge(['cpx', $package, '--'], $args)
        );

        $this->line("Ejecutando {$package}...");
        $process->run();

        if ($process->isSuccessful()) {
            $this->info("✓ {$package} completado");
        } else {
            $this->error("✗ {$package} falló");
            $this->line($process->getErrorOutput());
        }
    }
}
```

Úsalo:

```bash
php artisan code:analyze --phpstan --psalm
```

### Caso 3: Agentes IA con herramientas aisladas

CPX brilla aquí. Los agentes IA pueden ejecutar herramientas sin preocuparse por dependencias:

```php
<?php

namespace App\Services;

use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;

class AIDependencyRunner
{
    /**
     * Ejecuta una herramienta Composer de forma aislada
     * Retorna JSON para agentes IA
     */
    public static function execute(
        string $package,
        array $args = [],
        bool $json = true
    ): array {
        $command = ['cpx', $package, '--'];
        
        if ($json && !in_array('--output-format=json', $args)) {
            $args[] = '--output-format=json';
        }

        $command = array_merge($command, $args);
        $process = new Process($command);

        try {
            $process->run();
            $process->mustRun();

            return [
                'success' => true,
                'output' => json_decode(
                    $process->getOutput(), 
                    true
                ) ?? $process->getOutput(),
                'package' => $package
            ];
        } catch (ProcessFailedException $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'package' => $package
            ];
        }
    }

    public static function analyzeWithPhpstan(
        string $path = 'app/'
    ): array {
        return self::execute('phpstan/phpstan', [
            'analyse',
            $path,
            '--level=9'
        ]);
    }

    public static function checkSecurityWithPhpSecurityChecker(): array {
        return self::execute('enlightn/security-checker', [
            'security:check'
        ]);
    }
}
```

**Uso en un controlador API para agentes:**

```php
<?php

namespace App\Http\Controllers\Api;

use App\Services\AIDependencyRunner;
use Illuminate\Http\JsonResponse;

class CodeAnalysisController
{
    public function analyze(string $tool): JsonResponse
    {
        return response()->json(
            AIDependencyRunner::execute($tool)
        );
    }

    public function phpstan(): JsonResponse
    {
        return response()->json(
            AIDependencyRunner::analyzeWithPhpstan('app/')
        );
    }
}
```

### Caso 4: CI/CD pipeline optimizado

Ejecuta múltiples herramientas en paralelo sin instalar nada:

```bash
#!/bin/bash

# .github/workflows/analyze.yml (con cpx)
cpx phpstan/phpstan -- analyse app/ &
cpx vimeo/psalm -- --php-version=8.2 &
cpx rector/rector -- process app/ --dry-run &

wait
echo "✓ Análisis completado"
```

## Configuración avanzada

### Archivo `cpx.json`

Personaliza el comportamiento de CPX:

```json
{
  "prefer-local": true,
  "cache": true,
  "cache-dir": "/tmp/cpx-cache",
  "timeout": 600,
  "packages": {
    "phpstan/phpstan": {
      "version": "^1.10",
      "prefer-local": true
    },
    "vimeo/psalm": {
      "version": "^5.0"
    }
  }
}
```

### Variables de entorno

```bash
export CPX_PREFER_LOCAL=true
export CPX_TIMEOUT=600
export CPX_CACHE_DIR=~/.cpx/cache

cpx phpstan/phpstan -- analyse app/
```

## Integración con Laravel Pint

CPX 2.0 se integra perfectamente con la nueva feature de Pint para formatear Blade:

```bash
cpx laravel/pint -- --blade

# O con configuración personalizada
cpx laravel/pint -- --blade --fix app/Views/
```

## Ventajas en testing

CPX simplifica ejecutar herramientas de testing sin añadir peso:

```php
<?php

namespace Tests;

use Symfony\Component\Process\Process;

class CodeQualityTest extends TestCase
{
    public function test_code_passes_phpstan()
    {
        $process = new Process([
            'cpx',
            'phpstan/phpstan',
            '--',
            'analyse',
            'app/',
            '--level=9'
        ]);

        $process->run();
        
        $this->assertTrue(
            $process->isSuccessful(),
            'PHPStan analysis failed: ' . $process->getErrorOutput()
        );
    }
}
```

## Troubleshooting común

### "CPX no encontrado"

```bash
composer global require phpstan/phpstan-shim:2.0
export PATH="$HOME/.composer/vendor/bin:$PATH"
```

### Timeout en herramientas pesadas

```json
{
  "timeout": 1200
}
```

### Problema con permisos en Docker

```dockerfile
RUN composer global require phpstan/phpstan-shim:2.0 && \
    chmod +x /root/.composer/vendor/bin/cpx
```

## Conclusión

CPX 2.0 representa un cambio de paradigma en cómo manejamos dependencias en proyectos Laravel. Ya no necesitas contaminar tu `composer.json` con herramientas que solo usas ocasionalmente.

Es especialmente potente para:
- **Agentes IA** que necesitan ejecutar análisis aislados
- **CI/CD pipelines** que ejecutan múltiples herramientas
- **Equipos grandes** que quieren mantener el `composer.json` limpio
- **Microservicios** con responsabilidades específicas

La integración con Laravel Jobs, Commands y la salida JSON hacen de CPX una herramienta indispensable para la automatización moderna.

## Puntos clave

- **CPX ejecuta paquetes Composer sin instalarlos** en tu proyecto
- **Prefiere binarios locales** si ya están instalados, optimizando recursos
- **Retorna JSON** automáticamente para agentes IA y automatización
- **Reduce el peso del proyecto** eliminando dependencias innecesarias
- **Integración perfecta** con Laravel Jobs, Commands y Artisan
- **Paralización eficiente** para pipelines CI/CD complejos
- **Configurable** con `cpx.json` para comportamiento personalizado
- **Ideal para herramientas ocasionales** como análisis y formateo de código
- **Compatible con nuevas features** como Blade formatting en Pint
- **Especialmente útil** en arquitecturas impulsadas por agentes IA