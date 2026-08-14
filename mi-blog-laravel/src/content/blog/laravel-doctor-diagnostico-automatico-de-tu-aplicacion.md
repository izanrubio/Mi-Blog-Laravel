---
title: 'Laravel Doctor: Diagnóstico automático de tu aplicación'
description: 'Descubre cómo usar Laravel Doctor para diagnosticar y reparar automáticamente problemas de configuración, base de datos y almacenamiento.'
pubDate: '2026-08-04'
tags: ['laravel', 'debugging', 'devops', 'herramientas']
---

## Laravel Doctor: Diagnóstico automático de tu aplicación

Laravel es un framework robusto, pero mantener una aplicación en producción requiere estar atento a múltiples aspectos: variables de entorno, configuración de la base de datos, permisos de carpetas, colas funcionando correctamente... La buena noticia es que Laravel ahora incluye una herramienta oficial que automatiza este proceso: **Laravel Doctor**.

En este artículo te mostraré cómo usar Laravel Doctor para diagnosticar y reparar automáticamente los problemas más comunes en tus aplicaciones Laravel.

## ¿Qué es Laravel Doctor?

Laravel Doctor es una nueva herramienta incluida en Laravel que verifica el estado de tu aplicación ejecutando un único comando Artisan:

```bash
php artisan doctor
```

Este comando realiza una inspección exhaustiva de:

- **Entorno**: variables .env necesarias
- **Configuración**: settings críticos del framework
- **Base de datos**: conexión y estado
- **Colas**: workers y Redis (si está configurado)
- **Almacenamiento**: permisos de carpetas
- **Caché**: funcionamiento del sistema de caché

Lo más interesante es que **Doctor puede auto-reparar muchos de estos problemas** de forma segura.

## Instalación y configuración inicial

Laravel Doctor viene incluido en Laravel 13, pero si usas una versión anterior, puedes instalarlo a través de Composer:

```bash
composer require laravel/doctor
```

Una vez instalado, ejecuta el comando para ver el estado de tu aplicación:

```bash
php artisan doctor
```

La salida será algo como esto:

```
  Checking your application's health...

✓ Environment file exists
✓ App key is set
✓ Database connection works
✓ Cache driver is working
✗ Storage symlink missing
✗ Queue supervisor is not running
```

## Diagnósticos disponibles

### 1. Verificación del entorno

Doctor comprueba que tu archivo `.env` existe y contiene las variables necesarias:

```php
// config/doctor.php
'checks' => [
    'environment' => true,
    'app_key' => true,
],
```

Si falta el archivo `.env`, Doctor te lo indicará inmediatamente.

### 2. Conexión a la base de datos

Verifica que tu aplicación puede conectarse correctamente a la BD:

```bash
php artisan doctor
# ✓ Database connection works
# ✓ All migrations are up to date
```

Si hay problemas, Doctor indicará exactamente cuál es el fallo:

```
✗ Cannot connect to database
  Error: SQLSTATE[HY000]: General error: 
  1030 Got error 28 from storage engine
```

### 3. Sistema de colas

Si tienes jobs configurados, Doctor verifica que las colas estén funcionando:

```bash
php artisan doctor
# ✓ Queue connection works
# ✓ Redis is accessible
# ✗ No queue workers are running
```

## Auto-reparación de problemas

La característica más valiosa de Doctor es su capacidad para **auto-reparar problemas detectados**. Ejecuta el comando con el flag `--fix`:

```bash
php artisan doctor --fix
```

### Problemas que Doctor puede reparar automáticamente

**1. Crear enlace simbólico de almacenamiento:**

```bash
php artisan doctor --fix
# ✓ Created storage symlink
```

Esto es equivalente a ejecutar `php artisan storage:link`.

**2. Corregir permisos de carpetas:**

```bash
php artisan doctor --fix
# ✓ Fixed permissions for storage/logs
# ✓ Fixed permissions for bootstrap/cache
```

**3. Ejecutar migraciones pendientes:**

```bash
php artisan doctor --fix
# ✓ Ran 3 pending migrations
```

**4. Limpiar caché corrupto:**

```bash
php artisan doctor --fix
# ✓ Cleared application cache
# ✓ Cleared configuration cache
```

## Crear diagnósticos personalizados

Puedes extender Doctor para crear tus propios diagnósticos. Crea un proveedor de servicios personalizado:

```php
<?php

namespace App\Providers;

use Illuminate\Foundation\Providers\DoctorProvider;
use Illuminate\Foundation\Diagnostics\Check;

class CustomDoctorProvider extends DoctorProvider
{
    public function registerChecks()
    {
        $this->registerCheck(
            new class extends Check {
                public function name()
                {
                    return 'Custom API Configuration';
                }

                public function description()
                {
                    return 'Verify API credentials are configured';
                }

                public function run()
                {
                    if (!config('services.external_api.key')) {
                        return $this->failed('API key is not configured');
                    }

                    return $this->passed();
                }

                public function fix()
                {
                    // Intenta auto-reparar el problema
                    return $this->passed();
                }
            }
        );
    }
}
```

