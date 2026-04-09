---
title: 'Route not found / 404 en rutas de Laravel — Cómo diagnosticar'
description: 'Soluciona el 404 y RouteNotFoundException en Laravel: ruta mal definida, caché de rutas, métodos HTTP incorrectos y problemas de configuración del servidor.'
pubDate: '2024-02-13'
tags: ['laravel', 'errores', 'rutas', '404']
---

# Route not found / 404 en rutas de Laravel — Cómo diagnosticar

Cuando ves un error 404 en Laravel, puede significar varias cosas muy diferentes: la ruta no existe, existe pero el método HTTP es incorrecto, la caché de rutas tiene datos obsoletos, o el servidor web no está configurado para pasar todas las peticiones a Laravel. Vamos a diagnosticar y solucionar cada caso.

## Tipos de error 404 en Laravel

Primero, diferencia qué tipo de 404 estás viendo:

1. **404 de Laravel con la página de error de Whoops** (en desarrollo): Laravel sí recibe la petición pero no encuentra la ruta. El problema está en la definición de rutas.
2. **404 del servidor web** (Nginx/Apache, página diferente): el servidor web no está pasando la petición a Laravel. Problema de configuración del servidor.
3. **RouteNotFoundException** en el código: estás usando `route('nombre-ruta')` pero la ruta no existe.

## Herramienta de diagnóstico: php artisan route:list

Antes de cambiar nada, ejecuta:

```php
php artisan route:list
```

Esto muestra todas las rutas registradas en tu aplicación. Verifica:

- ¿Existe la ruta que buscas?
- ¿El método HTTP es correcto (GET, POST, PUT, etc.)?
- ¿El URI coincide exactamente con lo que estás accediendo?

Puedes filtrar por URI:

```php
php artisan route:list --path=productos
```

O por nombre:

```php
php artisan route:list --name=productos.
```

## Causa 1: La ruta simplemente no está definida

El caso más simple: la ruta no existe en `routes/web.php` o `routes/api.php`.

```php
// Verifica que tienes la ruta definida:
// routes/web.php

use App\Http\Controllers\ProductoController;

Route::get('/productos', [ProductoController::class, 'index'])->name('productos.index');
Route::post('/productos', [ProductoController::class, 'store'])->name('productos.store');
Route::get('/productos/{producto}', [ProductoController::class, 'show'])->name('productos.show');
Route::get('/productos/{producto}/editar', [ProductoController::class, 'edit'])->name('productos.edit');
Route::put('/productos/{producto}', [ProductoController::class, 'update'])->name('productos.update');
Route::delete('/productos/{producto}', [ProductoController::class, 'destroy'])->name('productos.destroy');
```

O usando el resource que genera todas estas rutas automáticamente:

```php
Route::resource('productos', ProductoController::class);
```

## Causa 2: El método HTTP es incorrecto

Una ruta definida como GET no responde a peticiones POST, y viceversa. Este es un error común al crear formularios:

```php
// En routes/web.php:
Route::post('/contacto', [ContactoController::class, 'enviar']);

// En el formulario HTML:
<form method="GET" action="/contacto">  <!-- ERROR: debería ser POST -->
```

O al hacer peticiones AJAX:

```php
// La ruta acepta PUT pero el fetch usa POST:
fetch('/productos/1', {
    method: 'POST',  // Error: debería ser PUT o usar _method
    // ...
});
```

Para formularios HTML que necesitan PUT, PATCH o DELETE, usa el campo `_method`:

```php
<form method="POST" action="/productos/{{ $producto->id }}">
    @csrf
    @method('PUT')  // Indica que realmente es una petición PUT
    <!-- campos del formulario -->
</form>
```

## Causa 3: La caché de rutas está desactualizada

Si ejecutaste `php artisan route:cache` y luego modificaste las rutas, la caché tiene las rutas antiguas. Laravel usará la caché en lugar de los archivos actuales:

