---
title: 'Class not found en Laravel — Cómo solucionarlo'
description: 'Error Class not found en Laravel: causas más frecuentes y cómo solucionarlo con composer dump-autoload, namespaces y estructura de directorios correcta.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'autoload', 'composer']
---

# Class not found en Laravel — Cómo solucionarlo

El error "Class not found" (o su variante "Class X does not exist") es uno de los errores más frecuentes cuando empiezas a trabajar con Laravel. La buena noticia es que, aunque el mensaje puede parecer críptico al principio, las causas son siempre las mismas y las soluciones son bastante simples una vez que entiendes cómo funciona el sistema de autoloading de PHP.

En esta guía vamos a ver por qué ocurre este error, cuáles son las causas más comunes y cómo solucionarlo en cada caso.

## ¿Por qué ocurre "Class not found"?

PHP no carga las clases automáticamente por sí solo. Necesita saber dónde encontrar cada clase cuando la utilizas. Esto se hace a través del **autoloading**: un mecanismo que, dado el nombre de una clase, sabe en qué archivo buscarla.

Laravel usa el estándar **PSR-4** para el autoloading, que establece una correspondencia directa entre el namespace de una clase y la ruta del archivo en el sistema de ficheros.

La regla es simple: el namespace de una clase debe coincidir exactamente con la ruta del archivo, partiendo desde la carpeta base configurada en `composer.json`.

Por defecto en Laravel:

```php
// En composer.json
"autoload": {
    "psr-4": {
        "App\\": "app/"
    }
}
```

Esto significa que cualquier clase con el namespace `App\` se buscará en la carpeta `app/`. Por ejemplo:

- `App\Models\User` → `app/Models/User.php`
- `App\Http\Controllers\ProductoController` → `app/Http/Controllers/ProductoController.php`
- `App\Services\PagoService` → `app/Services/PagoService.php`

El error "Class not found" ocurre cuando esta correspondencia falla por algún motivo.

## Causa 1: Namespace incorrecto en el archivo de la clase

Este es el error más común. El archivo existe en la ruta correcta, pero el namespace declarado dentro del archivo no coincide con esa ruta.

Ejemplo de error:

```php
// Archivo en: app/Services/PagoService.php
// Pero el namespace es incorrecto:

<?php

namespace App\Servicios; // ERROR: debería ser App\Services

class PagoService
{
    // ...
}
```

Cuando intentas usar esta clase:

```php
use App\Services\PagoService; // Laravel busca app/Services/PagoService.php
// El archivo existe pero el namespace no coincide → Class not found
```

**Solución**: corrige el namespace para que coincida exactamente con la ruta del archivo:

```php
<?php

namespace App\Services; // Correcto: coincide con app/Services/

class PagoService
{
    public function procesarPago(float $cantidad): bool
    {
        // implementación
        return true;
    }
}
```

## Causa 2: El nombre del archivo no coincide con el nombre de la clase

PHP en sistemas de archivos case-sensitive (Linux) distingue entre mayúsculas y minúsculas. En Windows, el sistema de archivos suele ser case-insensitive, por lo que el error puede no aparecer en desarrollo pero sí en producción (Linux).

```php
// Archivo: app/Models/producto.php  (p minúscula)

<?php

namespace App\Models;

class Producto // P mayúscula
{
    // ...
}
```

En Windows funciona porque el filesystem no distingue entre `producto.php` y `Producto.php`. En Linux (producción), falla porque busca exactamente `Producto.php`.

**Solución**: el nombre del archivo siempre debe coincidir exactamente con el nombre de la clase, con la misma capitalización:

```php
// Archivo: app/Models/Producto.php  (P mayúscula = correcto)
```

## Causa 3: El autoloader de Composer no está actualizado

Cuando creas un nuevo archivo de clase manualmente (en lugar de usar `php artisan make:`), Composer no lo conoce automáticamente. Necesitas actualizar el mapa de autoloading:

```php
composer dump-autoload
```

Este comando regenera los archivos de autoloading en `vendor/composer/`. Después de ejecutarlo, PHP podrá encontrar las nuevas clases.

Algunos desarrolladores también usan:

```php
composer dump-autoload -o
// La opción -o optimiza el autoloader para producción (más rápido)
```

En desarrollo, sin `-o` es suficiente.

**Cuándo ejecutar `composer dump-autoload`**:

- Cuando creas clases manualmente sin usar `php artisan make:`
- Cuando mueves archivos de una carpeta a otra
- Cuando cambias el namespace de una clase
- Después de cambiar el `composer.json`

## Causa 4: Namespace en el controlador al usar rutas con string

Un caso especialmente común en Laravel al definir rutas:

```php
// En routes/web.php - forma antigua que puede causar confusión:
Route::get('/productos', 'ProductoController@index');

// Laravel busca: App\Http\Controllers\ProductoController
// Si el controlador está en otra ubicación o tiene otro namespace, fallará
```

La forma moderna y recomendada desde Laravel 8+ es usar la sintaxis con `::class`:

```php
// Forma correcta y explícita:
use App\Http\Controllers\ProductoController;

