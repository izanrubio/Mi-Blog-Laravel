---
title: 'Signal en Laravel: Genera Documentación desde Atributos PHP'
description: 'Aprende a usar Signal para convertir atributos PHP en documentación automática. Guía completa con ejemplos prácticos para Laravel.'
pubDate: '2026-06-27'
tags: ['laravel', 'php', 'documentación', 'atributos', 'signal']
---

## Signal en Laravel: Genera Documentación desde Atributos PHP

La documentación es uno de los aspectos más importantes del desarrollo de software, pero también uno de los más tediosos. Mantener la documentación sincronizada con el código es un desafío constante en cualquier proyecto. **Signal** es una librería PHP que resuelve este problema de forma elegante: convierte los atributos PHP en documentación Markdown y JSON de manera automática.

En este artículo, te mostraré cómo integrar Signal en tus proyectos Laravel para generar documentación viva que siempre esté actualizada con tu código.

## ¿Qué es Signal y por qué te interesa?

Signal es una herramienta que lee los atributos definidos en tus clases y métodos, los procesa, y genera documentación en formato Markdown y JSON mediante un simple comando Artisan.

**Ventajas principales:**

- **Documentación automática**: La documentación se genera directamente desde tu código
- **Sincronización garantizada**: Los cambios en el código se reflejan inmediatamente en la documentación
- **Menos mantenimiento**: No necesitas actualizar documentación en dos lugares
- **Múltiples formatos**: Genera tanto Markdown como JSON
- **Integración natural**: Usa los atributos PHP nativos de tu framework

Esto es especialmente útil si desarrollas APIs REST, librerías o proyectos complejos donde la documentación técnica es crítica.

## Instalación de Signal en tu proyecto Laravel

Primero, instala Signal usando Composer:

```bash
composer require --dev quelofficial/signal
```

Una vez instalado, verifica que el paquete se haya registrado correctamente en tu aplicación Laravel. Signal generalmente se auto-descubre, pero puedes validarlo ejecutando:

```bash
php artisan vendor:publish --provider="Quel\Signal\SignalServiceProvider"
```

Si Signal incluye un archivo de configuración, lo encontrarás en `config/signal.php`.

## Definiendo atributos para documentación

El corazón de Signal son los atributos PHP. Vamos a crear una API REST de ejemplo para entender cómo funciona.

### Atributos básicos para tus clases

Crea un controlador con atributos descriptivos:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

#[Description('Controlador para gestionar productos de la tienda')]
#[Tag('Productos')]
class ProductController extends Controller
{
    #[Description('Obtiene el listado de todos los productos')]
    #[Method('GET')]
    #[Route('/api/products')]
    #[Response(200, 'Lista de productos obtenida correctamente')]
    #[Response(500, 'Error al obtener los productos')]
    public function index(): JsonResponse
    {
        $products = Product::all();
        
        return response()->json([
            'data' => $products,
            'message' => 'Productos obtenidos exitosamente'
        ]);
    }

