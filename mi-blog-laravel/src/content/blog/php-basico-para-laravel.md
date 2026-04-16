---
title: 'PHP básico para Laravel: lo que necesitas saber antes de empezar'
description: 'Aprende los fundamentos de PHP que necesitas dominar antes de aprender Laravel: variables, funciones, arrays, POO y namespaces explicados con ejemplos.'
pubDate: '2026-04-16'
tags: ['laravel', 'php', 'roadmap']
---

Laravel está escrito en PHP y lo usa en cada rincón del framework. Si llegas sin conocer el lenguaje, vas a encontrar código que no entiendes y eso te va a frenar. No necesitas ser un experto en PHP para empezar con Laravel, pero sí necesitas tener claras ciertas bases. Este artículo te las explica con ejemplos reales y directos al grano.

## Variables y tipos de datos

PHP es un lenguaje de tipado dinámico, lo que significa que no tienes que declarar el tipo de una variable al crearla. El intérprete lo infiere.

```php
<?php

$nombre = "Carlos";       // string
$edad = 28;               // integer
$precio = 19.99;          // float
$activo = true;           // boolean
$nada = null;             // null

// Verificar el tipo
var_dump($edad);          // int(28)
echo gettype($nombre);    // string
```

En versiones modernas de PHP (8.0+) puedes usar **tipos de unión** y el tipo `mixed`:

```php
<?php

function procesar(int|string $valor): void {
    echo $valor;
}
```

Laravel usa PHP 8.1+ y aprovecha todas estas características. Cuanto más cómodo te sientas con los tipos, más fácil te resultará leer el código del framework.

## Funciones

Las funciones encapsulan lógica reutilizable. En PHP se declaran con `function`:

```php
<?php

function saludar(string $nombre): string {
    return "Hola, $nombre";
}

echo saludar("Ana"); // Hola, Ana
```

PHP 7.4 introdujo las **arrow functions**, una sintaxis más compacta para funciones anónimas de una sola expresión:

```php
<?php

$multiplicar = fn($x, $y) => $x * $y;

echo $multiplicar(3, 4); // 12
```

Las arrow functions capturan automáticamente las variables del ámbito externo sin necesidad de `use`:

```php
<?php

$factor = 10;
$escalar = fn($n) => $n * $factor;

echo $escalar(5); // 50
```

En Laravel las verás constantemente en colecciones y callbacks.

## Arrays y funciones esenciales

Los arrays en PHP son estructuras muy versátiles. Pueden ser indexados numéricamente o asociativos (clave-valor):

```php
<?php

// Array indexado
$frutas = ['manzana', 'pera', 'uva'];

// Array asociativo
$usuario = [
    'nombre' => 'Luis',
    'email'  => 'luis@ejemplo.com',
    'edad'   => 32,
];

echo $usuario['nombre']; // Luis
echo $frutas[0];         // manzana
```

Las funciones más usadas que encontrarás en código Laravel son:

```php
<?php

$numeros = [1, 2, 3, 4, 5];

// array_map: transforma cada elemento
$dobles = array_map(fn($n) => $n * 2, $numeros);
// [2, 4, 6, 8, 10]

// array_filter: filtra elementos según condición
$pares = array_filter($numeros, fn($n) => $n % 2 === 0);
// [2, 4]

// array_keys: obtiene las claves
$datos = ['nombre' => 'Ana', 'rol' => 'admin'];
$claves = array_keys($datos);
// ['nombre', 'rol']

// array_values: reindexa tras un filter
$resultado = array_values($pares);
// [2, 4]

// in_array: comprueba si un valor existe
if (in_array(3, $numeros)) {
    echo "El 3 está en el array";
}
```

## Null coalescing y operadores modernos

El operador `??` es uno de los más útiles en PHP y lo verás por toda la base de código de Laravel:

```php
<?php

$config = ['timeout' => 30];

// Sin null coalescing
$limite = isset($config['limite']) ? $config['limite'] : 60;

// Con null coalescing
$limite = $config['limite'] ?? 60;

// Encadenado
$valor = $a ?? $b ?? $c ?? 'default';
```

