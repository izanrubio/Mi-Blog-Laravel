---
title: 'Laradocs: Documentación Versionada dentro de Laravel'
description: 'Aprende a integrar documentación markdown versionada en tu app Laravel con Laradocs. Guía completa con ejemplos prácticos.'
pubDate: '2026-06-12'
tags: ['laravel', 'documentacion', 'laradocs', 'markdown']
---

# Laradocs: Documentación Versionada dentro de Laravel

La documentación es uno de los aspectos más olvidados en los proyectos de software, especialmente en equipos pequeños o startups. Mantenerla actualizada, versionada y accesible es un desafío constante. **Laradocs** es un paquete Laravel que resuelve este problema de manera elegante: convierte archivos Markdown versionados en tu repositorio en un sitio de documentación servido directamente desde tu aplicación.

En este artículo, te mostraré cómo implementar Laradocs en tu proyecto Laravel, configurarlo correctamente y aprovechar sus características más potentes para mantener tu documentación siempre sincronizada con el código.

## ¿Qué es Laradocs y por qué lo necesitas?

Laradocs es un paquete que transforma archivos Markdown almacenados en tu repositorio Git en un sitio de documentación accesible en la ruta `/docs` de tu aplicación Laravel. Lo innovador es que:

- **Versionado con Git**: Tu documentación vive junto a tu código y se versiona automáticamente
- **Navegación basada en carpetas**: La estructura de directorios se convierte en menú automático
- **Metadatos con Front Matter**: Define título, descripción y orden con YAML
- **Variables y Macros**: Reutiliza contenido y crea documentación dinámica
- **Sin base de datos**: Todo es archivos, simple y rastreable

### ¿Cuándo usar Laradocs?

Ideal para:
- Documentación interna de tu aplicación
- Guías de API para usuarios
- Wikis de conocimiento del equipo
- Documentación de productos SaaS
- Repositorios educativos

## Instalación y configuración inicial

Instalar Laradocs es tan simple como agregar el paquete a través de Composer:

```bash
composer require laradocs/laradocs
```

Luego, publica los archivos de configuración:

```bash
php artisan vendor:publish --provider="Laradocs\LaradocsServiceProvider"
```

Esto creará:
- `config/laradocs.php` - Configuración principal
- `docs/` - Directorio para tu documentación

### Configuración básica

Abre `config/laradocs.php` y personaliza según tu necesidad:

```php
<?php

return [
    // Ruta donde se servirá la documentación
    'path' => 'docs',
    
    // Directorio donde se guardan los archivos markdown
    'source' => base_path('docs'),
    
    // Título de tu documentación
    'title' => 'Mi Documentación',
    
    // Logo o marca
    'branding' => 'Mi App',
    
    // Tema
    'theme' => 'light', // 'light' o 'dark'
    
    // Lenguajes soportados
    'locales' => ['es', 'en'],
    
    // Ocultar documentación en producción
    'visible' => env('APP_ENV') === 'local',
];
```

## Estructura de carpetas y organización

Laradocs usa la estructura de directorios para crear la navegación automáticamente. Crea una estructura como esta:

```
docs/
├── index.md
├── getting-started/
│   ├── installation.md
│   ├── configuration.md
│   └── first-steps.md
├── guides/
│   ├── authentication.md
│   ├── api-usage.md
│   └── advanced-features.md
└── troubleshooting.md
```

Cada archivo `.md` se convierte en una página accesible en la ruta correspondiente.

## Usando Front Matter para metadatos

El Front Matter en YAML define metadatos de cada página:

```markdown
---
title: 'Guía de Instalación'
description: 'Cómo instalar y configurar la aplicación'
order: 1
published: true
---

# Guía de Instalación

Contenido aquí...
```

Propiedades disponibles:

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `title` | string | Título de la página |
| `description` | string | Meta description |
| `order` | int | Orden en el menú (menor = primero) |
| `published` | bool | Mostrar u ocultar la página |
| `nav_title` | string | Título alternativo en navegación |
| `keywords` | array | Tags de búsqueda |

