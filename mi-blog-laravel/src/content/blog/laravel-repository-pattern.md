---
title: 'Repository Pattern en Laravel — ¿Vale la pena usarlo?'
description: 'Análisis honesto del Repository Pattern en Laravel: cuándo tiene sentido usarlo, cómo implementarlo correctamente y cuándo Eloquent directo es suficiente.'
pubDate: '2026-04-09'
tags: ['laravel', 'repositorios', 'patrones', 'arquitectura']
---

El Repository Pattern es uno de los temas más debatidos en la comunidad Laravel. Hay desarrolladores que lo usan en todos sus proyectos y otros que lo consideran una sobre-ingeniería innecesaria. Vamos a analizar ambos lados de forma honesta y ayudarte a decidir cuándo usarlo.

## ¿Qué es el Repository Pattern?

El patrón repositorio es una capa de abstracción entre tu lógica de negocio y el acceso a datos. En vez de que tus controladores o servicios llamen directamente a `Post::where(...)`, llaman a `$postRepository->findPublished()`.

La idea original viene del libro Domain-Driven Design de Eric Evans y tiene sentido en aplicaciones donde el dominio es complejo y el acceso a datos puede venir de múltiples fuentes.

## Implementación clásica en Laravel

Así es cómo normalmente se implementa:

```php
// app/Contracts/PostRepositoryInterface.php
<?php

namespace App\Contracts;

use App\Models\Post;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

interface PostRepositoryInterface
{
    public function findById(int $id): ?Post;
    public function findPublished(int $perPage = 15): LengthAwarePaginator;
    public function findByUser(int $userId): Collection;
    public function create(array $data): Post;
    public function update(Post $post, array $data): Post;
    public function delete(Post $post): bool;
}
```

```php
// app/Repositories/EloquentPostRepository.php
<?php

namespace App\Repositories;

use App\Contracts\PostRepositoryInterface;
use App\Models\Post;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

class EloquentPostRepository implements PostRepositoryInterface
{
    public function findById(int $id): ?Post
    {
        return Post::with(['user', 'tags'])->find($id);
    }

    public function findPublished(int $perPage = 15): LengthAwarePaginator
    {
        return Post::with(['user', 'tags'])
                   ->where('status', 'published')
                   ->where('published_at', '<=', now())
                   ->orderByDesc('published_at')
                   ->paginate($perPage);
    }

    public function findByUser(int $userId): Collection
    {
        return Post::where('user_id', $userId)
                   ->orderByDesc('created_at')
                   ->get();
    }

    public function create(array $data): Post
    {
        return Post::create($data);
    }

    public function update(Post $post, array $data): Post
    {
        $post->update($data);
        return $post->fresh();
    }

    public function delete(Post $post): bool
    {
        return $post->delete();
    }
}
```

```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    $this->app->bind(
        PostRepositoryInterface::class,
        EloquentPostRepository::class
    );
}
```

```php
// Uso en el controlador
class PostController extends Controller
{
    public function __construct(
        private PostRepositoryInterface $postRepo
    ) {}

    public function index()
    {
        $posts = $this->postRepo->findPublished();
        return view('posts.index', compact('posts'));
    }
}
```

## El argumento honesto en contra

Aquí está el argumento que muchos autores de Laravel (incluyendo Jeffrey Way y Adam Wathan) han hecho públicamente: **Eloquent ya es un repositorio**.

El patrón Repository nace en contextos donde el ORM es más simple o donde el acceso a datos debe abstraerse completamente. Pero Eloquent ya implementa los patrones Active Record y Query Builder con una API muy rica. Cuando creas un `EloquentPostRepository`, básicamente estás envolviendo Eloquent en otra capa de Eloquent.

```php
// Esta implementación "simple" del repositorio...
public function findPublished(): LengthAwarePaginator
{
    return Post::published()->paginate(15);
}

// ...es equivalente a usar Eloquent directamente con un scope:
// Post::published()->paginate(15);
```

