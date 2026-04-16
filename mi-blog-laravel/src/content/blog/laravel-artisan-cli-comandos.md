---
title: 'Laravel Artisan: guía completa de comandos CLI'
description: 'Domina Artisan, la herramienta CLI de Laravel. Los comandos más útiles para crear controladores, migraciones, modelos, jobs y gestionar tu app desde la terminal.'
pubDate: '2026-04-16'
tags: ['laravel', 'artisan', 'conceptos', 'roadmap']
---

Si llevas poco tiempo con Laravel, es probable que ya hayas ejecutado `php artisan serve` para levantar tu servidor local. Pero Artisan es mucho más que eso. Es la interfaz de línea de comandos integrada en Laravel, y conocerla bien puede ahorrarte decenas de minutos cada día.

En esta guía repasamos los comandos más importantes: desde generar clases hasta limpiar cachés, gestionar migraciones y crear tus propios comandos personalizados.

## ¿Qué es Artisan?

Artisan es la CLI oficial de Laravel. Está construida sobre el componente Console de Symfony y viene incluida en cada proyecto Laravel. Con ella puedes generar código automáticamente, ejecutar migraciones, gestionar la caché, interactuar con tu app en tiempo real y mucho más.

Para ver todos los comandos disponibles ejecuta:

```bash
php artisan list
```

Y para obtener ayuda sobre un comando específico:

```bash
php artisan help make:controller
```

## Comandos make: generación de código

Estos son los que usarás a diario. El prefijo `make:` indica que el comando va a crear un nuevo archivo en tu proyecto.

### Controladores

```bash
# Controlador básico
php artisan make:controller ProductController

# Controlador con todos los métodos resource (index, create, store, show, edit, update, destroy)
php artisan make:controller ProductController --resource

# Controlador de acción única (__invoke)
php artisan make:controller ShowDashboardController --invokable

# Controlador resource con el modelo ya vinculado
php artisan make:controller ProductController --resource --model=Product
```

### Modelos

```bash
# Modelo básico
php artisan make:model Product

# Modelo con su migración incluida (-m es el shorthand de --migration)
php artisan make:model Product -m

# Modelo + migración + factory + seeder + controlador resource de una sola vez
php artisan make:model Product -mfsc --resource
```

### Migraciones

```bash
# Crear una migración nueva
php artisan make:migration create_products_table

# Migración para modificar una tabla existente
php artisan make:migration add_price_to_products_table --table=products
```

### Seeders y Factories

```bash
php artisan make:seeder ProductSeeder
php artisan make:factory ProductFactory --model=Product
```

### Jobs, Events y Listeners

```bash
# Job para la cola
php artisan make:job SendWelcomeEmail

# Evento
php artisan make:event UserRegistered

# Listener que escucha un evento
php artisan make:listener SendWelcomeEmailListener --event=UserRegistered
```

### Middleware, Requests y Policies

```bash
# Middleware personalizado
php artisan make:middleware EnsureUserIsAdmin

# Form Request para validación
php artisan make:request StoreProductRequest

# Policy para autorización
php artisan make:policy ProductPolicy --model=Product
```

### Otros archivos útiles

```bash
php artisan make:mail OrderShipped
php artisan make:notification InvoicePaid
php artisan make:resource ProductResource
php artisan make:rule UniqueSlug
php artisan make:enum OrderStatus   # Laravel 11+
```

## Comandos de caché y optimización

Cuando cambias configuraciones, rutas o vistas, Laravel puede servir versiones en caché. Estos comandos limpian esas cachés.

```bash
# Limpiar la caché de configuración (.env y config/)
php artisan config:clear

# Limpiar la caché de la aplicación (Cache::put(), etc.)
php artisan cache:clear

# Limpiar la caché de rutas
php artisan route:clear

# Limpiar las vistas compiladas de Blade
php artisan view:clear

# Limpiar todo de una vez (el más usado en desarrollo)
php artisan optimize:clear

# En producción: cachear todo para mayor rendimiento
php artisan optimize
```

Un error muy común cuando cambias valores en `.env` es que el cambio no surte efecto. Casi siempre se soluciona con `php artisan config:clear`.

## Comandos de migraciones

```bash
# Ejecutar todas las migraciones pendientes
php artisan migrate

# Revertir el último lote de migraciones
php artisan migrate:rollback

# Revertir N lotes
php artisan migrate:rollback --step=3

# Borrar toda la base de datos y volver a migrar desde cero
php artisan migrate:fresh

# Lo mismo pero ejecutando también los seeders
php artisan migrate:fresh --seed

# Ver el estado de cada migración (ejecutada o pendiente)
php artisan migrate:status
```

