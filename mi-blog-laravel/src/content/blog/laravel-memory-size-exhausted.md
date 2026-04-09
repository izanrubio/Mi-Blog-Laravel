---
title: 'PHP Fatal error: Allowed memory size exhausted en Laravel'
description: 'Soluciona el error de memoria agotada en Laravel: aumenta el memory_limit de PHP, optimiza queries N+1 con eager loading y usa chunking para datos grandes.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'rendimiento', 'php']
---

`PHP Fatal error: Allowed memory size of 134217728 bytes exhausted`. Este error significa que tu script PHP intentó usar más de 128MB de memoria (u otro límite configurado). La solución rápida es aumentar el límite, pero la solución real es entender por qué está pasando y arreglarlo desde la raíz.

## La solución rápida (y por qué no es suficiente)

Puedes aumentar el límite de memoria de varias formas:

```php
// Al inicio del script (solo para desarrollo/debugging)
ini_set('memory_limit', '512M');

// En .env (si tu framework lo respeta)
// No es estándar en Laravel por sí solo

// En php.ini (global, afecta a todos los scripts)
// memory_limit = 512M

// En un comando Artisan específico
protected function handle()
{
    ini_set('memory_limit', '1G');
    // resto del código...
}
```

Pero aumentar el límite es una curita. Si tu código consume gigabytes de memoria, eventualmente volverá a fallar. Además, en servidores compartidos o contenedores, no siempre puedes subir el límite.

## La causa real: el problema N+1 y datos masivos

El error de memoria en Laravel casi siempre viene de uno de estos dos problemas:

### Problema 1: Cargando demasiados datos sin eager loading

```php
// MAL: Carga TODOS los posts y luego por cada uno hace una query
// Si tienes 10,000 posts, hace 10,001 queries y usa mucha memoria
$posts = Post::all();

foreach ($posts as $post) {
    echo $post->user->name;  // Query adicional por cada post
    echo $post->category->name;  // Otra query adicional
}
```

```php
// BIEN: Eager loading con with()
// Una sola query para posts, una para users, una para categories
$posts = Post::with(['user', 'category'])->get();

foreach ($posts as $post) {
    echo $post->user->name;  // Ya cargado en memoria, sin query extra
    echo $post->category->name;  // Ídem
}
```

Pero incluso con eager loading, cargar 100,000 registros de una vez sigue siendo un problema.

### Problema 2: Procesando datos masivos sin chunking

```php
// MAL: Carga todos los usuarios en memoria a la vez
$users = User::all();  // 100,000 usuarios × 50 campos = mucha RAM

foreach ($users as $user) {
    $this->sendNewsletter($user);
}
```

```php
// BIEN: Procesa por lotes de 200 en 200
User::chunk(200, function ($users) {
    foreach ($users as $user) {
        $this->sendNewsletter($user);
    }
});
// En cada iteración, solo 200 usuarios están en memoria
```

## chunk() vs chunkById() vs lazy()

Laravel ofrece varias formas de procesar grandes cantidades de datos:

```php
// chunk(): divide en grupos de N
// Puede tener problemas si modificas datos mientras iteras
User::orderBy('id')->chunk(500, function ($users) {
    foreach ($users as $user) {
        // Procesar usuario
    }
});

// chunkById(): más eficiente, usa el ID como cursor
// Recomendado cuando modificas datos
User::chunkById(500, function ($users) {
    foreach ($users as $user) {
        $user->update(['processed' => true]);
    }
});

// lazy(): usa cursores, carga un registro a la vez (PHP generator)
// Muy eficiente en memoria, pero más lento
foreach (User::lazy() as $user) {
    $this->processUser($user);
}

// lazyById(): cursor basado en ID
foreach (User::lazyById() as $user) {
    $this->processUser($user);
}
```

La diferencia en consumo de memoria es drástica:

