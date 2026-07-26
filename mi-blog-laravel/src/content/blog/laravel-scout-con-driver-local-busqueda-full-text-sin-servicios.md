---
title: 'Laravel Scout con Driver Local: Búsqueda Full-Text sin Servicios'
description: 'Aprende a implementar búsqueda full-text en Laravel Scout usando el driver de base de datos local sin Elasticsearch ni Meilisearch'
pubDate: '2026-07-20'
tags: ['laravel', 'search', 'scout', 'database', 'performance']
---

## Búsqueda Full-Text en Laravel Sin Servicios Externos

Laravel Scout es el estándar de facto para implementar búsqueda en aplicaciones Laravel, pero muchos desarrolladores asumen que necesitan servicios externos como Elasticsearch o Meilisearch. La realidad es que desde hace años Scout incluye un driver de base de datos nativo que funciona perfectamente para aplicaciones medianas y, con la optimización correcta, incluso en proyectos grandes.

En este artículo exploraremos cómo sacar el máximo provecho del driver local de Scout, implementar búsqueda full-text eficiente y evitar la complejidad innecesaria de servicios externos.

## ¿Por Qué Scout con Driver Local?

Antes de profundizar en la implementación, veamos los casos de uso ideales:

**Ventajas del driver local:**
- Sin infraestructura adicional que mantener
- Búsqueda inmediata sin sincronización
- Indexación automática en tiempo real
- Costos operativos mínimos
- Debugging directo en tu base de datos

**Limitaciones a considerar:**
- Rendimiento limitado con millones de registros
- Sin fuzzy search o relevancia avanzada nativa
- Mayor carga en la base de datos
- Sin soporte para sugerencias (autocomplete) optimizadas

Para aplicaciones con menos de 500,000 registros o búsquedas no críticas, el driver local de Scout es más que suficiente.

## Instalación y Configuración Básica

Comencemos instalando Scout si aún no lo tienes:

```bash
composer require laravel/scout
php artisan vendor:publish --provider="Laravel\Scout\ScoutServiceProvider"
```

El archivo `config/scout.php` se publica automáticamente. Por defecto, Scout viene configurado con el driver `null`, que debemos cambiar a `database`:

```php
// config/scout.php
return [
    'driver' => env('SCOUT_DRIVER', 'database'),
    
    'database' => [
        'mode' => 'BOOLEAN MODE',
    ],
    
    'chunk' => [
        'searchable' => 100,
        'unsearchable' => 500,
    ],
];
```

El parámetro `mode` en la configuración de base de datos define cómo MySQL busca: `BOOLEAN MODE` es más rápido y flexible que `NATURAL LANGUAGE MODE`.

## Preparar tu Modelo Eloquent

El siguiente paso es implementar la interfaz `Searchable` en el modelo que deseas indexar. Imaginemos un modelo de `Article`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Laravel\Scout\Searchable;

class Article extends Model
{
    use Searchable;

    protected $fillable = [
        'title',
        'slug',
        'content',
        'summary',
        'author_id',
        'published_at',
    ];

    /**
     * Obtén los índices que deben ser buscables.
     */
    public function toSearchableArray(): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'content' => $this->content,
            'summary' => $this->summary,
            'author_name' => $this->author->name ?? '',
        ];
    }

    public function author()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Personaliza el nombre del índice (tabla donde se almacena la búsqueda).
     */
    public function searchableAs(): string
    {
        return 'articles_index';
    }
}
```

El método `toSearchableArray()` es crucial: define exactamente qué campos se indexarán y en qué orden aparecerán en los resultados. Aquí incluimos el nombre del autor desnormalizado para búsquedas más rápidas.

## Crear la Tabla de Índices

Scout crea automáticamente una tabla de índices en tu base de datos. Para generarla, ejecuta:

```bash
php artisan scout:sync-index-settings
```

Si deseas ver la estructura creada, aquí está el esquema resultante:

```php
// Migración típica (Scout la genera internamente)
Schema::create('articles_index', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('articles_id');
    $table->fulltext(['title', 'slug', 'content', 'summary', 'author_name']);
    $table->timestamps();
    
    $table->foreign('articles_id')
        ->references('id')
        ->on('articles')
        ->onDelete('cascade');
});
```

## Indexar Datos Existentes

Si tu aplicación ya tiene registros, necesitas indexarlos:

```bash
php artisan scout:import "App\Models\Article"
```

Para modelos con muchos registros, personaliza el tamaño de lotes:

```bash
php artisan scout:import "App\Models\Article" --chunk=500
```

## Implementar Búsqueda Básica

Con Scout configurado, realizar búsquedas es trivial:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Article;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request)
    {
        $query = $request->input('q', '');

        if (strlen($query) < 2) {
            return response()->json(['results' => []]);
        }

        $results = Article::search($query)
            ->where('published_at', '!=', null)
            ->take(20)
            ->get();

        return response()->json([
            'results' => $results->map(fn($article) => [
                'id' => $article->id,
                'title' => $article->title,
                'slug' => $article->slug,
                'summary' => $article->summary,
            ]),
        ]);
    }
}
```

