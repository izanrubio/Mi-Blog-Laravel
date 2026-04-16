---
modulo: 3
leccion: 6
title: 'Query Builder vs Eloquent'
description: 'Compara el Query Builder y Eloquent de Laravel para saber cuándo usar cada herramienta y cómo sacar el máximo rendimiento a tus consultas.'
duracion: '20 min'
quiz:
  - pregunta: '¿Cuál es la principal ventaja del Query Builder sobre Eloquent en consultas con grandes volúmenes de datos?'
    opciones:
      - 'Query Builder soporta más tipos de bases de datos'
      - 'Query Builder tiene una sintaxis más sencilla'
      - 'Query Builder no instancia objetos Model, consumiendo menos memoria'
      - 'Query Builder genera SQL más seguro contra inyecciones'
    correcta: 2
    explicacion: 'El Query Builder devuelve objetos stdClass o arrays, no instancias de Model. Esto lo hace más eficiente en memoria para consultas que manejan miles de registros o que no necesitan los métodos del modelo.'
  - pregunta: '¿Qué método permite iterar grandes conjuntos de datos en Eloquent sin agotar la memoria?'
    opciones:
      - 'all()'
      - 'paginate()'
      - 'chunk()'
      - 'lazy()'
    correcta: 2
    explicacion: 'chunk() divide el resultado en lotes y procesa cada lote por separado. Esto evita cargar todos los registros en memoria a la vez, siendo esencial para procesar cientos de miles de registros.'
  - pregunta: '¿Qué método del Query Builder se usa para ejecutar una consulta SQL en bruto de forma segura?'
    opciones:
      - 'DB::query()'
      - 'DB::raw()'
      - 'DB::statement()'
      - 'DB::select()'
    correcta: 3
    explicacion: 'DB::select() ejecuta una consulta SELECT en bruto con parámetros enlazados (binding), protegiendo contra inyección SQL. DB::raw() solo construye una expresión cruda sin ejecutarla ni protegerla por sí misma.'
---

## Query Builder vs Eloquent en Laravel

Laravel ofrece dos formas de interactuar con la base de datos: el **Query Builder** (constructor de consultas) y **Eloquent ORM**. Ambos producen SQL seguro mediante prepared statements, pero tienen filosofías diferentes. Conocer cuándo usar cada uno marca la diferencia entre código eficiente y código que se cae bajo carga.

## ¿Qué es el Query Builder?

El Query Builder es una capa de abstracción sobre PDO que te permite construir consultas SQL con métodos PHP encadenados. No tiene concepto de modelos ni de relaciones orientadas a objetos. Devuelve colecciones de objetos `stdClass` o arrays simples.

```php
use Illuminate\Support\Facades\DB;

// Consulta básica con Query Builder
$posts = DB::table('posts')
    ->where('estado', 'publicado')
    ->orderBy('created_at', 'desc')
    ->get();

// $posts es una Collection de stdClass
foreach ($posts as $post) {
    echo $post->titulo; // propiedad de stdClass
}
```

## ¿Qué es Eloquent?

Eloquent es un ORM que mapea tablas de la base de datos a clases PHP (modelos). Cada fila se convierte en una instancia del modelo, con acceso a todos sus métodos, relaciones, accesors, mutators y eventos del ciclo de vida.

```php
use App\Models\Post;

// La misma consulta con Eloquent
$posts = Post::where('estado', 'publicado')
    ->orderBy('created_at', 'desc')
    ->get();

// $posts es una Collection de objetos Post
foreach ($posts as $post) {
    echo $post->titulo;          // propiedad del modelo
    echo $post->user->name;      // relación cargada
    echo $post->url_completa;    // accessor definido
}
```

## Comparación directa

### SELECT básico

```php
// Query Builder
$posts = DB::table('posts')
    ->select('id', 'titulo', 'slug')
    ->get();

// Eloquent
$posts = Post::select('id', 'titulo', 'slug')->get();
```

### WHERE con condiciones múltiples

```php
// Query Builder
$posts = DB::table('posts')
    ->where('estado', 'publicado')
    ->where('vistas', '>', 1000)
    ->orWhere('destacado', true)
    ->get();

// Eloquent
$posts = Post::where('estado', 'publicado')
    ->where('vistas', '>', 1000)
    ->orWhere('destacado', true)
    ->get();
```

La API de consultas es prácticamente idéntica. La diferencia está en el resultado y en las capacidades adicionales.

### JOIN

```php
// Query Builder — más explícito y controlado
$posts = DB::table('posts')
    ->join('users', 'users.id', '=', 'posts.user_id')
    ->join('categorias', 'categorias.id', '=', 'posts.categoria_id')
    ->select('posts.*', 'users.name as autor', 'categorias.nombre as categoria')
    ->where('posts.estado', 'publicado')
    ->orderBy('posts.created_at', 'desc')
    ->get();

// Eloquent — a través de relaciones (más legible)
$posts = Post::with(['user', 'categoria'])
    ->where('estado', 'publicado')
    ->latest()
    ->get();
```

### INSERT

