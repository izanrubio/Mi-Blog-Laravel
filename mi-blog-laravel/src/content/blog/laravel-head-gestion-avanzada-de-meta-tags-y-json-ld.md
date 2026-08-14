---
title: 'Laravel Head: Gestión Avanzada de Meta Tags y JSON-LD'
description: 'Aprende a gestionar meta tags, Open Graph y JSON-LD en Laravel con la API fluida de Laravel Head. Guía completa con ejemplos.'
pubDate: '2026-08-05'
tags: ['laravel', 'seo', 'head-management', 'meta-tags']
---

## Laravel Head: Gestión Avanzada de Meta Tags y JSON-LD

Si desarrollas aplicaciones web modernas en Laravel, sabes que la gestión de meta tags, Open Graph y estructuras JSON-LD es crítica para SEO y compartir contenido en redes sociales. Hasta ahora, esto implicaba trabajar con componentes Blade dispersos o librerías de terceros. Con **Laravel Head**, anunciado por Taylor Otwell en Laracon US 2026, tenemos una solución first-party elegante y unificada.

En este artículo exploraremos cómo Laravel Head simplifica la gestión del documento `<head>` de tu aplicación, funciona perfectamente con Blade, Livewire e Inertia, y te permite escribir código más limpio y mantenible.

## ¿Qué es Laravel Head?

Laravel Head es un paquete oficial de Laravel que proporciona una API fluida para gestionar todos los aspectos del `<head>` de tu documento HTML. Permite definir títulos, meta tags, directivas robots, esquemas JSON-LD, hints de rendimiento y más, desde cualquier parte de tu aplicación.

La belleza de Laravel Head radica en su enfoque declarativo y centralizado: en lugar de esparcir meta tags en múltiples archivos Blade, defines todo en un solo lugar con una sintaxis intuitiva.

### Comparación: antes y después

**Antes (enfoque tradicional):**

```blade
<!-- resources/views/layouts/app.blade.php -->
<head>
    <title>{{ $title ?? 'Mi App' }}</title>
    <meta name="description" content="{{ $description ?? '' }}">
    <meta property="og:title" content="{{ $ogTitle ?? '' }}">
    <meta property="og:description" content="{{ $ogDescription ?? '' }}">
    <meta property="og:image" content="{{ $ogImage ?? '' }}">
    <!-- Repetir esto en cada vista... -->
</head>
```

**Con Laravel Head:**

```php
// En tu controlador
use Illuminate\Support\Facades\Head;

Head::title('Mi Artículo')
    ->description('Una descripción cautivadora')
    ->openGraph('og:title', 'Mi Artículo')
    ->openGraph('og:description', 'Una descripción cautivadora')
    ->openGraph('og:image', 'https://ejemplo.com/imagen.jpg');
```

## Instalación y Configuración Básica

### Instalar Laravel Head

```bash
composer require laravel/head
```

### Publicar la configuración

```bash
php artisan vendor:publish --provider="Laravel\Head\HeadServiceProvider"
```

### Registrar el componente Blade

En tu layout principal (`resources/views/layouts/app.blade.php`), incluye el componente Head:

```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <!-- Aquí renderiza todo lo registrado en Laravel Head -->
    <x-head />
    
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    {{ $slot }}
</body>
</html>
```

## Uso Práctico: Gestión de Meta Tags

### Títulos y Descripciones

La forma más básica de usar Laravel Head es establecer el título y descripción:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Head;
use App\Models\Post;

class PostController extends Controller
{
    public function show(Post $post)
    {
        Head::title($post->title)
            ->description($post->excerpt);

        return view('posts.show', ['post' => $post]);
    }
}
```

### Meta Tags Personalizados

Añade meta tags específicos para controlar el comportamiento de los navegadores y buscadores:

```php
Head::title('Mis Productos')
    ->description('Catálogo completo de productos')
    ->tag('keywords', 'productos, tienda, ecommerce')
    ->tag('author', 'Mi Empresa')
    ->tag('robots', 'index, follow');
```

### Open Graph para Redes Sociales

Define cómo se ve tu contenido cuando se comparte en Facebook, Twitter, LinkedIn, etc:

```php
$post = Post::with('author')->find($id);

