---
title: 'Migraciones en Laravel: guía completa con ejemplos'
description: 'Aprende a crear y gestionar migraciones en Laravel. Tipos de columnas, modificadores, índices, claves foráneas y los comandos migrate, rollback y fresh explicados.'
pubDate: '2026-04-16'
tags: ['laravel', 'base-de-datos', 'migraciones', 'roadmap']
---

Las migraciones son el control de versiones de tu base de datos. En lugar de ejecutar SQL manualmente en cada entorno (local, staging, producción), defines la estructura de tus tablas en código PHP y Laravel se encarga de aplicar los cambios de forma consistente en todos lados.

En esta guía aprenderás a crear migraciones desde cero, qué tipos de columnas existen, cómo definir índices y claves foráneas, y cómo gestionar el ciclo de vida de tus migraciones.

## ¿Por qué usar migraciones?

Imagina este escenario sin migraciones: tu compañero añade una columna `descuento` a la tabla `productos` directamente en su base de datos local. Tú haces un pull de su código, ejecutas la app y explota porque la columna no existe en tu entorno. Con migraciones ese problema desaparece: el cambio queda en un archivo PHP versionado en Git, y con `php artisan migrate` se aplica en cualquier entorno.

Las ventajas son claras:
- El esquema de la base de datos viaja junto al código en el repositorio
- Puedes deshacer cambios con `rollback`
- Cada entorno se sincroniza con `php artisan migrate`
- Documentas la evolución de tu base de datos a lo largo del tiempo

## Crear una migración

```bash
# Laravel infiere que quieres crear una tabla por el prefijo "create_"
php artisan make:migration create_products_table

# Migración para modificar una tabla existente
php artisan make:migration add_discount_to_products_table --table=products

# Especificando la tabla explícitamente
php artisan make:migration create_order_items_table --create=order_items
```

El archivo se crea en `database/migrations/` con un timestamp como prefijo: `2026_04_16_102530_create_products_table.php`. Ese timestamp garantiza el orden de ejecución.