El comando `migrate:fresh --seed` es el que más usarás durante el desarrollo para resetear la base de datos a un estado limpio con datos de prueba.

## Comandos de colas (queues)

Si tu app procesa jobs en segundo plano, necesitas un worker que los ejecute.

```bash
# Iniciar el worker (procesa jobs y luego sigue escuchando)
php artisan queue:work

# Worker que se detiene si la cola está vacía (útil en producción con Supervisor)
php artisan queue:work --stop-when-empty

# Procesar solo la cola "emails"
php artisan queue:work --queue=emails

# Escuchar la cola (reinicia el proceso en cada job, más lento, útil en desarrollo)
php artisan queue:listen

# Ver jobs fallidos
php artisan queue:failed

# Reintentar un job fallido por su ID
php artisan queue:retry 5

# Reintentar todos los jobs fallidos
php artisan queue:retry all
```

## Otros comandos esenciales

```bash
# Generar la APP_KEY en .env (necesario en instalaciones nuevas)
php artisan key:generate

# Levantar el servidor de desarrollo
php artisan serve

# Levantar en un puerto específico
php artisan serve --port=8080

# Abrir una consola interactiva con acceso a toda la app (REPL)
php artisan tinker

# Listar todas las rutas registradas
php artisan route:list

# Listar rutas filtradas por nombre
php artisan route:list --name=product

# Poner la app en modo mantenimiento
php artisan down

# Sacar la app del modo mantenimiento
php artisan up
```

`php artisan tinker` merece una mención especial. Es una consola interactiva basada en PsySH donde puedes ejecutar código PHP con acceso completo a tu app: crear modelos, probar queries de Eloquent, llamar a servicios... ideal para depurar sin tocar archivos.

## Crear comandos personalizados con make:command

Uno de los puntos más potentes de Artisan es que puedes crear tus propios comandos. Por ejemplo, un comando que envíe un resumen diario por email o que limpie registros antiguos.

```bash
php artisan make:command SendDailyReport
```

Esto genera el archivo `app/Console/Commands/SendDailyReport.php`:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SendDailyReport extends Command
{
    // El nombre y firma del comando (lo que escribirás en la terminal)
    protected $signature = 'report:daily {--date= : Fecha específica (Y-m-d)}';

    // Descripción que aparece en php artisan list
    protected $description = 'Envía el reporte diario de actividad por email';

    public function handle(): int
    {
        $date = $this->option('date') ?? now()->toDateString();

        $this->info("Generando reporte para: {$date}");

        // Aquí iría tu lógica real
        $rows = [
            ['Pedidos nuevos', 42],
            ['Usuarios registrados', 18],
            ['Ingresos', '$1.240,00'],
        ];

        $this->table(['Métrica', 'Valor'], $rows);

        $this->newLine();
        $this->info('Reporte enviado correctamente.');

        // Devuelve 0 si todo fue bien, 1 si hubo error
        return Command::SUCCESS;
    }
}
```

Para ejecutarlo:

```bash
php artisan report:daily
php artisan report:daily --date=2026-04-15
```

También puedes programarlo en `routes/console.php` (Laravel 11+) o en `app/Console/Kernel.php` (Laravel 10) para que se ejecute automáticamente:

```php
// routes/console.php (Laravel 11)
use Illuminate\Support\Facades\Schedule;

Schedule::command('report:daily')->dailyAt('08:00');
```

Y activar el scheduler en el cron del sistema con una sola línea:

```bash
* * * * * cd /ruta/a/tu/proyecto && php artisan schedule:run >> /dev/null 2>&1
```

## Consejos prácticos

**Alias de terminal.** Si usas Artisan constantemente, crea un alias en tu `.bashrc` o `.zshrc`:

```bash
alias art="php artisan"
```

Así puedes escribir `art migrate` en lugar de `php artisan migrate`.

**Dry run en migraciones.** Puedes ver el SQL que ejecutaría una migración sin aplicarla:

```bash
php artisan migrate --pretend
```

**Comandos en tests.** Puedes ejecutar comandos Artisan dentro de tus tests de Feature:

```php
$this->artisan('report:daily')->assertExitCode(0);
```

Artisan es una herramienta que crece contigo. Al principio usarás solo `serve`, `migrate` y los `make:`. Con el tiempo descubrirás que puedes automatizar casi cualquier tarea recurrente de tu aplicación con un comando personalizado.
