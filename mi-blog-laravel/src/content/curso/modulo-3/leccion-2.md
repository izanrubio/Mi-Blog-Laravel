---
modulo: 3
leccion: 2
title: 'Migraciones — crear y modificar tablas'
description: 'Domina las migraciones de Laravel para crear, modificar y eliminar tablas de forma controlada y reproducible en cualquier entorno.'
duracion: '20 min'
quiz:
  - pregunta: '¿Qué comando crea un nuevo archivo de migración en Laravel?'
    opciones:
      - 'php artisan make:table nombre_tabla'
      - 'php artisan make:migration create_tabla_table'
      - 'php artisan migration:new nombre_tabla'
      - 'php artisan db:migrate create nombre_tabla'
    correcta: 1
    explicacion: 'El comando correcto es php artisan make:migration, seguido del nombre descriptivo. Laravel detecta automáticamente si es una migración de creación o modificación según el nombre.'
  - pregunta: '¿Qué método de Schema se usa para agregar una columna a una tabla existente?'
    opciones:
      - 'Schema::create()'
      - 'Schema::modify()'
      - 'Schema::table()'
      - 'Schema::alter()'
    correcta: 2
    explicacion: 'Schema::table() se utiliza para modificar tablas existentes (agregar, cambiar o eliminar columnas). Schema::create() solo se usa al crear una tabla nueva.'
  - pregunta: '¿Qué hace el método rollback en las migraciones?'
    opciones:
      - 'Elimina todas las tablas de la base de datos'
      - 'Deshace el último lote de migraciones ejecutadas'
      - 'Reinicia la base de datos desde cero'
      - 'Crea una copia de seguridad antes de migrar'
    correcta: 1
    explicacion: 'php artisan migrate:rollback deshace el último lote (batch) de migraciones, ejecutando el método down() de cada migración de ese lote en orden inverso.'
---

## Migraciones en Laravel — crear y modificar tablas

Las migraciones son el sistema de control de versiones para tu base de datos. En lugar de ejecutar sentencias SQL manualmente en cada entorno, defines los cambios en código PHP y Laravel se encarga de aplicarlos de forma ordenada y reproducible. Así cualquier miembro del equipo puede tener exactamente la misma estructura de base de datos ejecutando un solo comando.

## ¿Qué es una migración?

Una migración es un archivo PHP que contiene dos métodos:

- `up()`: define los cambios a aplicar (crear tabla, agregar columna, etc.)
- `down()`: define cómo deshacer esos cambios (eliminar tabla, quitar columna, etc.)

Laravel guarda un registro de qué migraciones se han ejecutado en la tabla `migrations` de la base de datos. Así sabe cuáles pendientes aplicar y cuáles revertir.

## Crear una migración

```bash
php artisan make:migration create_posts_table
```

Este comando crea un archivo en `database/migrations/` con un timestamp como prefijo para garantizar el orden de ejecución:

```
2024_01_15_120000_create_posts_table.php
```

El archivo generado tiene esta estructura:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('posts');
    }
};
```

## Tipos de columnas más usados

Laravel ofrece métodos descriptivos para cada tipo de columna SQL:

```php
Schema::create('posts', function (Blueprint $table) {
    $table->id();                          // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
    $table->string('titulo', 200);         // VARCHAR(200)
    $table->text('contenido');             // TEXT
    $table->longText('cuerpo');            // LONGTEXT
    $table->integer('vistas')->default(0); // INT con valor por defecto 0
    $table->unsignedBigInteger('user_id'); // BIGINT UNSIGNED (para claves foráneas)
    $table->boolean('publicado');          // TINYINT(1)
    $table->enum('estado', ['borrador', 'publicado', 'archivado']);
    $table->decimal('precio', 8, 2);       // DECIMAL(8,2) para dinero
    $table->date('fecha_publicacion');     // DATE
    $table->dateTime('programado_para');   // DATETIME
    $table->json('meta');                  // JSON nativo
    $table->timestamps();                  // created_at y updated_at
    $table->softDeletes();                 // deleted_at para borrado suave
});
```

## Columnas nullable y valores por defecto

```php
$table->string('subtitulo')->nullable();           // Permite NULL
$table->string('slug')->unique();                  // Valor único
$table->string('imagen')->nullable()->default('default.jpg');
$table->integer('orden')->default(0)->unsigned();
```

## Claves foráneas

Laravel facilita la definición de claves foráneas con su sintaxis fluida:

```php
// Forma larga (más control)
$table->unsignedBigInteger('user_id');
$table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');

