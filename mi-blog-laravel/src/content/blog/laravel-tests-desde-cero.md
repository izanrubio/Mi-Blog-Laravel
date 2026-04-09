---
title: 'Cómo escribir tests en Laravel desde cero con PHPUnit'
description: 'Empieza a escribir tests en Laravel: tests de feature, unitarios, database testing con RefreshDatabase, factories y cómo testear APIs REST correctamente.'
pubDate: '2024-04-18'
tags: ['laravel', 'testing', 'phpunit', 'tdd', 'calidad']
---

Los tests son una de esas cosas que todos los desarrolladores saben que deberían hacer pero que muchos evitan porque "lleva demasiado tiempo" o "no sé por dónde empezar". La realidad es la opuesta: los tests te ahorran tiempo a largo plazo y hacen que refactorizar código sea mucho menos aterrador. En este artículo vamos a ver cómo escribir tests en Laravel desde cero, con ejemplos prácticos y reales.

## Por qué escribir tests

Antes de ver el código, entendamos el beneficio real de los tests:

**Confianza al hacer cambios**: con una buena suite de tests, puedes modificar o refactorizar código con la certeza de que si algo se rompe, los tests te lo van a decir inmediatamente. Sin tests, cada cambio es una apuesta.

**Documentación viva**: un test bien escrito documenta cómo debería funcionar el código. Si alguien lee tu test, entiende exactamente qué hace esa funcionalidad.

**Detección temprana de bugs**: es mucho más barato detectar un bug durante el desarrollo que en producción cuando los usuarios ya están afectados.

**Diseño mejor**: escribir tests te obliga a pensar en la interfaz de tu código antes de implementarla, lo que generalmente lleva a diseños más limpios y modulares.

## PHPUnit ya está incluido en Laravel

No necesitas instalar nada. Laravel viene con PHPUnit preconfigurado y con una capa encima que hace los tests mucho más cómodos de escribir. Para ejecutar los tests:

```php
php artisan test
```

O directamente con PHPUnit:

```php
./vendor/bin/phpunit
```

El comando `php artisan test` tiene output más bonito y algunas características adicionales como `--parallel` para ejecutar tests en paralelo.

## Feature Tests vs Unit Tests

Laravel tiene dos tipos principales de tests y es importante entender cuándo usar cada uno.

### Unit Tests

Los Unit Tests prueban una clase o función de forma aislada, sin conectarse a la base de datos ni a servicios externos. Son rápidos y precisos, pero solo sirven para probar lógica pura.

```php
// tests/Unit/PostTest.php
class PostTest extends TestCase
{
    public function test_can_calculate_reading_time(): void
    {
        $post = new Post(['content' => str_repeat('word ', 500)]);

        $this->assertEquals(2, $post->readingTimeInMinutes());
    }
}
```

### Feature Tests

Los Feature Tests prueban funcionalidades completas: hacen requests HTTP, interactúan con la base de datos, verifican la respuesta. Son más lentos que los Unit Tests pero mucho más realistas y valiosos.

```php
// tests/Feature/PostTest.php
class PostTest extends TestCase
{
    public function test_user_can_create_a_post(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/posts', [
            'title' => 'Mi primer post',
            'content' => 'Contenido del post',
        ]);

        $response->assertRedirect('/posts');
        $this->assertDatabaseHas('posts', ['title' => 'Mi primer post']);
    }
}
```

**La regla general**: usa Feature Tests para la mayoría de las cosas. Son los que realmente te dan confianza de que tu aplicación funciona. Usa Unit Tests para lógica de negocio compleja que vale la pena probar de forma aislada.

## Crear tu primer test

```php
php artisan make:test PostTest
// Crea: tests/Feature/PostTest.php

php artisan make:test PostUnitTest --unit
// Crea: tests/Unit/PostUnitTest.php
```

```php
// tests/Feature/PostTest.php
namespace Tests\Feature;

use Tests\TestCase;

class PostTest extends TestCase
{
    public function test_homepage_loads_successfully(): void
    {
        $response = $this->get('/');
        $response->assertStatus(200);
    }
}
```

Ejecuta este test:

```php
php artisan test --filter PostTest
```

## El trait RefreshDatabase

Cuando tus tests interactúan con la base de datos, necesitas que cada test comience con una base de datos limpia. El trait `RefreshDatabase` hace exactamente eso: antes de cada test, ejecuta las migraciones (o las revierte y vuelve a ejecutar) para dejarte la base de datos en estado limpio.

