---
modulo: 3
leccion: 3
title: 'Seeders y Factories — datos de prueba'
description: 'Aprende a poblar tu base de datos con datos de prueba realistas usando Seeders y Factories con Faker en Laravel.'
duracion: '18 min'
quiz:
  - pregunta: '¿Cuál es la función principal de un Factory en Laravel?'
    opciones:
      - 'Ejecutar migraciones automáticamente'
      - 'Generar instancias de modelos con datos falsos de forma programática'
      - 'Crear conexiones a bases de datos externas'
      - 'Gestionar las rutas de la aplicación'
    correcta: 1
    explicacion: 'Los Factories permiten definir plantillas de datos para cada modelo, usando Faker para generar valores realistas. Son esenciales para tests y para poblar la base de datos en desarrollo.'
  - pregunta: '¿Qué método se usa en un Factory para crear y guardar un registro en la base de datos?'
    opciones:
      - 'make()'
      - 'build()'
      - 'create()'
      - 'save()'
    correcta: 2
    explicacion: 'El método create() genera el modelo Y lo persiste en la base de datos. El método make() solo crea la instancia en memoria sin guardarla, útil para tests unitarios.'
  - pregunta: '¿Qué comando ejecuta todos los seeders registrados en DatabaseSeeder?'
    opciones:
      - 'php artisan seed:run'
      - 'php artisan db:seed'
      - 'php artisan seeder:execute'
      - 'php artisan make:seeder'
    correcta: 1
    explicacion: 'El comando php artisan db:seed ejecuta la clase DatabaseSeeder, que a su vez puede llamar a otros seeders individuales. Con --class puedes ejecutar un seeder específico.'
---

## Seeders y Factories en Laravel

Cuando desarrollas una aplicación, necesitas datos con los que trabajar: usuarios, posts, productos, comentarios. Crearlos a mano es tedioso y lento. Laravel ofrece dos herramientas para automatizar esto: **Factories** para definir cómo se generan los datos y **Seeders** para orquestar su inserción en la base de datos.

## ¿Qué es un Factory?

Un Factory es una clase que define cómo construir instancias de un modelo con datos falsos pero realistas. Usa la librería **Faker** (incluida en Laravel) para generar nombres, emails, fechas, textos, URLs y decenas de tipos de datos.

### Crear un Factory

```bash
php artisan make:factory PostFactory --model=Post
```

Esto crea el archivo `database/factories/PostFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PostFactory extends Factory
{
    public function definition(): array
    {
        $titulo = fake()->sentence(6);

        return [
            'user_id'        => User::factory(),
            'titulo'         => $titulo,
            'slug'           => Str::slug($titulo),
            'extracto'       => fake()->paragraph(2),
            'contenido'      => fake()->paragraphs(8, true),
            'estado'         => fake()->randomElement(['borrador', 'publicado']),
            'vistas'         => fake()->numberBetween(0, 5000),
            'tiempo_lectura' => fake()->numberBetween(2, 20),
            'publicado_en'   => fake()->dateTimeBetween('-1 year', 'now'),
        ];
    }
}
```

### Datos de Faker más útiles

```php
// Texto
fake()->word()               // una palabra
fake()->sentence(5)          // oración con ~5 palabras
fake()->paragraph(3)         // párrafo con ~3 oraciones
fake()->paragraphs(5, true)  // 5 párrafos como string

// Personas
fake()->name()               // nombre completo
fake()->firstName()          // nombre
fake()->lastName()           // apellido
fake()->email()              // email único
fake()->username()           // nombre de usuario

// Internet
fake()->url()                // URL
fake()->imageUrl(640, 480)   // URL de imagen
fake()->slug()               // slug-de-url

// Números y fechas
fake()->numberBetween(1, 100)
fake()->randomFloat(2, 0, 999)
fake()->dateTimeBetween('-1 year', 'now')
fake()->boolean(70)          // true el 70% de las veces

// Listas
fake()->randomElement(['activo', 'inactivo', 'pendiente'])
```

### Faker en español

Para generar datos en español, configura el locale en `config/app.php`:

```php
'faker_locale' => 'es_ES',
```

Esto afecta a nombres, direcciones, números de teléfono y más.

## Usar el Factory

Una vez definido, puedes usar el Factory desde Tinker, Seeders o tests:

```php
// Crear un Post (y lo guarda en la BD)
Post::factory()->create();

// Crear 10 Posts
Post::factory()->count(10)->create();

// Crear solo la instancia sin guardar (para tests)
Post::factory()->make();

// Sobrescribir valores específicos
Post::factory()->create([
    'titulo' => 'Mi post especial',
    'estado' => 'publicado',
]);

// Crear un usuario con 5 posts asociados
User::factory()
    ->has(Post::factory()->count(5))
    ->create();
```