Si tu repositorio termina siendo un thin wrapper alrededor de Eloquent, no estás ganando nada, solo añadiendo complejidad.

## El argumento honesto a favor: testabilidad

El argumento más válido para el repositorio es la **testabilidad**. Cuando tu controlador depende de `PostRepositoryInterface`, puedes mockear el repositorio en los tests sin necesidad de base de datos:

```php
// Test con repositorio mockeado (sin DB)
public function test_index_shows_published_posts()
{
    $posts = Post::factory()->count(5)->make();
    
    $mockRepo = Mockery::mock(PostRepositoryInterface::class);
    $mockRepo->shouldReceive('findPublished')
             ->once()
             ->andReturn(new LengthAwarePaginator($posts, 5, 15));
    
    $this->app->instance(PostRepositoryInterface::class, $mockRepo);
    
    $response = $this->get('/posts');
    $response->assertStatus(200);
}
```

Sin embargo, Laravel tiene `RefreshDatabase` y tests de integración que trabajan con una base de datos real (SQLite en memoria) que son rápidos y más confiables que los mocks. Así que incluso este argumento está debilitado.

## Cuándo SÍ tiene sentido usarlo

Hay escenarios donde el repositorio es genuinamente útil:

### Múltiples fuentes de datos

```php
interface ProductRepository
{
    public function findById(int $id): ?Product;
}

// Implementación que busca en BD local primero, luego en API externa
class HybridProductRepository implements ProductRepository
{
    public function findById(int $id): ?Product
    {
        // Primero busca en caché/BD local
        $product = Product::find($id);
        
        if ($product) {
            return $product;
        }
        
        // Si no existe, busca en el ERP externo
        $erpData = $this->erpApi->getProduct($id);
        
        if ($erpData) {
            return Product::create($erpData);
        }
        
        return null;
    }
}
```

### Queries muy complejas que necesitan ser testeadas aisladamente

```php
class ReportRepository
{
    public function getMonthlyRevenueBySku(
        \Carbon\Carbon $startDate,
        \Carbon\Carbon $endDate,
        string $region
    ): Collection {
        return DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->where('orders.region', $region)
            ->where('orders.status', 'completed')
            ->groupBy('products.sku', 'products.name')
            ->select(
                'products.sku',
                'products.name',
                DB::raw('SUM(order_items.quantity) as units_sold'),
                DB::raw('SUM(order_items.quantity * order_items.price) as revenue')
            )
            ->orderByDesc('revenue')
            ->get();
    }
}
```

Esta es una query lo suficientemente compleja como para justificar su propio lugar y sus propios tests.

## El medio pragmático: Eloquent con Query Scopes

La alternativa más común en proyectos Laravel reales es usar Eloquent directamente con Query Scopes para lógica reutilizable:

```php
// app/Models/Post.php
class Post extends Model
{
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published')
                     ->where('published_at', '<=', now());
    }
    
    public function scopeForUser(Builder $query, int $userId): Builder
    {
        return $query->where('user_id', $userId);
    }
    
    public function scopeWithAuthor(Builder $query): Builder
    {
        return $query->with(['user:id,name,avatar']);
    }
}

// Uso en el controlador o service:
$posts = Post::published()->withAuthor()->paginate(15);
$userPosts = Post::forUser($userId)->orderByDesc('created_at')->get();
```

Los Query Scopes dan la reutilización sin la complejidad de las interfaces y las clases de repositorio.

## Conclusión

El Repository Pattern en Laravel es una herramienta, no una ley. Tiene sentido cuando tienes múltiples fuentes de datos, queries de reportes muy complejas que quieres testear aisladamente, o cuando tu equipo tiene background DDD y lo usa de forma consistente. No tiene sentido como un thin wrapper alrededor de Eloquent que solo añade boilerplate sin valor real. Para el 80% de las aplicaciones Laravel, Eloquent con Query Scopes bien definidos es suficiente y más mantenible.