```php
namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostTest extends TestCase
{
    use RefreshDatabase; // cada test comienza con la BD limpia

    public function test_can_list_posts(): void
    {
        Post::factory()->count(5)->create();

        $response = $this->get('/posts');

        $response->assertStatus(200);
        $response->assertViewHas('posts');
    }
}
```

Para tests de API que no usen sqlite en memoria, puede ser más rápido usar `RefreshDatabase` con transacciones:

```php
use Illuminate\Foundation\Testing\DatabaseTransactions;
// cada test se envuelve en una transacción que se revierte al final
// más rápido que RefreshDatabase pero no funciona con todos los escenarios
```

## Métodos HTTP para Feature Tests

Laravel proporciona métodos convenientes para hacer requests HTTP en los tests:

```php
$response = $this->get('/posts');
$response = $this->post('/posts', $data);
$response = $this->put('/posts/1', $data);
$response = $this->patch('/posts/1', $data);
$response = $this->delete('/posts/1');

// Con headers personalizados
$response = $this->withHeaders(['Accept' => 'application/json'])->get('/api/posts');

// Con JSON
$response = $this->postJson('/api/posts', $data);
$response = $this->getJson('/api/posts');
```

## Assertions más usados

```php
// Status codes
$response->assertStatus(200);
$response->assertOk(); // 200
$response->assertCreated(); // 201
$response->assertNotFound(); // 404
$response->assertUnauthorized(); // 401
$response->assertForbidden(); // 403

// Redirecciones
$response->assertRedirect('/posts');
$response->assertRedirectToRoute('posts.index');

// Contenido de la vista
$response->assertSee('Mi post'); // verifica texto en el HTML
$response->assertDontSee('Error'); // verifica que NO está en el HTML
$response->assertViewIs('posts.index'); // verifica el nombre de la vista
$response->assertViewHas('posts'); // verifica que la vista tiene la variable

// JSON (para APIs)
$response->assertJson(['status' => 'success']);
$response->assertJsonStructure([
    'data' => ['id', 'title', 'content'],
    'meta' => ['total', 'per_page'],
]);
$response->assertJsonCount(5, 'data');

// Base de datos
$this->assertDatabaseHas('posts', ['title' => 'Mi post']);
$this->assertDatabaseMissing('posts', ['title' => 'Post eliminado']);
$this->assertDatabaseCount('posts', 5);
```

## Factories — Crear datos de prueba

Las factories son clases que saben cómo crear instancias de modelos con datos de prueba. Laravel incluye una factory para el modelo `User` y puedes crear las tuyas:

```php
php artisan make:factory PostFactory --model=Post
```

```php
// database/factories/PostFactory.php
class PostFactory extends Factory
{
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(),
            'content' => fake()->paragraphs(5, true),
            'slug' => fake()->unique()->slug(),
            'published' => fake()->boolean(),
            'user_id' => User::factory(), // crea un usuario automáticamente
            'created_at' => fake()->dateTimeBetween('-1 year', 'now'),
        ];
    }

    // Estado personalizado: post siempre publicado
    public function published(): static
    {
        return $this->state(['published' => true]);
    }

    // Estado personalizado: post no publicado
    public function draft(): static
    {
        return $this->state(['published' => false]);
    }
}
```

```php
// Uso en los tests
User::factory()->create(); // crea 1 usuario
User::factory()->count(10)->create(); // crea 10 usuarios
Post::factory()->published()->create(); // usa el estado 'published'
Post::factory()->count(5)->for($user)->create(); // 5 posts del mismo usuario

// Puedes sobreescribir atributos
Post::factory()->create(['title' => 'Título específico', 'user_id' => $user->id]);
```

## Testing de autenticación con `actingAs()`

La mayoría de las rutas de tu aplicación requieren autenticación. El método `actingAs()` te permite simular un usuario autenticado:

```php
public function test_authenticated_user_can_create_post(): void
{
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/posts', [
        'title' => 'Mi post',
        'content' => 'Contenido del post',
    ]);

    $response->assertRedirect('/posts');
    $this->assertDatabaseHas('posts', [
        'title' => 'Mi post',
        'user_id' => $user->id,
    ]);
}

public function test_guest_cannot_create_post(): void
{
    $response = $this->post('/posts', [
        'title' => 'Mi post',
        'content' => 'Contenido del post',
    ]);

    $response->assertRedirect('/login'); // redirige al login si no está autenticado
    $this->assertDatabaseCount('posts', 0); // no se creó ningún post
}
```

Para APIs con tokens (Sanctum o Passport):

