---
title: 'phpcpd-next en Laravel: Detecta Código Duplicado Automáticamente'
description: 'Guía completa para integrar phpcpd-next en tus proyectos Laravel y eliminar código duplicado de forma automática en CI/CD.'
pubDate: '2026-07-04'
tags: ['laravel', 'php', 'calidad-código', 'herramientas', 'devops']
---

## Introducción

El código duplicado es uno de los peores enemigos del mantenimiento de software. No solo aumenta la deuda técnica, sino que también incrementa el riesgo de bugs cuando necesitas hacer cambios y olvidas actualizar todas las copias. 

**phpcpd-next** es una herramienta moderna que detecta automáticamente código duplicado en tus proyectos PHP, incluyendo clones reordenados y parciales. A diferencia de su predecesor (phpcpd de Sebastian Bergmann que ya no se mantiene), phpcpd-next es:

- **Sin dependencias externas**: No requiere librerías complejas
- **Compatible con PHP 8.5+**: Aprovecha las últimas características del lenguaje
- **Detecta clones inteligentes**: Encuentra copias incluso si el código está ligeramente modificado
- **Ideal para CI/CD**: Se integra perfectamente en pipelines automatizados

En este artículo aprenderás a instalar, configurar e integrar phpcpd-next en tus proyectos Laravel para mantener la calidad del código bajo control.

## ¿Qué es la duplicación de código?

La duplicación de código ocurre cuando la misma lógica o bloques de código similares existen en múltiples lugares. Por ejemplo:

```php
// Archivo 1: app/Services/OrderService.php
public function calculateDiscount($amount, $customerType)
{
    $discount = 0;
    
    if ($customerType === 'premium') {
        $discount = $amount * 0.20;
    } elseif ($customerType === 'regular') {
        $discount = $amount * 0.10;
    }
    
    return $amount - $discount;
}

// Archivo 2: app/Services/InvoiceService.php
public function calculateDiscount($amount, $customerType)
{
    $discount = 0;
    
    if ($customerType === 'premium') {
        $discount = $amount * 0.20;
    } elseif ($customerType === 'regular') {
        $discount = $amount * 0.10;
    }
    
    return $amount - $discount;
}
```