Y la ruta correspondiente:

```php
// routes/api.php
Route::get('/search', [SearchController::class, 'search'])->name('search');
```

## Búsqueda Avanzada con Filtros

En aplicaciones reales, necesitarás búsquedas más sofisticadas. Aquí combinamos Scout con Query Builder para máxima flexibilidad:

```php
public function advancedSearch(Request $request)
{
    $query = $request->input('q', '');
    $authorId = $request->input('author_id');
    $fromDate = $request->input('from_date');
    $toDate = $request->input('to_date');
    $sortBy = $request->input('sort_by', 'relevance');

    $results = Article::query()
        ->when($query, function ($q) use ($query) {
            // Scout integrado con Query Builder
            $q->whereFullText(['title', 'content', 'summary'], $query, ['mode' => 'boolean']);
        })
        ->when($authorId, function ($q) use ($authorId) {
            $q->where('author_id', $authorId);
        })
        ->when($fromDate, function ($q) use ($fromDate) {
            $q->whereDate('published_at', '>=', $fromDate);
        })
        ->when($toDate, function ($q) use ($toDate) {
            $q->whereDate('published_at', '<=', $toDate);
        })
        ->when($sortBy === 'newest', function ($q) {
            $q->orderByDesc('published_at');
        })
        ->when($sortBy === 'oldest', function ($q) {
            $q->orderBy('published_at');
        })
        ->paginate(15);

    return response()->json($results);
}
```

Este enfoque mantiene la flexibilidad de Eloquent mientras aprovecha la búsqueda full-text de MySQL.

## Optimización de Índices para Rendimiento

La clave del rendimiento está en índices bien configurados. Aquí hay una migración optimizada:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('articles_index', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('articles_id')->unique();
            
            // Índice full-text principal
            $table->fulltext(
                ['title', 'content', 'summary'],
                'idx_articles_fulltext'
            );
            
            // Índices para filtros comunes
            $table->index('published_at', 'idx_articles_published');
            
            $table->timestamps();
            
            $table->foreign('articles_id')
                ->references('id')
                ->on('articles')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('articles_index');
    }
};
```

**Nota importante:** Full-text en MySQL requiere un mínimo de 4 caracteres por defecto. Configúralo en `my.cnf` si necesitas búsquedas más cortas:

```ini
[mysqld]
innodb_ft_min_token_size=2
```

## Sincronización Automática en Tiempo Real

Scout sincroniza automáticamente cambios en el índice, pero puedes personalizarlo:

```php
<?php

namespace App\Models;

use Laravel\Scout\Searchable;

class Article extends Model
{
    use Searchable;

    protected static function booted(): void
    {
        // Sincronizar solo artículos publicados
        static::addGlobalScope('published', function ($query) {
            $query->where('published_at', '!=', null);
        });
    }

    /**
     * Determina si el modelo debe ser indexado.
     */
    public function shouldBeSearchable(): bool
    {
        return $this->published_at !== null && $this->status === 'active';
    }