## Estados del Factory

Los estados permiten definir variaciones del Factory para situaciones específicas:

```php
class PostFactory extends Factory
{
    public function definition(): array
    {
        return [
            'titulo'  => fake()->sentence(),
            'estado'  => 'borrador',
            'vistas'  => 0,
        ];
    }

    // Estado: post publicado
    public function publicado(): static
    {
        return $this->state(fn (array $attributes) => [
            'estado'       => 'publicado',
            'publicado_en' => now()->subDays(fake()->numberBetween(1, 180)),
        ]);
    }

    // Estado: post viral
    public function viral(): static
    {
        return $this->state(fn (array $attributes) => [
            'estado' => 'publicado',
            'vistas' => fake()->numberBetween(10000, 100000),
        ]);
    }
}
```

Usarlos es muy intuitivo:

```php
Post::factory()->publicado()->create();
Post::factory()->viral()->count(3)->create();
```

## ¿Qué es un Seeder?

Un Seeder es una clase que inserta datos en la base de datos. Es donde orquestas qué datos se crean, en qué cantidad y en qué orden. El seeder principal es `DatabaseSeeder`, pero puedes crear tantos como necesites.

### Crear un Seeder

```bash
php artisan make:seeder PostSeeder
```

Esto genera `database/seeders/PostSeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;

class PostSeeder extends Seeder
{
    public function run(): void
    {
        // Crear 5 usuarios, cada uno con 10 posts
        User::factory()
            ->count(5)
            ->has(Post::factory()->count(10)->publicado())
            ->create();

        // Posts en borrador sin autor específico
        Post::factory()->count(20)->create();
    }
}
```

### DatabaseSeeder — el seeder raíz

El archivo `database/seeders/DatabaseSeeder.php` es el punto de entrada. Llama a los demás seeders en el orden correcto:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            CategoriaSeeder::class,
            PostSeeder::class,
            ComentarioSeeder::class,
            TagSeeder::class,
        ]);
    }
}
```

El orden importa si hay relaciones entre tablas. Los usuarios deben existir antes de crear posts que los referencian.

## Ejecutar los Seeders

```bash
# Ejecutar DatabaseSeeder
php artisan db:seed

# Ejecutar un seeder específico
php artisan db:seed --class=PostSeeder

# Migrar y sembrar en un solo comando (útil en desarrollo)
php artisan migrate:fresh --seed
```

El comando `migrate:fresh --seed` elimina todas las tablas, las vuelve a crear y ejecuta los seeders. Es el comando más usado para resetear el entorno de desarrollo.

## Seeder con datos estáticos

No siempre uses Factories. Para datos de catálogo (roles, categorías, países) es mejor insertar datos concretos:

```php
class CategoriaSeeder extends Seeder
{
    public function run(): void
    {
        $categorias = [
            ['nombre' => 'Laravel',     'slug' => 'laravel',     'color' => '#FF2D20'],
            ['nombre' => 'PHP',         'slug' => 'php',         'color' => '#4F5D95'],
            ['nombre' => 'JavaScript',  'slug' => 'javascript',  'color' => '#F0DB4F'],
            ['nombre' => 'Bases de Datos', 'slug' => 'bases-de-datos', 'color' => '#336791'],
            ['nombre' => 'DevOps',      'slug' => 'devops',      'color' => '#2496ED'],
        ];

        foreach ($categorias as $categoria) {
            Categoria::updateOrCreate(
                ['slug' => $categoria['slug']],
                $categoria
            );
        }
    }
}
```

Usar `updateOrCreate` permite ejecutar el seeder múltiples veces sin duplicar datos.

## El modelo debe usar HasFactory

Para que un Factory funcione con un modelo, este debe usar el trait `HasFactory`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id', 'titulo', 'slug', 'extracto',
        'contenido', 'estado', 'vistas', 'publicado_en',
    ];
}
```

## Factories en tests

Los Factories brillan especialmente en los tests, donde necesitas datos controlados:

```php
public function test_usuario_puede_ver_posts_publicados(): void
{
    $usuario = User::factory()->create();
    $postsPublicados = Post::factory()->publicado()->count(3)->create();
    $postsBorrador = Post::factory()->count(2)->create(['estado' => 'borrador']);

    $response = $this->actingAs($usuario)->get('/posts');

    $response->assertOk();
    $response->assertViewHas('posts', function ($posts) {
        return $posts->count() === 3;
    });
}
```

Los Factories y Seeders son herramientas indispensables en el ciclo de desarrollo con Laravel. Con ellos, montar un entorno de prueba con datos realistas tarda segundos, no horas.
