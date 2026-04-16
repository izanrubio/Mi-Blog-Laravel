---
modulo: 5
leccion: 5
title: 'Testing básico en Laravel'
description: 'Aprende a escribir tests en Laravel con PHPUnit y Pest: tests de funcionalidad, pruebas de base de datos, mocking y las herramientas integradas de Laravel.'
duracion: '25 min'
quiz:
  - pregunta: '¿Qué tipo de test verifica que un endpoint de la API devuelve el código de estado y los datos correctos?'
    opciones:
      - 'Unit Test (test unitario)'
      - 'Feature Test (test de funcionalidad)'
      - 'Integration Test (test de integración)'
      - 'End-to-End Test'
    correcta: 1
    explicacion: 'Los Feature Tests (tests de funcionalidad) simulan peticiones HTTP completas a la aplicación y verifican la respuesta, incluyendo el código de estado, la estructura JSON y los datos devueltos. Son ideales para probar rutas y controladores.'
  - pregunta: '¿Qué trait se usa en los tests de Laravel para reiniciar la base de datos después de cada test?'
    opciones:
      - 'UsesDatabase'
      - 'RefreshDatabase'
      - 'ResetDatabase'
      - 'CleanDatabase'
    correcta: 1
    explicacion: 'El trait RefreshDatabase aplica las migraciones al inicio de la suite de tests y reinicia la base de datos entre tests, garantizando que cada test parta de un estado limpio y conocido.'
  - pregunta: '¿Qué helper de Laravel permite hacer una petición GET simulada en un test?'
    opciones:
      - '$this->request()->get()'
      - '$this->call("GET", "/ruta")'
      - '$this->get("/ruta")'
      - 'Http::get("/ruta")'
    correcta: 2
    explicacion: 'Laravel proporciona métodos helper como $this->get(), $this->post(), $this->put() y $this->delete() en los tests de funcionalidad para simular peticiones HTTP de forma sencilla y expresiva.'
---

## ¿Por qué hacer tests?

Escribir tests es una de las prácticas que más diferencia a los desarrolladores junior de los senior. Los tests automáticos garantizan que tu código funciona como esperas, y más importante, te avisan cuando un cambio rompe algo que antes funcionaba.

Los beneficios son claros:
- **Confianza al hacer cambios**: puedes refactorizar código sabiendo que los tests te avisarán si algo deja de funcionar.
- **Documentación viva**: los tests describen el comportamiento esperado del sistema.
- **Menos bugs en producción**: los tests detectan errores antes de que lleguen a los usuarios.
- **Desarrollo más rápido a largo plazo**: aunque escribir tests lleva tiempo al principio, ahorra horas de depuración manual.

Laravel incluye PHPUnit por defecto y también es compatible con **Pest**, un framework de testing más moderno y con una sintaxis más concisa.

## Tipos de tests en Laravel

Laravel distingue dos grandes categorías:

- **Unit Tests** (`tests/Unit/`): prueban una clase o función de forma aislada, sin interactuar con la base de datos ni con el framework completo. Son muy rápidos.
- **Feature Tests** (`tests/Feature/`): simulan peticiones HTTP completas o interacciones con el sistema, incluyendo base de datos, rutas y middleware. Son más lentos pero más realistas.

## Configurar el entorno de tests

Laravel incluye el archivo `phpunit.xml` en la raíz del proyecto. Para que los tests usen una base de datos en memoria (SQLite), añade estas líneas:

```xml
<!-- phpunit.xml -->
<php>
    <env name="APP_ENV" value="testing"/>
    <env name="DB_CONNECTION" value="sqlite"/>
    <env name="DB_DATABASE" value=":memory:"/>
    <env name="CACHE_DRIVER" value="array"/>
    <env name="QUEUE_CONNECTION" value="sync"/>
    <env name="SESSION_DRIVER" value="array"/>
</php>
```

Usando SQLite en memoria los tests son mucho más rápidos porque no se escribe nada en disco.

## Tu primer Feature Test

```bash
php artisan make:test ProductoApiTest
```

Esto crea `tests/Feature/ProductoApiTest.php`:

```php
// tests/Feature/ProductoApiTest.php

namespace Tests\Feature;

use App\Models\Producto;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductoApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_puede_listar_productos(): void
    {
        // Crear 5 productos en la base de datos de tests
        Producto::factory()->count(5)->create();

        $respuesta = $this->getJson('/api/productos');

        $respuesta
            ->assertStatus(200)
            ->assertJsonCount(5, 'data');
    }

    public function test_puede_crear_un_producto(): void
    {
        $datos = [
            'nombre' => 'Teclado mecánico',
            'precio' => 89.99,
            'stock'  => 50,
        ];

        $respuesta = $this->postJson('/api/productos', $datos);

        $respuesta
            ->assertStatus(201)
            ->assertJsonFragment(['nombre' => 'Teclado mecánico']);

        $this->assertDatabaseHas('productos', ['nombre' => 'Teclado mecánico']);
    }

    public function test_no_puede_crear_producto_sin_nombre(): void
    {
        $respuesta = $this->postJson('/api/productos', [
            'precio' => 89.99,
        ]);

        $respuesta
            ->assertStatus(422)
            ->assertJsonValidationErrors(['nombre']);
    }

    public function test_puede_ver_un_producto(): void
    {
        $producto = Producto::factory()->create();

        $respuesta = $this->getJson("/api/productos/{$producto->id}");

        $respuesta
            ->assertStatus(200)
            ->assertJsonFragment(['id' => $producto->id]);
    }

    public function test_devuelve_404_si_producto_no_existe(): void
    {
        $respuesta = $this->getJson('/api/productos/9999');

        $respuesta->assertStatus(404);
    }

    public function test_puede_actualizar_un_producto(): void
    {
        $producto = Producto::factory()->create(['precio' => 100.00]);

        $respuesta = $this->putJson("/api/productos/{$producto->id}", [
            'precio' => 79.99,
        ]);

        $respuesta->assertStatus(200);
        $this->assertDatabaseHas('productos', ['id' => $producto->id, 'precio' => 79.99]);
    }

    public function test_puede_eliminar_un_producto(): void
    {
        $producto = Producto::factory()->create();

        $respuesta = $this->deleteJson("/api/productos/{$producto->id}");

        $respuesta->assertStatus(204);
        $this->assertDatabaseMissing('productos', ['id' => $producto->id]);
    }
}
```

