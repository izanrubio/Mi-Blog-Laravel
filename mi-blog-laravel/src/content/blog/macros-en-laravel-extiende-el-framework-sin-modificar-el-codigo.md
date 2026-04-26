---
title: 'Macros en Laravel: Extiende el Framework sin Modificar el Código'
description: 'Aprende a crear macros en Laravel para extender clases del framework. Guía práctica con ejemplos reales de uso en Eloquent, Query Builder y más.'
pubDate: '2026-04-26'
tags: ['laravel', 'php', 'macros', 'extensibilidad']
---

## Macros en Laravel: Extiende el Framework sin Modificar el Código

Los macros son uno de los patrones más poderosos de Laravel para extender la funcionalidad del framework sin necesidad de modificar su código fuente. Si alguna vez has sentido que te falta un método en Eloquent, el Query Builder o cualquier otra clase del framework, los macros son tu solución.

En este artículo aprenderás qué son los macros, cómo crearlos, dónde registrarlos y verás casos de uso prácticos que puedes implementar en tus proyectos hoy mismo.

## ¿Qué son los Macros en Laravel?

Un macro es un método dinámico que añades a una clase existente del framework sin modificarla directamente. Laravel utiliza el patrón Macroable para permitir esto de manera elegante y segura.

Cuando creas un macro, estás diciendo: "Quiero que esta clase tenga este nuevo método con esta funcionalidad", y Laravel se encarga de agregarlo en tiempo de ejecución.

Los macros son especialmente útiles para:

- **Reutilizar lógica personalizada** en múltiples lugares de tu aplicación
- **Mejorar la legibilidad** del código al crear métodos más específicos del dominio
- **Mantener la compatibilidad** con futuras versiones del framework
- **Evitar herencia innecesaria** de clases del framework

## Clases que Soportan Macros en Laravel

No todas las clases del framework pueden tener macros. Necesitan implementar el trait `Macroable`. Las más comunes son:

- **Eloquent\Builder**: Para los queries de modelos
- **Query\Builder**: Para queries directos
- **Request**: Para acceder a la solicitud HTTP
- **Response**: Para respuestas HTTP
- **Collection**: Para trabajar con colecciones
- **Str** y **Arr**: Para manipulación de strings y arrays

## Cómo Crear tu Primer Macro

Los macros se registran típicamente en un Service Provider. Vamos a crear un ejemplo simple.

### Paso 1: Crear un Service Provider

```bash
php artisan make:provider MacroServiceProvider
```

### Paso 2: Registrar el Macro

Abre el archivo `app/Providers/MacroServiceProvider.php` y añade tu primer macro:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Database\Eloquent\Builder;

class MacroServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Builder::macro('whereLike', function ($column, $value) {
            return $this->where($column, 'like', "%{$value}%");
        });
    }
}
```

### Paso 3: Registrar el Service Provider

En `config/app.php`, añade el provider a la lista:

```php
'providers' => [
    // ... otros providers
    App\Providers\MacroServiceProvider::class,
],
```

### Paso 4: Usar el Macro

Ahora puedes usar `whereLike` en cualquier query de Eloquent:

```php
$users = User::whereLike('name', 'john')->get();
// Equivalente a: User::where('name', 'like', '%john%')->get();
```

## Macros Prácticos para Query Builder

Veamos algunos macros útiles que puedes implementar en tus proyectos:

### Macro para búsqueda en múltiples columnas

```php
Builder::macro('whereAnyLike', function ($columns, $value) {
    return $this->where(function ($query) use ($columns, $value) {
        foreach ($columns as $column) {
            $query->orWhere($column, 'like', "%{$value}%");
        }
    });
});
```

**Uso:**

```php
$results = User::whereAnyLike(['name', 'email', 'phone'], 'search term')->get();
```

### Macro para ordenar por relevancia

```php
Builder::macro('orderByRelevance', function ($searchTerm, $columns) {
    $relevanceCase = implode(' + ', array_map(function ($column) {
        return "CASE WHEN {$column} LIKE ? THEN 3 WHEN {$column} LIKE ? THEN 1 ELSE 0 END";
    }, $columns));

    $bindings = [];
    foreach ($columns as $column) {
        $bindings[] = $searchTerm;
        $bindings[] = "{$searchTerm}%";
    }

    return $this->selectRaw("*, ({$relevanceCase}) as relevance", $bindings)
                ->orderByDesc('relevance');
});
```

**Uso:**

```php
$results = User::whereAnyLike(['name', 'email'], 'john')
    ->orderByRelevance('john', ['name', 'email'])
    ->get();
```

### Macro para paginación con información útil

```php
Builder::macro('smartPaginate', function ($perPage = 15, $columns = ['*']) {
    $total = $this->count();
    $paginated = $this->paginate($perPage, $columns);
    
    return $paginated->appends(request()->query())->additional([
        'meta' => [
            'total' => $total,
            'has_more' => $paginated->hasMorePages(),
            'pages' => ceil($total / $perPage),
        ],
    ]);
});
```

## Macros para Colecciones

Las colecciones son especialmente útiles para macros. Aquí hay algunos ejemplos:

### Macro para agrupar por clave y contar

```php
use Illuminate\Support\Collection;

