---
title: 'Seeders y Factories en Laravel: pobla tu base de datos fácilmente'
description: 'Aprende a usar Seeders y Factories en Laravel para generar datos de prueba. Faker, relaciones entre factories y el comando db:seed explicados paso a paso.'
pubDate: '2026-04-16'
tags: ['laravel', 'base-de-datos', 'testing', 'roadmap']
---

Cuando desarrollas una aplicación necesitas datos con los que trabajar: usuarios, productos, pedidos, comentarios... Crearlos manualmente uno a uno en la base de datos es tedioso y no escala. Laravel tiene dos herramientas para esto: **Seeders** para insertar datos concretos y **Factories** para generar datos aleatorios realistas en masa.

En esta guía aprenderás a usarlos juntos, a definir relaciones entre factories y a aprovecharlos en tus tests.

## ¿Qué son los Seeders?

Un Seeder es una clase PHP que contiene código para insertar datos en la base de datos. Son ideales para datos que siempre deben existir en tu app: los roles de usuario, las categorías por defecto, el usuario administrador inicial...

```bash
php artisan make:seeder CategorySeeder
```

Genera `database/seeders/CategorySeeder.php`:

```php
<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['nombre' => 'Electrónica',   'slug' => 'electronica'],
            ['nombre' => 'Ropa',          'slug' => 'ropa'],
            ['nombre' => 'Hogar',         'slug' => 'hogar'],
            ['nombre' => 'Deportes',      'slug' => 'deportes'],
            ['nombre' => 'Libros',        'slug' => 'libros'],
        ];

        foreach ($categories as $category) {
            Category::firstOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }
    }
}
```

Usando `firstOrCreate` en lugar de `create` o `insert` evitas duplicados si ejecutas el seeder varias veces.

## DatabaseSeeder: el orquestador

`database/seeders/DatabaseSeeder.php` es el seeder principal. Desde aquí llamas al resto:

```php
<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // El orden importa: primero crea los datos de los que dependen otros
        $this->call([
            RoleSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            ProductSeeder::class,
            OrderSeeder::class,
        ]);
    }
}
```

Puedes llamar a un seeder individual o a todos:

```bash
# Ejecutar solo el DatabaseSeeder (llama a todos los llamados con $this->call)
php artisan db:seed

# Ejecutar un seeder específico
php artisan db:seed --class=CategorySeeder

# Borrar la base de datos, migrar y ejecutar todos los seeders
php artisan migrate:fresh --seed
```

## ¿Qué son las Factories?

Las Factories son clases que generan instancias de modelos con datos aleatorios pero realistas gracias a la librería **Faker**. Son perfectas para:

- Generar 50 productos de prueba con un solo comando
- Crear datos para tests de forma declarativa
- Simular escenarios complejos con relaciones

```bash
php artisan make:factory ProductFactory --model=Product
```

Genera `database/factories/ProductFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Category;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ProductFactory extends Factory
{
    public function definition(): array
    {
        $nombre = $this->faker->words(rand(2, 4), true);

        return [
            'nombre'       => ucfirst($nombre),
            'slug'         => Str::slug($nombre) . '-' . $this->faker->unique()->numberBetween(1, 9999),
            'descripcion'  => $this->faker->paragraph(3),
            'precio'       => $this->faker->randomFloat(2, 5, 500),
            'stock'        => $this->faker->numberBetween(0, 200),
            'activo'       => $this->faker->boolean(80), // 80% de probabilidad de true
            'category_id'  => Category::factory(),
        ];
    }
}
```

## Métodos de Faker más utilizados

Faker puede generar casi cualquier tipo de dato realista. Aquí los más comunes:

### Texto y nombres

```php
$this->faker->name();                    // 'María García López'
$this->faker->firstName();               // 'Carlos'
$this->faker->lastName();                // 'Martínez'
$this->faker->email();                   // 'usuario@example.com'
$this->faker->safeEmail();               // 'usuario@example.org' (siempre válido)
$this->faker->userName();                // 'user.name123'
$this->faker->password(8, 20);          // 'xK9$mN2p'

$this->faker->word();                    // 'lorem'
$this->faker->words(3, true);           // 'lorem ipsum dolor'
$this->faker->sentence();               // 'Lorem ipsum dolor sit amet.'
$this->faker->sentences(3, true);       // 3 frases como string
$this->faker->paragraph();              // Párrafo de texto
$this->faker->paragraphs(3, true);      // 3 párrafos como string
$this->faker->text(200);                // Texto de máximo 200 caracteres
```