Este es un ejemplo clásico de **violación del principio DRY** (Don't Repeat Yourself). Si necesitas cambiar la lógica de descuento, debes actualizar dos lugares. phpcpd-next te ayuda a identificar exactamente estos problemas.

## Instalación de phpcpd-next

### Paso 1: Instalar la herramienta

La forma más simple es instalar phpcpd-next globalmente con Composer:

```bash
composer global require bartlett/phpcpd-next
```

O si prefieres instalarlo solo en tu proyecto Laravel:

```bash
composer require --dev bartlett/phpcpd-next
```

### Paso 2: Verificar la instalación

```bash
phpcpd --version
```

Deberías ver algo como:

```
phpcpd version 1.0.0
```

## Configuración básica en Laravel

### Uso desde línea de comandos

El comando más básico analiza toda tu carpeta `app`:

```bash
phpcpd app/
```

La salida te mostrará algo como:

```
phpcpd 1.0.0 by Christoph M. Becker

Found 2 exact clones with 8 duplicated lines in 2 files:

  18 duplicate lines out of 150 total lines (12.00%)

  - app/Services/OrderService.php (5 lines)
  - app/Services/InvoiceService.php (5 lines)

Duration: 0.123 seconds
```

### Análisis de directorios específicos

Si quieres analizar solo ciertos directorios:

```bash
# Solo servicios y modelos
phpcpd app/Services app/Models

# Excluir directorios
phpcpd app/ --exclude=app/Console,app/Jobs
```

### Opciones útiles de phpcpd-next

```bash
# Establecer un umbral mínimo de líneas duplicadas
phpcpd app/ --min-lines 5

# Establecer un umbral mínimo de tokens
phpcpd app/ --min-tokens 50

# Exportar resultados en formato JSON
phpcpd app/ --output-json report.json

# Ver solo un resumen
phpcpd app/ --quiet
```

## Integración en Laravel

### Crear un comando Artisan personalizado

Para facilitar el análisis en tu equipo, crea un comando Artisan:

```bash
php artisan make:command AnalyzeDuplicateCode
```

Edita `app/Console/Commands/AnalyzeDuplicateCode.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class AnalyzeDuplicateCode extends Command
{
    protected $signature = 'code:analyze-duplicates {--min-lines=5} {--exclude=} {--json}';
    protected $description = 'Detecta código duplicado usando phpcpd-next';

    public function handle()
    {
        $minLines = $this->option('min-lines');
        $exclude = $this->option('exclude');
        $isJson = $this->option('json');

        $command = ['phpcpd', 'app/', "--min-lines={$minLines}"];

        if ($exclude) {
            $excludeDirs = implode(',', explode(',', $exclude));
            $command[] = "--exclude={$excludeDirs}";
        }

        if ($isJson) {
            $command[] = '--output-json=phpcpd-report.json';
        }

        $this->info('🔍 Analizando código duplicado...');

        $process = new Process($command);
        $process->setTty(true);
        $exitCode = $process->run();

        if ($exitCode === 0) {
            $this->info('✅ No se encontró código duplicado significativo.');
        } else {
            $this->warn('⚠️ Se encontraron posibles duplicados.');
        }

        if ($isJson && file_exists('phpcpd-report.json')) {
            $this->info('📊 Reporte JSON guardado en: phpcpd-report.json');
        }

        return $exitCode;
    }
}
```

Ahora puedes ejecutar:

```bash
# Análisis básico
php artisan code:analyze-duplicates

# Con opciones personalizadas
php artisan code:analyze-duplicates --min-lines=10 --exclude=Console,Jobs

# Generar reporte JSON
php artisan code:analyze-duplicates --json
```

## Integración en CI/CD

### GitHub Actions

Crea `.github/workflows/code-quality.yml`:

```yaml
name: Calidad de Código

on: [push, pull_request]

jobs:
  analyze-duplicates:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Instalar PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.5'

      - name: Instalar dependencias
        run: composer install

      - name: Instalar phpcpd-next
        run: composer global require bartlett/phpcpd-next

      - name: Analizar código duplicado
        run: phpcpd app/ --min-lines=5 --output-json=phpcpd-report.json
        continue-on-error: true

      - name: Comentar resultados en PR
        if: github.event_name == 'pull_request'
        run: |
          if [ -f phpcpd-report.json ]; then
            echo "## 📊 Reporte de Código Duplicado" >> $GITHUB_STEP_SUMMARY
            cat phpcpd-report.json >> $GITHUB_STEP_SUMMARY
          fi
```

### GitLab CI

Crea `.gitlab-ci.yml`:

```yaml
stages:
  - analyze

code-quality:
  stage: analyze
  image: php:8.5-cli
  script:
    - composer global require bartlett/phpcpd-next
    - phpcpd app/ --min-lines=5 --output-json=phpcpd-report.json || true
  artifacts:
    reports:
      codequality: phpcpd-report.json
    paths:
      - phpcpd-report.json
    expire_in: 1 week
  allow_failure: true
```

## Refactorizar código duplicado

Una vez identificado el duplicado, aquí hay estrategias para eliminarlo:

### Opción 1: Extraer a un método compartido

Antes:

```php
// Duplicado en dos servicios
$discount = 0;
if ($customerType === 'premium') {
    $discount = $amount * 0.20;
} elseif ($customerType === 'regular') {
    $discount = $amount * 0.10;
}
return $amount - $discount;
```

Después:

```php
// app/Support/PricingHelper.php
class PricingHelper
{
    public static function applyDiscount($amount, $customerType)
    {
        $discountRate = match($customerType) {
            'premium' => 0.20,
            'regular' => 0.10,
            default => 0,
        };

        return $amount * (1 - $discountRate);
    }
}

// Uso en ambos servicios
return PricingHelper::applyDiscount($amount, $customerType);
```

### Opción 2: Usar un Trait

```php
// app/Traits/HasDiscountCalculation.php
trait HasDiscountCalculation
{
    public function calculateDiscount($amount, $customerType)
    {
        return $amount * match($customerType) {
            'premium' => 0.80,
            'regular' => 0.90,
            default => 1.0,
        };
    }
}

// Usar en clases
class OrderService
{
    use HasDiscountCalculation;
}

class InvoiceService
{
    use HasDiscountCalculation;
}
```

### Opción 3: Herencia o Composición

```php
// app/Services/BaseDiscountService.php
abstract class BaseDiscountService
{
    protected function getDiscountRate($customerType): float
    {
        return match($customerType) {
            'premium' => 0.20,
            'regular' => 0.10,
            default => 0,
        };
    }
}

// Heredar
class OrderService extends BaseDiscountService
{
    public function calculateDiscount($amount, $customerType)
    {
        return $amount - ($amount * $this->getDiscountRate($customerType));
    }
}
```

## Configuración avanzada

### Archivo de configuración personalizado

Crea `phpcpd.config.php` en la raíz del proyecto:

```php
<?php

return [
    'minLines' => 5,
    'minTokens' => 50,
    'directories' => [
        'app',
    ],
    'exclude' => [
        'app/Console',
        'app/Jobs',
        'tests',
    ],
    'fuzzyMatching' => true,
];
```

Luego úsalo con:

```bash
phpcpd --configuration phpcpd.config.php
```

### Excepciones por archivo

Hay casos donde el código duplicado es justificado (test fixtures, migraciones). Puedes excluirlos:

```bash
phpcpd app/ --exclude=database/migrations,tests
```

## Monitoreo continuo

### Script de pre-commit

Crea `.git/hooks/pre-commit`:

```bash
#!/bin/bash

echo "🔍 Verificando código duplicado..."

phpcpd app/ --min-lines=5 --min-tokens=50

if [ $? -ne 0 ]; then
    echo "❌ Se encontró código duplicado. Arreglalo antes de hacer commit."
    exit 1
fi

echo "✅ No hay duplicados significativos."
exit 0
```

Hazlo ejecutable:

```bash
chmod +x .git/hooks/pre-commit
```

## Mejores prácticas

1. **Establece umbrales realistas**: No todos los duplicados son problemas. Usa `--min-lines=5` o superior.

2. **Integra en CI/CD pero no bloquees**: Usa `continue-on-error: true` para informar sin fallar el pipeline.

3. **Revisa regularmente**: Ejecuta phpcpd-next en cada PR para evitar que se acumule deuda técnica.

4. **Refactoriza de forma incremental**: No intentes eliminar todo el código duplicado de una vez.

5. **Documenta excepciones**: Si ignoras duplicados, deja un comentario explicando por qué.

6. **Combina con otras herramientas**: Usa phpcpd-next junto con PHPStan, Psalm o Laravel Pint.

## Puntos clave

- **phpcpd-next** es una herramienta moderna y mantenida para detectar código duplicado en PHP sin dependencias complejas
- Se instala fácilmente vía Composer y funciona con PHP 8.5+
- Detecta clones exactos y aproximados, incluso código reordenado
- Integración en Laravel es simple mediante comandos Artisan personalizados
- Se configura fácilmente en pipelines CI/CD (GitHub Actions, GitLab CI, etc.)
- El refactoring debe hacerse mediante métodos compartidos, Traits, herencia o composición
- Los umbrales configurables (`--min-lines`, `--min-tokens`) evitan falsos positivos
- Úsalo como alerta temprana pero no bloquees completamente en CI/CD
- Combínalo con análisis estáticos y revisiones de código para máxima efectividad
- El monitoreo continuo mediante pre-commit hooks mantiene la calidad a largo plazo