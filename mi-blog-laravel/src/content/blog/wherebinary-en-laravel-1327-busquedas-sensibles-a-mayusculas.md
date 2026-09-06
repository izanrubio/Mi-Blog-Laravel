---
title: 'whereBinary() en Laravel 13.27: Búsquedas Sensibles a Mayúsculas'
description: 'Domina whereBinary() en Laravel 13.27 para búsquedas case-sensitive. Guía completa con ejemplos reales en MySQL y PostgreSQL.'
pubDate: '2026-01-28'
tags: ['laravel', 'eloquent', 'base-de-datos', 'laravel-13']
---

# whereBinary() en Laravel 13.27: Búsquedas Sensibles a Mayúsculas

Laravel 13.27 introduce una herramienta poderosa pero frecuentemente subestimada: el método `whereBinary()`. Este método resuelve un problema común en aplicaciones reales: **realizar búsquedas case-sensitive en bases de datos que por defecto ignoran mayúsculas**.

Si alguna vez necesitaste buscar un usuario llamado "Admin" y no querías que coincidiera con "admin", estabas ante el problema exacto que `whereBinary()` soluciona elegantemente.

## El Problema: Búsquedas No Sensibles a Mayúsculas

Por defecto, las bases de datos como MySQL y PostgreSQL **ignoran las mayúsculas** en comparaciones de strings. Esto tiene sentido en muchos casos (búsquedas de email, nombres de usuario), pero hay escenarios donde necesitas exactitud total.

### Ejemplo del Problema

Imagina una tabla de códigos de acceso donde diferenciamos entre `SKU-ABC` y `sku-abc`. Con un `where()` normal:

```php
$products = Product::where('sku', 'SKU-ABC')->get();
// ❌ Devuelve tanto 'SKU-ABC' como 'sku-abc'
```

Ambos registros coincidirían porque MySQL trata `SKU-ABC` y `sku-abc` como equivalentes. En un sistema de gestión de inventario, esto puede causar problemas graves.

## La Solución: whereBinary()

El nuevo método `whereBinary()` fuerza a la base de datos a hacer comparaciones **byte a byte**, respetando mayúsculas y minúsculas:

```php
$products = Product::whereBinary('sku', 'SKU-ABC')->get();
// ✅ Solo devuelve registros con exactamente 'SKU-ABC'
```

### Sintaxis Básica

```php
whereBinary($column, $operator, $value, $boolean = 'and')
```

Es prácticamente idéntico a `where()`, pero con comparación sensible a mayúsculas:

```php
// Búsqueda exacta
User::whereBinary('username', 'admin')->first();

// Con operadores
Product::whereBinary('code', '!=', 'ACTIVE')->get();

// Con LIKE
Document::whereBinary('title', 'like', 'Laravel%')->get();
```

## Casos de Uso Reales

### 1. Códigos y Identificadores Únicos

En sistemas que tratan `ID-001` y `id-001` como valores diferentes:

```php
// Sistema de tickets
$ticket = Ticket::whereBinary('code', 'TICKET-2024-12345')->first();

if (!$ticket) {
    return response()->json(['error' => 'Ticket no encontrado'], 404);
}
```

### 2. Validación de Credenciales Sensibles

Algunos sistemas de autenticación requieren case-sensitive en ciertos campos:

```php
// En un AuthController
$user = User::whereBinary('api_key', request('key'))->first();

if (!$user) {
    return response()->json(['error' => 'API key inválida'], 401);
}
```

### 3. Búsquedas en Lenguajes con Caracteres Especiales

Idiomas como el turco donde `I` y `ı` son diferentes:

```php
// Búsqueda de nombres turcos
$users = User::whereBinary('name', 'İstanbul')->get();
// ✅ No coincidirá con 'istanbul'
```

### 4. Validación de Configuración

En aplicaciones con valores de configuración sensibles:

```php
$settings = Settings::whereBinary('env', 'PRODUCTION')
    ->where('active', true)
    ->first();

if ($settings->env !== 'PRODUCTION') {
    Log::warning('Entorno no es producción, abortando operación crítica');
    abort(403);
}
```

## Diferencias Entre where() y whereBinary()

| Método | Sensible a Mayúsculas | Base Datos | Uso |
|--------|----------------------|-----------|-----|
| `where()` | ❌ No | Depende del collation | Búsquedas generales |
| `whereBinary()` | ✅ Sí | Siempre | Comparaciones exactas |

### Ejemplo Comparativo

```php
// Tabla users con valores: 'Admin', 'admin', 'ADMIN'

User::where('role', 'admin')->count();
// Resultado: 3 (todas las variantes)

User::whereBinary('role', 'admin')->count();
// Resultado: 1 (solo 'admin')

User::whereBinary('role', 'Admin')->count();
// Resultado: 1 (solo 'Admin')
```

