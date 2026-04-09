---
title: 'Eloquent vs Query Builder en Laravel — Cuándo usar cada uno'
description: 'Compara Eloquent ORM y Query Builder en Laravel: rendimiento, facilidad de uso, casos de uso y cuándo es mejor usar cada uno con ejemplos prácticos.'
pubDate: '2024-03-15'
tags: ['laravel', 'eloquent', 'query-builder', 'base-de-datos']
---

Esta es una pregunta que surge constantemente en proyectos Laravel: ¿uso Eloquent o el Query Builder? La respuesta, como casi siempre en desarrollo de software, es "depende". Pero vamos a ver exactamente de qué depende y con qué criterios tomar la decisión.

## ¿Qué es cada uno?

### Eloquent ORM

Eloquent es el ORM (Object-Relational Mapper) de Laravel. Representa cada tabla de la base de datos como un modelo PHP. Cuando consultas con Eloquent, obtienes objetos con métodos, eventos, relaciones y más:

```php
// Eloquent: trabajas con objetos Model
$posts = Post::where('published', true)
             ->with('user', 'tags')
             ->orderByDesc('created_at')
             ->paginate(15);

foreach ($posts as $post) {
    echo $post->user->name;  // Relación cargada automáticamente
    echo $post->created_at->diffForHumans();  // Carbon object
}
```

### Query Builder

El Query Builder es una capa por encima de PDO que te permite construir queries SQL de forma fluida sin escribir SQL crudo:

```php
// Query Builder: trabajas con colecciones de stdClass o arrays
$posts = DB::table('posts')
           ->where('published', 1)
           ->join('users', 'posts.user_id', '=', 'users.id')
           ->select('posts.*', 'users.name as author_name')
           ->orderByDesc('posts.created_at')
           ->paginate(15);

foreach ($posts as $post) {
    echo $post->author_name;  // stdClass property
    echo $post->created_at;   // String, no Carbon
}
```

## Las diferencias clave

### 1. Lo que devuelven

```php
// Eloquent devuelve instancias del Model
$user = User::find(1);
// $user es una instancia de App\Models\User
// Tiene: $user->posts(), $user->isAdmin(), $user->getFullNameAttribute(), etc.

// Query Builder devuelve stdClass o arrays
$user = DB::table('users')->find(1);
// $user es stdClass
// Solo tiene las columnas de la tabla, nada más
```

### 2. Relaciones y eager loading

Eloquent tiene un sistema de relaciones sofisticado:

```php
// Eloquent: relaciones definidas en el modelo
class Post extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
    
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }
}

// Eager loading para evitar N+1
$posts = Post::with(['user:id,name', 'tags'])->get();
```

Con Query Builder, debes hacer los JOINs manualmente:

```php
// Query Builder: JOINs explícitos
$posts = DB::table('posts')
           ->join('users', 'posts.user_id', '=', 'users.id')
           ->leftJoin('post_tag', 'posts.id', '=', 'post_tag.post_id')
           ->leftJoin('tags', 'post_tag.tag_id', '=', 'tags.id')
           ->select('posts.*', 'users.name', 'tags.name as tag_name')
           ->get();
// Obtienes los datos desnormalizados: un post por cada tag
```

### 3. Mutadores, accesores y casting

```php
// Eloquent: casting automático y accesores
class User extends Model
{
    protected $casts = [
        'email_verified_at' => 'datetime',
        'settings'          => 'array',     // JSON → array automáticamente
        'is_admin'          => 'boolean',
    ];

    // Accesores
    public function getFullNameAttribute(): string
    {
        return "{$this->first_name} {$this->last_name}";
    }
}

$user = User::find(1);
echo $user->full_name;      // Usa el accesor
echo $user->settings['theme'];  // Array, no string JSON
echo $user->created_at->format('d/m/Y');  // Carbon object
```

Con Query Builder, recibes los valores exactos de la BD: JSON como string, fechas como string, booleanos como 0/1.

### 4. Eventos y observers

Eloquent tiene un sistema de eventos que se disparan automáticamente:

```php
// Se dispara cuando creas un usuario con Eloquent
class UserObserver
{
    public function created(User $user): void
    {
        // Enviar email de bienvenida
        Mail::to($user)->send(new WelcomeMail($user));
    }
}

User::create(['email' => '...']); // Dispara el evento 'created'

// Query Builder BYPASEA todos los eventos:
DB::table('users')->insert([...]); // NO dispara eventos, NO usa Observers
```