Luego registra el proveedor en `config/app.php`:

```php
'providers' => [
    // ...
    App\Providers\CustomDoctorProvider::class,
],
```

Ahora tus diagnósticos personalizados se ejecutarán junto con los de Doctor:

```bash
php artisan doctor
# ✓ Custom API Configuration verified
```

## Diagnósticos avanzados: integración con CI/CD

Doctor es especialmente útil en pipelines de CI/CD. Aquí te muestro cómo integrarlo con GitHub Actions:

```yaml
# .github/workflows/doctor.yml
name: Application Health Check

on: [push, pull_request]

jobs:
  doctor:
    runs-on: ubuntu-latest

    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
          extensions: pdo_mysql, redis

      - name: Install dependencies
        run: composer install

      - name: Copy .env
        run: cp .env.testing .env

      - name: Generate app key
        run: php artisan key:generate

      - name: Run Laravel Doctor
        run: php artisan doctor --fix

      - name: Run tests
        run: php artisan test
```

De esta forma, Doctor validará tu aplicación antes de ejecutar los tests.

## Caso de uso real: onboarding de nuevos desarrolladores

Imagina que un nuevo desarrollador clona tu repositorio. Con Laravel Doctor, puede validar su entorno en segundos:

```bash
git clone https://github.com/tu-empresa/app.git
cd app
composer install
cp .env.example .env
php artisan key:generate

# ¡Aquí viene la magia!
php artisan doctor --fix

# La salida indicará exactamente qué está mal y qué se reparó
```

Sin Doctor, el nuevo desarrollador tendría que:

1. Crear manualmente el enlace simbólico de storage
2. Ajustar permisos de carpetas
3. Verificar la conexión a la BD manualmente
4. Comprobar si Redis está corriendo
5. Ejecutar las migraciones
6. Etc...

Con Doctor, todo se valida y repara automáticamente.

## Mejores prácticas

### 1. Ejecutar Doctor en cada deployment

```bash
#!/bin/bash
# scripts/deploy.sh

cd /var/www/app

# Pull cambios
git pull origin main

# Instalar dependencias
composer install --no-dev --optimize-autoloader

# Ejecutar diagnostics con auto-fix
php artisan doctor --fix

# Reiniciar servicios
supervisorctl restart all
```

### 2. Monitorear Doctor en producción

Puedes crear un job que ejecute Doctor periódicamente:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Artisan;
use App\Models\HealthCheck;

class RunDoctorDiagnostics implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle()
    {
        $output = [];
        
        Artisan::call('doctor', ['--fix' => true], $output);
        
        // Guarda el resultado en la BD
        HealthCheck::create([
            'status' => 'completed',
            'output' => implode("\n", $output),
            'checked_at' => now(),
        ]);
    }
}
```

Luego programa el job:

```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    $schedule->job(new RunDoctorDiagnostics)
        ->daily()
        ->at('02:00');
}
```

### 3. Crear un dashboard personalizado

Puedes crear una vista que muestre el estado de tu aplicación en tiempo real:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Artisan;

class HealthController extends Controller
{
    public function show()
    {
        $output = [];
        Artisan::call('doctor', [], $output);
        
        return view('health', [
            'diagnostics' => $output,
            'status' => $this->parseStatus($output),
        ]);
    }

    private function parseStatus($output)
    {
        $failures = collect($output)
            ->filter(fn($line) => str_starts_with($line, '✗'))
            ->count();

        return $failures === 0 ? 'healthy' : 'degraded';
    }
}
```

## Limitaciones de Doctor

Es importante conocer qué Doctor **no puede reparar**:

- **Problemas de código**: errores lógicos en tu aplicación
- **Configuración de servicios externos**: claves de API inválidas
- **Hardware**: falta de espacio en disco
- **Network**: problemas de conectividad de red
- **Credenciales de BD**: usuario/contraseña incorrectos

En estos casos, Doctor solo reportará el problema y tú tendrás que resolverlo manualmente.

## Conclusión

Laravel Doctor es una herramienta simple pero poderosa que automatiza una tarea repetitiva y propensa a errores. Es especialmente valiosa en:

- **Deployments automáticos**: valida que todo esté correcto antes de iniciar la aplicación
- **Onboarding**: nuevos desarrolladores pueden verificar su entorno rápidamente
- **Mantenimiento**: detecta problemas antes de que afecten a los usuarios
- **CI/CD pipelines**: asegura que solo código en buen estado llegue a producción

## Puntos clave

- **Laravel Doctor** es una herramienta oficial que diagnostica automáticamente el estado de tu aplicación
- Ejecuta `php artisan doctor` para ver un reporte de salud de tu app
- El flag `--fix` permite auto-reparar muchos problemas comunes de forma segura
- Puedes crear diagnósticos personalizados extendiendo la funcionalidad base
- Es ideal para integración en pipelines de CI/CD y deployments automáticos
- Doctor no puede reparar problemas lógicos de código ni credenciales inválidas
- Usar Doctor regularmente reduce problemas en producción y mejora la experiencia del desarrollador