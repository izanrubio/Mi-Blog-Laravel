---
modulo: 1
leccion: 5
title: 'Artisan CLI — tu mejor amigo'
description: 'Domina Artisan, la poderosa herramienta de línea de comandos de Laravel: genera código, ejecuta migraciones, limpia cachés y crea tus propios comandos.'
duracion: '15 min'
quiz:
  - pregunta: '¿Qué comando de Artisan genera un nuevo modelo junto con su migración y controlador de recursos?'
    opciones:
      - 'php artisan make:model Article --all'
      - 'php artisan make:model Article -mcr'
      - 'php artisan generate Article'
      - 'php artisan scaffold Article'
    correcta: 1
    explicacion: 'El flag -mcr en "php artisan make:model Article -mcr" genera el modelo, su migración (-m), su controlador de recursos (-c) y su factory (-r no, en realidad -r es resource controller). La opción --all genera modelo, migración, factory, seeder, controlador de recursos y form requests en un solo comando.'
  - pregunta: '¿Qué comando de Artisan deshace la última migración ejecutada?'
    opciones:
      - 'php artisan migrate:undo'
      - 'php artisan migrate:down'
      - 'php artisan migrate:rollback'
      - 'php artisan migrate:revert'
    correcta: 2
    explicacion: 'El comando "php artisan migrate:rollback" deshace el último lote de migraciones. Puedes usar --step=N para indicar cuántos lotes deshacer. "php artisan migrate:fresh" borra todas las tablas y vuelve a migrar desde cero.'
  - pregunta: '¿Qué hace el comando "php artisan tinker"?'
    opciones:
      - 'Abre el editor de código integrado de Laravel'
      - 'Inicia una consola REPL interactiva para ejecutar código PHP en el contexto de la aplicación'
      - 'Comprueba si hay errores de sintaxis en el código'
      - 'Genera documentación automática de la API'
    correcta: 1
    explicacion: 'Tinker es una REPL (Read-Eval-Print Loop) que te permite ejecutar código PHP interactivamente con acceso completo a tu aplicación Laravel: modelos, facades, helpers, etc. Es perfecta para probar código, hacer consultas rápidas a la base de datos o experimentar.'
---

## ¿Qué es Artisan?

**Artisan** es la interfaz de línea de comandos (CLI) incluida en Laravel. Es una herramienta increíblemente poderosa que te permite realizar decenas de tareas sin abrir el editor: generar código, gestionar migraciones, limpiar cachés, ejecutar seeders, crear comandos personalizados y mucho más.

Para ver todos los comandos disponibles:

```bash
php artisan list
```

Para obtener ayuda sobre un comando específico:

```bash
php artisan help make:controller
```

---

## Comandos más usados — Referencia rápida

### Servidor de desarrollo

```bash
# Arranca el servidor en http://localhost:8000
php artisan serve

# Especificar host y puerto
php artisan serve --host=0.0.0.0 --port=9000
```

### Información del proyecto

```bash
# Ver la versión de Laravel
php artisan --version

# Ver todas las rutas registradas
php artisan route:list

# Ver rutas filtradas por nombre
php artisan route:list --name=article

# Ver solo las rutas de la API
php artisan route:list --path=api
```

---

## Generadores de código — `make:`

Los comandos `make:` son los más útiles del día a día. Generan archivos con la estructura básica correcta para que no tengas que escribirlos desde cero.

### Controladores

```bash
# Controlador básico
php artisan make:controller ArticleController

# Controlador de recursos (con métodos index, create, store, show, edit, update, destroy)
php artisan make:controller ArticleController --resource

# Controlador de API (sin métodos create y edit, que son formularios HTML)
php artisan make:controller Api/ArticleController --api

# Controlador invocable (un solo método __invoke)
php artisan make:controller ShowDashboardController --invokable
```

### Modelos

```bash
# Solo el modelo
php artisan make:model Article

# Modelo con migración
php artisan make:model Article -m

# Modelo con migración, factory y seeder
php artisan make:model Article -mfs

# Modelo completo (migración, factory, seeder, controlador de recursos, form requests)
php artisan make:model Article --all
```

### Migraciones

```bash
# Crear una migración nueva
php artisan make:migration create_articles_table

# Migración para agregar columnas a una tabla existente
php artisan make:migration add_published_at_to_articles_table

# Laravel detecta el nombre y crea la estructura correcta automáticamente
```

### Seeders y Factories

```bash
# Crear un seeder
php artisan make:seeder ArticleSeeder

# Crear una factory
php artisan make:factory ArticleFactory
```

### Middleware

```bash
# Crear middleware
php artisan make:middleware EnsureUserIsAdmin
```

### Form Requests (validación)

```bash
# Crear un Form Request
php artisan make:request StoreArticleRequest
php artisan make:request UpdateArticleRequest
```

### Eventos, Listeners y Jobs

```bash
# Eventos
php artisan make:event ArticlePublished

# Listener
php artisan make:listener SendPublishedNotification --event=ArticlePublished

# Job para colas de trabajo
php artisan make:job ProcessArticleImages
```

---

## Gestión de migraciones