```php
public function test_api_requires_authentication(): void
{
    $response = $this->getJson('/api/posts');
    $response->assertUnauthorized();
}

public function test_authenticated_api_returns_posts(): void
{
    $user = User::factory()->create();

    $response = $this->actingAs($user, 'sanctum')->getJson('/api/posts');
    $response->assertOk();
}
```

## Ejemplo completo: testear un CRUD de posts

Vamos a escribir una suite completa de tests para un CRUD de posts:

```php
namespace Tests\Feature;

use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PostCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
    }

    public function test_can_list_published_posts(): void
    {
        Post::factory()->published()->count(3)->create();
        Post::factory()->draft()->count(2)->create();

        $response = $this->get('/posts');

        $response->assertOk();
        $response->assertViewHas('posts', fn($posts) => $posts->count() === 3);
    }

    public function test_can_view_a_single_post(): void
    {
        $post = Post::factory()->published()->create();

        $response = $this->get("/posts/{$post->slug}");

        $response->assertOk();
        $response->assertSee($post->title);
    }

    public function test_can_create_post(): void
    {
        $data = [
            'title' => 'Mi nuevo post',
            'content' => 'Contenido del post con suficiente texto para ser válido.',
            'published' => true,
        ];

        $response = $this->actingAs($this->user)->post('/posts', $data);

        $response->assertRedirect();
        $this->assertDatabaseHas('posts', [
            'title' => 'Mi nuevo post',
            'user_id' => $this->user->id,
        ]);
    }

    public function test_create_post_requires_title(): void
    {
        $response = $this->actingAs($this->user)->post('/posts', [
            'content' => 'Contenido sin título',
        ]);

        $response->assertSessionHasErrors('title');
        $this->assertDatabaseCount('posts', 0);
    }

    public function test_can_update_own_post(): void
    {
        $post = Post::factory()->create(['user_id' => $this->user->id]);

        $response = $this->actingAs($this->user)->put("/posts/{$post->id}", [
            'title' => 'Título actualizado',
            'content' => $post->content,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('posts', ['title' => 'Título actualizado']);
    }

    public function test_cannot_update_other_users_post(): void
    {
        $otherUser = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $otherUser->id]);

        $response = $this->actingAs($this->user)->put("/posts/{$post->id}", [
            'title' => 'Intento de robo',
            'content' => $post->content,
        ]);

        $response->assertForbidden();
        $this->assertDatabaseMissing('posts', ['title' => 'Intento de robo']);
    }

    public function test_can_delete_own_post(): void
    {
        $post = Post::factory()->create(['user_id' => $this->user->id]);

        $response = $this->actingAs($this->user)->delete("/posts/{$post->id}");

        $response->assertRedirect('/posts');
        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }
}
```

## Ejecutar tests específicos y ver cobertura

```php
# Ejecutar todos los tests
php artisan test

# Ejecutar solo un archivo de tests
php artisan test tests/Feature/PostCrudTest.php

# Ejecutar tests que coincidan con un nombre
php artisan test --filter test_can_create_post

# Ejecutar tests en paralelo (más rápido)
php artisan test --parallel

# Ver cobertura de código (requiere Xdebug o PCOV)
php artisan test --coverage

# Cobertura con mínimo requerido (falla si es menor al 80%)
php artisan test --coverage --min=80
```

## Buenas prácticas al escribir tests

**Nombra los tests como frases que describen el comportamiento**:

```php
// MAL
public function testPost(): void {}

// BIEN
public function test_authenticated_user_can_create_published_post(): void {}
```

**Un test, un concepto**. No mezcles múltiples comportamientos en un test. Si el test falla, quieres saber exactamente qué se rompió.

**Usa `setUp()` para código repetido**. Si varios tests necesitan el mismo usuario o los mismos datos, crea el recurso en `setUp()`.

**Testea los casos negativos**. No solo testees que las cosas funcionan correctamente: testea también qué pasa cuando el usuario no tiene permisos, cuando los datos son inválidos, cuando el recurso no existe.

## Conclusión

Empezar a escribir tests en Laravel es más fácil de lo que parece. Las herramientas ya están incluidas, la API es muy cómoda y el beneficio es enorme a medida que el proyecto crece.

Empieza con Feature Tests para las rutas más importantes de tu aplicación, usa Factories para crear datos de prueba realistas y usa `actingAs()` para probar rutas autenticadas. Con eso ya tienes una base sólida.

La clave es empezar aunque los tests no sean perfectos. Un test imperfecto siempre es mejor que ningún test. Con el tiempo, escribir tests se vuelve natural y forma parte del flujo normal de desarrollo.