- `User::all()` con 100,000 usuarios: puede usar 500MB+
- `User::chunk(500, ...)`: máximo 500 usuarios en memoria a la vez
- `User::lazy()`: un usuario a la vez

## Lazy Loading vs Eager Loading: el impacto en memoria

Es importante entender la diferencia entre "lazy loading" de Eloquent (las relaciones) y "lazy loading" de datos (lazy collections):

```php
// Lazy loading de RELACIONES (acceder a relación cuando la necesitas)
// Esto causa el problema N+1
$posts = Post::all();
foreach ($posts as $post) {
    $post->user; // Query aquí, por cada post
}

// Eager loading de RELACIONES (cargar todo junto)
// La relación se carga en la misma query inicial
$posts = Post::with('user')->get();
foreach ($posts as $post) {
    $post->user; // Ya está en memoria, sin query
}
```

La confusión de nombres es real. En el contexto del problema de memoria:
- Eager loading de relaciones: mejor para reducir queries
- `lazy()` collections: mejor para reducir memoria en iteraciones de grandes datasets

## Seleccionar solo las columnas necesarias

Otra fuente de consumo excesivo de memoria: cargar columnas que no necesitas.

```php
// MAL: Carga todas las columnas, incluyendo 'content' que puede ser enorme
$posts = Post::with('user')->get();

// BIEN: Solo las columnas que necesitas
$posts = Post::select('id', 'title', 'published_at', 'user_id')
             ->with('user:id,name,email')  // Solo columnas específicas de user
             ->get();
```

Esto puede reducir el uso de memoria a la mitad o más si tienes columnas TEXT o BLOB grandes.

## Optimizar en comandos Artisan

Si el problema ocurre en un comando de consola, puedes usar la opción de verbose para ver el progreso y el indicador de memoria:

```php
// app/Console/Commands/ProcessUsersCommand.php

protected $signature = 'users:process {--chunk=500 : Tamaño del chunk}';

public function handle(): int
{
    $chunkSize = (int) $this->option('chunk');
    $processed = 0;

    $this->info("Iniciando procesamiento...");
    $bar = $this->output->createProgressBar(User::count());

    User::chunkById($chunkSize, function ($users) use (&$processed, $bar) {
        foreach ($users as $user) {
            $this->processUser($user);
            $processed++;
            $bar->advance();
        }
        
        // Limpiar modelo de eventos para liberar memoria
        User::flushEventListeners();
        
        // Ver memoria actual en logs
        \Log::info("Memoria usada: " . round(memory_get_usage() / 1024 / 1024, 2) . " MB");
    });

    $bar->finish();
    $this->newLine();
    $this->info("Procesados: {$processed} usuarios");
    
    return self::SUCCESS;
}

private function processUser(User $user): void
{
    // Lógica de procesamiento
}
```

## Detectar el problema con Telescope o logs

Si no sabes qué parte de tu código consume la memoria, añade logs estratégicos:

```php
// Antes de cada operación sospechosa
\Log::debug('Memoria antes de query: ' . round(memory_get_usage(true) / 1024 / 1024, 2) . 'MB');

$posts = Post::with(['comments', 'user', 'tags'])->get();

\Log::debug('Memoria después de query: ' . round(memory_get_usage(true) / 1024 / 1024, 2) . 'MB');
```

O usa `memory_get_peak_usage()` para ver el pico máximo de memoria usado:

```php
register_shutdown_function(function() {
    \Log::info('Memoria pico: ' . round(memory_get_peak_usage(true) / 1024 / 1024, 2) . 'MB');
});
```

## Conclusión

El error de memoria en Laravel raramente necesita solo aumentar el límite. La solución correcta es identificar si estás cargando demasiados registros de una vez (usa `chunk()` o `lazy()`), si tienes el problema N+1 (usa `with()` para eager loading), o si estás cargando columnas innecesarias (usa `select()`). Aplicando estas técnicas, la mayoría de procesos pueden ejecutarse con mucha menos memoria y de forma más rápida.
