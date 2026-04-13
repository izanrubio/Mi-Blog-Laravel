---
title: 'Laravel 12 vs Laravel 13 — Qué cambió y si debes actualizar'
description: 'Compara Laravel 12 y Laravel 13: nuevas funcionalidades, cambios de PHP, mejoras en Eloquent y starter kits. Guía para saber si debes migrar tu proyecto.'
pubDate: '2026-04-10'
tags: ['laravel', 'laravel-13', 'actualizacion', 'comparativa']
---

# Laravel 12 vs Laravel 13 — Qué cambió y si debes actualizar

Laravel sigue su cadencia anual de versiones mayores. Laravel 12 llegó en febrero de 2025 con un enfoque claro en los starter kits modernos y la experiencia de desarrollador. Laravel 13 —lanzado a principios de 2026— construye sobre esa base y añade mejoras en el núcleo, herramientas de testing y soporte para las características más recientes de PHP.

Si ya estás en Laravel 12, esta guía te explica exactamente qué ganás actualizando.

## El cambio más importante: PHP 8.3 obligatorio

| | Laravel 12 | Laravel 13 |
|---|---|---|
| PHP mínimo | 8.2 | **8.3** |
| Lanzamiento | Febrero 2025 | Marzo 2026 |
| Soporte bugs | Agosto 2026 | Septiembre 2027 |
| Soporte seguridad | Febrero 2027 | Marzo 2028 |

El salto de PHP 8.2 a 8.3 es el único cambio de requisitos que puede bloquearte. Si tu servidor ya corre PHP 8.3 (lo más probable en 2026), la actualización es directa.

## Starter kits: qué cambió

Laravel 12 introdujo los starter kits modernos como característica principal. Laravel 13 los actualiza:

### Laravel 12 introdujo
```bash
# Por primera vez, starter kits con React, Vue o Livewire integrados
laravel new mi-proyecto --using=react   # React 18 + Inertia 1.x
laravel new mi-proyecto --using=vue     # Vue 3 + Inertia 1.x
laravel new mi-proyecto --using=livewire
```

### Laravel 13 actualiza a
```bash
laravel new mi-proyecto --using=react   # React 19 + Inertia 2.x
laravel new mi-proyecto --using=vue     # Vue 3.5+ + Inertia 2.x
laravel new mi-proyecto --using=livewire # Livewire 3 estable
```

El cambio más notable es Inertia 2.x, que trae soporte para renderizado asíncrono y mejor manejo del estado global entre páginas.

## Eloquent: métodos nuevos en Laravel 13

Laravel 12 no añadió cambios mayores en Eloquent. Laravel 13 sí:

### `whereAny` / `whereAll`

```php
// Laravel 12: tenías que hacerlo manualmente
User::where(function ($q) use ($search) {
    $q->where('name', 'like', "%$search%")
      ->orWhere('email', 'like', "%$search%");
})->get();

// Laravel 13: más expresivo
User::whereAny(['name', 'email'], 'like', "%$search%")->get();

// Y su opuesto: todos los campos deben cumplir la condición
Product::whereAll(['price', 'cost', 'margin'], '>', 0)->get();
```

### `explain()` para debugging

```php
// Nuevo en Laravel 13: ver el plan de ejecución
$query = Order::with('items')->where('status', 'pending');
$query->explain(); // Devuelve el EXPLAIN de la base de datos
```

### Casting más limpio

```php
// Laravel 12
protected $casts = [
    'options' => 'array',
];

// Laravel 13: sintaxis de método (más flexible, acepta parámetros)
protected function casts(): array
{
    return [
        'options'  => AsCollection::class,
        'status'   => AsEnum::of(OrderStatus::class),
        'statuses' => AsEnumCollection::of(OrderStatus::class),
    ];
}
```

## Testing: Pest 3 y nuevos helpers

Laravel 12 usaba Pest 2. Laravel 13 viene con **Pest 3** preconfigurado.

