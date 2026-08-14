---
title: 'HEIC en Laravel 13.24: Convierte Fotos iPhone Automáticamente'
description: 'Aprende a validar y convertir imágenes HEIC y AVIF en Laravel 13.24. Procesa fotos de iPhone automáticamente a WebP sin dependencias externas.'
pubDate: '2026-01-15'
tags: ['laravel', 'imagenes', 'validacion', 'php']
---

## HEIC en Laravel 13.24: Convierte Fotos iPhone Automáticamente

Desde hace años, los usuarios de iPhone capturan fotos en formato HEIC (High Efficiency Image Container), un formato moderno que ofrece mejor compresión que JPG. Sin embargo, la integración de este formato en aplicaciones web ha sido problemática. **Laravel 13.24 resuelve esto completamente** permitiendo validar y convertir automáticamente imágenes HEIC y AVIF sin necesidad de librerías externas adicionales.

En este artículo descubrirás cómo aprovechar esta nueva funcionalidad para mejorar la experiencia de tus usuarios y optimizar el almacenamiento de imágenes en tu aplicación.

## ¿Por qué HEIC es importante para tu aplicación?

Cuando un usuario sube una foto desde su iPhone, es probable que obtengas un archivo HEIC. Hasta hace poco, tenías tres opciones problemáticas:

1. **Rechazar el archivo** – Mala experiencia de usuario
2. **Guardar HEIC directamente** – Incompatibilidad en navegadores antiguos
3. **Usar librerías externas complejas** – Dependencias adicionales y configuración tediosa

HEIC comprime mejor que JPG (reducción del 40-50% de tamaño), pero los navegadores antiguos no lo soportan nativamente. Convertir a WebP o AVIF es la solución ideal.

Antes de Laravel 13.24, necesitabas instalar software adicional como ImageMagick con soporte HEIC. **Ahora es tan simple como validar cualquier otra imagen**.

## Validación de imágenes HEIC en Laravel 13.24

La forma más directa de trabajar con HEIC es mediante las reglas de validación mejoradas:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class PhotoController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'photo' => [
                'required',
                'image',
                'mimes:heic,heif,jpeg,png,webp,avif',
                'max:10240', // 10MB
            ],
        ]);

        // El archivo se procesará automáticamente
        $path = $request->file('photo')->store('photos');

        return response()->json([
            'message' => 'Foto subida exitosamente',
            'path' => $path,
        ]);
    }
}
```

Laravel reconoce automáticamente el tipo MIME de HEIC y lo valida correctamente. La clave está en incluir `heic` y `heif` en la lista de tipos permitidos.

## Conversión automática a WebP con Image Facade

Para servir imágenes de la mejor forma posible, convierte HEIC a WebP usando el Image Facade introducido en Laravel 13.20:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Storage;
use Intervention\Image\Facades\Image;
use Illuminate\Http\Request;

class PhotoController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'photo' => 'required|image|mimes:heic,heif,jpeg,png|max:10240',
        ]);

        $file = $request->file('photo');
        $originalName = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);

        // Leer el archivo subido
        $image = Image::read($file);

        // Convertir a WebP
        $webpPath = "photos/{$originalName}.webp";
        Storage::disk('public')->put(
            $webpPath,
            $image->toWebp(quality: 85)->encode()
        );

        return response()->json([
            'message' => 'Foto procesada',
            'path' => "/storage/{$webpPath}",
            'size' => Storage::disk('public')->size($webpPath),
        ]);
    }
}
```

Este código:
- Lee la imagen HEIC directamente
- La convierte a WebP con calidad optimizada (85%)
- Guarda el resultado en storage
- Retorna la ruta lista para usar

## Procesamiento en Jobs para imágenes grandes

Para imágenes grandes o aplicaciones con alto volumen, procesa en una cola:

```php
<?php

namespace App\Jobs;

use Illuminate\Queue\SerializesModels;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Intervention\Image\Facades\Image;
use Illuminate\Support\Facades\Storage;

class ProcessHeicImage implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        private string $filePath,
        private string $disk = 'public'
    ) {}

    public function handle(): void
    {
        try {
            // Obtener el archivo almacenado
            $content = Storage::disk($this->disk)->get($this->filePath);
            
            // Procesar imagen
            $image = Image::read($content);
            
            // Generar múltiples versiones
            $original = $image->toWebp(quality: 90);
            $thumbnail = $image->scale(300, 300)->toWebp(quality: 85);
            
            $directory = dirname($this->filePath);
            $filename = pathinfo($this->filePath, PATHINFO_FILENAME);
            
            // Guardar versiones
            Storage::disk($this->disk)->put(
                "{$directory}/{$filename}.webp",
                $original->encode()
            );
            
            Storage::disk($this->disk)->put(
                "{$directory}/{$filename}_thumb.webp",
                $thumbnail->encode()
            );
            
            // Limpiar original si es HEIC
            if (str_ends_with($this->filePath, '.heic')) {
                Storage::disk($this->disk)->delete($this->filePath);
            }
        } catch (\Exception $e) {
            \Log::error("Error procesando imagen HEIC: {$e->getMessage()}");
            throw $e;
        }
    }
}
```

