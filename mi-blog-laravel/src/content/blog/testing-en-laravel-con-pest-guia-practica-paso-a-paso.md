---
title: 'Testing en Laravel con Pest: Guía práctica paso a paso'
description: 'Aprende a escribir tests en Laravel con Pest, la alternativa moderna a PHPUnit con sintaxis intuitiva y poderosa.'
pubDate: '2025-04-13'
tags: ['laravel', 'testing', 'pest', 'php']
---

# Testing en Laravel con Pest: Guía práctica paso a paso

Si has estado escribiendo tests en Laravel, probablemente conoces PHPUnit. Es potente, pero su sintaxis puede ser verbosa y poco intuitiva para nuevos desarrolladores. **Pest PHP** es una alternativa moderna que simplifica enormemente el proceso de testing manteniendo toda la potencia subyacente.

En este artículo, exploraremos cómo instalar, configurar y escribir tests efectivos con Pest en Laravel, desde lo más básico hasta patrones avanzados.

## ¿Qué es Pest y por qué deberías usarlo?

Pest es un framework de testing para PHP que se construye sobre PHPUnit, pero con una sintaxis más limpia, intuitiva y similar a la de Jest (JavaScript). Aunque se menciona en la lista de artículos publicados la extensión de VS Code para Pest, nunca hemos cubierto un tutorial completo sobre cómo usarlo.

Las ventajas principales de Pest son:

- **Sintaxis más legible**: Las pruebas parecen casi historias en lugar de código técnico
- **Curva de aprendizaje menor**: Ideal para desarrolladores junior
- **Excelente integración con Laravel**: Diseñado específicamente teniendo en mente el ecosistema Laravel
- **Características poderosas**: Assertions fluidas, test coverage, fixtures y más
- **Mejor output en la terminal**: Los resultados de tests son más visuales y fáciles de entender

## Instalación de Pest en Laravel

Instalar Pest en un proyecto Laravel existente es muy simple. Solo necesitas ejecutar un comando:

```bash
composer require pestphp/pest --dev
php artisan pest:install
```

El comando `pest:install` configura automáticamente la estructura de directorios y crea los archivos necesarios. Una vez instalado, tu estructura de directorios incluirá dos carpetas principales en `tests/`:

```
tests/
├── Feature/
├── Unit/
└── Pest.php
```

- **Feature**: Para tests que prueban características completas (controllers, rutas, middlewares)
- **Unit**: Para tests de componentes individuales (modelos, métodos específicos)

## Configuración básica

El archivo `tests/Pest.php` es donde ocurre la magia. Aquí defines helpers globales y configuraciones compartidas:

```php
<?php

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(TestCase::class, RefreshDatabase::class)
    ->in('Feature');

uses(TestCase::class)
    ->in('Unit');
```

Esta configuración aplica automáticamente traits a todos los tests en cada directorio. `RefreshDatabase` resetea la base de datos entre tests, esencial para tests de integración.

## Tu primer test con Pest

Veamos un ejemplo simple. Crearemos un test para una ruta que devuelve un listado de usuarios.

Primero, crea un test en `tests/Feature/UsersTest.php`:

```php
<?php

test('usuarios pueden listar todos los usuarios', function () {
    // Arrange
    User::factory()->count(3)->create();

    // Act
    $response = $this->get('/api/users');

    // Assert
    $response->assertStatus(200)
        ->assertJsonCount(3);
});
```

¿Ves la diferencia? No hay clases ni métodos complicados. Solo `test()`, una descripción, y tu lógica. Es Python-like, es hermoso.

## Tests unitarios con Pest

Los tests unitarios son más simples. Por ejemplo, probar un método de un modelo:

```php
<?php

test('usuario puede obtener nombre completo', function () {
    $user = User::factory()->create([
        'first_name' => 'Juan',
        'last_name' => 'Pérez'
    ]);

    expect($user->fullName())->toBe('Juan Pérez');
});
```

Aquí usamos `expect()` en lugar de assertions tradicionales. Es más fluida y fácil de leer.

## Organizando tests con describe y describe groups

Cuando tus tests crecen, es útil organizarlos. Pest ofrece `describe()` para agrupar tests relacionados:

```php
<?php

describe('UserController', function () {
    describe('index', function () {
        test('retorna todos los usuarios', function () {
            $response = $this->get('/users');
            $response->assertStatus(200);
        });

        test('puede filtrar por rol', function () {
            User::factory()->create(['role' => 'admin']);
            User::factory()->create(['role' => 'user']);

            $response = $this->get('/users?role=admin');
            $response->assertJsonCount(1);
        });
    });

    describe('store', function () {
        test('crea un nuevo usuario', function () {
            $response = $this->post('/users', [
                'name' => 'Carlos',
                'email' => 'carlos@example.com',
                'password' => 'password123'
            ]);

            $response->assertStatus(201);
            expect(User::where('email', 'carlos@example.com')->exists())->toBeTrue();
        });

        test('valida email duplicado', function () {
            User::factory()->create(['email' => 'test@example.com']);

            $response = $this->post('/users', [
                'name' => 'Test',
                'email' => 'test@example.com',
                'password' => 'password123'
            ]);

            $response->assertStatus(422);
        });
    });
});
```

Esta estructura es mucho más legible y mantenible.

## Usando fixtures y datasets

Pest permite reutilizar datos con fixtures:

```php
<?php

test('usuario puede actualizar su perfil', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->put("/users/{$user->id}", [
        'name' => 'Nuevo Nombre',
        'email' => 'nuevo@example.com'
    ]);

    $response->assertStatus(200);
    expect($user->fresh()->name)->toBe('Nuevo Nombre');
});
```