## Factories — crear datos de prueba

Las factories permiten crear modelos con datos falsos de forma rápida. Laravel usa Faker para generar datos aleatorios:

```bash
php artisan make:factory ProductoFactory --model=Producto
```

```php
// database/factories/ProductoFactory.php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

class ProductoFactory extends Factory
{
    public function definition(): array
    {
        return [
            'nombre'      => fake()->words(3, true),
            'descripcion' => fake()->paragraph(),
            'precio'      => fake()->randomFloat(2, 5, 500),
            'stock'       => fake()->numberBetween(0, 200),
        ];
    }

    // Estado: producto sin stock
    public function agotado(): static
    {
        return $this->state(['stock' => 0]);
    }

    // Estado: producto caro
    public function premium(): static
    {
        return $this->state(['precio' => fake()->randomFloat(2, 500, 5000)]);
    }
}
```

Usar estados en los tests:

```php
// Crear un producto sin stock
$productoAgotado = Producto::factory()->agotado()->create();

// Crear 3 productos premium
$productos = Producto::factory()->premium()->count(3)->create();
```

## Tests con autenticación

Si tus endpoints requieren autenticación, usa `actingAs()`:

```php
public function test_usuario_autenticado_puede_crear_producto(): void
{
    $usuario = User::factory()->create();

    $respuesta = $this->actingAs($usuario, 'sanctum')
        ->postJson('/api/productos', [
            'nombre' => 'Monitor 4K',
            'precio' => 299.99,
            'stock'  => 10,
        ]);

    $respuesta->assertStatus(201);
}

public function test_usuario_no_autenticado_no_puede_crear(): void
{
    $respuesta = $this->postJson('/api/productos', [
        'nombre' => 'Monitor 4K',
        'precio' => 299.99,
        'stock'  => 10,
    ]);

    $respuesta->assertStatus(401);
}
```

## Unit Tests

Los tests unitarios prueban clases de forma aislada:

```bash
php artisan make:test CalculadoraPrecioTest --unit
```

```php
// tests/Unit/CalculadoraPrecioTest.php

namespace Tests\Unit;

use App\Services\CalculadoraPrecio;
use PHPUnit\Framework\TestCase;

class CalculadoraPrecioTest extends TestCase
{
    public function test_aplica_descuento_correctamente(): void
    {
        $calculadora = new CalculadoraPrecio();
        $precioFinal = $calculadora->aplicarDescuento(100.00, 20);

        $this->assertEquals(80.00, $precioFinal);
    }

    public function test_descuento_no_puede_ser_negativo(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $calculadora = new CalculadoraPrecio();
        $calculadora->aplicarDescuento(100.00, -10);
    }
}
```

## Mocking — simular dependencias

El mocking permite reemplazar dependencias reales por versiones simuladas en los tests:

```php
use Illuminate\Support\Facades\Mail;
use App\Mail\BienvenidaMail;

public function test_envía_email_al_registrarse(): void
{
    Mail::fake(); // Interceptar todos los emails sin enviarlos

    $respuesta = $this->postJson('/api/registro', [
        'nombre'   => 'Juan',
        'email'    => 'juan@ejemplo.com',
        'password' => 'secreto123',
    ]);

    $respuesta->assertStatus(201);

    // Verificar que el email fue "enviado"
    Mail::assertSent(BienvenidaMail::class, function ($mail) {
        return $mail->hasTo('juan@ejemplo.com');
    });
}
```

Facades que soportan fake: `Mail::fake()`, `Queue::fake()`, `Event::fake()`, `Storage::fake()`, `Notification::fake()`.

## Ejecutar los tests

```bash
# Ejecutar todos los tests
php artisan test

# Ejecutar con más detalle
php artisan test --verbose

# Ejecutar solo un archivo de test
php artisan test tests/Feature/ProductoApiTest.php

# Ejecutar un método específico
php artisan test --filter test_puede_crear_un_producto

# Ejecutar en paralelo (más rápido)
php artisan test --parallel
```

Empezar a escribir tests puede parecer un esfuerzo adicional, pero con el tiempo se convierte en un hábito que hace tu desarrollo más sólido y te da la confianza para mejorar tu código sin miedo a romper nada.
