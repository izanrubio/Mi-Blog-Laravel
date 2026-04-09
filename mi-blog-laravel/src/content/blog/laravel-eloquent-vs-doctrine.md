---
title: 'Eloquent ORM vs Doctrine — Comparativa para desarrolladores Laravel'
description: 'Compara Eloquent ORM de Laravel con Doctrine: Active Record vs Data Mapper, rendimiento, flexibilidad y por qué Eloquent es la elección natural en Laravel.'
pubDate: '2024-04-08'
tags: ['laravel', 'eloquent', 'doctrine', 'orm', 'comparativa']
---

Si vienes de Symfony o de un background de desarrollo enterprise, puede que te preguntes si deberías usar Doctrine en Laravel en lugar de Eloquent. O simplemente quieres entender cuáles son las diferencias filosóficas entre los dos ORMs más populares en PHP. Vamos a analizarlos de forma honesta.

## Dos filosofías diferentes

La diferencia fundamental es el patrón de diseño que implementa cada uno:

- **Eloquent:** Active Record
- **Doctrine:** Data Mapper

Esta diferencia filosófica impacta todo: cómo defines modelos, cómo haces queries, cómo persistes datos y cómo testeas.

## Active Record: el patrón de Eloquent

En Active Record, el modelo es responsable de sí mismo. Sabe cómo guardarse, cómo encontrarse, cómo eliminarse. La tabla y el objeto son prácticamente lo mismo.

```php
// Un modelo Eloquent
class Post extends Model
{
    protected $fillable = ['title', 'content', 'user_id', 'status'];
    
    protected $casts = [
        'published_at' => 'datetime',
    ];
    
    // Relaciones
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
    
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }
    
    // Scopes de query
    public function scopePublished(Builder $query): Builder
    {
        return $query->where('status', 'published');
    }
}

// Uso: el modelo se persiste a sí mismo
$post = new Post();
$post->title   = 'Mi artículo';
$post->content = 'Contenido del artículo';
$post->user_id = $user->id;
$post->save(); // ← El objeto se guarda a sí mismo

// O forma más concisa
$post = Post::create([
    'title'   => 'Mi artículo',
    'content' => 'Contenido',
    'user_id' => $user->id,
]);

// Buscar y actualizar
$post = Post::findOrFail(1);
$post->update(['title' => 'Título actualizado']);

// Eliminar
$post->delete();
```

Todo es muy intuitivo y directo. El modelo hace todo.

## Data Mapper: el patrón de Doctrine

En Data Mapper, el objeto de dominio (la entidad) no sabe nada sobre la base de datos. Es un objeto PHP puro. Un objeto separado (el EntityManager) se encarga de mapear entre el objeto y la BD.

```php
// Una entidad de Doctrine
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity]
#[ORM\Table(name: 'posts')]
class Post
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private int $id;

    #[ORM\Column(length: 255)]
    private string $title;

    #[ORM\Column(type: 'text')]
    private string $content;

    #[ORM\ManyToOne(targetEntity: User::class)]
    private User $user;

    // Getters y setters explícitos
    public function getTitle(): string
    {
        return $this->title;
    }

    public function setTitle(string $title): void
    {
        $this->title = $title;
    }
    
    // La entidad NO tiene métodos save(), find(), etc.
}

// Uso con EntityManager (el que habla con la BD)
$post        = new Post();
$post->setTitle('Mi artículo');
$post->setContent('Contenido');
$post->setUser($user);

// El EntityManager persiste la entidad
$entityManager->persist($post);
$entityManager->flush(); // ← Aquí se ejecutan los SQL

// Buscar
$post = $entityManager->find(Post::class, 1);

// Actualizar
$post->setTitle('Título actualizado');
$entityManager->flush(); // Doctrine detecta el cambio (Unit of Work)

// Eliminar
$entityManager->remove($post);
$entityManager->flush();
```

La entidad es un objeto PHP puro. El EntityManager hace todo el trabajo sucio.

## Las ventajas de Eloquent

### 1. Integración perfecta con el ecosistema Laravel