Route::get('/productos', [ProductoController::class, 'index']);
```

Con esta sintaxis, tu IDE puede autocompletar y verificar que la clase existe, y cualquier error de namespace se detecta en tiempo de escritura, no en tiempo de ejecución.

## Causa 5: La clase está fuera del directorio de autoloading

Si creas una clase en un directorio que no está configurado en el autoloading de Composer, nunca será encontrada:

```php
// Archivo en: mi-carpeta-custom/MiClase.php
// Este directorio no está en el autoloading de composer.json
```

**Solución**: mueve la clase a `app/` o agrega el nuevo directorio a `composer.json`:

```php
// composer.json
"autoload": {
    "psr-4": {
        "App\\": "app/",
        "MiNamespace\\": "mi-carpeta-custom/"
    }
}
```

Luego ejecuta:

```php
composer dump-autoload
```

## Diagnóstico paso a paso

Cuando te encuentras con "Class X not found", sigue estos pasos:

### Paso 1: Identifica exactamente qué clase no se encuentra

Lee el error con cuidado:

```
Class "App\Services\PagoService" not found
```

Esto te dice el namespace completo de la clase que Laravel intenta cargar.

### Paso 2: Verifica que el archivo existe en la ruta correcta

El namespace `App\Services\PagoService` debería corresponder al archivo `app/Services/PagoService.php`:

```php
// Verifica desde la terminal:
ls -la app/Services/PagoService.php
```

Si el archivo no existe, créalo (o revisa si está en otra ubicación).

### Paso 3: Verifica el namespace dentro del archivo

Abre el archivo y verifica que el namespace declarado coincide con la ruta:

```php
<?php

namespace App\Services; // ¿Coincide con app/Services/?

class PagoService // ¿Coincide con el nombre del archivo PagoService.php?
{
```

### Paso 4: Regenera el autoloader

```php
composer dump-autoload
```

### Paso 5: Limpia la caché de Laravel

En algunos casos, la caché de configuración o rutas puede causar problemas:

```php
php artisan config:clear
php artisan route:clear
php artisan cache:clear
```

O todo de una vez:

```php
php artisan optimize:clear
```

## Ejemplo completo: crear un Service correctamente

Vamos a ver el proceso correcto desde cero para crear una clase Service:

```php
// Opción 1: crear el archivo manualmente

// Archivo: app/Services/EmailService.php
<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Mail;

class EmailService
{
    public function enviarBienvenida(User $usuario): void
    {
        Mail::to($usuario->email)->send(new \App\Mail\BienvenidaMail($usuario));
    }

    public function enviarNotificacion(User $usuario, string $mensaje): void
    {
        // implementación
    }
}
```

Luego ejecuta:

```php
composer dump-autoload
```

Y ya puedes usar la clase:

```php
// En un controlador:
use App\Services\EmailService;

class RegistroController extends Controller
{
    public function __construct(
        private EmailService $emailService
    ) {}

    public function store(Request $request): RedirectResponse
    {
        $usuario = User::create($request->validated());
        $this->emailService->enviarBienvenida($usuario);

        return redirect()->route('dashboard');
    }
}
```

## Convenciones de nomenclatura en Laravel

Para evitar estos errores en el futuro, sigue las convenciones de Laravel:

| Tipo de clase | Namespace | Carpeta | Ejemplo |
|---|---|---|---|
| Modelo | `App\Models` | `app/Models/` | `Producto.php` |
| Controlador | `App\Http\Controllers` | `app/Http/Controllers/` | `ProductoController.php` |
| Middleware | `App\Http\Middleware` | `app/Http/Middleware/` | `VerificarAdmin.php` |
| Job | `App\Jobs` | `app/Jobs/` | `EnviarEmail.php` |
| Event | `App\Events` | `app/Events/` | `PedidoCreado.php` |
| Listener | `App\Listeners` | `app/Listeners/` | `NotificarAdmin.php` |
| Service | `App\Services` | `app/Services/` | `PagoService.php` |
| Request | `App\Http\Requests` | `app/Http/Requests/` | `CrearProductoRequest.php` |

## Usa `php artisan make:` siempre que puedas

Los comandos `make:` de Artisan crean los archivos con el namespace correcto automáticamente y ejecutan el equivalente a `composer dump-autoload`:

```php
// Crear un controlador
php artisan make:controller ProductoController

// Crear un modelo con migración
php artisan make:model Producto -m

// Crear un Service (no existe make:service, pero puedes crear la carpeta y clase manualmente)
// O usar un paquete de terceros para esto

// Crear un Job
php artisan make:job EnviarEmail

// Crear un Request
php artisan make:request CrearProductoRequest
```

Con estos comandos, el namespace siempre será correcto y el autoloader estará actualizado.

## Conclusión

El error "Class not found" en Laravel siempre tiene la misma raíz: una desconexión entre el namespace declarado en el archivo de la clase y la ruta real del archivo en el sistema de ficheros. La solución casi siempre es: corregir el namespace, asegurarse de que el nombre del archivo coincide con el nombre de la clase, y ejecutar `composer dump-autoload`.

Si interiorizas la regla de PSR-4 (namespace = ruta del archivo) y usas los comandos `php artisan make:` siempre que puedas, este error prácticamente desaparecerá de tu vida.