Ejemplo completo:

```markdown
---
title: 'API Resources en Laravel'
description: 'Aprende a crear API Resources para formatear respuestas JSON'
order: 5
published: true
nav_title: 'API Resources'
keywords: ['api', 'json', 'resources', 'rest']
---

# API Resources en Laravel

Tu contenido aquí...
```

## Variables y Macros para contenido reutilizable

Laradocs permite crear variables globales y macros que se sustituyen en el markdown:

### Definir variables globales

En `config/laradocs.php`:

```php
'variables' => [
    'app_name' => 'Mi Aplicación',
    'app_version' => '1.2.0',
    'support_email' => 'support@example.com',
    'github_url' => 'https://github.com/tuusario/tuorepo',
],
```

### Usar variables en Markdown

```markdown
# Bienvenido a {{ app_name }}

Versión actual: {{ app_version }}

Para soporte, contáctanos en {{ support_email }}

[Ver repositorio]({{ github_url }})
```

### Crear macros personalizados

En `config/laradocs.php`:

```php
'macros' => [
    'installation_steps' => <<<'MARKDOWN'
1. Clona el repositorio
2. Ejecuta `composer install`
3. Copia `.env.example` a `.env`
4. Genera la clave: `php artisan key:generate`
5. Ejecuta migraciones: `php artisan migrate`
MARKDOWN,
    
    'requirements' => <<<'MARKDOWN'
- PHP 8.2 o superior
- Laravel 13+
- MySQL 8.0+ o PostgreSQL 12+
- Composer
MARKDOWN,
],
```

Úsalos en markdown:

```markdown
## Instalación

{{ installation_steps }}

## Requisitos

{{ requirements }}
```

## Ejemplo práctico: Documentar una API

Veamos un caso real: documentar una API REST. Crea la estructura:

```
docs/
├── index.md
├── api/
│   ├── authentication.md
│   ├── users/
│   │   ├── list.md
│   │   ├── create.md
│   │   └── update.md
│   └── products/
│       ├── list.md
│       └── detail.md
```

### `docs/api/authentication.md`

```markdown
---
title: 'Autenticación'
description: 'Endpoints de autenticación de la API'
order: 1
---

# Autenticación

Todos los endpoints requieren un token Bearer. Obtén tu token aquí.

## POST /api/auth/login

Autentica un usuario y obtiene un token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** (200 OK)
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "name": "John Doe",
    "email": "user@example.com"
  }
}
```

## POST /api/auth/logout

Invalida el token actual.

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
```

**Response:** (204 No Content)
```

```markdown
---
title: 'Listar Usuarios'
description: 'Obtiene un listado paginado de usuarios'
order: 1
---

# GET /api/users

Obtiene un listado paginado de usuarios.

**Headers:**
```
Authorization: Bearer YOUR_TOKEN
Accept: application/json
```

**Query Parameters:**
| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `page` | int | Página (default: 1) |
| `per_page` | int | Registros por página (default: 15) |
| `search` | string | Buscar por nombre o email |
| `sort` | string | Campo para ordenar |

**Request:**
```bash
GET /api/users?page=1&per_page=20&search=john
Authorization: Bearer YOUR_TOKEN
```

**Response:** (200 OK)
```json
{
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2026-01-15T10:30:00Z"
    }
  ],
  "links": {
    "first": "/api/users?page=1",
    "last": "/api/users?page=5",
    "next": "/api/users?page=2"
  },
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 5,
    "per_page": 20,
    "total": 100
  }
}
```
```

## Personalizar el tema y apariencia

Aunque Laradocs viene con temas predeterminados, puedes personalizarlos. Publica los assets del frontend:

```bash
php artisan vendor:publish --tag=laradocs-assets
```

Esto creará:
- `resources/views/laradocs/` - Vistas Blade
- `public/css/laradocs.css` - Estilos

Modifica `resources/views/laradocs/layout.blade.php` para ajustar el diseño:

