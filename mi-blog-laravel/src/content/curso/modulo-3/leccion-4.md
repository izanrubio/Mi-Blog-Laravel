---
modulo: 3
leccion: 4
title: 'Eloquent ORM básico — CRUD completo'
description: 'Aprende a crear, leer, actualizar y eliminar registros con Eloquent ORM, el potente sistema de mapeo objeto-relacional de Laravel.'
duracion: '25 min'
quiz:
  - pregunta: '¿Qué propiedad del modelo Eloquent define qué columnas pueden asignarse masivamente?'
    opciones:
      - '$hidden'
      - '$casts'
      - '$fillable'
      - '$guarded'
    correcta: 2
    explicacion: 'La propiedad $fillable contiene un array de columnas permitidas para asignación masiva (mass assignment). Sin ella, create() y fill() lanzarán una excepción de seguridad.'
  - pregunta: '¿Cuál es la diferencia entre find() y findOrFail() en Eloquent?'
    opciones:
      - 'No hay diferencia, son sinónimos'
      - 'find() devuelve null si no existe; findOrFail() lanza una excepción 404'
      - 'findOrFail() solo funciona en controladores de recursos'
      - 'find() solo busca por slug, findOrFail() busca por id'
    correcta: 1
    explicacion: 'find() devuelve null cuando el registro no existe. findOrFail() lanza ModelNotFoundException (que Laravel convierte en HTTP 404), lo cual es ideal en controladores web y API.'
  - pregunta: '¿Qué método de Eloquent realiza un borrado suave (soft delete) en lugar de eliminar el registro de la BD?'
    opciones:
      - 'archive()'
      - 'hide()'
      - 'delete()'
      - 'trash()'
    correcta: 2
    explicacion: 'Cuando el modelo usa el trait SoftDeletes, el método delete() no elimina el registro sino que rellena la columna deleted_at con la fecha actual. El registro queda "oculto" pero sigue en la BD.'
---

## Eloquent ORM — CRUD completo

Eloquent es el ORM (Object-Relational Mapper) de Laravel. Su filosofía es simple: cada tabla de la base de datos tiene un modelo PHP correspondiente, y ese modelo es la puerta de entrada para todas las operaciones sobre esa tabla. En lugar de escribir SQL, escribes PHP expresivo y legible.

## El modelo Eloquent

Un modelo Eloquent es una clase PHP que extiende `Illuminate\Database\Eloquent\Model`. Laravel infiere el nombre de la tabla a partir del nombre del modelo (en plural y snake_case), pero puedes configurarlo manualmente.

### Crear un modelo

```bash
# Solo el modelo
php artisan make:model Post

# Modelo + migración
php artisan make:model Post -m

# Modelo + migración + factory + seeder + controlador
php artisan make:model Post -mfsc
```

### Estructura básica del modelo

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use HasFactory, SoftDeletes;

    // Laravel asume tabla 'posts'. Si fuera distinta:
    // protected $table = 'articulos';

    // Columnas permitidas para asignación masiva
    protected $fillable = [
        'user_id',
        'titulo',
        'slug',
        'extracto',
        'contenido',
        'estado',
        'publicado_en',
    ];

    // Columnas ocultas en serialización (toArray, toJson)
    protected $hidden = [
        'deleted_at',
    ];

    // Conversión automática de tipos
    protected $casts = [
        'publicado_en' => 'datetime',
        'vistas'       => 'integer',
        'activo'       => 'boolean',
        'meta'         => 'array',   // columna JSON → array PHP
    ];
}
```

## CREATE — Crear registros

Hay varias formas de crear registros con Eloquent:

```php
// Método 1: instancia + save()
$post = new Post();
$post->titulo    = 'Mi primer post';
$post->contenido = 'Contenido del post...';
$post->user_id   = 1;
$post->save();

// Método 2: create() — asignación masiva (requiere $fillable)
$post = Post::create([
    'titulo'    => 'Aprendiendo Eloquent',
    'slug'      => 'aprendiendo-eloquent',
    'contenido' => 'Eloquent es el ORM de Laravel...',
    'user_id'   => auth()->id(),
    'estado'    => 'borrador',
]);

// Método 3: firstOrCreate — busca o crea
$post = Post::firstOrCreate(
    ['slug' => 'aprendiendo-eloquent'],          // condición de búsqueda
    ['titulo' => 'Aprendiendo Eloquent', 'user_id' => 1] // datos si no existe
);

// Método 4: updateOrCreate — actualiza si existe, crea si no
$post = Post::updateOrCreate(
    ['slug' => 'aprendiendo-eloquent'],
    ['titulo' => 'Aprendiendo Eloquent — actualizado', 'vistas' => 0]
);
```

## READ — Leer registros

Eloquent ofrece un fluent interface para construir consultas:

```php
// Todos los registros
$posts = Post::all();

