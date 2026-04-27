---
title: 'Laravel Sluggable: URLs amigables automáticas'
description: 'Genera slugs automáticos en Laravel con el paquete Sluggable de Spatie. Optimiza tus URLs SEO sin código complejo.'
pubDate: '2026-04-27'
tags: ['laravel', 'seo', 'slugs', 'spatie', 'eloquent']
---

## Introducción

Las URLs amigables son fundamentales para el SEO y la experiencia del usuario. En lugar de direcciones como `/productos/15`, queremos `/productos/laptop-hp-pavilion`. Mientras que cualquier developer experimentado puede crear slugs manualmente, el paquete **Laravel Sluggable** de Spatie automatiza completamente este proceso, ahorrándote horas de desarrollo y permitiéndote enfocarte en la lógica real de tu aplicación.

En este artículo aprenderás cómo implementar slugs automáticos en tus modelos Eloquent, manejar casos complejos como actualizaciones y duplicados, y optimizar tus rutas para mejorar el posicionamiento SEO.

## ¿Qué es un Slug?

Un slug es una versión simplificada y URL-safe de un texto. Por ejemplo:

| Texto Original | Slug Generado |
|---|---|
| "Guía Completa de Laravel" | "guia-completa-de-laravel" |
| "iPhone 15 Pro Max" | "iphone-15-pro-max" |
| "¿Cómo funciona Eloquent?" | "como-funciona-eloquent" |

Los slugs son esenciales porque:
- Mejoran el SEO (palabras clave en la URL)
- Son más legibles y recordables
- Funcionan mejor en enlaces compartidos
- Evitan problemas de caracteres especiales

## Instalación de Laravel Sluggable

El primer paso es instalar el paquete a través de Composer:

```bash
composer require spatie/laravel-sluggable
```

Una vez instalado, ya puedes usar el trait en tus modelos. No requiere configuración adicional en la mayoría de casos, aunque Spatie proporciona un archivo de configuración opcional si necesitas personalizar el comportamiento.

## Uso Básico: Tu Primer Slug

Implementar Sluggable es extremadamente simple. Supongamos que tienes un modelo `Post`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Sluggable\HasSlug;
use Spatie\Sluggable\SlugOptions;

class Post extends Model
{
    use HasSlug;

    protected $fillable = ['title', 'slug', 'content'];

    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugFrom('title')
            ->saveSlugsTo('slug');
    }
}
```

Ahora, cuando crees un post, el slug se generará automáticamente:

```php
$post = Post::create([
    'title' => 'Cómo dominar Laravel Eloquent',
    'content' => 'Lorem ipsum...'
]);

echo $post->slug; // Output: "como-dominar-laravel-eloquent"
```

¿Ves? Sin hacer nada extra, el slug está ahí. Perfecto para rutas:

```php
// routes/web.php
Route::get('/blog/{post:slug}', [PostController::class, 'show'])->name('posts.show');
```

## Configuración Avanzada

### Generar desde Múltiples Campos

A veces necesitas combinar varios campos para el slug:

```php
public function getSlugOptions(): SlugOptions
{
    return SlugOptions::create()
        ->generateSlugFrom(['categoria', 'titulo'])
        ->saveSlugsTo('slug');
}
```

Si tienes un producto en la categoría "Electrónica" con título "Monitor 4K", el slug será: `electonica-monitor-4k`.

### Personalizar el Idioma y Caracteres

Sluggable usa el excelente paquete `cocur/slugify` bajo el capó. Puedes personalizar cómo se generan:

```php
public function getSlugOptions(): SlugOptions
{
    return SlugOptions::create()
        ->generateSlugFrom('title')
        ->saveSlugsTo('slug')
        ->usingSeparator('-')
        ->usingLanguage('es'); // Soporte para acentos españoles
}
```

Con `usingLanguage('es')`, los acentos se manejan correctamente: `"Café Colombiano"` → `"cafe-colombiano"`.

### Slugs Únicos Automáticamente

¿Qué pasa si dos posts tienen el mismo título? Sluggable maneja esto automáticamente añadiendo números:

```php
public function getSlugOptions(): SlugOptions
{
    return SlugOptions::create()
        ->generateSlugFrom('title')
        ->saveSlugsTo('slug')
        ->ensureUniqueSlugs();
}
```

Resultado:
- Primer post: "mi-primer-articulo"
- Segundo post con mismo título: "mi-primer-articulo-1"
- Tercero: "mi-primer-articulo-2"

### Permitir Actualizaciones de Slug

Por defecto, Sluggable solo genera el slug una vez (al crear). Si quieres que se regenere cuando actualizas el título:

```php
public function getSlugOptions(): SlugOptions
{
    return SlugOptions::create()
        ->generateSlugFrom('title')
        ->saveSlugsTo('slug')
        ->ensureUniqueSlugs()
        ->doNotUpdateSlugs(); // Cambia a updateSlugs() para permitir cambios
}
```

Usa `updateSlugs()` con cuidado en producción, ya que cambiar URLs puede romper enlaces existentes. Una mejor práctica es mantener los slugs una vez creados.

## Casos de Uso Prácticos

### Sistema de Blog Completo

Aquí está un ejemplo real con validación y almacenamiento:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Sluggable\HasSlug;
use Spatie\Sluggable\SlugOptions;

class Article extends Model
{
    use HasSlug;

    protected $fillable = ['title', 'slug', 'content', 'excerpt', 'published_at'];

    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugFrom('title')
            ->saveSlugsTo('slug')
            ->ensureUniqueSlugs()
            ->usingLanguage('es');
    }

    public function getRouteKeyName()
    {
        return 'slug'; // Usa slug en rutas automáticamente
    }
}
```

