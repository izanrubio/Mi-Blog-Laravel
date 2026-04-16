---
title: 'Laravel Tinker: la REPL para explorar y depurar tu aplicación'
description: 'Aprende a usar Laravel Tinker para ejecutar código PHP en tiempo real, probar modelos Eloquent, crear registros y depurar tu aplicación sin crear rutas de prueba.'
pubDate: '2026-04-16'
tags: ['laravel', 'artisan', 'conceptos', 'roadmap']
---

Cuando estás desarrollando una aplicación Laravel, hay momentos en los que necesitas probar algo rápido: una consulta Eloquent, una función auxiliar, el comportamiento de un servicio. La solución habitual es crear una ruta temporal o añadir un `dd()` en algún sitio. Pero existe una herramienta mucho mejor: **Laravel Tinker**.

## ¿Qué es Tinker?

Tinker es la REPL (Read-Eval-Print Loop) interactiva de Laravel. Está basada en [PsySH](https://psysh.org/), una de las mejores shells interactivas para PHP, y viene incluida por defecto en todos los proyectos Laravel.

Una REPL te permite escribir código PHP línea a línea y ver el resultado inmediatamente, sin tener que crear archivos ni ejecutar scripts. Lo más importante es que Tinker tiene acceso completo a tu aplicación: modelos, servicios, configuración, base de datos, todo.

## Iniciar Tinker

Abrir Tinker es tan sencillo como ejecutar:

```bash
php artisan tinker
```

Verás algo así:

```
Psy Shell v0.12.3 (PHP 8.3.0 — cli) by Justin Hileman
>
```

El símbolo `>` indica que Tinker está listo para recibir código. Para salir, escribe `exit` o pulsa `Ctrl+D`.

## Consultas con Eloquent

Esto es donde Tinker brilla. Puedes interactuar con tu base de datos directamente desde la terminal.

### Obtener todos los registros

```php
> User::all()
= Illuminate\Database\Eloquent\Collection {#1234
    all: [
      App\Models\User {#1235
        id: 1,
        name: "Juan García",
        email: "juan@ejemplo.com",
        ...
      },
    ],
  }
```

### Buscar por ID

```php
> User::find(1)
= App\Models\User {#1236
    id: 1,
    name: "Juan García",
    email: "juan@ejemplo.com",
    email_verified_at: "2026-01-15 10:30:00",
    created_at: "2026-01-15 10:30:00",
    updated_at: "2026-01-15 10:30:00",
  }
```

### Consultas con condiciones

```php
> User::where('email', 'juan@ejemplo.com')->first()
= App\Models\User {#1237 ...}

> User::where('created_at', '>', now()->subDays(7))->count()
= 12

> Post::where('status', 'published')->orderBy('created_at', 'desc')->take(5)->get()
= Illuminate\Database\Eloquent\Collection {#1238 ...}
```

## Crear registros

### Con mass assignment

```php
> User::create([
...     'name' => 'María López',
...     'email' => 'maria@ejemplo.com',
...     'password' => bcrypt('secreto123'),
... ])
= App\Models\User {#1239
    name: "María López",
    email: "maria@ejemplo.com",
    updated_at: "2026-04-16 09:00:00",
    created_at: "2026-04-16 09:00:00",
    id: 42,
  }
```

### Con new y save()

```php
> $user = new User
= App\Models\User {#1240}

> $user->name = 'Carlos Ruiz'
= "Carlos Ruiz"

> $user->email = 'carlos@ejemplo.com'
= "carlos@ejemplo.com"

> $user->password = bcrypt('secreto456')
= "$2y$12$..."

> $user->save()
= true
```

## Actualizar registros

```php
> $user = User::find(1)
= App\Models\User {#1241 ...}

> $user->update(['name' => 'Juan García Actualizado'])
= true

// O bien
> $user->name = 'Otro nombre'
= "Otro nombre"

> $user->save()
= true

// Actualización masiva con query builder
> User::where('status', 'inactive')->update(['status' => 'active'])
= 5
```

## Eliminar registros

```php
> $user = User::find(99)
= App\Models\User {#1242 ...}

> $user->delete()
= true

// Soft delete si el modelo lo tiene
> $user->trashed()
= true

// Eliminar sin recuperar el modelo
> User::destroy(100)
= 1

// Borrado múltiple
> User::destroy([101, 102, 103])
= 3
```

## Probar relaciones

Tinker es perfecto para comprobar que tus relaciones Eloquent funcionan como esperas:

```php
> $user = User::with('posts')->find(1)
= App\Models\User {#1243 ...}

> $user->posts
= Illuminate\Database\Eloquent\Collection {#1244
    all: [
      App\Models\Post {#1245
        id: 1,
        title: "Mi primer artículo",
        user_id: 1,
        ...
      },
    ],
  }

> $user->posts()->count()
= 5

> $post = Post::find(1)
= App\Models\Post {#1246 ...}

> $post->user->name
= "Juan García"
```

## Ejecutar cualquier código PHP

Tinker no se limita a Eloquent. Puedes ejecutar cualquier código PHP válido:

```php
// Operaciones básicas
> 2 ** 10
= 1024

// Arrays
> collect([1, 2, 3, 4, 5])->filter(fn($n) => $n % 2 === 0)->values()
= Illuminate\Support\Collection {#1247
    all: [2, 4],
  }

// Clases de PHP
> Carbon\Carbon::now()->addDays(30)->format('d/m/Y')
= "16/05/2026"

// Variables persistentes entre líneas
> $nombres = ['Ana', 'Luis', 'Eva']
= ["Ana", "Luis", "Eva"]

> implode(', ', $nombres)
= "Ana, Luis, Eva"
```

## Funciones auxiliares de Laravel

Todas las helpers de Laravel están disponibles:

```php
// Fechas con Carbon
> now()
= Illuminate\Support\Carbon @1744790400 {#1248
    date: 2026-04-16 09:00:00.0 UTC (+00:00),
  }

> now()->diffForHumans()
= "just now"

// Strings
> str('hola mundo')->title()
= Illuminate\Support\Stringable {#1249
    value: "Hola Mundo",
  }

> str('laravel-es-genial')->slug()
= Illuminate\Support\Stringable {#1250
    value: "laravel-es-genial",
  }

// Rutas
> route('home')
= "http://localhost"

> route('posts.show', ['post' => 1])
= "http://localhost/posts/1"

// Config
> config('app.name')
= "Mi Blog Laravel"

> config('app.env')
= "local"
```

## Probar el envío de emails

Una de las cosas más útiles de Tinker es verificar que tus emails se construyen correctamente:

```php
// Usar Mail::fake() para evitar envíos reales
> Mail::fake()
= null

> Mail::to('test@ejemplo.com')->send(new App\Mail\BienvenidaMail(User::find(1)))
= null

> Mail::assertSent(App\Mail\BienvenidaMail::class)
= null // No lanza excepción = fue enviado correctamente
```

También puedes enviar emails reales desde Tinker si tienes el driver configurado:

```php
> Mail::to('test@ejemplo.com')->send(new App\Mail\BienvenidaMail(User::first()))
```

## Casos de uso prácticos para depurar

### Verificar el resultado de un scope

```php
> Post::published()->count()
= 47

> Post::published()->latest()->first()->title
= "Artículo más reciente"
```

### Comprobar si una política funciona

```php
> $user = User::find(1)
> $post = Post::find(5)
> $user->can('update', $post)
= true
```

### Inspeccionar la configuración

```php
> config()->all()
// Muestra toda la configuración cargada

> env('APP_DEBUG')
= true
```

### Probar accessors y mutators

```php
> $user = User::find(1)
> $user->full_name  // Si tienes un accessor getFullNameAttribute
= "Juan García"
```

### Ver las queries ejecutadas

```php
> DB::enableQueryLog()
= null

> User::with('posts')->find(1)
= App\Models\User {#1251 ...}

> DB::getQueryLog()
= [
    [
      "query" => "select * from `users` where `users`.`id` = ? limit 1",
      "bindings" => [1],
      "time" => 1.5,
    ],
    [
      "query" => "select * from `posts` where `posts`.`user_id` in (?)",
      "bindings" => [1],
      "time" => 0.8,
    ],
  ]
```

## Consejos y trucos

### Usar el historial de comandos

Puedes navegar por comandos anteriores con las teclas de flecha arriba y abajo, igual que en bash.

### Autocompletado

Tinker soporta autocompletado con la tecla `Tab`. Escribe `User::` y pulsa Tab para ver los métodos disponibles.

### Ver la documentación de una función

```php
> doc collect
// Muestra la documentación de la función collect
```

### Listar variables definidas

```php
> ls
// Muestra las variables y funciones definidas en la sesión actual
```

### Limpiar la pantalla

```php
> clear
```

### Comandos de varias líneas

Tinker detecta automáticamente cuando un bloque de código no está terminado y espera a que lo completes:

```php
> if (User::count() > 10) {
...     echo "Hay más de 10 usuarios";
... } else {
...     echo "Pocos usuarios";
... }
Hay más de 10 usuarios
```

## Conclusión

Laravel Tinker es una herramienta que todo desarrollador Laravel debería tener dominada. Te ahorra tiempo, evita crear código temporal que luego tienes que borrar, y te permite explorar tu aplicación con total libertad. La próxima vez que quieras probar una consulta o verificar una relación, abre Tinker en lugar de tocar el código de producción.