// Buscar por ID
$post = Post::find(1);           // null si no existe
$post = Post::findOrFail(1);     // excepción 404 si no existe

// Buscar múltiples IDs
$posts = Post::find([1, 2, 3]);

// Primer resultado
$post = Post::where('estado', 'publicado')->first();
$post = Post::where('estado', 'publicado')->firstOrFail();

// Condiciones
$posts = Post::where('estado', 'publicado')
    ->where('vistas', '>', 100)
    ->get();

// OR WHERE
$posts = Post::where('estado', 'publicado')
    ->orWhere('vistas', '>', 1000)
    ->get();

// LIKE
$posts = Post::where('titulo', 'LIKE', '%eloquent%')->get();

// Ordenar
$posts = Post::orderBy('publicado_en', 'desc')->get();
$posts = Post::latest()->get();        // orderBy created_at desc
$posts = Post::oldest()->get();        // orderBy created_at asc

// Limitar y paginar
$posts = Post::take(5)->get();
$posts = Post::skip(10)->take(5)->get();
$posts = Post::paginate(15);           // paginación automática
$posts = Post::simplePaginate(15);     // paginación simple (anterior/siguiente)
```

### Seleccionar columnas específicas

```php
$posts = Post::select('id', 'titulo', 'slug', 'publicado_en')
    ->where('estado', 'publicado')
    ->get();
```

### Contar, sumar, promediar

```php
$total     = Post::count();
$publicados = Post::where('estado', 'publicado')->count();
$totalVistas = Post::sum('vistas');
$promedioVistas = Post::avg('vistas');
$maxVistas = Post::max('vistas');
```

## UPDATE — Actualizar registros

```php
// Método 1: busca + modifica + guarda
$post = Post::findOrFail(1);
$post->titulo = 'Título actualizado';
$post->save();

// Método 2: fill() + save()
$post = Post::findOrFail(1);
$post->fill([
    'titulo'  => 'Título actualizado',
    'estado'  => 'publicado',
])->save();

// Método 3: update() masivo sobre una consulta
Post::where('estado', 'borrador')
    ->where('created_at', '<', now()->subDays(30))
    ->update(['estado' => 'archivado']);

// Incrementar/decrementar valores numéricos
$post = Post::findOrFail(1);
$post->increment('vistas');         // +1
$post->increment('vistas', 10);    // +10
$post->decrement('stock', 2);      // -2
```

## DELETE — Eliminar registros

```php
// Busca y elimina
$post = Post::findOrFail(1);
$post->delete();

// Eliminar por ID sin buscar primero
Post::destroy(1);
Post::destroy([1, 2, 3]);

// Eliminar con condiciones
Post::where('estado', 'archivado')
    ->where('created_at', '<', now()->subYear())
    ->delete();
```

### Soft Deletes — borrado suave

El borrado suave es una técnica que "oculta" registros en lugar de eliminarlos físicamente. Es útil para papeleras de reciclaje, auditorías y recuperación de datos.

Primero agrega la columna en la migración:

```php
$table->softDeletes(); // agrega columna deleted_at
```

Luego usa el trait en el modelo:

```php
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;
}
```

Con esto, `delete()` rellena `deleted_at` en lugar de eliminar el registro. Las consultas normales excluyen automáticamente los registros con `deleted_at` no nulo.

```php
// Solo ve registros no eliminados
$posts = Post::all();

// Incluir eliminados
$posts = Post::withTrashed()->get();

// Solo los eliminados
$posts = Post::onlyTrashed()->get();

// Restaurar un registro eliminado
$post = Post::withTrashed()->find(1);
$post->restore();

// Eliminar definitivamente (aunque use SoftDeletes)
$post->forceDelete();
```

## Accesors y Mutators

Permiten transformar valores al leerlos o guardarlos:

```php
use Illuminate\Database\Eloquent\Casts\Attribute;

class Post extends Model
{
    // Accessor: titulo siempre en Title Case al leerlo
    protected function titulo(): Attribute
    {
        return Attribute::make(
            get: fn (string $value) => ucwords($value),
        );
    }

    // Mutator: slug siempre en minúsculas al guardarlo
    protected function slug(): Attribute
    {
        return Attribute::make(
            set: fn (string $value) => strtolower($value),
        );
    }
}
```

## Verificar si un modelo fue creado o actualizado

```php
$post = Post::updateOrCreate(
    ['slug' => 'mi-post'],
    ['titulo' => 'Mi Post', 'user_id' => 1]
);

if ($post->wasRecentlyCreated) {
    // Se acaba de crear
} else {
    // Ya existía y fue actualizado
}
```

Eloquent simplifica enormemente el trabajo con bases de datos. Con una API fluida y expresiva, puedes realizar operaciones complejas en pocas líneas de código, manteniendo la legibilidad y reduciendo los errores.