Head::title($post->title)
    ->description($post->excerpt)
    ->openGraph('og:title', $post->title)
    ->openGraph('og:description', $post->excerpt)
    ->openGraph('og:image', $post->featured_image_url)
    ->openGraph('og:url', route('posts.show', $post))
    ->openGraph('og:type', 'article')
    ->openGraph('article:published_time', $post->published_at->toAtomString())
    ->openGraph('article:author', $post->author->name);
```

### Twitter Card

Personaliza cómo aparece tu contenido en Twitter:

```php
Head::openGraph('twitter:card', 'summary_large_image')
    ->openGraph('twitter:creator', '@miusuario')
    ->openGraph('twitter:title', $post->title)
    ->openGraph('twitter:description', $post->excerpt)
    ->openGraph('twitter:image', $post->featured_image_url);
```

## Esquemas JSON-LD para SEO Estructurado

JSON-LD es el formato recomendado por Google para datos estructurados. Laravel Head lo hace muy sencillo:

### Artículo Blog

```php
Head::jsonLd('Article', [
    'headline' => $post->title,
    'description' => $post->excerpt,
    'image' => $post->featured_image_url,
    'datePublished' => $post->published_at->toAtomString(),
    'dateModified' => $post->updated_at->toAtomString(),
    'author' => [
        '@type' => 'Person',
        'name' => $post->author->name,
    ],
]);
```

### Producto (E-commerce)

```php
Head::jsonLd('Product', [
    'name' => $product->name,
    'description' => $product->description,
    'image' => $product->image_url,
    'offers' => [
        '@type' => 'Offer',
        'url' => route('products.show', $product),
        'priceCurrency' => 'EUR',
        'price' => $product->price,
        'availability' => $product->in_stock ? 'InStock' : 'OutOfStock',
    ],
    'aggregateRating' => [
        '@type' => 'AggregateRating',
        'ratingValue' => $product->average_rating,
        'reviewCount' => $product->reviews_count,
    ],
]);
```

### Organización

```php
Head::jsonLd('Organization', [
    'name' => config('app.name'),
    'url' => config('app.url'),
    'logo' => asset('images/logo.png'),
    'sameAs' => [
        'https://twitter.com/miempresa',
        'https://facebook.com/miempresa',
        'https://linkedin.com/company/miempresa',
    ],
    'contact' => [
        '@type' => 'ContactPoint',
        'contactType' => 'Customer Support',
        'telephone' => '+34-123-456789',
        'email' => 'soporte@miempresa.com',
    ],
]);
```

## Integración con Livewire e Inertia.js

### Usar Laravel Head en Componentes Livewire

En componentes Livewire, puedes actualizar los meta tags dinámicamente:

```php
<?php

namespace App\Livewire;

use Livewire\Component;
use Illuminate\Support\Facades\Head;
use App\Models\Post;

class PostViewer extends Component
{
    public $postId;

    #[On('post-selected')]
    public function updatePost($id)
    {
        $post = Post::find($id);

        Head::title($post->title)
            ->description($post->excerpt)
            ->openGraph('og:title', $post->title)
            ->openGraph('og:image', $post->featured_image_url);

        $this->postId = $id;
    }

    public function render()
    {
        return view('livewire.post-viewer', [
            'post' => Post::find($this->postId),
        ]);
    }
}
```

### Usar Laravel Head con Inertia.js

En Inertia, pasa los datos de head a través de props y configúralos en el controlador:

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Illuminate\Support\Facades\Head;
use App\Models\Product;

class ProductController extends Controller
{
    public function show(Product $product)
    {
        Head::title($product->name)
            ->description($product->short_description)
            ->openGraph('og:title', $product->name)
            ->openGraph('og:image', $product->image_url)
            ->jsonLd('Product', [
                'name' => $product->name,
                'image' => $product->image_url,
                'offers' => [
                    'priceCurrency' => 'EUR',
                    'price' => $product->price,
                ],
            ]);

        return Inertia::render('Product/Show', [
            'product' => $product,
        ]);
    }
}
```

## Hints de Rendimiento

Laravel Head también permite agregar hints de rendimiento para optimizar la carga:

```php
// Preconnect a servicios externos
Head::link('preconnect', 'https://fonts.googleapis.com')
    ->link('preconnect', 'https://cdn.example.com');

// Prefetch recursos que probablemente necesites
Head::link('prefetch', asset('js/heavy-component.js'));

// DNS prefetch para dominios externos
Head::link('dns-prefetch', '//api.ejemplo.com');

// Preload fuentes críticas
Head::link('preload', asset('fonts/inter-var.woff2'))
    ->attribute('as', 'font')
    ->attribute('type', 'font/woff2')
    ->attribute('crossorigin', true);
```