// Forma corta (Laravel recomendado)
$table->foreignId('user_id')->constrained()->cascadeOnDelete();

// Con tabla y columna personalizadas
$table->foreignId('autor_id')->constrained('users')->cascadeOnDelete();
```

El método `constrained()` infiere automáticamente la tabla referenciada a partir del nombre de la columna (`user_id` → tabla `users`, columna `id`).

## Ejecutar migraciones

```bash
# Ejecutar todas las migraciones pendientes
php artisan migrate

# Ver el estado de las migraciones
php artisan migrate:status

# Ejecutar con confirmación en producción
php artisan migrate --force
```

## Revertir migraciones

```bash
# Revertir el último lote
php artisan migrate:rollback

# Revertir N lotes
php artisan migrate:rollback --step=2

# Revertir todas las migraciones
php artisan migrate:reset

# Revertir todo y volver a migrar
php artisan migrate:refresh

# Revertir todo, volver a migrar y ejecutar seeders
php artisan migrate:refresh --seed
```

## Modificar tablas existentes

Para agregar columnas a una tabla que ya existe, crea una nueva migración con un nombre descriptivo:

```bash
php artisan make:migration add_categoria_to_posts_table
```

Dentro, usa `Schema::table()` en lugar de `Schema::create()`:

```php
public function up(): void
{
    Schema::table('posts', function (Blueprint $table) {
        $table->string('categoria')->nullable()->after('titulo');
        $table->integer('tiempo_lectura')->default(0)->after('contenido');
    });
}

public function down(): void
{
    Schema::table('posts', function (Blueprint $table) {
        $table->dropColumn(['categoria', 'tiempo_lectura']);
    });
}
```

El método `after('columna')` coloca la nueva columna justo después de la indicada (solo en MySQL).

## Cambiar el tipo de una columna

Para cambiar el tipo o propiedades de una columna existente, usa el método `change()`. Requiere instalar el paquete `doctrine/dbal`:

```bash
composer require doctrine/dbal
```

```php
public function up(): void
{
    Schema::table('posts', function (Blueprint $table) {
        $table->text('titulo')->change(); // Cambia string a text
        $table->string('subtitulo', 500)->nullable()->change();
    });
}
```

## Renombrar y eliminar columnas

```php
// Renombrar columna
$table->renameColumn('nombre_viejo', 'nombre_nuevo');

// Eliminar columna
$table->dropColumn('columna_a_eliminar');

// Eliminar múltiples columnas
$table->dropColumn(['col1', 'col2', 'col3']);
```

## Índices

Los índices mejoran el rendimiento de las consultas. Puedes agregarlos al crear o modificar tablas:

```php
$table->string('email')->unique();      // Índice único
$table->index('user_id');               // Índice simple
$table->index(['user_id', 'estado']);   // Índice compuesto
$table->fullText('contenido');          // Índice de texto completo (MySQL/PostgreSQL)
```

## Ejemplo completo: tabla posts con relaciones

```php
Schema::create('posts', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('titulo');
    $table->string('slug')->unique();
    $table->text('extracto')->nullable();
    $table->longText('contenido');
    $table->string('imagen_portada')->nullable();
    $table->enum('estado', ['borrador', 'publicado', 'archivado'])->default('borrador');
    $table->integer('vistas')->default(0);
    $table->integer('tiempo_lectura')->default(0);
    $table->timestamp('publicado_en')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->index('estado');
    $table->index('publicado_en');
});
```

## Buenas prácticas

- Nombra las migraciones de forma descriptiva: `create_posts_table`, `add_slug_to_posts_table`, `drop_vistas_from_posts_table`.
- Siempre implementa el método `down()` para poder hacer rollback sin perder consistencia.
- Nunca modifiques una migración que ya fue ejecutada en producción. Crea siempre una nueva.
- Usa `foreignId()->constrained()` en lugar de la forma larga, es más limpia y menos propensa a errores.
- Agrupa cambios relacionados en una sola migración para mantener el historial limpio.

Las migraciones son la base del trabajo colaborativo con bases de datos. Con ellas, todo el equipo trabaja siempre con la misma estructura, sin scripts SQL manuales ni documentación desactualizada.
