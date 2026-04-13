---
title: 'Novedades de Laravel 13 — Todo lo que cambia en la nueva versión'
description: 'Descubre las novedades de Laravel 13: nuevos requisitos de PHP, mejoras en Eloquent, Artisan, starter kits y el ecosistema del framework en 2026.'
pubDate: '2026-04-10'
tags: ['laravel', 'laravel-13', 'actualizacion', 'novedad']
---

# Novedades de Laravel 13 — Todo lo que cambia en la nueva versión

Laravel 13 llega siguiendo la cadencia anual del framework: una nueva versión mayor cada año en los primeros meses. Después de que Laravel 12 pusiera el foco en los starter kits modernos y la integración con Inertia 2, la versión 13 consolida esos cambios y añade mejoras en el núcleo del framework, herramientas de desarrollo y el ecosistema de pruebas.

En este artículo repasamos los cambios más relevantes para que sepas qué esperar si actualizas un proyecto existente o empiezas uno nuevo.

## PHP 8.3 como versión mínima

El cambio más directo y que afecta antes de tocar una sola línea de código: Laravel 13 requiere **PHP 8.3 o superior**.

```bash
# Verificar tu versión de PHP
php --version
# PHP 8.3.x o superior para Laravel 13
```

PHP 8.3 trajo mejoras que Laravel aprovecha en su núcleo:

```php
// Typed class constants (PHP 8.3)
class Status
{
    const string ACTIVE   = 'active';
    const string INACTIVE = 'inactive';
}

// json_validate() nativo (PHP 8.3)
if (json_validate($jsonString)) {
    $data = json_decode($jsonString, true);
}

// readonly en propiedades de clases anónimas
$obj = new readonly class('Laravel 13') {
    public function __construct(public string $name) {}
};
```

Si tienes PHP 8.2, necesitarás actualizarlo antes de usar Laravel 13.

## Starter kits modernizados

Laravel 13 mantiene y amplía los starter kits introducidos en Laravel 12, con actualizaciones a las versiones más recientes de cada tecnología:

```bash
# Nuevo proyecto con starter kit React
laravel new mi-proyecto --using=react

# Con Vue
laravel new mi-proyecto --using=vue

# Con Livewire
laravel new mi-proyecto --using=livewire

# API pura (sin frontend)
laravel new mi-proyecto --using=api
```

Los starter kits ahora incluyen:

- **React 19** con soporte completo para Server Components
- **Vue 3.5+** con la API de composición mejorada
- **Livewire 3** como opción fullstack sin JavaScript complejo
- **Inertia.js 2.x** como capa de comunicación entre Laravel y el frontend

## Mejoras en Eloquent

### `whereAny` y `whereAll` más expresivos

```php
// Buscar registros donde ALGUNO de los campos coincida
User::whereAny(['name', 'email', 'username'], 'like', '%juan%')->get();

// Buscar registros donde TODOS los campos cumplan la condición
Product::whereAll(['price', 'cost'], '>', 0)->get();

// Encadenables con otras condiciones
User::whereAny(['name', 'email'], 'like', "%$search%")
    ->where('active', true)
    ->get();
```

### Casting mejorado con AsCollection y AsEnumCollection

```php
// En el modelo
protected function casts(): array
{
    return [
        'tags'     => AsCollection::class,
        'statuses' => AsEnumCollection::of(Status::class),
    ];
}

// Uso
$user->tags->push('laravel');           // Collection
$order->statuses->contains(Status::Pending); // EnumCollection
```

### `explain()` para debugging de queries

```php
// Ver el plan de ejecución de una query Eloquent
$query = User::where('active', true)->with('posts');
dd($query->explain());
// Devuelve el EXPLAIN de MySQL/PostgreSQL directamente
```

## Nuevos helpers y funciones globales