## Soporte para AVIF: el futuro del almacenamiento

AVIF es aún más eficiente que WebP. Laravel 13.24 también lo soporta:

```php
// Convertir a AVIF (máxima compresión)
$image = Image::read($request->file('photo'));

$avifPath = "photos/{$name}.avif";
Storage::disk('public')->put(
    $avifPath,
    $image->toAvif(quality: 80)->encode()
);

// Fallback a WebP
$webpPath = "photos/{$name}.webp";
Storage::disk('public')->put(
    $webpPath,
    $image->toWebp(quality: 85)->encode()
);
```

Sirve AVIF a navegadores modernos y WebP a los antiguos mediante HTML:

```html
<picture>
    <source srcset="{{ asset('storage/photo.avif') }}" type="image/avif">
    <source srcset="{{ asset('storage/photo.webp') }}" type="image/webp">
    <img src="{{ asset('storage/photo.jpg') }}" alt="Foto">
</picture>
```

## Validación avanzada con array_keys en Laravel 13.24

Si tu aplicación recibe datos de imagen con metadatos, usa la nueva regla `array_keys` para rechazar campos inesperados:

```php
$validated = $request->validate([
    'photo' => 'required|image|mimes:heic,jpeg,webp',
    'metadata' => 'array',
    'metadata.keys' => 'array_keys:exif_data,camera_model', // Solo estas claves
]);

// Rechaza automáticamente si viene metadata.location, metadata.gps, etc.
```

## Caso de uso completo: Sistema de galería con conversión automática

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Photo extends Model
{
    protected $fillable = ['user_id', 'original_path', 'webp_path', 'thumbnail_path'];

    public function getDisplayImageUrl()
    {
        return asset("storage/{$this->webp_path}");
    }

    public function getThumbnailUrl()
    {
        return asset("storage/{$this->thumbnail_path}");
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Models\Photo;
use App\Jobs\ProcessHeicImage;
use Illuminate\Http\Request;

class GalleryController extends Controller
{
    public function upload(Request $request)
    {
        $validated = $request->validate([
            'photo' => 'required|image|mimes:heic,heif,jpeg,png,webp|max:20480',
        ]);

        // Guardar archivo original temporalmente
        $originalPath = $request->file('photo')->store('temp', 'public');

        // Crear registro en BD
        $photo = Photo::create([
            'user_id' => auth()->id(),
            'original_path' => $originalPath,
        ]);

        // Procesar en cola
        ProcessHeicImage::dispatch($originalPath)
            ->onConnection('redis')
            ->delay(now()->addSeconds(5));

        return response()->json([
            'message' => 'Foto subida, procesando...',
            'photo_id' => $photo->id,
        ]);
    }
}
```

## Configuración de almacenamiento recomendada

En `config/filesystems.php`, asegúrate de tener:

```php
'disks' => [
    'public' => [
        'driver' => 'local',
        'root' => storage_path('app/public'),
        'url' => env('APP_URL') . '/storage',
        'visibility' => 'public',
    ],
],
```

## Rendimiento y optimización

Algunos consejos para maximizar rendimiento:

```php
// 1. Establece límites de tamaño razonables
'photo' => 'max:10240', // 10MB máximo

// 2. Usa colas con worker persistent
// Procesa múltiples imágenes sin reiniciar

// 3. Cachea URLs con una columna en la BD
$photo->update([
    'webp_url' => $webpPath,
    'thumbnail_url' => $thumbPath,
]);

// 4. Limpia archivos temporales regularmente
Storage::disk('public')->delete(
    Storage::disk('public')->listContents('temp')
        ->where('timestamp', '<', now()->subDay())
);
```

## Puntos clave

- **HEIC es el formato nativo de iPhone**: Laravel 13.24 lo soporta nativamente sin librerías externas
- **Valida con `mimes:heic,heif`**: Incluye ambos tipos MIME en las reglas de validación
- **Convierte a WebP o AVIF**: Usa Image Facade para optimizar automáticamente
- **Procesa en colas para escalabilidad**: Los trabajos pesados no deben bloquear requests
- **Usa `array_keys` para metadatos**: Valida estructura de datos complejos fácilmente
- **Sirve múltiples formatos con `<picture>`**: Garantiza compatibilidad en todos los navegadores
- **Guarda URLs en BD**: Evita regenerar rutas de imágenes en cada request
- **Limpia archivos temporales**: Implementa políticas de eliminación automática regularmente