El operador `??=` asigna solo si la variable es null:

```php
<?php

$nombre = null;
$nombre ??= 'Invitado';
echo $nombre; // Invitado
```

## Clases y Programación Orientada a Objetos

Laravel es un framework completamente orientado a objetos. Entender POO no es opcional.

### Clases y constructores

```php
<?php

class Producto {
    public string $nombre;
    protected float $precio;
    private int $stock;

    public function __construct(string $nombre, float $precio, int $stock) {
        $this->nombre = $nombre;
        $this->precio = $precio;
        $this->stock  = $stock;
    }

    public function getPrecio(): float {
        return $this->precio;
    }

    public function hayStock(): bool {
        return $this->stock > 0;
    }
}

$producto = new Producto('Teclado', 49.99, 10);
echo $producto->nombre;        // Teclado
echo $producto->getPrecio();   // 49.99
```

La visibilidad importa:
- `public`: accesible desde cualquier lugar.
- `protected`: accesible desde la clase y sus subclases.
- `private`: solo accesible dentro de la propia clase.

### Herencia

```php
<?php

class Animal {
    public function __construct(protected string $nombre) {}

    public function hablar(): string {
        return "...";
    }
}

class Perro extends Animal {
    public function hablar(): string {
        return "{$this->nombre} dice: ¡Guau!";
    }
}

$perro = new Perro('Rex');
echo $perro->hablar(); // Rex dice: ¡Guau!
```

En Laravel, tus controladores extienden `Controller`, tus modelos extienden `Model`. Heredar comportamiento del framework es la base de todo.

### Interfaces

Una interfaz define un contrato: qué métodos debe implementar una clase, sin decir cómo.

```php
<?php

interface Notificable {
    public function enviarNotificacion(string $mensaje): bool;
}

class UsuarioEmail implements Notificable {
    public function enviarNotificacion(string $mensaje): bool {
        // lógica de envío por email
        return true;
    }
}

class UsuarioSMS implements Notificable {
    public function enviarNotificacion(string $mensaje): bool {
        // lógica de envío por SMS
        return true;
    }
}
```

Laravel usa interfaces en todo su sistema de contratos (`Illuminate\Contracts`). Cuando inyectas una interfaz en un constructor, el contenedor de servicios resuelve qué implementación usar.

### Clases abstractas

Son como las interfaces pero pueden tener implementación parcial:

```php
<?php

abstract class Pago {
    abstract public function procesar(float $monto): bool;

    public function registrar(float $monto): void {
        echo "Registrando pago de $monto euros";
    }
}

class PagoTarjeta extends Pago {
    public function procesar(float $monto): bool {
        // lógica específica de tarjeta
        return true;
    }
}
```

## Namespaces y use

Los namespaces organizan el código evitando colisiones de nombres. En Laravel cada clase tiene su namespace:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class UsuarioController extends Controller {
    public function show(int $id): Response {
        $usuario = Usuario::find($id);
        return response()->json($usuario);
    }
}
```

La declaración `namespace` va al principio del archivo. Los `use` importan clases de otros namespaces para usarlas con su nombre corto. Sin esto tendrías que escribir la ruta completa cada vez: `new \App\Models\Usuario()`.

## Type hints y return types

PHP moderno tiene un sistema de tipos robusto. Laravel lo usa intensamente:

```php
<?php

function dividir(int $a, int $b): float {
    return $a / $b;
}

// Tipos nullables
function buscarUsuario(int $id): ?Usuario {
    return Usuario::find($id); // puede retornar null
}

// Union types (PHP 8.0+)
function formatear(int|float $numero): string {
    return number_format($numero, 2);
}

// Tipo de retorno void
function limpiarCache(): void {
    cache()->flush();
}
```

## Conclusión

Con estos fundamentos puedes empezar a leer y escribir código Laravel con confianza. No hace falta memorizar todo de golpe: practica con pequeños scripts, comprueba que entiendes cómo funcionan las clases y los namespaces, y cuando abras un controlador de Laravel por primera vez, el código te resultará familiar.

El siguiente paso natural es instalar Composer, el gestor de paquetes que hace posible instalar Laravel con un solo comando.