En el controlador:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Article;

class ArticleController extends Controller
{
    public function show(Article $article)
    {
        return view('articles.show', compact('article'));
    }

    public function store()
    {
        $validated = request()->validate([
            'title' => 'required|unique:articles|max:255',
            'content' => 'required',
            'excerpt' => 'max:500',
        ]);

        // El slug se genera automáticamente
        Article::create($validated);

        return redirect()->route('articles.index');
    }
}
```

Y tu ruta será ultra limpia:

```php
Route::get('/articulos/{article}', [ArticleController::class, 'show']);
// Automatically uses {article:slug}
```

### Slugs en Relaciones

Imagina productos con categorías:

```php
class Product extends Model
{
    use HasSlug;

    protected $fillable = ['name', 'slug', 'category_id'];

    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugFrom('name')
            ->saveSlugsTo('slug')
            ->ensureUniqueSlugs()
            ->usingLanguage('es');
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}

// En routes
Route::get('/categorias/{category:slug}/productos/{product:slug}', 
    [ProductController::class, 'show']
);
```

URLs como `/categorias/electronica/productos/monitor-lg-4k` se generan sin esfuerzo.

### Cambiar Slugs de Forma Segura

Si necesitas cambiar la lógica de generación de slugs pero mantener URLs antiguas funcionando:

```php
class Post extends Model
{
    use HasSlug;

    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugFrom('title')
            ->saveSlugsTo('slug')
            ->ensureUniqueSlugs()
            ->doNotUpdateSlugs();
    }

    public function redirects()
    {
        return $this->hasMany(SlugRedirect::class);
    }
}

// Usa un middleware para redirecciones 301
Route::get('/blog/{old_slug}', function ($old_slug) {
    $redirect = SlugRedirect::where('old_slug', $old_slug)->firstOrFail();
    return redirect("/blog/{$redirect->post->slug}", 301);
});
```

## Integración con Búsqueda SEO

Combina Sluggable con otras prácticas SEO:

```php
class Article extends Model
{
    use HasSlug;

    protected $fillable = [
        'title', 'slug', 'content', 
        'meta_description', 'meta_keywords'
    ];

    public function getSlugOptions(): SlugOptions
    {
        return SlugOptions::create()
            ->generateSlugFrom('title')
            ->saveSlugsTo('slug')
            ->ensureUniqueSlugs()
            ->usingLanguage('es');
    }

    public function getMeta()
    {
        return [
            'title' => $this->title,
            'url' => route('articles.show', $this),
            'description' => $this->meta_description ?? str($this->content)->words(20),
            'keywords' => $this->meta_keywords,
        ];
    }
}
```

En la vista:

```blade
<meta name="description" content="{{ $article->getMeta()['description'] }}">
<meta name="keywords" content="{{ $article->getMeta()['keywords'] }}">
<link rel="canonical" href="{{ $article->getMeta()['url'] }}">
```

## Ventajas Frente a Hacer Slugs Manualmente

| Aspecto | Manual | Sluggable |
|---|---|---|
| Líneas de código | 20-30 | 5-10 |
| Manejo de acentos | Error-prone | Perfecto |
| Duplicados | Lógica manual | Automático |
| Rendimiento | Depende | Optimizado |
| Mantenimiento | Difícil | Trivial |

## Rendimiento y Consideraciones

Sluggable es extremadamente eficiente. El slug se genera **una sola vez** al crear el modelo (por defecto). Si usas búsquedas frecuentes por slug, asegúrate de indexar:

```php
// En tu migración
Schema::create('articles', function (Blueprint $table) {
    $table->id();
    $table->string('title');
    $table->string('slug')->unique()->index(); // ← Index aquí
    $table->text('content');
    $table->timestamps();
});
```

## Conclusión

Laravel Sluggable elimina una de las tareas más tediosas del desarrollo web: la generación de URLs amigables. Con apenas 10 líneas de código, consigues:

- Slugs automáticos y SEO-friendly
- Manejo perfecto de acentos y caracteres especiales
- Unicidad garantizada
- Rutas limpias y predecibles
- Mejor experiencia de usuario

El paquete es tan simple pero tan poderoso que debería ser estándar en cualquier proyecto Laravel. No solo ahorra tiempo de desarrollo, sino que garantiza consistencia y calidad en tus URLs desde el primer día.

## Puntos Clave

- **Sluggable de Spatie** automatiza la generación de URLs amigables en Eloquent models
- El trait `HasSlug` + método `getSlugOptions()` es todo lo que necesitas
- Usa `ensureUniqueSlugs()` para evitar duplicados automáticamente
- `usingLanguage('es')` maneja correctamente acentos y caracteres españoles
- Los slugs se generan una sola vez (mejor para SEO) con `doNotUpdateSlugs()`
- Indexa siempre la columna `slug` en tu base de datos para búsquedas rápidas
- Combina con `getRouteKeyName()` para rutas ultra limpias
- Perfecto para blogs, tiendas online, portfolios y cualquier contenido dinámico
- El paquete es lightweight, sin dependencias problemáticas
- Integra perfectamente con relaciones Eloquent (categoría/producto)