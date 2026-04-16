---
modulo: 5
leccion: 1
title: 'API REST con Laravel'
description: 'Aprende a construir una API REST completa con Laravel: rutas, controladores, autenticación y buenas prácticas para devolver datos JSON.'
duracion: '25 min'
quiz:
  - pregunta: '¿Qué método HTTP se usa convencionalmente para crear un nuevo recurso en una API REST?'
    opciones:
      - 'GET'
      - 'POST'
      - 'PUT'
      - 'DELETE'
    correcta: 1
    explicacion: 'POST es el método HTTP estándar para crear nuevos recursos en una API REST. GET recupera datos, PUT actualiza y DELETE elimina.'
  - pregunta: '¿En qué archivo de Laravel se definen las rutas de una API?'
    opciones:
      - 'routes/web.php'
      - 'routes/console.php'
      - 'routes/api.php'
      - 'routes/channels.php'
    correcta: 2
    explicacion: 'Las rutas de la API se definen en routes/api.php. Estas rutas usan automáticamente el middleware "api" y tienen el prefijo /api en la URL.'
  - pregunta: '¿Qué comando de Artisan genera un controlador con todos los métodos REST (index, store, show, update, destroy)?'
    opciones:
      - 'php artisan make:controller ApiController'
      - 'php artisan make:controller ProductoController --api'
      - 'php artisan make:controller ProductoController --rest'
      - 'php artisan make:api ProductoController'
    correcta: 1
    explicacion: 'El flag --api genera un Resource Controller sin los métodos create y edit (que son para formularios HTML), dejando solo los métodos necesarios para una API REST.'
---

## ¿Qué es una API REST?

Una **API REST** (Representational State Transfer) es un conjunto de convenciones para construir servicios web que permiten la comunicación entre sistemas a través del protocolo HTTP. En lugar de devolver HTML como lo hace una aplicación web tradicional, una API REST devuelve datos en formato **JSON** (o XML), que pueden ser consumidos por aplicaciones móviles, frontends en React/Vue, otros servidores o cualquier cliente HTTP.

Laravel es uno de los frameworks más populares para construir APIs REST gracias a su elegancia, su potente sistema de rutas y sus herramientas integradas como Eloquent, API Resources y Sanctum.

## Principios básicos de REST

Antes de escribir código, conviene entender las convenciones que rigen una API REST bien diseñada:

- **Recursos**: Todo se representa como un recurso identificado por una URL. Por ejemplo, `/api/productos` representa la colección de productos.
- **Métodos HTTP**: Cada operación usa el verbo HTTP adecuado:
  - `GET /api/productos` — listar todos los productos
  - `POST /api/productos` — crear un nuevo producto
  - `GET /api/productos/{id}` — obtener un producto específico
  - `PUT /api/productos/{id}` — actualizar un producto
  - `DELETE /api/productos/{id}` — eliminar un producto
- **Sin estado (stateless)**: Cada petición debe contener toda la información necesaria. El servidor no guarda sesiones entre peticiones.
- **Códigos de estado HTTP**: La API debe responder con el código correcto: `200 OK`, `201 Created`, `404 Not Found`, `422 Unprocessable Entity`, etc.

## Crear el proyecto y configurar la API

Si partes desde cero, crea un proyecto Laravel:

```bash
composer create-project laravel/laravel mi-api
cd mi-api
```

Las rutas de la API van en `routes/api.php`. A diferencia de `routes/web.php`, estas rutas usan el middleware `api` por defecto, que no incluye protección CSRF y está optimizado para peticiones sin estado.

## Definir las rutas

```php
// routes/api.php

use App\Http\Controllers\Api\ProductoController;
use Illuminate\Support\Facades\Route;

Route::apiResource('productos', ProductoController::class);
```

`Route::apiResource()` genera automáticamente estas rutas:

| Método | URI | Acción | Nombre |
|--------|-----|--------|--------|
| GET | /api/productos | index | productos.index |
| POST | /api/productos | store | productos.store |
| GET | /api/productos/{producto} | show | productos.show |
| PUT/PATCH | /api/productos/{producto} | update | productos.update |
| DELETE | /api/productos/{producto} | destroy | productos.destroy |

Puedes verificar las rutas generadas con:

```bash
php artisan route:list
```

## Crear el modelo y la migración

```bash
php artisan make:model Producto -m
```

Define la migración:

