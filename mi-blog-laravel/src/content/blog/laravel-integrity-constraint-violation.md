---
title: 'Integrity constraint violation en migraciones de Laravel'
description: 'Soluciona el error Integrity constraint violation en Laravel: claves foráneas, valores NULL en columnas NOT NULL y problemas de orden en migraciones.'
pubDate: '2024-02-21'
tags: ['laravel', 'errores', 'migraciones', 'base-de-datos']
---

Hay pocos errores tan frustrantes como ejecutar `php artisan migrate` y ver un muro rojo de texto que termina en `SQLSTATE[23000]: Integrity constraint violation`. Este error tiene varias causas posibles y cada una tiene su propia solución. Vamos a verlas todas.

## ¿Qué significa "Integrity constraint violation"?

Es un error de base de datos que ocurre cuando intentas insertar o modificar datos que **violan una restricción de integridad** definida en el esquema. Hay tres variantes principales que verás en Laravel:

- `1048 Column 'X' cannot be null` — columna NOT NULL con valor NULL
- `1062 Duplicate entry 'X' for key 'Y'` — violación de índice único
- `1452 Cannot add or update a child row: a foreign key constraint fails` — clave foránea

Veamos cada una con su solución.

## Error 1: Foreign key constraint fails

Este es el más común. Ocurre cuando intentas insertar un registro con un `foreign key` que apunta a un ID que no existe en la tabla padre.

### Causa en migraciones

El problema más frecuente es el **orden de las migraciones**. Si tu tabla `posts` tiene una clave foránea a `users`, pero la migración de `posts` corre antes que la de `users`, vas a tener este error.

```php
// Migración de posts (corre ANTES que users - ERROR)
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained(); // users no existe todavía
    $table->string('title');
    $table->timestamps();
});
```

**Solución:** Los archivos de migración se ordenan por nombre (que incluye la fecha). Asegúrate de que la tabla padre tenga una fecha anterior:

```
2024_01_01_000000_create_users_table.php    ← primero
2024_01_01_000001_create_posts_table.php    ← después
```

### Causa en seeders

Cuando haces `php artisan migrate:fresh --seed`, las tablas se recrean vacías. Si el seeder de `posts` corre antes del de `users`, no habrá usuarios a los que apuntar.

```php
// DatabaseSeeder.php - ORDEN INCORRECTO
public function run(): void
{
    $this->call([
        PostSeeder::class,  // Error: users no existen
        UserSeeder::class,
    ]);
}

// ORDEN CORRECTO
public function run(): void
{
    $this->call([
        UserSeeder::class,  // Primero los padres
        PostSeeder::class,  // Después los hijos
    ]);
}
```

### Truncate vs Delete en seeders

Si intentas usar `truncate()` en tablas con foreign keys, también obtendrás este error porque truncate no respeta las restricciones de integridad.

```php
// MAL: falla con foreign keys activas
Post::truncate();

// BIEN: desactiva temporalmente las foreign keys
DB::statement('SET FOREIGN_KEY_CHECKS=0;');
Post::truncate();
DB::statement('SET FOREIGN_KEY_CHECKS=1;');

// O simplemente usa delete()
Post::query()->delete(); // respeta las constraints
```

## Error 2: Column cannot be null

Ocurre cuando intentas insertar un valor `null` en una columna definida como `NOT NULL`.

```php
// La migración define la columna como NOT NULL (por defecto)
$table->string('email'); // NOT NULL implícito
```

Pero en el código insertas un dato sin ese campo:

```php
User::create([
    'name' => 'Juan',
    // 'email' olvidado → NULL → ERROR
]);
```

### Solución 1: Hacer la columna nullable

Si el campo realmente puede ser opcional:

```php
$table->string('email')->nullable(); // Ahora acepta NULL
```

### Solución 2: Dar un valor por defecto

```php
$table->string('status')->default('active');
```

### Solución 3: Agregar el campo en la lógica de negocio

Si el campo es obligatorio, el error es legítimo. Debes asegurarte de que siempre se proporcione:

```php
// Usar Form Request para validar antes de llegar a la BD
public function rules(): array
{
    return [
        'email' => 'required|email|unique:users',
    ];
}
```

## Error 3: Duplicate entry for key

Ocurres cuando intentas insertar un valor duplicado en una columna con índice único.

```php
// Migración con índice único
$table->string('email')->unique();
```

```php
// Intentar insertar el mismo email dos veces → ERROR
User::create(['email' => 'juan@example.com']);
User::create(['email' => 'juan@example.com']); // BOOM
```

### Solución: firstOrCreate / updateOrCreate

```php
// En vez de create(), usa firstOrCreate()
$user = User::firstOrCreate(
    ['email' => 'juan@example.com'],
    ['name' => 'Juan', 'password' => bcrypt('secret')]
);

// O updateOrCreate para insertar o actualizar
$user = User::updateOrCreate(
    ['email' => 'juan@example.com'],
    ['name' => 'Juan Actualizado']
);
```

## Cómo usar onDelete correctamente

Cuando defines claves foráneas, debes pensar qué pasa cuando se elimina el registro padre:

```php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    
    // Opción 1: Si el usuario se elimina, elimina sus posts también
    $table->foreignId('user_id')
          ->constrained()
          ->onDelete('cascade');
    
    // Opción 2: Si la categoría se elimina, el post queda sin categoría
    $table->foreignId('category_id')
          ->nullable()
          ->constrained()
          ->onDelete('set null');
    
    // Opción 3: No permitir eliminar el usuario si tiene posts
    $table->foreignId('author_id')
          ->constrained('users')
          ->onDelete('restrict');
});
```

La opción `cascade` es la más común para relaciones de propiedad (el post "pertenece" al usuario). La opción `set null` es útil para relaciones opcionales.

## El método after() para agregar columnas

Cuando agregas una columna nueva a una tabla existente con una migración, puedes controlar dónde se inserta:

```php
Schema::table('posts', function (Blueprint $table) {
    $table->string('slug')
          ->after('title')   // Se coloca justo después de 'title'
          ->unique();
    
    $table->foreignId('category_id')
          ->nullable()
          ->after('user_id')
          ->constrained()
          ->onDelete('set null');
});
```

Esto es especialmente útil cuando el orden de las columnas importa para la legibilidad o para índices compuestos.

## Diagnóstico rápido

Cuando te llegue este error, sigue estos pasos:

```bash
# 1. Ver el error completo
php artisan migrate --verbose

# 2. Si el error es en datos existentes, ver el estado de la BD
php artisan migrate:status

# 3. En desarrollo, resetea todo y empieza limpio
php artisan migrate:fresh --seed

# 4. Para ver qué SQL está ejecutando
php artisan migrate --pretend
```

## Conclusión

El `Integrity constraint violation` siempre te está diciendo algo concreto sobre tu esquema o tus datos. Lee el mensaje de error completo: te dice qué tabla, qué columna y qué restricción está siendo violada. Con esa información y los patrones que vimos aquí, deberías poder resolver cualquier variante de este error en pocos minutos.