### Números y booleanos

```php
$this->faker->numberBetween(1, 100);    // Entero entre 1 y 100
$this->faker->randomFloat(2, 0, 1000);  // Decimal con 2 cifras, entre 0 y 1000
$this->faker->randomDigit();            // Dígito del 0 al 9
$this->faker->boolean();                // true o false (50%)
$this->faker->boolean(80);             // true el 80% de las veces
```

### Fechas

```php
$this->faker->date();                           // '1990-03-15'
$this->faker->dateTime();                       // DateTime object
$this->faker->dateTimeBetween('-1 year', 'now'); // Fecha entre hace 1 año y ahora
$this->faker->dateTimeBetween('-30 days', '+30 days');
$this->faker->unixTime();                       // Timestamp Unix
$this->faker->year();                           // '2023'
$this->faker->time();                           // '14:35:22'
```

### Internet y URLs

```php
$this->faker->url();                    // 'https://example.com/path'
$this->faker->imageUrl(640, 480);       // URL de imagen con dimensiones
$this->faker->ipv4();                   // '192.168.1.100'
$this->faker->slug();                   // 'lorem-ipsum-dolor'
$this->faker->domainName();             // 'example.com'
```

### Selección aleatoria

```php
$this->faker->randomElement(['activo', 'inactivo', 'suspendido']);
$this->faker->randomElements(['rojo', 'verde', 'azul', 'negro'], 2);
$this->faker->shuffle(['a', 'b', 'c']);
```

### Valores únicos

```php
// unique() garantiza que no se repita el valor durante la ejecución de la factory
$this->faker->unique()->email();
$this->faker->unique()->numberBetween(1, 1000);
```

## States (variantes de una factory)

Los states permiten definir variaciones de una factory sin duplicar código:

```php
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nombre'   => $this->faker->words(3, true),
            'precio'   => $this->faker->randomFloat(2, 5, 500),
            'activo'   => true,
            'stock'    => $this->faker->numberBetween(1, 100),
        ];
    }

    // Estado: producto agotado
    public function agotado(): static
    {
        return $this->state(fn (array $attributes) => [
            'stock' => 0,
        ]);
    }

    // Estado: producto en oferta
    public function enOferta(): static
    {
        return $this->state(fn (array $attributes) => [
            'precio_original' => $attributes['precio'],
            'precio'          => $attributes['precio'] * 0.7, // 30% descuento
        ]);
    }

    // Estado: producto inactivo
    public function inactivo(): static
    {
        return $this->state(fn (array $attributes) => [
            'activo' => false,
        ]);
    }
}
```

Usar los states:

```php
// Producto agotado
Product::factory()->agotado()->create();

// 10 productos en oferta
Product::factory()->enOferta()->count(10)->create();

// Combinar estados
Product::factory()->agotado()->inactivo()->create();
```

## Relaciones entre factories

### Relación belongsTo (muchos-a-uno)

Un producto pertenece a una categoría:

```php
class ProductFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nombre'      => $this->faker->words(3, true),
            'precio'      => $this->faker->randomFloat(2, 1, 1000),
            // Crea una categoría nueva automáticamente si no se especifica una
            'category_id' => Category::factory(),
        ];
    }
}
```

Para asignar una categoría existente en lugar de crear una nueva:

```php
$category = Category::factory()->create();

// Todos los productos de esta categoría
Product::factory()->count(10)->create(['category_id' => $category->id]);

// O con for()
Product::factory()->count(10)->for($category)->create();
```

### Relación hasMany (uno-a-muchos)

Un usuario tiene muchos pedidos. En el UserFactory:

```php
class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name'     => $this->faker->name(),
            'email'    => $this->faker->unique()->safeEmail(),
            'password' => bcrypt('password'),
        ];
    }

    // State: usuario con pedidos
    public function withOrders(int $count = 3): static
    {
        return $this->has(Order::factory()->count($count), 'orders');
    }
}
```

Usando la relación:

```php
// Crear un usuario con 5 pedidos
User::factory()->withOrders(5)->create();

// Alternativa más explícita con has()
User::factory()
    ->has(Order::factory()->count(5), 'orders')
    ->create();
```