Esto es muy importante saberlo: si usas `DB::table()` para insertar, los observers de Eloquent no se ejecutarán.

## Rendimiento: ¿cuánto importa?

La pregunta más común es "¿no es Eloquent más lento?". Técnicamente sí, hay overhead. Pero en la práctica:

```php
// Para consultas normales (decenas o cientos de registros):
// La diferencia es imperceptible para el usuario

// Para reportes con millones de registros:
// El Query Builder puede ser 2-5x más rápido

// Ejemplo: generar un CSV de 1 millón de registros
// Eloquent: puede agotar la memoria y tardar minutos
// Query Builder: mucho más eficiente
$users = DB::table('users')
           ->select('id', 'name', 'email')
           ->orderBy('id')
           ->cursor(); // Generator, muy eficiente en memoria

foreach ($users as $user) {
    fputcsv($file, [$user->id, $user->name, $user->email]);
}
```

## El método toSql() para debugging

Muy útil para ver qué SQL genera tu query:

```php
// Ver el SQL de Eloquent
$sql = Post::where('published', true)
           ->with('user')
           ->toSql();
// SELECT * FROM `posts` WHERE `published` = ?

// Ver el SQL con los bindings reales
$query = Post::where('published', true)->where('user_id', 5);
dump($query->toSql());
dump($query->getBindings());

// Alternativa: log de todas las queries
DB::listen(function ($query) {
    Log::debug($query->sql, $query->bindings);
});
```

## Cuándo usar cada uno

### Usa Eloquent cuando:

```php
// Trabajas con lógica de negocio compleja
// Necesitas relaciones (belongsTo, hasMany, etc.)
// Tienes eventos/observers que deben ejecutarse
// Necesitas casting de tipos (JSON, fechas, etc.)
// Construyes funcionalidades CRUD estándar

$order = Order::create([
    'user_id' => $user->id,
    'total'   => $cart->total(),
    'status'  => 'pending',
]);
// Dispara el evento 'created', ejecuta observers,
// hace casting automático de 'total' a float
```

### Usa Query Builder cuando:

```php
// Reportes con grandes volúmenes de datos
// Queries complejas con múltiples JOINs y agregaciones
// Operaciones masivas (bulk insert, bulk update)
// Necesitas máximo rendimiento en un proceso batch

// Reporte de ventas por categoría (query compleja)
$report = DB::table('orders')
            ->join('order_items', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->join('categories', 'products.category_id', '=', 'categories.id')
            ->whereBetween('orders.created_at', [$startDate, $endDate])
            ->where('orders.status', 'completed')
            ->groupBy('categories.id', 'categories.name')
            ->select(
                'categories.name',
                DB::raw('COUNT(DISTINCT orders.id) as total_orders'),
                DB::raw('SUM(order_items.quantity) as total_units'),
                DB::raw('SUM(order_items.price * order_items.quantity) as revenue')
            )
            ->orderByDesc('revenue')
            ->get();
```

### Bulk operations

```php
// Bulk insert con Query Builder (mucho más rápido que Eloquent)
$data = array_map(fn($i) => [
    'name'       => "Product {$i}",
    'price'      => rand(10, 100),
    'created_at' => now(),
    'updated_at' => now(),
], range(1, 10000));

// Eloquent: 10,000 inserts individuales (lento, dispara eventos x10,000)
// foreach ($data as $item) Product::create($item); // NO hagas esto

// Query Builder: una sola query SQL con muchos valores (rápido)
DB::table('products')->insert($data);

// O en chunks para no sobrecargar
foreach (array_chunk($data, 500) as $chunk) {
    DB::table('products')->insert($chunk);
}
```

## Se pueden combinar

Eloquent y Query Builder no son mutuamente excluyentes. Puedes usar Eloquent para consultas normales y el Query Builder para operaciones específicas:

```php
// Eloquent para operaciones normales
$user = User::findOrFail($id);
$user->posts()->create(['title' => 'Nuevo post']);

// Query Builder para una operación masiva en el mismo request
DB::table('analytics_events')
   ->where('session_id', session()->getId())
   ->update(['user_id' => $user->id]);
```

## Conclusión

Usa Eloquent como tu herramienta principal para el 90% de las operaciones. Es más expresivo, integra con el ecosistema Laravel (eventos, observers, casting) y hace tu código más legible. Cambia al Query Builder cuando necesites rendimiento en operaciones masivas o cuando construyas queries analíticas complejas con muchos JOINs y agregaciones. No es una elección de uno u otro para toda la aplicación, sino la herramienta correcta para cada contexto.