    /**
     * Ejecutar lógica después de que el modelo sea indexado.
     */
    protected static function booting(): void
    {
        static::updated(function ($article) {
            // Reindexar cuando cambien campos críticos
            if ($article->isDirty(['title', 'content'])) {
                $article->searchable();
            }
        });
    }
}
```

## Implementar Autocomplete Eficiente

Para sugerencias mientras el usuario escribe, una tabla separada optimizada es superior:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArticleSearchSuggestion extends Model
{
    public $timestamps = false;
    protected $fillable = ['phrase', 'count'];

    // Obtén sugerencias ordenadas por popularidad
    public static function suggestions($prefix, $limit = 10)
    {
        return self::where('phrase', 'like', $prefix . '%')
            ->orderByDesc('count')
            ->limit($limit)
            ->pluck('phrase');
    }
}
```

Alimenta esta tabla con un job que analiza búsquedas reales:

```php
<?php

namespace App\Jobs;

use App\Models\ArticleSearchSuggestion;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;

class UpdateSearchSuggestions implements ShouldQueue
{
    use Queueable;

    public function handle()
    {
        // Obtén las 100 búsquedas más frecuentes
        $topSearches = \DB::table('search_logs')
            ->select('query', \DB::raw('COUNT(*) as count'))
            ->where('created_at', '>=', now()->subMonth())
            ->groupBy('query')
            ->orderByDesc('count')
            ->limit(100)
            ->get();

        foreach ($topSearches as $search) {
            ArticleSearchSuggestion::updateOrCreate(
                ['phrase' => $search->query],
                ['count' => $search->count]
            );
        }
    }
}
```

## Endpoint de Búsqueda para Frontend

Aquí está el controlador completo listo para producción:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Models\Article;
use App\Models\ArticleSearchSuggestion;
use Illuminate\Http\Request;

class SearchController
{
    public function search(Request $request)
    {
        $query = $request->string('q')->trim();

        if ($query->length() < 2) {
            return response()->json(['results' => [], 'total' => 0]);
        }

        $results = Article::whereFullText(
            ['title', 'content', 'summary'],
            (string) $query,
            ['mode' => 'boolean']
        )
            ->where('published_at', '!=', null)
            ->select('id', 'title', 'slug', 'summary', 'published_at')
            ->limit(20)
            ->get();

        // Registra la búsqueda para analítica
        \DB::table('search_logs')->insert([
            'query' => (string) $query,
            'results_count' => $results->count(),
            'created_at' => now(),
        ]);

        return response()->json([
            'results' => $results,
            'total' => $results->count(),
        ]);
    }

    public function suggestions(Request $request)
    {
        $prefix = $request->string('q')->trim();

        if ($prefix->length() < 2) {
            return response()->json(['suggestions' => []]);
        }

        $suggestions = ArticleSearchSuggestion::suggestions(
            (string) $prefix,
            10
        );

        return response()->json(['suggestions' => $suggestions]);
    }
}
```

## Monitoreo y Debugging

Para asegurar que tus índices funcionan correctamente:

```php
// En Tinker, verifica el estado de indexación
Article::count();                    // Registros en la tabla
Article::search('*')->count();       // Registros indexados

// Busca específica
Article::search('laravel')->get();

// Con Telescope, monitorea las queries SQL generadas
```

## Migración desde Servicios Externos

Si vienes de Elasticsearch o Meilisearch, la transición es simple:

```bash
# 1. Cambia el driver en .env
SCOUT_DRIVER=database

# 2. Limpia los índices viejos en el servicio
php artisan scout:flush "App\Models\Article"

# 3. Reindexar en la base de datos
php artisan scout:import "App\Models\Article"

# 4. Prueba exhaustivamente en staging
```

## Puntos clave

- Scout con driver `database` es adecuado para aplicaciones medianas sin infraestructura adicional
- El método `toSearchableArray()` controla exactamente qué se indexa y cómo
- Combina Scout con `whereFullText()` para búsqueda avanzada y filtros simultáneos
- Los índices full-text requieren configuración MySQL pero ofrecen rendimiento excelente
- Implementa tablas separadas para autocomplete basado en datos reales de búsqueda
- Monitorea la sincronización automática con `shouldBeSearchable()` para casos especiales
- La búsqueda local es mantenible, barata y suficientemente rápida para la mayoría de casos
- Registra búsquedas para analítica y mejora contin