```php
// Limpiar la caché de rutas:
php artisan route:clear

// Verificar que no hay caché activa:
ls bootstrap/cache/routes*.php  // Si existe este archivo, hay caché activa
```

En producción, cuando actualices las rutas siempre limpia y regenera la caché:

```php
php artisan route:clear
php artisan route:cache
```

En desarrollo, no uses `route:cache` para evitar este problema.

## Causa 4: Problemas de configuración del servidor

Si el servidor web (Nginx o Apache) no está configurado correctamente, las peticiones a URLs como `/productos/editar` pueden devolver un 404 del servidor, nunca llegando a Laravel.

### Configuración de Nginx

Laravel necesita que todas las peticiones pasen por `public/index.php`. La configuración crítica en Nginx es el bloque `location /`:

```php
server {
    listen 80;
    server_name tudominio.com;
    root /var/www/mi-app/public;

    index index.php;

    charset utf-8;

    # Esto es lo CRÍTICO: intenta el archivo, si no existe, pasa a index.php
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

La línea `try_files $uri $uri/ /index.php?$query_string;` es esencial. Dice: "intenta servir el archivo estático, si no existe intenta el directorio, y si tampoco existe pasa la petición a index.php". Sin esto, Nginx devuelve 404 para cualquier URL que no sea un archivo físico.

### Configuración de Apache (.htaccess)

Laravel incluye un archivo `.htaccess` en la carpeta `public/` que hace lo mismo para Apache:

```php
<IfModule mod_rewrite.c>
    <IfModule mod_negotiation.c>
        Options -MultiViews -Indexes
    </IfModule>

    RewriteEngine On

    # Handle Authorization Header
    RewriteCond %{HTTP:Authorization} .
    RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]

    # Redirect Trailing Slashes If Not A Folder...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_URI} (.+)/$
    RewriteRule ^ %1 [L,R=301]

    # Send Requests To Front Controller...
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteRule ^ index.php [L]
</IfModule>
```

Para que `.htaccess` funcione en Apache, necesitas tener `mod_rewrite` habilitado:

```php
sudo a2enmod rewrite
sudo systemctl restart apache2
```

Y en la configuración del virtual host, necesitas `AllowOverride All`:

```php
<VirtualHost *:80>
    ServerName tudominio.com
    DocumentRoot /var/www/mi-app/public

    <Directory /var/www/mi-app/public>
        AllowOverride All    <!-- Esto permite que .htaccess funcione -->
        Require all granted
    </Directory>
</VirtualHost>
```

## Causa 5: Prefijos de grupo de rutas mal configurados

Si tienes grupos de rutas con prefijos, el URI completo incluye el prefijo:

```php
// En routes/web.php:
Route::prefix('admin')->name('admin.')->group(function () {
    Route::get('/usuarios', [Admin\UsuarioController::class, 'index'])->name('usuarios.index');
    // URI completo: /admin/usuarios
    // Nombre completo: admin.usuarios.index
});
```

Si intentas acceder a `/usuarios` en lugar de `/admin/usuarios`, obtendrás 404. Verifica el URI completo con `route:list`.

## Causa 6: Parámetros de ruta mal tipados

Si defines una restricción en los parámetros de ruta con `where()` y el valor en la URL no cumple esa restricción, Laravel devuelve 404:

```php
Route::get('/productos/{id}', [ProductoController::class, 'show'])
    ->where('id', '[0-9]+');  // Solo acepta números

// Acceder a /productos/abc → 404 porque 'abc' no son solo dígitos
```

Esto es comportamiento esperado y correcto. Si necesitas IDs alfanuméricos:

```php
Route::get('/productos/{slug}', [ProductoController::class, 'show'])
    ->where('slug', '[a-z0-9-]+');
```

## Causa 7: Route model binding fallando

Si usas Route Model Binding y el modelo no se encuentra, Laravel devuelve 404 automáticamente:

```php
// En routes/web.php:
Route::get('/productos/{producto}', [ProductoController::class, 'show']);

