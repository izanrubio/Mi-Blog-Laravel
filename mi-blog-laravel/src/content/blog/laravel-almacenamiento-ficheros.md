---
title: 'Almacenamiento de archivos en Laravel: Storage facade explicada'
description: 'Aprende a gestionar archivos en Laravel con la facade Storage. Sube, descarga, elimina y organiza ficheros en local, S3 y otros discos con ejemplos prácticos.'
pubDate: '2026-04-16'
tags: ['laravel', 'storage', 'conceptos', 'roadmap']
---

Subir y gestionar archivos es una necesidad habitual en cualquier aplicación web: imágenes de perfil, documentos adjuntos, exportaciones en PDF... Laravel incluye una capa de abstracción del sistema de archivos muy bien diseñada que te permite trabajar con archivos locales, Amazon S3 o cualquier otro proveedor usando exactamente la misma API.

## La abstracción del sistema de archivos

La filosofía de Laravel es que el código que escribe y lee archivos no debería saber ni importarle dónde se almacenan esos archivos. En local durante el desarrollo, en S3 en producción... el código es el mismo.

Esto es posible gracias a la librería [Flysystem](https://flysystem.thephpleague.com/) de PHP, sobre la cual Laravel construye su facade `Storage`.

## Configuración: config/filesystems.php

El archivo de configuración `config/filesystems.php` define los "discos" disponibles:

```php
// config/filesystems.php
return [
    'default' => env('FILESYSTEM_DISK', 'local'),

    'disks' => [
        'local' => [
            'driver' => 'local',
            'root'   => storage_path('app/private'),
            'throw'  => false,
        ],

        'public' => [
            'driver'     => 'local',
            'root'       => storage_path('app/public'),
            'url'        => env('APP_URL') . '/storage',
            'visibility' => 'public',
            'throw'      => false,
        ],

        's3' => [
            'driver'                  => 's3',
            'key'                     => env('AWS_ACCESS_KEY_ID'),
            'secret'                  => env('AWS_SECRET_ACCESS_KEY'),
            'region'                  => env('AWS_DEFAULT_REGION'),
            'bucket'                  => env('AWS_BUCKET'),
            'url'                     => env('AWS_URL'),
            'endpoint'                => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw'                   => false,
        ],
    ],

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],
];
```

Los tres discos más importantes son:

- **local**: almacena en `storage/app/private`. No es accesible desde la web (privado).
- **public**: almacena en `storage/app/public`. Accesible desde la web mediante un enlace simbólico.
- **s3**: Amazon S3 o servicios compatibles (DigitalOcean Spaces, MinIO, etc.).

## La facade Storage: operaciones básicas

```php
use Illuminate\Support\Facades\Storage;

// Guardar contenido en un archivo
Storage::put('archivo.txt', 'Contenido del archivo');

// Leer el contenido de un archivo
$contenido = Storage::get('archivo.txt');

// Comprobar si un archivo existe
if (Storage::exists('archivo.txt')) {
    // ...
}

// Eliminar un archivo
Storage::delete('archivo.txt');

// Eliminar múltiples archivos
Storage::delete(['uno.txt', 'dos.txt', 'tres.txt']);

// Obtener la URL pública de un archivo
$url = Storage::url('imagenes/foto.jpg');

// Obtener el tamaño en bytes
$bytes = Storage::size('archivo.txt');

// Fecha de última modificación
$timestamp = Storage::lastModified('archivo.txt');
```

Para usar un disco específico, encadena `disk()`:

```php
// Guardar en S3
Storage::disk('s3')->put('backups/dump.sql', $contenido);

// Leer del disco local
$contenido = Storage::disk('local')->get('privado/datos.json');
```

## Subir archivos desde formularios

### El formulario en Blade

```html
<form method="POST" action="/perfil/avatar" enctype="multipart/form-data">
    @csrf
    @method('PUT')

    <input type="file" name="avatar" accept="image/*">

    @error('avatar')
        <p class="text-red-500">{{ $message }}</p>
    @enderror

    <button type="submit">Actualizar avatar</button>
</form>
```

### Procesar la subida en el controlador

```php
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;

public function updateAvatar(Request $request): RedirectResponse
{
    $request->validate([
        'avatar' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
    ]);

    $archivo = $request->file('avatar');

    // store() genera un nombre único automáticamente
    // Guarda en storage/app/public/avatars/
    $ruta = $archivo->store('avatars', 'public');

    // storeAs() te permite definir el nombre del archivo
    // $ruta = $archivo->storeAs('avatars', $request->user()->id . '.webp', 'public');

    // Eliminar el avatar anterior si existe
    if ($request->user()->avatar) {
        Storage::disk('public')->delete($request->user()->avatar);
    }

    $request->user()->update(['avatar' => $ruta]);

    return back()->with('success', 'Avatar actualizado correctamente.');
}
```

### Información sobre el archivo subido

```php
$archivo = $request->file('avatar');

// Nombre original del archivo en el cliente
$nombreOriginal = $archivo->getClientOriginalName();
// foto_perfil.jpg

// Extensión original
$extension = $archivo->getClientOriginalExtension();
// jpg

// Extensión según el MIME type (más segura)
$extension = $archivo->extension();
// jpg

// Tamaño en bytes
$tamano = $archivo->getSize();
// 245632

// MIME type
$mime = $archivo->getMimeType();
// image/jpeg

// Ruta temporal en el servidor
$rutaTemporal = $archivo->getRealPath();
```

## El disco public y storage:link

El disco `public` almacena archivos en `storage/app/public`, pero esta carpeta no es accesible desde el navegador. Para que lo sea, necesitas crear un enlace simbólico:

```bash
php artisan storage:link
```

Este comando crea un symlink desde `public/storage` hacia `storage/app/public`. Después de ejecutarlo, los archivos guardados en el disco `public` son accesibles en:

```
https://tudominio.com/storage/avatars/nombrearchivo.jpg
```

Para obtener la URL pública de un archivo:

```php
// Forma recomendada
$url = Storage::disk('public')->url($ruta);

// O usando asset()
$url = asset('storage/' . $ruta);

// En Blade
<img src="{{ Storage::disk('public')->url($user->avatar) }}" alt="Avatar">
// O más corto:
<img src="{{ asset('storage/' . $user->avatar) }}" alt="Avatar">
```

## Visibilidad de archivos

Los archivos pueden ser públicos o privados:

```php
// Guardar como público
Storage::put('archivo.txt', 'contenido', 'public');

// Guardar como privado (por defecto)
Storage::put('archivo.txt', 'contenido', 'private');

// Cambiar la visibilidad
Storage::setVisibility('archivo.txt', 'public');

// Consultar la visibilidad
$visibilidad = Storage::getVisibility('archivo.txt');
// 'public' o 'private'
```

## Mover y copiar archivos

```php
// Copiar un archivo
Storage::copy('imagenes/original.jpg', 'imagenes/copia.jpg');

// Mover (renombrar) un archivo
Storage::move('imagenes/temporal.jpg', 'imagenes/definitivo.jpg');
```

## Streams para archivos grandes

Para archivos grandes, usa streams en lugar de cargar todo el contenido en memoria:

```php
// Leer como stream
$stream = Storage::readStream('videos/pelicula.mp4');

// Guardar desde un stream
Storage::writeStream('backups/dump.sql', $stream);

// Descarga en streaming desde un controlador
public function download(string $filename): StreamedResponse
{
    if (! Storage::disk('local')->exists("privados/{$filename}")) {
        abort(404);
    }

    return Storage::disk('local')->download("privados/{$filename}");
}

// O con nombre personalizado
return Storage::disk('s3')->download(
    "documentos/{$filename}",
    'mi-documento-descargado.pdf'
);
```

## Listar archivos y directorios

```php
// Listar archivos en un directorio
$archivos = Storage::files('imagenes');

// Listar archivos recursivamente
$todosLosArchivos = Storage::allFiles('imagenes');

// Listar directorios
$directorios = Storage::directories('uploads');

// Listar directorios recursivamente
$todosLosDirecctorios = Storage::allDirectories('uploads');

// Crear un directorio
Storage::makeDirectory('usuarios/123/documentos');

// Eliminar un directorio y su contenido
Storage::deleteDirectory('temporales');
```

## Configurar Amazon S3

Primero instala el paquete necesario:

```bash
composer require league/flysystem-aws-s3-v3 "^3.0" --with-all-dependencies
```

Añade las variables al `.env`:

```ini
FILESYSTEM_DISK=s3

AWS_ACCESS_KEY_ID=tu_access_key
AWS_SECRET_ACCESS_KEY=tu_secret_key
AWS_DEFAULT_REGION=eu-west-1
AWS_BUCKET=nombre-de-tu-bucket
AWS_URL=https://nombre-de-tu-bucket.s3.eu-west-1.amazonaws.com
```

Con esto configurado, todo el código que uses con `Storage::disk('s3')` o con el disco por defecto funcionará con S3 sin ningún cambio adicional.

### URLs temporales para archivos privados en S3

Para generar URLs de acceso temporal a archivos privados en S3:

```php
// URL válida durante 30 minutos
$url = Storage::disk('s3')->temporaryUrl(
    'documentos/privado.pdf',
    now()->addMinutes(30)
);
```

## Consejos para producción

**Permisos correctos**: en producción, asegúrate de que el directorio `storage` y sus subdirectorios tienen los permisos correctos:

```bash
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

**Variables de entorno**: nunca hardcodees credenciales de S3 en el código. Usa siempre las variables del `.env` o el sistema de secrets de tu proveedor cloud.

**El symlink en producción**: ejecuta `php artisan storage:link` como parte de tu proceso de despliegue. Si usas Deployer o Envoyer, ya está incluido.

**Subidas directas a S3 desde el navegador**: para evitar pasar archivos grandes por tu servidor, considera usar las URLs prefirmadas de S3 para subidas directas desde el cliente.

```php
// Generar una URL prefirmada para subida directa
$url = Storage::disk('s3')->temporaryUploadUrl(
    'uploads/' . uniqid() . '.jpg',
    now()->addMinutes(5),
    ['ContentType' => 'image/jpeg']
);
```

## Conclusión

La facade `Storage` de Laravel es una de las partes más bien diseñadas del framework. Abstraer el sistema de archivos significa que puedes desarrollar localmente con archivos en disco y desplegar en producción con S3 sin cambiar una sola línea de código. Dominar esta herramienta te va a ahorrar mucho tiempo y va a hacer tus aplicaciones más robustas y escalables.