    #[Description('Crea un nuevo producto en la tienda')]
    #[Method('POST')]
    #[Route('/api/products')]
    #[Parameter('name', 'string', 'Nombre del producto')]
    #[Parameter('price', 'float', 'Precio del producto')]
    #[Parameter('description', 'string', 'Descripción detallada')]
    #[Response(201, 'Producto creado exitosamente')]
    #[Response(422, 'Datos de validación inválidos')]
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'price' => 'required|numeric|min:0',
            'description' => 'nullable|string'
        ]);

        $product = Product::create($validated);

        return response()->json([
            'data' => $product,
            'message' => 'Producto creado exitosamente'
        ], 201);
    }

    #[Description('Obtiene los detalles de un producto específico')]
    #[Method('GET')]
    #[Route('/api/products/{id}')]
    #[Parameter('id', 'integer', 'ID del producto a obtener')]
    #[Response(200, 'Producto obtenido correctamente')]
    #[Response(404, 'Producto no encontrado')]
    public function show(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        return response()->json([
            'data' => $product
        ]);
    }

    #[Description('Actualiza los datos de un producto existente')]
    #[Method('PUT')]
    #[Route('/api/products/{id}')]
    #[Parameter('id', 'integer', 'ID del producto a actualizar')]
    #[Parameter('name', 'string', 'Nuevo nombre del producto', false)]
    #[Parameter('price', 'float', 'Nuevo precio', false)]
    public function update(Request $request, int $id): JsonResponse
    {
        $product = Product::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'price' => 'sometimes|numeric|min:0',
            'description' => 'sometimes|string'
        ]);

        $product->update($validated);

        return response()->json([
            'data' => $product,
            'message' => 'Producto actualizado exitosamente'
        ]);
    }

    #[Description('Elimina un producto de la tienda')]
    #[Method('DELETE')]
    #[Route('/api/products/{id}')]
    #[Parameter('id', 'integer', 'ID del producto a eliminar')]
    #[Response(204, 'Producto eliminado exitosamente')]
    #[Response(404, 'Producto no encontrado')]
    public function destroy(int $id): JsonResponse
    {
        $product = Product::findOrFail($id);
        $product->delete();

        return response()->json(null, 204);
    }
}
```

### Creando atributos personalizados

Si los atributos de Signal no cubren exactamente lo que necesitas, puedes crear los tuyos propios:

```php
<?php

namespace App\Attributes;

use Attribute;

#[Attribute]
class Description
{
    public function __construct(
        public string $text
    ) {}
}

#[Attribute]
class Method
{
    public function __construct(
        public string $verb
    ) {}
}

#[Attribute]
class Route
{
    public function __construct(
        public string $path
    ) {}
}

#[Attribute]
class Response
{
    public function __construct(
        public int $status,
        public string $description
    ) {}
}

#[Attribute(Attribute::TARGET_METHOD | Attribute::TARGET_PARAMETER)]
class Parameter
{
    public function __construct(
        public string $name,
        public string $type,
        public string $description,
        public bool $required = true
    ) {}
}

#[Attribute]
class Tag
{
    public function __construct(
        public string $name
    ) {}
}
```

## Generando documentación con Signal

Una vez que has añadido los atributos a tu código, es momento de generar la documentación.

### Comando básico

Signal proporciona un comando Artisan para generar la documentación:

```bash
php artisan signal:generate
```

Este comando buscará todos los atributos en tu aplicación y generará la documentación correspondiente. Por defecto, crea archivos en un directorio de salida (típicamente `docs/api`).

### Configurando opciones de generación

Puedes personalizar dónde se genera la documentación y en qué formatos:

```bash
php artisan signal:generate --output=docs/api --format=markdown,json
```

### Ejemplo de salida generada

Signal generaría un archivo `docs/api/products.md` similar a esto:

```markdown
# Productos

Controlador para gestionar productos de la tienda

## Obtener listado de productos

**GET** `/api/products`

Obtiene el listado de todos los productos

### Respuestas

- **200**: Lista de productos obtenida correctamente
- **500**: Error al obtener los productos

---

## Crear nuevo producto

**POST** `/api/products`

Crea un nuevo producto en la tienda

### Parámetros

| Nombre | Tipo | Descripción |
|--------|------|-------------|
| name | string | Nombre del producto |
| price | float | Precio del producto |
| description | string | Descripción detallada |

### Respuestas

- **201**: Producto creado exitosamente
- **422**: Datos de validación inválidos
```

Y en formato JSON:

```json
{
  "resource": "Productos",
  "description": "Controlador para gestionar productos de la tienda",
  "tag": "Productos",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/products",
      "description": "Obtiene el listado de todos los productos",
      "responses": [
        {
          "status": 200,
          "description": "Lista de productos obtenida correctamente"
        },
        {
          "status": 500,
          "description": "Error al obtener los productos"
        }
      ]
    }
  ]
}
```

## Integrando Signal en tu flujo de desarrollo

### Automatizar la generación

Añade la generación de documentación a tu pipeline de CI/CD. Por ejemplo, con GitHub Actions:

```yaml
name: Generate Documentation

on: [push, pull_request]