### Relación belongsToMany (muchos-a-muchos)

Un post puede tener muchas etiquetas:

```php
// Crear un post con 3 tags existentes
$tags = Tag::factory()->count(3)->create();

Post::factory()->create()->tags()->attach($tags);

// O directamente en el seeder
Post::factory()
    ->count(20)
    ->create()
    ->each(function ($post) {
        $post->tags()->attach(
            Tag::inRandomOrder()->limit(rand(1, 4))->pluck('id')
        );
    });
```

## create() vs make()

```php
// create(): guarda en la base de datos y devuelve el modelo
$product = Product::factory()->create();

// make(): construye el modelo en memoria sin guardarlo (útil en unit tests)
$product = Product::factory()->make();

// createMany(): crea N instancias, devuelve Collection
$products = Product::factory()->count(50)->create();

// makeMany(): construye N instancias sin guardar
$products = Product::factory()->count(10)->make();

// Sobreescribir atributos al crear
$product = Product::factory()->create([
    'nombre' => 'Producto Específico',
    'precio' => 99.99,
]);
```

## Usar factories en seeders

Combina seeders para datos fijos con factories para datos de volumen:

```php
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Datos fijos con seeder
        $this->call([
            RoleSeeder::class,
            CategorySeeder::class,
        ]);

        // Datos de prueba con factories
        $categories = Category::all();

        // 5 usuarios con datos realistas
        User::factory()->count(5)->create();

        // 50 productos distribuidos entre las categorías existentes
        Product::factory()
            ->count(50)
            ->create([
                'category_id' => fn () => $categories->random()->id,
            ]);

        // 10 productos agotados
        Product::factory()->count(10)->agotado()->create([
            'category_id' => fn () => $categories->random()->id,
        ]);
    }
}
```

## Usar factories en tests

Aquí es donde las factories brillan especialmente. En lugar de preparar datos manualmente en cada test, los generas con una línea:

```php
<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductTest extends TestCase
{
    // RefreshDatabase limpia la base de datos entre tests
    use RefreshDatabase;

    public function test_user_can_view_product_list(): void
    {
        // Arrange: crear datos de prueba
        $products = Product::factory()->count(10)->create();

        // Act: hacer la petición
        $response = $this->get(route('productos.index'));

        // Assert: verificar la respuesta
        $response->assertStatus(200);
        $response->assertViewHas('products');
    }

    public function test_authenticated_user_can_create_product(): void
    {
        // Crear un usuario y autenticarlo
        $user = User::factory()->create();

        $productData = Product::factory()->make()->toArray();

        $response = $this->actingAs($user)
            ->post(route('productos.store'), $productData);

        $response->assertRedirect(route('productos.index'));
        $this->assertDatabaseHas('products', [
            'nombre' => $productData['nombre'],
        ]);
    }

    public function test_out_of_stock_products_show_sold_out_badge(): void
    {
        $product = Product::factory()->agotado()->create();

        $response = $this->get(route('productos.show', $product));

        $response->assertSee('Agotado');
    }
}
```

## Ejecutar los seeders

```bash
# Ejecutar el DatabaseSeeder completo
php artisan db:seed

# Ejecutar un seeder específico
php artisan db:seed --class=ProductSeeder

# Limpiar la base de datos, migrar y sembrar (el flujo más habitual en desarrollo)
php artisan migrate:fresh --seed

# Con confirmación explícita en producción
php artisan db:seed --force
```

## Buenas prácticas

**Usa `firstOrCreate` o `updateOrCreate` en seeders de datos fijos.** Así puedes ejecutar el seeder múltiples veces sin duplicar registros.

**Separa seeders de producción de los de desarrollo.** Los datos del administrador inicial y los roles van en seeders que se ejecutan en producción. Las 100 categorías falsas y los 500 productos de Faker solo en entornos de desarrollo.

**Mantén las factories simples.** Una factory debe representar un estado válido y común del modelo. Las variaciones van en states.

**Usa `RefreshDatabase` en tests, no `truncate` manual.** El trait de Laravel gestiona las transacciones automáticamente y es más eficiente.

**No uses datos reales de producción como semilla.** Además del RGPD, mezclar datos reales con entornos de prueba es una fuente de bugs difíciles de detectar. Para eso existen las factories.