## Estructura de una migración

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Aplica la migración (crear, modificar, añadir columnas)
     */
    public function up(): void
    {
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->decimal('precio', 10, 2);
            $table->timestamps();
        });
    }

    /**
     * Revierte la migración (debe ser el inverso exacto de up())
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
```

El método `up()` se ejecuta al migrar y `down()` al hacer rollback. Siempre deben ser operaciones inversas: si en `up()` creas una tabla, en `down()` la eliminas. Si en `up()` añades una columna, en `down()` la eliminas.

## Schema::create vs Schema::table

```php
// Para crear una tabla nueva
Schema::create('products', function (Blueprint $table) {
    // definición de columnas
});

// Para modificar una tabla existente
Schema::table('products', function (Blueprint $table) {
    $table->string('sku')->after('nombre')->nullable();
    $table->decimal('descuento', 5, 2)->default(0);
});
```

## Tipos de columnas

### Cadenas de texto

```php
$table->string('nombre');           // VARCHAR(255)
$table->string('nombre', 100);      // VARCHAR(100)
$table->char('codigo_pais', 2);     // CHAR(2)
$table->text('descripcion');        // TEXT
$table->mediumText('contenido');    // MEDIUMTEXT
$table->longText('html');           // LONGTEXT
$table->tinyText('nota');           // TINYTEXT
```

### Números

```php
$table->integer('cantidad');        // INTEGER
$table->bigInteger('visitas');      // BIGINT
$table->smallInteger('posicion');   // SMALLINT
$table->tinyInteger('prioridad');   // TINYINT
$table->unsignedInteger('votos');   // INTEGER sin signo
$table->unsignedBigInteger('user_id'); // BIGINT sin signo

$table->float('peso', 8, 2);        // FLOAT
$table->double('latitud', 15, 8);   // DOUBLE
$table->decimal('precio', 10, 2);   // DECIMAL(10,2) — ideal para dinero
```

### Booleanos y estados

```php
$table->boolean('activo');          // TINYINT(1)
$table->enum('estado', ['pendiente', 'pagado', 'cancelado']); // ENUM
$table->set('permisos', ['leer', 'escribir', 'eliminar']);    // SET
```

### Fechas y tiempos

```php
$table->date('fecha_nacimiento');   // DATE
$table->time('hora_apertura');      // TIME
$table->dateTime('publicado_en');   // DATETIME
$table->timestamp('confirmado_en'); // TIMESTAMP
$table->year('anio_fundacion');     // YEAR

// Añade created_at y updated_at automáticamente
$table->timestamps();

// Añade deleted_at para soft deletes
$table->softDeletes();
```

### JSON y otros

```php
$table->json('metadata');           // JSON
$table->jsonb('atributos');         // JSONB (PostgreSQL)
$table->binary('imagen');           // BLOB
$table->uuid('uuid');               // UUID (36 chars)
$table->ulid('ulid');               // ULID
$table->ipAddress('ip_cliente');    // VARCHAR(45)
$table->macAddress('mac');          // VARCHAR(17)
```

### Columnas especiales

```php
// $table->id() es un shorthand de:
$table->bigIncrements('id');        // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY

// Para claves foráneas
$table->foreignId('user_id');       // Equivale a unsignedBigInteger('user_id')

// Columnas de morfismo (relaciones polimórficas)
$table->morphs('comentable');       // Añade comentable_id y comentable_type
```

## Modificadores de columnas

Los modificadores se encadenan al tipo de columna:

```php
Schema::create('products', function (Blueprint $table) {
    $table->id();

    // nullable: permite valores NULL
    $table->string('descripcion')->nullable();

    // default: valor por defecto
    $table->boolean('activo')->default(true);
    $table->integer('stock')->default(0);
    $table->string('estado')->default('borrador');

    // unsigned: solo valores positivos
    $table->integer('cantidad')->unsigned();

    // after: posición de la columna (MySQL)
    $table->string('sku')->after('nombre');

    // first: pone la columna primera (MySQL)
    $table->string('codigo')->first();

    // comment: comentario en la columna
    $table->decimal('precio', 10, 2)->comment('Precio en euros con IVA incluido');

    // useCurrent: usa CURRENT_TIMESTAMP como default
    $table->timestamp('creado_en')->useCurrent();

    $table->timestamps();
});
```

## Índices

Los índices aceleran las búsquedas pero ocupan espacio y ralentizan las escrituras. Úsalos en columnas por las que filtras frecuentemente.

```php
// Índice simple (acelera búsquedas, permite duplicados)
$table->string('email')->index();

// Índice único (además garantiza unicidad)
$table->string('slug')->unique();
$table->string('email')->unique();

// Índice primario (normalmente automático con id())
$table->primary('id');

// Índice compuesto (para búsquedas por múltiples columnas)
$table->index(['category_id', 'activo'], 'idx_category_activo');

// Índice único compuesto
$table->unique(['user_id', 'product_id'], 'uq_user_product');

// Índice fulltext para búsqueda de texto
$table->fullText('contenido');
```

También puedes añadir índices en una instrucción separada:

```php
$table->string('email');
$table->unique('email');

// O en la migración de modificación de tabla:
Schema::table('products', function (Blueprint $table) {
    $table->index('nombre');
});
```

## Claves foráneas

Las claves foráneas garantizan integridad referencial a nivel de base de datos.

### Sintaxis moderna (recomendada)

```php
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->string('nombre');

    // foreignId crea la columna + la clave foránea en una línea
    $table->foreignId('category_id')->constrained();
    // Equivale a: FK que referencia categories.id con ON DELETE RESTRICT

    // Con comportamiento en cascade
    $table->foreignId('user_id')->constrained()->onDelete('cascade');

    // Si la tabla referenciada no sigue la convención de nombre
    $table->foreignId('author_id')->constrained('users');

    // Con set null al borrar
    $table->foreignId('parent_id')->nullable()->constrained('categories')->nullOnDelete();

    $table->timestamps();
});
```

### Sintaxis clásica (más explícita)

```php
$table->unsignedBigInteger('category_id');

$table->foreign('category_id')
    ->references('id')
    ->on('categories')
    ->onDelete('cascade')
    ->onUpdate('cascade');
```

### Eliminar una clave foránea (en down())

```php
public function down(): void
{
    Schema::table('products', function (Blueprint $table) {
        $table->dropForeign(['category_id']);
        $table->dropColumn('category_id');
    });
}
```

## Renombrar y eliminar columnas

```php
Schema::table('products', function (Blueprint $table) {
    // Renombrar columna
    $table->renameColumn('nombre', 'titulo');

    // Eliminar columna
    $table->dropColumn('descripcion_vieja');

    // Eliminar varias columnas a la vez
    $table->dropColumn(['campo1', 'campo2', 'campo3']);

    // Renombrar tabla
    // (esto va fuera del closure, como segundo argumento de Schema::rename)
});

Schema::rename('products_old', 'products');
```

### Modificar columnas existentes

```php
Schema::table('products', function (Blueprint $table) {
    // Cambiar el tipo o propiedades de una columna existente
    $table->string('nombre', 500)->change();
    $table->decimal('precio', 12, 4)->nullable()->change();
});
```

## Comandos de migración

```bash
# Ejecutar todas las migraciones pendientes
php artisan migrate

# Ver qué migraciones se ejecutarían sin aplicarlas (dry run)
php artisan migrate --pretend

# Forzar en producción (sin confirmación)
php artisan migrate --force

# Revertir el último lote de migraciones
php artisan migrate:rollback

# Revertir los últimos N lotes
php artisan migrate:rollback --step=2

# Revertir todas las migraciones
php artisan migrate:reset

# Revertir todas y volver a ejecutar (útil en desarrollo)
php artisan migrate:refresh

# Revertir, ejecutar y sembrar datos
php artisan migrate:refresh --seed

# Borrar todas las tablas y volver a migrar desde cero
php artisan migrate:fresh

# Lo mismo con seeders
php artisan migrate:fresh --seed

# Ver estado de cada migración
php artisan migrate:status
```

La diferencia clave entre `refresh` y `fresh`:
- `migrate:refresh` ejecuta `down()` en cada migración (respeta la lógica de rollback)
- `migrate:fresh` borra todas las tablas directamente y aplica `up()` desde cero (más rápido, pero no ejecuta `down()`)

## Ejemplo completo: tienda online

Aquí tienes un ejemplo real de varias migraciones encadenadas:

```php
// create_categories_table
Schema::create('categories', function (Blueprint $table) {
    $table->id();
    $table->string('nombre');
    $table->string('slug')->unique();
    $table->text('descripcion')->nullable();
    $table->boolean('activa')->default(true);
    $table->timestamps();
});

// create_products_table
Schema::create('products', function (Blueprint $table) {
    $table->id();
    $table->foreignId('category_id')->constrained()->onDelete('restrict');
    $table->string('nombre');
    $table->string('slug')->unique();
    $table->text('descripcion')->nullable();
    $table->decimal('precio', 10, 2);
    $table->decimal('precio_oferta', 10, 2)->nullable();
    $table->unsignedInteger('stock')->default(0);
    $table->enum('estado', ['borrador', 'publicado', 'archivado'])->default('borrador');
    $table->json('imagenes')->nullable();
    $table->timestamps();
    $table->softDeletes();

    $table->index(['category_id', 'estado']);
    $table->index('precio');
});

// create_orders_table
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->onDelete('restrict');
    $table->string('numero')->unique();
    $table->enum('estado', ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'])
          ->default('pendiente');
    $table->decimal('subtotal', 10, 2);
    $table->decimal('impuestos', 10, 2)->default(0);
    $table->decimal('total', 10, 2);
    $table->text('notas')->nullable();
    $table->timestamp('pagado_en')->nullable();
    $table->timestamp('enviado_en')->nullable();
    $table->timestamps();
});
```

## Buenas prácticas

**Un cambio por migración.** Crea una migración por cada cambio lógico. Evita acumular múltiples cambios no relacionados en una sola migración; si algo falla, el rollback es mucho más limpio.

**Nunca edites una migración ya ejecutada en producción.** Si necesitas corregir algo, crea una nueva migración que aplique el ajuste. Editar una migración que ya se ejecutó en producción implica que en ese entorno el rollback no funcionará correctamente.

**El método down() siempre debe ser el inverso de up().** Si en `up()` añades una columna con índice, en `down()` elimina primero el índice y luego la columna.

**Usa `migrate:fresh --seed` en desarrollo, nunca en producción.** Este comando borra todos los datos. En producción solo usa `migrate`.