```php
// str()->wrap() — envolver un string
str('Laravel')->wrap('[', ']');  // [Laravel]

// Number::spell() — número en palabras
Number::spell(13);         // "thirteen"
Number::spell(13, 'es');   // "trece"

// Arr::from() — crear array desde distintas fuentes
Arr::from(collect([1, 2, 3]));  // [1, 2, 3]
Arr::from(new ArrayObject([1])); // [1]

// rescue() mejorado con valor por defecto tipado
$value = rescue(fn() => riskyOperation(), default: 'fallback');
```

## Artisan: nuevos comandos

```bash
# Crear un Data Transfer Object
php artisan make:dto CreateUserDto

# Crear un Value Object
php artisan make:value-object Money

# Listar todos los jobs registrados
php artisan queue:list

# Nuevo comando para revisar configuración de entorno
php artisan env:check

# Limpiar todo de golpe (caché, config, rutas, vistas)
php artisan optimize:clear
```

## Testing: mejoras en Pest y PHPUnit

Laravel 13 actualiza el andamiaje de tests y añade helpers:

```php
// Test de arquitectura con Pest (nuevo helper)
arch()->expect('App\Models')
    ->toExtend(Illuminate\Database\Eloquent\Model::class)
    ->toHaveMethod('casts');

// assertModelMissing ahora acepta closure
$this->assertModelMissing(User::class, fn($q) => $q->where('email', 'test@test.com'));

// Nuevos matchers de JSON
$response->assertJsonPath('data.*.id', [1, 2, 3]);
$response->assertJsonCount(3, 'data');
$response->assertJsonStructure([
    'data' => [['id', 'name', 'email']]
]);
```

## Mejoras en el scheduler

El scheduler de tareas gana más flexibilidad:

```php
// routes/console.php
use Illuminate\Support\Facades\Schedule;

// Nuevo: skipWithoutOverlapping()
Schedule::command('reports:generate')
    ->daily()
    ->skipWithoutOverlapping()   // No encola si la anterior sigue corriendo
    ->onFailure(function () {
        Notification::send($admin, new ScheduleFailedNotification());
    });

// Nuevo: runInBackground() encadenado
Schedule::job(new HeavyJob())->hourly()->runInBackground();

// Nuevo: timezone por comando individual
Schedule::command('tasks:process')
    ->daily()
    ->timezone('Europe/Madrid');
```

## Soporte actualizado

Laravel 13 tiene el siguiente ciclo de soporte:

| Versión | PHP mínimo | Lanzamiento   | Correcciones de bugs | Parches de seguridad |
|---------|------------|---------------|----------------------|----------------------|
| 11      | 8.2        | Marzo 2024    | Agosto 2025          | Febrero 2026         |
| 12      | 8.2        | Febrero 2025  | Agosto 2026          | Febrero 2027         |
| 13      | 8.3        | Marzo 2026    | Septiembre 2027      | Marzo 2028           |

Si tienes un proyecto en Laravel 11, ten en cuenta que **el soporte de correcciones de bugs ya terminó** en agosto de 2025.

## ¿Cómo actualizar a Laravel 13?

```bash
# 1. Actualiza composer.json
# "laravel/framework": "^13.0"
# "php": "^8.3"

# 2. Actualiza PHP a 8.3+ si no lo has hecho

# 3. Corre el update
composer update

# 4. Revisa los breaking changes en el upgrade guide
# https://laravel.com/docs/13.x/upgrade

# 5. Ejecuta los tests
php artisan test
```

Laravel mantiene compatibilidad hacia atrás en la mayoría de los casos, así que la migración desde Laravel 12 suele ser sencilla. La de Laravel 11 requiere más atención.

## Conclusión

Laravel 13 es una versión que refina y consolida el trabajo de las versiones anteriores. Los cambios más importantes son el requisito de PHP 8.3, las mejoras en Eloquent con los nuevos métodos de consulta, y la actualización de los starter kits. Si estás empezando un proyecto nuevo en 2026, usa Laravel 13 directamente. Si tienes uno en producción en Laravel 12, la migración es sencilla; desde Laravel 11, planifícala con calma.