```bash
# Ejecutar todas las migraciones pendientes
php artisan migrate

# Ver el estado de las migraciones
php artisan migrate:status

# Deshacer la última migración (o lote)
php artisan migrate:rollback

# Deshacer N lotes
php artisan migrate:rollback --step=2

# Deshacer todas y volver a migrar
php artisan migrate:refresh

# Borrar todas las tablas y migrar desde cero
php artisan migrate:fresh

# Migrar y ejecutar seeders
php artisan migrate:fresh --seed
```

El comando que más usarás en desarrollo es:

```bash
php artisan migrate:fresh --seed
```

Te permite empezar con una base de datos limpia y datos de prueba en segundos.

---

## Seeders — poblar la base de datos

```bash
# Ejecutar todos los seeders (DatabaseSeeder)
php artisan db:seed

# Ejecutar un seeder específico
php artisan db:seed --class=ArticleSeeder
```

---

## Gestión de caché

```bash
# Limpiar la caché de la aplicación
php artisan cache:clear

# Limpiar la caché de rutas
php artisan route:clear

# Limpiar la caché de vistas Blade compiladas
php artisan view:clear

# Limpiar la caché de configuración
php artisan config:clear

# Limpiar todo de una vez
php artisan optimize:clear

# Cachear configuración, rutas y vistas (para producción)
php artisan optimize
```

En desarrollo, si cambias algo en `config/` o en `.env` y no se aplica, ejecuta:

```bash
php artisan config:clear
```

---

## Tinker — la consola interactiva

**Tinker** es una de las herramientas más útiles de Laravel. Te abre una consola PHP interactiva (REPL) con acceso completo a tu aplicación:

```bash
php artisan tinker
```

Dentro de Tinker puedes hacer prácticamente cualquier cosa:

```php
// Crear un usuario de prueba
>>> User::create(['name' => 'Test', 'email' => 'test@test.com', 'password' => bcrypt('password')]);

// Consultar la base de datos
>>> User::all()->count();
=> 5

>>> Article::where('published', true)->latest()->first();

// Probar helpers
>>> now()->addDays(7)->format('d/m/Y');
=> "23/04/2024"

// Probar el envío de correos
>>> Mail::to('test@test.com')->send(new App\Mail\WelcomeMail());

// Salir de Tinker
>>> exit
```

Tinker es perfecto para **depurar sin escribir rutas de prueba** y para explorar la API de Eloquent.

---

## Comandos de colas y tareas programadas

```bash
# Procesar las colas de trabajo
php artisan queue:work

# Procesar la cola con reintentos
php artisan queue:work --tries=3

# Ver los trabajos fallidos
php artisan queue:failed

# Reintentar trabajos fallidos
php artisan queue:retry all

# Ejecutar las tareas programadas (para usar con cron)
php artisan schedule:run

# Ejecutar el scheduler en modo desarrollo (sin cron)
php artisan schedule:work
```

---

## Crear tus propios comandos Artisan

Una de las funciones más potentes de Artisan es que puedes **crear tus propios comandos** personalizados:

```bash
php artisan make:command EnviarResumenSemanal
```

Esto crea el archivo `app/Console/Commands/EnviarResumenSemanal.php`:

```php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Mail\WeeklySummaryMail;
use Illuminate\Support\Facades\Mail;

class EnviarResumenSemanal extends Command
{
    // El nombre y firma del comando
    protected $signature = 'email:resumen-semanal {--dry-run : Solo muestra lo que haría sin enviar}';

    // Descripción que aparece en php artisan list
    protected $description = 'Envía el resumen semanal a todos los suscriptores';

    public function handle(): void
    {
        $users = User::where('subscribed', true)->get();

        if ($this->option('dry-run')) {
            $this->info("Se enviaría el resumen a {$users->count()} usuarios.");
            return;
        }

        $this->withProgressBar($users, function (User $user) {
            Mail::to($user)->send(new WeeklySummaryMail($user));
        });

        $this->newLine();
        $this->info('¡Resumen semanal enviado correctamente!');
    }
}
```

Y lo ejecutas así:

```bash
# Modo prueba
php artisan email:resumen-semanal --dry-run

# Ejecución real
php artisan email:resumen-semanal
```

---

## Comandos de mantenimiento

```bash
# Poner la aplicación en modo mantenimiento (muestra página de mantenimiento)
php artisan down

# Volver al modo normal
php artisan up

# Modo mantenimiento pero permitiendo tu IP
php artisan down --allow=192.168.1.100 --render="errors.503"

# Refrescar la caché de autoload de Composer
composer dump-autoload
```

---

## Tabla resumen de comandos esenciales

| Comando | Qué hace |
|---|---|
| `php artisan serve` | Servidor de desarrollo |
| `php artisan route:list` | Ver todas las rutas |
| `php artisan make:model X -mfsc` | Genera modelo con migracion, factory, seeder y controlador |
| `php artisan migrate` | Ejecuta migraciones |
| `php artisan migrate:fresh --seed` | BD limpia + datos de prueba |
| `php artisan tinker` | Consola interactiva |
| `php artisan optimize:clear` | Limpia toda la caché |
| `php artisan queue:work` | Procesa trabajos en cola |
| `php artisan down / up` | Modo mantenimiento |

Con Artisan dominas Laravel desde la terminal. En la siguiente lección escribirás tu primera ruta real y la harás responder con contenido de verdad.