Para múltiples casos con datos diferentes, usa datasets:

```php
<?php

test('validación de email', function ($email, $valido) {
    $response = $this->post('/register', [
        'email' => $email,
        'password' => 'password123'
    ]);

    $valido 
        ? $response->assertStatus(201)
        : $response->assertStatus(422);
})->with([
    ['test@example.com', true],
    ['invalid-email', false],
    ['', false],
    ['test@test.com', true],
]);
```

## Assertions más comunes en Pest

Pest proporciona una gran variedad de assertions optimizadas:

```php
<?php

// Assertions JSON
$response->assertJson(['status' => 'success']);
$response->assertJsonPath('user.name', 'Juan');
$response->assertJsonCount(5, 'data');

// Assertions de base de datos
$this->assertDatabaseHas('users', ['email' => 'test@example.com']);
$this->assertDatabaseMissing('users', ['email' => 'deleted@example.com']);

// Assertions de modelos
$user = User::factory()->create();
expect($user->is_active)->toBeTrue();
expect($user->email)->toContain('@');

// Assertions de excepciones
$this->expectException(ModelNotFoundException::class);
User::findOrFail(99999);
```

## Testing de APIs con Pest

Para APIs, Pest proporciona helpers específicos:

```php
<?php

test('obtener usuario retorna datos correctos', function () {
    $user = User::factory()->create();

    $this->getJson("/api/users/{$user->id}")
        ->assertStatus(200)
        ->assertJson([
            'data' => [
                'id' => $user->id,
                'email' => $user->email,
            ]
        ]);
});

test('crear usuario requiere autenticación', function () {
    $this->postJson('/api/users', [
        'name' => 'Test',
        'email' => 'test@example.com'
    ])->assertStatus(401);
});

test('usuario autenticado puede crear recursos', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->postJson('/api/posts', [
            'title' => 'Mi primer post',
            'content' => 'Contenido interesante'
        ])
        ->assertStatus(201)
        ->assertJsonPath('data.title', 'Mi primer post');
});
```

## Ejecutando tests con Pest

Ejecutar tests es simple:

```bash
# Ejecutar todos los tests
php artisan pest

# Ejecutar un archivo específico
php artisan pest tests/Feature/UsersTest.php

# Ejecutar un test específico
php artisan pest --filter="usuarios pueden listar"

# Con coverage
php artisan pest --coverage

# Watch mode (rerun tests al cambiar archivos)
php artisan pest --watch
```

El output es limpio y visual, mostrando exactamente qué pasó:

```
   PASS  tests/Feature/UsersTest.php
  ✓ usuarios pueden listar todos los usuarios
  ✓ usuario puede obtener nombre completo
  ✓ validación de email
  
Tests:  3 passed (45 assertions)
```

## Mejores prácticas con Pest

### 1. Usa nombres descriptivos

```php
// ✅ Bueno
test('usuario no autenticado no puede acceder a dashboard', function () {
    $this->get('/dashboard')->assertRedirect('/login');
});

// ❌ Malo
test('test', function () {
    // ...
});
```

### 2. Sigue el patrón AAA (Arrange, Act, Assert)

```php
// ✅ Bueno: Claramente separado
test('crear producto valida nombre requerido', function () {
    // Arrange
    $datos = ['price' => 99.99]; // nombre falta
    
    // Act
    $response = $this->post('/products', $datos);
    
    // Assert
    $response->assertStatus(422);
});

// ❌ Malo: Todo mezclado
test('crear producto', function () {
    $producto = new Product();
    $producto->price = 99.99;
    $this->post('/products', $producto->toArray());
    // ¿qué se está testeando?
});
```

### 3. Un concepto por test

```php
// ✅ Bueno: Cada test verifica una cosa
test('usuario requiere email único', function () {
    User::factory()->create(['email' => 'test@example.com']);
    
    $response = $this->post('/register', [
        'name' => 'Test',
        'email' => 'test@example.com'
    ]);
    
    $response->assertStatus(422);
});

test('usuario requiere contraseña mínimo 8 caracteres', function () {
    $response = $this->post('/register', [
        'name' => 'Test',
        'email' => 'unique@example.com',
        'password' => 'short'
    ]);
    
    $response->assertStatus(422);
});
```

## Integración con CI/CD

Pest se integra perfectamente con pipelines de CI/CD. Aquí un ejemplo con GitHub Actions:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      
      - name: Install dependencies
        run: composer install
      
      - name: Run tests
        run: php artisan pest --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Puntos clave

- **Pest simplifica el testing**: Sintaxis más legible que PHPUnit, perfecta para nuevos desarrolladores
- **Describe y describe groups**: Organiza tus tests en grupos coherentes para mejor mantenibilidad
- **Usa datasets para casos múltiples**: Evita repetir lógica cuando necesitas probar múltiples escenarios
- **AAA pattern**: Mantén tus tests claros separando Arrange, Act y Assert
- **Un concepto por test**: Cada test debe verificar una cosa específica, facilita el debugging
- **Assertions fluidas**: Pest proporciona assertions intuitivas para JSON, base de datos, modelos y excepciones
- **Testing de APIs**: Especializado con helpers como `actingAs()`, `getJson()` y `postJson()`
- **Watch mode**: Usa `--watch` durante desarrollo para rerun tests automáticamente
- **Coverage reports**: `--coverage` te muestra qué código está testeado y qué no
- **CI/CD integration**: Se integra perfectamente con GitHub Actions y otros servicios