## Directivas Robots

Controla cómo los motores de búsqueda indexan tu contenido:

```php
// Contenido privado
Head::robots('noindex, nofollow');

// Contenido indexable pero sin seguimiento de links
Head::robots('index, nofollow');

// Permite indexación estándar
Head::robots('index, follow');

// Especificar máximo caché
Head::tag('robots', 'max-snippet:-1, max-image-preview:large, max-video-preview:-1');
```

## Patrón Service: Centralizar la Lógica de Head

Para aplicaciones grandes, es recomendable crear un servicio que centralice la lógica de meta tags:

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Head;
use App\Models\Post;

class HeadService
{
    public function setPostHead(Post $post): void
    {
        Head::title($post->title)
            ->description($post->excerpt)
            ->robots('index, follow')
            ->openGraph('og:title', $post->title)
            ->openGraph('og:description', $post->excerpt)
            ->openGraph('og:image', $post->featured_image_url)
            ->openGraph('og:type', 'article')
            ->openGraph('og:url', route('posts.show', $post))
            ->openGraph('article:published_time', $post->published_at->toAtomString())
            ->openGraph('article:author', $post->author->name)
            ->jsonLd('Article', [
                'headline' => $post->title,
                'description' => $post->excerpt,
                'image' => $post->featured_image_url,
                'datePublished' => $post->published_at->toAtomString(),
                'author' => [
                    '@type' => 'Person',
                    'name' => $post->author->name,
                ],
            ]);
    }

    public function setProductHead($product): void
    {
        Head::title($product->name)
            ->description($product->short_description)
            ->openGraph('og:title', $product->name)
            ->openGraph('og:image', $product->image_url)
            ->jsonLd('Product', [
                'name' => $product->name,
                'image' => $product->image_url,
                'offers' => [
                    'priceCurrency' => 'EUR',
                    'price' => $product->price,
                    'availability' => $product->in_stock ? 'InStock' : 'OutOfStock',
                ],
            ]);
    }
}
```

Luego úsalo en tus controladores:

```php
<?php

namespace App\Http\Controllers;

use App\Services\HeadService;
use App\Models\Post;

class PostController extends Controller
{
    public function __construct(private HeadService $headService) {}

    public function show(Post $post)
    {
        $this->headService->setPostHead($post);

        return view('posts.show', ['post' => $post]);
    }
}
```

## Testing de Meta Tags

Verifica que tus meta tags se rendericen correctamente en tests:

```php
<?php

namespace Tests\Feature;

use App\Models\Post;
use Illuminate\Support\Facades\Head;
use Tests\TestCase;

class PostMetaTagsTest extends TestCase
{
    public function test_post_page_renders_correct_meta_tags()
    {
        $post = Post::factory()->create([
            'title' => 'Mi Artículo Fantástico',
            'excerpt' => 'Una descripción increíble',
        ]);

        Head::title($post->title)
            ->description($post->excerpt)
            ->openGraph('og:title', $post->title);

        $response = $this->get(route('posts.show', $post));

        $response->assertSeeText('Mi Artículo Fantástico');
        $response->assertSeeInOrder([
            'name="description"',
            'Una descripción increíble',
        ]);
    }
}
```

## Mejores Prácticas

### 1. Mantén Meta Tags Actualizados

Actualiza meta tags dinámicamente según el contenido:

```php
// ✅ Bien
Head::title($dynamicTitle)
    ->description($dynamicDescription);

// ❌ Evita
Head::title('Título Estático');
```

### 2. Usa JSON-LD para SEO

Siempre proporciona datos estructurados para que Google entienda tu contenido:

```php
// ✅ Incluye JSON-LD
Head::jsonLd('Article', ['headline' => $title]);

// ❌ Evita confiar solo en meta tags básicos
```

### 3. Optimiza Imágenes para Open Graph

Las imágenes deben ser de al menos 1200x630px:

```php
Head::openGraph('og:image', $post->getOgImageUrl()); // Imagen optimizada
```

### 4. Centraliza la Lógica en Servicios

No desperdigues la lógica de head por múltiples controladores:

```php
// ✅