```php
// Query Builder
DB::table('posts')->insert([
    'titulo'     => 'Nuevo post',
    'user_id'    => 1,
    'created_at' => now(),
    'updated_at' => now(),
]);

// Eloquent
Post::create([
    'titulo'  => 'Nuevo post',
    'user_id' => 1,
]);
// created_at y updated_at se manejan automáticamente
```

### UPDATE

```php
// Query Builder
DB::table('posts')
    ->where('id', 1)
    ->update(['titulo' => 'Título actualizado']);

// Eloquent
$post = Post::findOrFail(1);
$post->update(['titulo' => 'Título actualizado']);
```

### DELETE

```php
// Query Builder — elimina directamente
DB::table('posts')->where('id', 1)->delete();

// Eloquent — respeta SoftDeletes si está configurado
Post::findOrFail(1)->delete();
```

## Cuándo usar Query Builder

El Query Builder brilla en estos escenarios:

**1. Consultas complejas con múltiples JOINs y agregaciones:**

```php
$estadisticas = DB::table('posts')
    ->join('users', 'users.id', '=', 'posts.user_id')
    ->select(
        'users.name',
        DB::raw('COUNT(posts.id) as total_posts'),
        DB::raw('SUM(posts.vistas) as total_vistas'),
        DB::raw('AVG(posts.vistas) as media_vistas')
    )
    ->where('posts.estado', 'publicado')
    ->groupBy('users.id', 'users.name')
    ->having('total_posts', '>', 5)
    ->orderByDesc('total_vistas')
    ->get();
```

**2. Operaciones masivas sobre millones de filas:**

```php
// Actualizar sin instanciar modelos — mucho más rápido
DB::table('posts')
    ->where('created_at', '<', now()->subYear())
    ->update(['estado' => 'archivado']);
```

**3. Consultas en tablas sin modelo asociado:**

```php
$logs = DB::table('activity_log')
    ->where('user_id', $userId)
    ->orderByDesc('created_at')
    ->limit(50)
    ->get();
```

## Cuándo usar Eloquent

Eloquent es la opción correcta cuando:

**1. Necesitas acceder a relaciones:**

```php
$posts = Post::with(['user', 'tags', 'comentarios'])
    ->where('estado', 'publicado')
    ->get();
```

**2. El ciclo de vida del modelo importa (observers, eventos):**

```php
// Eloquent dispara eventos: creating, created, updating, updated, deleting, deleted
Post::create($datos); // dispara creating y created
```

**3. Usas accesors, mutators o casts:**

```php
$post = Post::find(1);
echo $post->titulo_mayusculas; // accessor
echo $post->publicado_en->diffForHumans(); // cast a Carbon
```

**4. Usas SoftDeletes:**

```php
$post->delete();             // soft delete (rellena deleted_at)
$post->restore();            // restaurar
Post::withTrashed()->get();  // incluye eliminados
```

## Procesamiento de grandes volúmenes

Para procesar miles de registros sin agotar la memoria, usa `chunk()` o `lazy()`:

```php
// chunk() — procesa en lotes (Query Builder o Eloquent)
DB::table('posts')->orderBy('id')->chunk(500, function ($posts) {
    foreach ($posts as $post) {
        // procesar cada post
    }
});

// Eloquent con chunk
Post::where('estado', 'publicado')->chunk(500, function ($posts) {
    foreach ($posts as $post) {
        $post->update(['vistas' => $post->vistas + 1]);
    }
});

// lazy() — cursor perezoso, más eficiente en memoria
foreach (Post::lazy() as $post) {
    // procesa uno a uno sin cargar todos en memoria
}
```

## SQL en bruto con bindings seguros

A veces necesitas SQL que el Query Builder no puede expresar. Usa bindings para evitar inyección SQL:

```php
// DB::select con bindings — SEGURO
$posts = DB::select(
    'SELECT * FROM posts WHERE estado = ? AND vistas > ?',
    ['publicado', 1000]
);

// Con parámetros nombrados — más legible
$posts = DB::select(
    'SELECT * FROM posts WHERE estado = :estado AND vistas > :vistas',
    ['estado' => 'publicado', 'vistas' => 1000]
);

// DB::raw SOLO para partes de la consulta (columnas, expresiones)
$posts = Post::select(DB::raw('titulo, CHAR_LENGTH(contenido) as longitud'))
    ->orderBy('longitud', 'desc')
    ->get();
```

Nunca concatenes variables directamente en cadenas SQL. Siempre usa bindings.

## Resumen: qué elegir

| Situación | Herramienta |
|---|---|
| CRUD básico de un modelo | Eloquent |
| Relaciones entre modelos | Eloquent |
| Eventos del ciclo de vida | Eloquent |
| SoftDeletes | Eloquent |
| Consultas analíticas complejas | Query Builder |
| JOINs con muchas tablas | Query Builder |
| Operaciones masivas de actualización | Query Builder |
| Tablas sin modelo Eloquent | Query Builder |
| Millones de registros con poca lógica | Query Builder |

En la práctica, los dos se complementan. Puedes usar Eloquent para la mayoría de operaciones CRUD y Query Builder para los reportes y operaciones de alto rendimiento. No existe una regla que obligue a elegir uno solo por proyecto.