```php
// Events y Observers
class PostObserver
{
    public function created(Post $post): void { /* ... */ }
    public function updated(Post $post): void { /* ... */ }
}

// Casts automáticos
protected $casts = [
    'settings' => 'array',        // JSON ↔ array
    'price'    => 'decimal:2',    // String ↔ float
    'status'   => PostStatus::class, // String ↔ Enum
];

// Accessors y Mutators con PHP 8.0+
protected function title(): Attribute
{
    return Attribute::make(
        get: fn($value) => ucfirst($value),
        set: fn($value) => strtolower($value),
    );
}

// API Resources, Form Requests, Factories... todo está diseñado para Eloquent
$users = User::factory()->count(10)->create();
return UserResource::collection($users);
```

### 2. Sintaxis fluida y expresiva

```php
// Eloquent: legible y conciso
$posts = Post::published()
             ->with(['user:id,name', 'tags'])
             ->where('created_at', '>=', now()->subMonths(3))
             ->orderByDesc('published_at')
             ->paginate(15);
```

### 3. Curva de aprendizaje mucho menor

Con Eloquent estás productivo en días. Con Doctrine, necesitas entender el Unit of Work, el EntityManager, las relaciones bidireccionales con `inversedBy` y `mappedBy`, las entidades detached, etc.

## Las ventajas de Doctrine

### 1. Entidades más "limpias" (DDD puro)

```php
// La entidad Post no sabe nada de BD
// Puede testarse sin base de datos
class Post
{
    private PostStatus $status = PostStatus::Draft;
    private array $tags = [];
    
    public function publish(): void
    {
        if ($this->status !== PostStatus::Draft) {
            throw new \DomainException('Solo se pueden publicar borradores');
        }
        $this->status = PostStatus::Published;
        $this->publishedAt = new \DateTimeImmutable();
    }
    
    public function addTag(Tag $tag): void
    {
        if (count($this->tags) >= 5) {
            throw new \DomainException('Máximo 5 tags por post');
        }
        $this->tags[] = $tag;
    }
}
```

Esta entidad puede testearse sin tocar la base de datos.

### 2. Unit of Work: menos queries implícitas

Doctrine rastrea todos los cambios y los ejecuta todos de golpe con `flush()`. Esto puede ser más eficiente en operaciones complejas.

### 3. Mejor para DDD estricto

Si tu equipo practica Domain-Driven Design de forma estricta, Doctrine encaja mejor porque las entidades son objetos de dominio puros sin acoplamiento a la infraestructura.

## Por qué Doctrine en proyectos Laravel es raramente la respuesta correcta

Usar Doctrine en Laravel significa:

```bash
# Instalar un paquete de terceros
composer require laravel-doctrine/orm

# Configuración adicional compleja
# Las factories de Laravel no funcionan con entidades Doctrine
# Los seeders necesitan usar el EntityManager
# Telescopio, Horizon, etc. asumen Eloquent
# Los paquetes de comunidad (Cashier, Jetstream, Breeze) asumen Eloquent
# Route Model Binding funciona diferente
```

Estás nadando contra la corriente del framework. Cada paquete del ecosistema, cada tutorial, cada documentación asume que usas Eloquent. El costo de mantenimiento es alto.

## Cuándo considerarlo seriamente

La única razón válida para usar Doctrine en Laravel sería:

1. Tienes un equipo de 10+ devs con background Symfony/enterprise
2. Tu dominio es extremadamente complejo con reglas de negocio ricas
3. El equipo ya conoce profundamente Doctrine y el costo de usar Eloquent sería mayor

Incluso en ese caso, la mayoría de los equipos prefieren aprender las abstracciones de Eloquent en lugar de pelear con la integración de Doctrine.

## Conclusión

Eloquent es el ORM de Laravel por una razón: está diseñado para trabajar con el framework de forma cohesiva. Sus ventajas (sintaxis expresiva, integración perfecta con el ecosistema, curva de aprendizaje baja) superan sus limitaciones filosóficas para el 99% de los proyectos. Doctrine es excelente en Symfony donde está diseñado para convivir. En Laravel, es un barco de concreto: técnicamente puede flotar, pero no es lo que quieres.