```php
// database/migrations/xxxx_create_productos_table.php

public function up(): void
{
    Schema::create('productos', function (Blueprint $table) {
        $table->id();
        $table->string('nombre');
        $table->text('descripcion')->nullable();
        $table->decimal('precio', 8, 2);
        $table->integer('stock')->default(0);
        $table->timestamps();
    });
}
```

Ejecuta la migración:

```bash
php artisan migrate
```

Y define los campos rellenables en el modelo:

```php
// app/Models/Producto.php

class Producto extends Model
{
    protected $fillable = ['nombre', 'descripcion', 'precio', 'stock'];
}
```

## Crear el controlador API

```bash
php artisan make:controller Api/ProductoController --api
```

El flag `--api` genera un controlador con los cinco métodos REST sin `create` ni `edit` (que son para formularios HTML). Implementa cada método:

```php
// app/Http/Controllers/Api/ProductoController.php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ProductoController extends Controller
{
    public function index(): JsonResponse
    {
        $productos = Producto::all();
        return response()->json($productos);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'nombre'      => 'required|string|max:255',
            'descripcion' => 'nullable|string',
            'precio'      => 'required|numeric|min:0',
            'stock'       => 'required|integer|min:0',
        ]);

        $producto = Producto::create($validated);

        return response()->json($producto, 201);
    }

    public function show(Producto $producto): JsonResponse
    {
        return response()->json($producto);
    }

    public function update(Request $request, Producto $producto): JsonResponse
    {
        $validated = $request->validate([
            'nombre'      => 'sometimes|string|max:255',
            'descripcion' => 'nullable|string',
            'precio'      => 'sometimes|numeric|min:0',
            'stock'       => 'sometimes|integer|min:0',
        ]);

        $producto->update($validated);

        return response()->json($producto);
    }

    public function destroy(Producto $producto): JsonResponse
    {
        $producto->delete();
        return response()->json(null, 204);
    }
}
```

## Manejo de errores en la API

Laravel devuelve HTML por defecto cuando ocurre un error. Para que la API siempre devuelva JSON, tienes dos opciones. En Laravel 11 puedes registrar un handler en `bootstrap/app.php`:

```php
->withExceptions(function (Exceptions $exceptions) {
    $exceptions->render(function (\Illuminate\Validation\ValidationException $e, Request $request) {
        if ($request->is('api/*')) {
            return response()->json([
                'message' => 'Los datos enviados no son válidos.',
                'errors'  => $e->errors(),
            ], 422);
        }
    });

    $exceptions->render(function (\Illuminate\Database\Eloquent\ModelNotFoundException $e, Request $request) {
        if ($request->is('api/*')) {
            return response()->json(['message' => 'Recurso no encontrado.'], 404);
        }
    });
})
```

## Probar la API con cURL

```bash
# Listar productos
curl -X GET http://localhost:8000/api/productos \
  -H "Accept: application/json"

# Crear un producto
curl -X POST http://localhost:8000/api/productos \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Teclado mecánico","precio":89.99,"stock":50}'

# Actualizar un producto
curl -X PUT http://localhost:8000/api/productos/1 \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"precio":79.99}'

# Eliminar un producto
curl -X DELETE http://localhost:8000/api/productos/1 \
  -H "Accept: application/json"
```

## Paginación

En lugar de devolver todos los registros con `Producto::all()`, usa paginación para no sobrecargar la respuesta:

```php
public function index(): JsonResponse
{
    $productos = Producto::paginate(15);
    return response()->json($productos);
}
```

Laravel incluye automáticamente metadatos de paginación en la respuesta JSON:

```json
{
  "data": [...],
  "current_page": 1,
  "last_page": 4,
  "per_page": 15,
  "total": 58,
  "next_page_url": "http://localhost:8000/api/productos?page=2",
  "prev_page_url": null
}
```

## Buenas prácticas

- **Versiona tu API**: Prefija tus rutas con `/api/v1/` para poder hacer cambios sin romper clientes existentes.
- **Usa API Resources**: En la siguiente lección aprenderás a formatear las respuestas JSON de forma controlada.
- **Valida siempre**: Nunca confíes en los datos del cliente. Usa el sistema de validación de Laravel.
- **Documenta**: Herramientas como Scribe o Laravel OpenAPI generan documentación automática a partir de tu código.
- **Añade autenticación**: Una API pública sin autenticación es un riesgo. Usa Laravel Sanctum (para SPAs y móvil) o Passport (para OAuth2).

Con estos fundamentos ya puedes construir una API REST funcional en Laravel. En las próximas lecciones profundizaremos en formatear las respuestas con API Resources, proteger los endpoints con autenticación y optimizar el rendimiento con caché.