```blade
@extends('laradocs::layout')

@section('content')
<div class="docs-container">
    <aside class="docs-sidebar">
        @include('laradocs::sidebar')
    </aside>
    
    <main class="docs-content">
        @yield('docs_content')
    </main>
</div>
@endsection
```

## Buscar en la documentación

Laradocs incluye búsqueda full-text. Personalízala en `config/laradocs.php`:

```php
'search' => [
    'enabled' => true,
    'index_file' => storage_path('laradocs-index.json'),
    'algorithm' => 'fuzzy', // 'fuzzy' o 'exact'
],
```

La búsqueda se genera automáticamente al acceder a `/docs`.

## Integrar con múltiples idiomas

Laradocs soporta documentación multiidioma. Estructura así:

```
docs/
├── es/
│   ├── index.md
│   ├── guia/
│   │   └── instalacion.md
│   └── api/
│       └── autenticacion.md
├── en/
│   ├── index.md
│   ├── guide/
│   │   └── installation.md
│   └── api/
│       └── authentication.md
```

Configura en `config/laradocs.php`:

```php
'locales' => ['es', 'en'],
'default_locale' => 'es',
'locale_in_url' => true, // /docs/es/... o /docs/en/...
```

## Automatizar updates con webhooks

En un proyecto SaaS, podrías sincronizar la documentación automáticamente. Crea un comando:

```bash
php artisan make:command SyncDocumentation
```

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class SyncDocumentation extends Command
{
    protected $signature = 'docs:sync';
    protected $description = 'Sincroniza documentación desde el repositorio';

    public function handle()
    {
        $this->info('Sincronizando documentación...');
        
        // Simular descarga desde CDN o repositorio
        $docs = Http::get('https://api.github.com/repos/tuuser/tuorepo/contents/docs')
            ->json();
        
        foreach ($docs as $item) {
            if ($item['type'] === 'file' && str_ends_with($item['name'], '.md')) {
                $content = Http::get($item['download_url'])->body();
                File::put(
                    base_path('docs/' . $item['name']),
                    $content
                );
            }
        }
        
        $this->info('✓ Documentación sincronizada correctamente');
    }
}
```

Ejecuta con:

```bash
php artisan docs:sync
```

## Desplegar documentación en producción

Para servir documentación en producción, considera:

1. **Caché las páginas**: Laradocs cachea automáticamente, pero puedes forzar:

```php
// En tu ruta o controlador
Cache::forget('laradocs:*');
```

2. **Genera HTML estático**: Crea un comando para generar un sitio estático:

```bash
php artisan vendor:publish --tag=laradocs-stubs
```

3. **Restringe acceso**: Si es documentación privada, usa middleware:

```php
Route::group(['middleware' => 'auth'], function () {
    // Laradocs se servirá solo para usuarios autenticados
});
```

## Troubleshooting común

### Las páginas no aparecen en el menú

Verifica que los archivos tengan Front Matter válido y que `published` sea `true`:

```markdown
---
title: 'Mi Página'
published: true  # ← Asegúrate de esto
---
```

### La búsqueda no funciona

Regenera el índice:

```bash
php artisan laradocs:index
```

### Variables no se sustituyen

Revisa que uses exactamente `{{ variable_name }}` (con espacios) y que la variable esté definida en `config/laradocs.php`.

## Puntos clave

- **Laradocs** convierte Markdown versionado en documentación servida desde tu app Laravel
- La **estructura de carpetas** se transforma automáticamente en navegación
- **Front Matter YAML** permite definir metadatos como título, orden y estado de publicación
- **Variables y macros** reutilizan contenido y crean documentación dinámica
- Ideal para **APIs, guías internas y wikis** de equipos
- Soporta **múltiples idiomas** con estructura multilocale
- La **búsqueda full-text** está incluida y es automática
- **Perfecto para SaaS** donde la documentación debe ser versionada junto al código
- Usa **Git como fuente de verdad** para tu documentación
- Puedes **personalizarlo completamente** modificando vistas y estilos
- **Sin base de datos**: Todo es archivos, rastreables y mergeables