## Combinando whereBinary() con Otros Métodos

El método funciona perfectamente dentro de consultas complejas:

```php
$users = User::where('active', true)
    ->whereBinary('username', 'like', 'Admin%')
    ->orWhereBinary('email', 'admin@example.com')
    ->orderBy('created_at', 'desc')
    ->paginate(15);
```

### Con Collections y Filtros

```php
$admins = User::all()
    ->filter(function ($user) {
        // whereBinary es para la BD, para collections usamos ==
        return $user->role === 'Admin';
    });

// Mejor: hacerlo en la BD
$admins = User::whereBinary('role', 'Admin')->get();
```

## Consideraciones de Rendimiento

`whereBinary()` es eficiente, pero tiene un costo ligeramente mayor que `where()` porque la base de datos debe hacer comparaciones byte a byte.

### Indexación Correcta

Si usas `whereBinary()` frecuentemente en una columna, asegúrate de que esté indexada:

```php
// En una migración
Schema::table('users', function (Blueprint $table) {
    $table->index('username');
    // O con collation específica para comparaciones binarias
});
```

### Ejemplo de Migración

```php
Schema::create('api_keys', function (Blueprint $table) {
    $table->id();
    $table->string('key')->index();
    // key se indexará normalmente, pero whereBinary()
    // seguirá funcionando
    $table->timestamps();
});
```

## Alternativas Anteriores a Laravel 13.27

Antes de `whereBinary()`, los desarrolladores usaban workarounds:

```php
// ❌ Antiguo: Usar expresiones raw
User::whereRaw('BINARY username = ?', ['admin'])->first();

// ❌ Antiguo: Usar collation específica
User::where('username', '=', DB::raw("COLLATE utf8mb4_bin 'admin'"))
    ->first();

// ✅ Nuevo en 13.27
User::whereBinary('username', 'admin')->first();
```

## whereBinary() en Diferentes Bases de Datos

### MySQL

```php
// whereBinary() traduce a COLLATE utf8mb4_bin en MySQL
User::whereBinary('email', 'Admin@Example.com')->first();
// SELECT * FROM users WHERE BINARY email = 'Admin@Example.com'
```

### PostgreSQL

```php
// En PostgreSQL usa ~ (match exacto)
User::whereBinary('email', 'Admin@Example.com')->first();
// Comparación sensible a mayúsculas nativa
```

## Validación con whereBinary()

Un patrón común es validar datos sensibles a mayúsculas:

```php
class ApiKeyController extends Controller
{
    public function validate(Request $request)
    {
        $validated = $request->validate([
            'api_key' => 'required|string|min:32',
        ]);

        $key = ApiKey::whereBinary('key', $validated['api_key'])
            ->where('active', true)
            ->first();

        if (!$key) {
            throw ValidationException::withMessages([
                'api_key' => 'API key inválida o no activa',
            ]);
        }

        return response()->json(['valid' => true]);
    }
}
```

## Debugging de whereBinary()

Para ver las queries generadas:

```php
User::whereBinary('username', 'admin')->toSql();
// MySQL: SELECT * FROM users WHERE BINARY username = ?

User::whereBinary('username', 'admin')->getBindings();
// ['admin']
```

Con Telescope:

```php
// Laravel Telescope capturará automáticamente
// las queries con whereBinary()
User::whereBinary('username', 'admin')->get();
// Visible en http://localhost/telescope
```

## Combinación con whereIn()

Para múltiples valores exactos:

```php
// ❌ No exacto
User::whereIn('status', ['Active', 'active'])->get();

// ✅ Exacto (necesitas hacer múltiples whereBinary)
$users = User::where(function ($query) {
    $query->whereBinary('status', 'Active')
        ->orWhereBinary('status', 'ACTIVE');
})->get();

// O más elegante con Collection::whereIn()
$statuses = ['Active', 'ACTIVE'];
$users = User::whereBinary('status', $statuses[0])
    ->orWhereBinary('status', $statuses[1])
    ->get();
```

## Puntos Clave

- **whereBinary()** realiza comparaciones case-sensitive en la base de datos
- Soluciona problemas donde mayúsculas y minúsculas importan (códigos, IDs, credenciales)
- Funciona con operadores: `=`, `!=`, `like`, `not like`, etc.
- Sintaxis idéntica a `where()`: `whereBinary($column, $operator, $value)`
- Compatible con MySQL, PostgreSQL y otras BD con soporte COLLATE binaria
- Rendimiento similar a `where()`, pero con costo ligeramente mayor
- Úsalo en: códigos de acceso, API keys, lenguajes con caracteres especiales, valores de configuración
- Combina con otros métodos Eloquent sin problemas
- Alternativa moderna a `whereRaw()` y collations complejas
- Siempre indexa columnas que uses frecuentemente con `whereBinary()`