```php
// Pest 3: tests de arquitectura más potentes
arch()->expect('App\Models')
    ->toExtend(Model::class)
    ->not->toHavePublicMethods(['password', 'remember_token']);

// Nuevos matchers de respuestas HTTP
$response->assertJsonPath('data.*.id', fn($ids) => count($ids) === 3);
$response->assertJsonIsArray('data');
$response->assertJsonIsObject('meta');

// assertModelMissing con condiciones
$this->assertModelMissing(User::class, fn($q) => $q->where('email', $email));
```

## Artisan: nuevos comandos en Laravel 13

```bash
# Generar DTOs
php artisan make:dto CreateUserDto
php artisan make:dto UpdateOrderDto

# Value Objects
php artisan make:value-object Money
php artisan make:value-object Email

# Revisar variables de entorno
php artisan env:check
# Muestra qué variables del .env.example faltan en .env

# Listar jobs de la queue
php artisan queue:list
```

## Helpers nuevos

```php
// En Laravel 12 no existían estos:

// str()->wrap()
str('hola')->wrap('¡', '!');   // ¡hola!

// Number::spell() con idioma
Number::spell(42, 'es');   // "cuarenta y dos"

// Arr::from() acepta cualquier iterable
Arr::from(collect([1, 2, 3]));        // [1, 2, 3]
Arr::from(new \ArrayObject([1, 2]));  // [1, 2]

// rescue() con tipo garantizado
$result = rescue(fn() => riskyOperation(), default: []);
```

## Scheduler: mejoras puntuales

```php
// Laravel 12
Schedule::command('emails:send')->daily();

// Laravel 13: más opciones encadenadas
Schedule::command('emails:send')
    ->daily()
    ->timezone('Europe/Madrid')
    ->skipWithoutOverlapping()
    ->onFailure(fn() => Log::error('Schedule failed'));
```

## ¿Qué NO cambia entre Laravel 12 y 13?

La estructura de los proyectos es **idéntica**. Si creaste un proyecto con Laravel 12 verás exactamente lo mismo:

```
bootstrap/app.php       ← sigue siendo el punto central (desde Laravel 11)
bootstrap/providers.php ← igual
routes/web.php          ← igual
routes/api.php          ← igual
routes/console.php      ← igual
app/Http/               ← igual
app/Models/             ← igual
```

No hay cambios de estructura de directorios ni archivos que desaparezcan.

## Cómo migrar de Laravel 12 a Laravel 13

La migración es la más sencilla de todas las actualizaciones recientes:

```bash
# 1. Asegúrate de tener PHP 8.3+
php --version

# 2. Actualiza composer.json
# "laravel/framework": "^13.0",
# "php": "^8.3"

# 3. Si usas Pest, actualiza también
# "pestphp/pest": "^3.0"

# 4. Lanza el update
composer update

# 5. Comprueba si hay cambios en el upgrade guide
# (normalmente hay pocos breaking changes entre versiones menores del mismo año)

# 6. Ejecuta los tests
php artisan test
```

Para la mayoría de proyectos, estos cuatro pasos son todo lo necesario.

## ¿Vale la pena actualizar?

**Si empiezas un proyecto nuevo**: usa Laravel 13 directamente. No hay razón para empezar en 12.

**Si tienes un proyecto en producción con Laravel 12**: la migración es rápida (actualizar PHP y cambiar la versión en composer.json). Merece la pena por el ciclo de soporte extendido y los nuevos helpers de Eloquent.

**Si tienes un proyecto en Laravel 11**: considera saltar directamente a Laravel 13. El soporte de bugs de Laravel 11 terminó en agosto de 2025. El soporte de seguridad termina en febrero de 2026, así que estás en zona de riesgo si no actualizas.

## Conclusión

La diferencia entre Laravel 12 y Laravel 13 es menor de lo que parece por el salto de número de versión. El cambio más importante es el requisito de PHP 8.3, seguido de las mejoras en Eloquent y los nuevos comandos Artisan. La estructura del proyecto es idéntica. Si ya estás en Laravel 12, puedes actualizar con tranquilidad en cualquier sprint sin dedicarle más de un par de horas.