Collection::macro('groupByAndCount', function ($key) {
    return $this->groupBy($key)->map(function ($items) {
        return [
            'count' => $items->count(),
            'items' => $items,
        ];
    });
});
```

**Uso:**

```php
$grouped = collect($users)->groupByAndCount('department');
// [
//     'engineering' => ['count' => 5, 'items' => [...]],
//     'sales' => ['count' => 3, 'items' => [...]],
// ]
```

### Macro para filtrar valores nulos

```php
Collection::macro('filterNotNull', function () {
    return $this->filter(function ($value) {
        return !is_null($value);
    });
});
```

**Uso:**

```php
$clean = collect($data)->filterNotNull();
```

## Macros para la Clase Request

Puedes extender el objeto Request para añadir métodos útiles:

### Macro para obtener solo inputs específicos

```php
use Illuminate\Http\Request;

Request::macro('onlyFilled', function (...$keys) {
    return $this->only($keys)
        ->filter(fn ($value) => !empty($value))
        ->toArray();
});
```

**Uso:**

```php
$filtered = $request->onlyFilled('name', 'email', 'phone');
// Solo retorna los campos que tengan valores
```

### Macro para validación condicional rápida

```php
Request::macro('validateIfPresent', function ($field, $rules) {
    return $this->when($this->has($field), function ($request) use ($field, $rules) {
        return $request->validate([$field => $rules]);
    });
});
```

## Estructura Recomendada para Macros

Cuando tus macros crecen, es buena idea organizarlos. Crea una carpeta `app/Macros`:

```
app/
└── Macros/
    ├── BuilderMacros.php
    ├── CollectionMacros.php
    ├── RequestMacros.php
    └── StringMacros.php
```

**Ejemplo de `app/Macros/BuilderMacros.php`:**

```php
<?php

namespace App\Macros;

use Illuminate\Database\Eloquent\Builder;

class BuilderMacros
{
    public static function register(): void
    {
        Builder::macro('whereLike', function ($column, $value) {
            return $this->where($column, 'like', "%{$value}%");
        });

        Builder::macro('whereAnyLike', function ($columns, $value) {
            return $this->where(function ($query) use ($columns, $value) {
                foreach ($columns as $column) {
                    $query->orWhere($column, 'like', "%{$value}%");
                }
            });
        });

        // Más macros...
    }
}
```

Luego, en tu Service Provider:

```php
public function boot(): void
{
    BuilderMacros::register();
    CollectionMacros::register();
    RequestMacros::register();
}
```

## Debugging de Macros

Si algo no funciona correctamente, puedes verificar si un macro existe:

```php
if (method_exists(Builder::class, 'yourMacroName')) {
    // El macro existe
}

// O usando Tinker
php artisan tinker
> User::hasMacro('whereLike')
```

## Mejores Prácticas

### 1. **Documentación clara**

```php
/**
 * Busca en una columna usando LIKE
 *
 * @param string $column
 * @param string $value
 * @return \Illuminate\Database\Eloquent\Builder
 */
Builder::macro('whereLike', function ($column, $value) {
    return $this->where($column, 'like', "%{$value}%");
});
```

### 2. **Evita nombres genéricos**

```php
// ❌ Malo - muy genérico
Builder::macro('search', function ($value) { ... });

// ✅ Bueno - específico del dominio
Builder::macro('searchByNameOrEmail', function ($value) { ... });
```

### 3. **Retorna el objeto para encadenamiento**

```php
// ✅ Permite: User::whereLike('name', 'john')->paginate()
Builder::macro('whereLike', function ($column, $value) {
    return $this->where($column, 'like', "%{$value}%");
});
```

### 4. **Ten cuidado con las actualizaciones del framework**

Si Laravel agrega un método con el mismo nombre en una versión futura, tu macro será ignorado. Usa namespacing en los nombres si es necesario.

## Conclusión

Los macros en Laravel son una herramienta poderosa para crear código más limpio, mantenible y reutilizable. Te permiten extender el framework sin modificar su código fuente, lo que facilita las actualizaciones y mantiene tu proyecto organizado.

Comienza con casos simples como `whereLike` y, conforme te sientas cómodo, crea macros más complejos que reflejen la lógica específica de tu dominio. Recuerda documentar bien tus macros y organizarlos de manera coherente en tu proyecto.

## Puntos clave

- Los macros permiten añadir métodos dinámicamente a clases de Laravel sin modificarlas
- Se registran en Service Providers usando el patrón Macroable
- Las clases más comunes para macros son Builder, Collection, Request y Response
- Los macros deben retornar `$this` para permitir encadenamiento de métodos
- Organiza tus macros en archivos separados por tipo para mejor mantenibilidad
- Documenta bien tus macros para que otros desarrolladores entiendan su propósito
- Usa nombres específicos del dominio, no genéricos
- Los macros no interfieren con actualizaciones del framework
- Verifica si un macro existe antes de usarlo con `hasMacro()` si es necesario
- Los macros mejoran la legibilidad y reutilización del código en grandes proyectos