jobs:
  generate-docs:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      
      - name: Install dependencies
        run: composer install --no-dev
      
      - name: Generate Signal documentation
        run: php artisan signal:generate --output=docs/api
      
      - name: Commit changes
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add docs/api
          git commit -m "docs: update API documentation" || true
          git push
```

### Versionando la documentación

Mantén versiones de documentación para diferentes releases:

```bash
php artisan signal:generate \
  --output=docs/api/v1 \
  --version=1.0.0
```

## Casos de uso reales

### APIs públicas

Signal es perfecto para documentar APIs públicas. Los desarrolladores externos siempre tendrán acceso a documentación actualizada:

```php
#[Description('API pública de integración para sistemas externos')]
#[Version('2.0.0')]
#[BaseUrl('https://api.tuapp.com/v2')]
class IntegrationController extends Controller
{
    // ...
}
```

### Documentación de librerías

Si desarrollas una librería que distribuyes a otros desarrolladores:

```php
#[Description('Servicio de procesamiento de pagos')]
#[Deprecated('Usa PaymentServiceV2 en su lugar')]
class PaymentService
{
    // ...
}
```

### Especificaciones internas

Documenta servicios internos para que otros equipos entiendan interfaces:

```php
#[Description('Servicio interno de notificaciones')]
#[Internal]
class NotificationService
{
    // ...
}
```

## Mejores prácticas con Signal

### 1. Mantén descripciones concisas y claras

```php
// ✅ Bien
#[Description('Obtiene todos los usuarios activos del sistema')]

// ❌ Evita
#[Description('Método que retorna usuarios')]
```

### 2. Documenta parámetros de entrada y salida

```php
#[Parameter('filters', 'array', 'Filtros de búsqueda: name, email, status')]
#[Response(200, 'Array de usuarios encontrados')]
#[Response(422, 'Parámetros de filtro inválidos')]
public function search(Request $request)
{
    // ...
}
```

### 3. Usa versioning para APIs

```php
#[Version('1.0.0')]
#[Deprecated('Será removido en v2.0.0, usa /api/v2/products')]
public function indexV1()
{
    // ...
}

#[Version('2.0.0')]
public function index()
{
    // ...
}
```

### 4. Agrupa endpoints relacionados con tags

```php
#[Tag('Autenticación')]
#[Tag('Admin')]
class AuthController extends Controller
{
    // ...
}
```

## Limitaciones y consideraciones

- Signal requiere que uses atributos PHP nativos en tu código
- La configuración inicial puede ser verbosa para proyectos grandes
- Necesitas mantener los atributos actualizados manualmente
- Algunos frameworks pueden requerir configuración adicional

## Conclusión

Signal es una herramienta poderosa para mantener tu documentación sincronizada con tu código en Laravel. Al usar atributos PHP nativos, conseguimos una documentación declarativa que es:

- **Mantenible**: Un solo lugar para actualizar
- **Automatizada**: Se genera con un simple comando
- **Confiable**: Siempre refleja el estado actual del código
- **Flexible**: Soporta múltiples formatos y personalizaciones

Si trabajas en una API REST, librería compartida o proyecto que requiere documentación técnica rigurosa, Signal te ahorrará horas de trabajo manual y te permitirá enfocarte en lo que realmente importa: escribir código de calidad.

## Puntos clave

- Signal convierte atributos PHP en documentación Markdown y JSON automáticamente
- Se integra naturalmente con Laravel sin requerir cambios mayores en tu arquitectura
- Los atributos personalizados te permiten documentar exactamente lo que necesitas
- La documentación generada siempre está sincronizada con tu código fuente
- Es ideal para APIs públicas, librerías distribuidas y proyectos con requisitos de documentación rigurosa
- Puedes automatizar la generación en tu pipeline de CI/CD
- Signal reduce significativamente el mantenimiento de documentación técnica
- Los formatos JSON generados facilitan la integración con herramientas externas
- Las descripciones claras y parámetros bien documentados mejoran la experiencia del desarrollador
- Versionar la documentación es sencillo y ayuda a mantener compatibilidad entre releases