// En el controlador:
public function show(Producto $producto): View
{
    // Si no existe ningún Producto con el ID de la URL, Laravel devuelve 404 automáticamente
    return view('productos.show', compact('producto'));
}
```

Esto es el comportamiento correcto. Si quieres personalizar la respuesta cuando el modelo no existe:

```php
Route::get('/productos/{producto}', [ProductoController::class, 'show'])
    ->missing(function (Request $request) {
        return redirect()->route('productos.index')
            ->with('warning', 'El producto que buscas no existe.');
    });
```

O globalmente en el modelo:

```php
// app/Models/Producto.php
protected static function booted(): void
{
    // Usar soft deletes para que los productos eliminados también devuelvan 404
    static::addGlobalScope('activo', function (Builder $builder) {
        $builder->where('activo', true);
    });
}
```

## Causa 8: Rutas de API vs rutas web

Las rutas definidas en `routes/api.php` tienen el prefijo `/api` automáticamente. Si defines una ruta en `api.php` y accedes sin el prefijo, obtendrás 404:

```php
// En routes/api.php:
Route::get('/productos', [ProductoController::class, 'index']);
// URI real: /api/productos

// Si accedes a /productos → 404
// Debes acceder a /api/productos → 200
```

Si quieres cambiar el prefijo de la API:

```php
// bootstrap/app.php (Laravel 11)
->withRouting(
    web: __DIR__.'/../routes/web.php',
    api: __DIR__.'/../routes/api.php',
    apiPrefix: 'v1',  // Cambia el prefijo a /v1
)
```

## Personalizar la respuesta 404

En lugar de la página de error genérica, puedes personalizar la respuesta 404:

```php
// Crear la vista: resources/views/errors/404.blade.php
<!DOCTYPE html>
<html>
<head>
    <title>Página no encontrada</title>
</head>
<body>
    <h1>Oops! Página no encontrada</h1>
    <p>La página que buscas no existe o fue movida.</p>
    <a href="{{ url('/') }}">Volver al inicio</a>
</body>
</html>
```

Laravel usará automáticamente esta vista cuando devuelva un error 404.

Para lanzar un 404 manualmente desde el código:

```php
// En un controlador:
public function show(int $id): View
{
    $producto = Producto::find($id);

    if (!$producto) {
        abort(404, 'Producto no encontrado');
    }

    return view('productos.show', compact('producto'));
}

// O más limpio con findOrFail():
public function show(int $id): View
{
    $producto = Producto::findOrFail($id); // Lanza 404 si no existe

    return view('productos.show', compact('producto'));
}
```

## Checklist de diagnóstico

Cuando tienes un error 404 en Laravel:

```php
// 1. Ver todas las rutas registradas:
php artisan route:list

// 2. Buscar la ruta específica:
php artisan route:list --path=tu-uri

// 3. Limpiar la caché de rutas:
php artisan route:clear

// 4. Si usas Nginx, verificar la configuración:
sudo nginx -t
// Revisar el bloque location / con try_files

// 5. Si usas Apache, verificar .htaccess y mod_rewrite:
sudo a2enmod rewrite
// Verificar que AllowOverride All está en el virtual host

// 6. Verificar el método HTTP correcto para la ruta

// 7. Si hay prefijo de grupo, incluirlo en el URI
```

## Conclusión

Los errores 404 en Laravel tienen causas bien definidas y diagnosticables. La herramienta `php artisan route:list` es tu mejor aliada para verificar qué rutas están realmente registradas. La segunda causa más común después de la ruta no definida es la configuración del servidor web, especialmente el bloque `try_files` en Nginx o `mod_rewrite` en Apache.

Recuerda: en desarrollo usa `php artisan serve` que ya maneja correctamente el enrutamiento, y en producción verifica cuidadosamente la configuración de tu servidor web.
