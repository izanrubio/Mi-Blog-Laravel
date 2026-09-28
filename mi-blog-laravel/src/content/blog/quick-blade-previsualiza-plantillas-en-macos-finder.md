---
title: 'Quick Blade: Previsualiza Plantillas en macOS Finder'
description: 'Quick Blade es la extensión Quick Look para macOS que renderiza archivos .blade.php directamente en Finder con CSS compilado y datos de prueba.'
pubDate: '2024-01-15'
tags: ['laravel', 'blade', 'macos', 'herramientas', 'productividad']
---

## Quick Blade: Previsualiza Plantillas en macOS Finder

Si trabajas en Laravel con macOS, seguramente has pasado por la frustración de querer ver una vista Blade directamente desde el Finder sin necesidad de abrir el navegador o tu editor de código. **Quick Blade** resuelve exactamente este problema, permitiéndote previsualizar archivos `.blade.php` con solo presionar la barra espaciadora en Finder.

En este artículo, exploraremos qué es Quick Blade, cómo instalarlo, configurarlo y aprovecharlo al máximo en tu flujo de trabajo diario con Laravel.

## ¿Qué es Quick Blade?

Quick Blade es una extensión gratuita de Quick Look para macOS que renderiza plantillas Blade directamente en el Finder sin necesidad de herramientas adicionales complejas. A diferencia de las simples vistas de código, Quick Blade:

- **Renderiza el HTML compilado** de tus plantillas `.blade.php`
- **Aplica CSS compilado** para que veas el diseño real
- **Usa datos de prueba automáticos** para simular contenido dinámico
- **Funciona sin configuración adicional** en la mayoría de casos
- **Es completamente gratuito** y de código abierto

Esta herramienta es especialmente valiosa para diseñadores que trabajan con Laravel, desarrolladores frontend que necesitan verificar diseños rápidamente, y equipos que quieren agilizar el workflow de desarrollo.

## Instalación de Quick Blade

### Requisitos previos

Antes de instalar Quick Blade, asegúrate de tener:

- macOS 10.15 o superior
- Xcode Command Line Tools instaladas
- Laravel 8 o superior en tu proyecto
- Node.js 14+ (para compilar assets)

### Paso 1: Descargar e instalar la extensión

La forma más sencilla es descargar Quick Blade desde su repositorio oficial:

```bash
# Clona el repositorio
git clone https://github.com/laravel/quick-blade.git

# Navega al directorio
cd quick-blade

# Instala las dependencias
npm install

# Compila el proyecto
npm run build
```

### Paso 2: Activar en macOS

Después de compilar, debes activar la extensión en macOS:

1. Abre **Finder → Preferences**
2. Ve a la pestaña **Extensions**
3. Marca la opción **Quick Blade** en la sección de Quick Look
4. Reinicia Finder

```bash
# También puedes reiniciar Finder desde terminal
killall Finder
```

## Configuración en tu proyecto Laravel

### Estructura básica de directorios

Quick Blade espera encontrar tu proyecto Laravel con una estructura estándar:

```
tu-proyecto-laravel/
├── app/
├── resources/
│   ├── views/
│   └── css/
├── public/
│   ├── css/
│   └── js/
├── webpack.mix.js o vite.config.js
└── package.json
```

### Configurar variables de entorno

Crea un archivo `.blade-preview.json` en la raíz de tu proyecto para personalizar cómo Quick Blade previsualiza tus vistas:

```json
{
  "layout": "resources/views/layouts/app.blade.php",
  "cssFiles": [
    "public/css/app.css"
  ],
  "jsFiles": [
    "public/js/app.js"
  ],
  "data": {
    "user": {
      "id": 1,
      "name": "Juan Pérez",
      "email": "juan@example.com"
    },
    "posts": [
      {
        "id": 1,
        "title": "Mi primer artículo",
        "content": "Contenido de prueba",
        "created_at": "2024-01-15"
      }
    ]
  }
}
```

## Ejemplos prácticos de uso

### Ejemplo 1: Previsualizar una vista simple

Supongamos que tienes una vista de tarjeta de producto:

```blade
<!-- resources/views/components/product-card.blade.php -->
<div class="product-card bg-white rounded-lg shadow-md p-6">
    <img src="{{ $product['image'] }}" alt="{{ $product['name'] }}" class="w-full h-48 object-cover rounded">
    <h3 class="mt-4 text-lg font-bold text-gray-900">{{ $product['name'] }}</h3>
    <p class="text-gray-600 text-sm mt-2">{{ $product['description'] }}</p>
    <div class="flex justify-between items-center mt-4">
        <span class="text-2xl font-bold text-green-600">${{ $product['price'] }}</span>
        <button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
            Agregar
        </button>
    </div>
</div>
```

Con Quick Blade instalado, solo presiona **Space** en Finder sobre el archivo y verás la previsualización renderizada con datos de prueba.

### Ejemplo 2: Componentes con slots

Quick Blade también maneja componentes con slots complejos:

```blade
<!-- resources/views/components/modal.blade.php -->
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div class="border-b px-6 py-4">
            <h2 class="text-xl font-bold">{{ $title ?? 'Modal' }}</h2>
        </div>
        <div class="px-6 py-4">
            {{ $slot }}
        </div>
        <div class="border-t px-6 py-4 flex justify-end gap-2">
            <button class="px-4 py-2 text-gray-700 border rounded hover:bg-gray-50">
                Cancelar
            </button>
            <button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Confirmar
            </button>
        </div>
    </div>
</div>
```

### Ejemplo 3: Vistas que usan modelos

Para vistas que dependen de modelos Eloquent, Quick Blade usa los datos de prueba del `.blade-preview.json`:

```blade
<!-- resources/views/posts/show.blade.php -->
<article class="max-w-2xl mx-auto py-8">
    <header class="mb-8">
        <h1 class="text-4xl font-bold text-gray-900">{{ $post['title'] }}</h1>
        <time class="text-gray-500 text-sm mt-2">{{ $post['created_at'] }}</time>
    </header>
    
    <div class="prose prose-lg max-w-none">
        {!! nl2br(e($post['content'])) !!}
    </div>
    
    <footer class="mt-12 pt-8 border-t">
        <div class="flex items-center gap-4">
            <img src="{{ $post['author']['avatar'] }}" 
                 alt="{{ $post['author']['name'] }}" 
                 class="w-12 h-12 rounded-full">
            <div>
                <p class="font-semibold">{{ $post['author']['name'] }}</p>
                <p class="text-gray-600 text-sm">{{ $post['author']['bio'] }}</p>
            </div>
        </div>
    </footer>
</article>
```

## Ventajas de usar Quick Blade

### Flujo de trabajo más rápido

Eliminas el paso de abrir el navegador para ver cambios. Con un simple Space en Finder, ves el resultado inmediato de tus cambios en CSS o estructura HTML.

### Mejor colaboración

Los diseñadores pueden revisar fácilmente las plantillas sin necesidad de ejecutar el servidor de desarrollo, lo que facilita el feedback rápido.

### Debugging visual

Cuando algo no se ve como esperabas, la previsualización te ayuda a identificar rápidamente si el problema es en la estructura Blade o en los estilos.

### Integración con Tailwind CSS

Quick Blade funciona perfectamente con Tailwind CSS, mostrando todos tus estilos compilados correctamente:

```blade
<!-- El Tailwind CSS se aplica automáticamente en la previsualización -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8">
    @foreach($items as $item)
        <div class="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-4 text-white shadow-lg">
            <h3 class="text-lg font-bold mb-2">{{ $item['name'] }}</h3>
            <p class="text-sm opacity-90">{{ $item['description'] }}</p>
        </div>
    @endforeach
</div>
```

## Configuración avanzada

### Personalizar datos de prueba por vista

Puedes crear archivos de configuración específicos por vista:

```json
// .blade-preview/show.json - para resources/views/posts/show.blade.php
{
  "post": {
    "id": 1,
    "title": "Entendiendo Quick Blade en Laravel",
    "content": "Quick Blade es una herramienta increíble...",
    "created_at": "2024-01-15",
    "author": {
      "name": "Ana García",
      "avatar": "https://api.example.com/avatars/ana.jpg",
      "bio": "Desarrolladora full-stack apasionada por Laravel"
    }
  }
}
```

### Compilación de CSS personalizada

Si usas PostCSS o SCSS, Quick Blade puede detectarlo automáticamente:

```javascript
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel(['resources/css/app.css', 'resources/js/app.js']),
    ],
});
```

## Troubleshooting común

### Quick Blade no aparece en las opciones de Quick Look

```bash
# Reinicia el demonio de Quick Look
qlmanage -r
qlmanage -r cache
```

### Los estilos CSS no se aplican en la previsualización

Verifica que los rutas en `.blade-preview.json` sean correctas y que los archivos CSS estén compilados:

```bash
# Recompila tus assets
npm run build
# o con Vite
npm run build
```

### Las vistas con directivas complejas no se renderizan

Quick Blade soporta la mayoría de directivas Blade, pero algunas características avanzadas requieren que configures los datos de prueba adecuadamente en `.blade-preview.json`.

## Integración con tu flujo de trabajo actual

Quick Blade se integra perfectamente con tu setup existente sin requerir cambios. Simplemente:

1. Instala la extensión
2. Configura el archivo `.blade-preview.json` si es necesario
3. Comienza a usar Space en Finder sobre tus archivos `.blade.php`

No interfiere con tu servidor de desarrollo Laravel ni con tus herramientas de compilación de assets.

## Conclusión

Quick Blade es una herramienta simple pero poderosa que mejora significativamente la experiencia de desarrollo con Laravel en macOS. Te permite verificar rápidamente cómo se ven tus plantillas Blade sin abandonar el Finder, acelera el flujo de trabajo y facilita la colaboración con tu equipo.

Aunque es una característica aparentemente pequeña, el ahorro de tiempo y la mejora en la experiencia de desarrollo hacen que valga completamente la pena instalarlo en cualquier proyecto Laravel que uses regularmente.

## Puntos clave

- **Quick Blade renderiza plantillas `.blade.php` directamente en Finder** con solo presionar Space
- **No requiere servidor en ejecución** ni configuración compleja para empezar
- **Soporta CSS compilado, Tailwind CSS y componentes Blade** complejos
- **Ideal para diseñadores y desarrolladores frontend** que necesitan feedback visual rápido
- **Se personaliza fácilmente** con archivos de configuración JSON
- **Mejora la colaboración en equipos** eliminando barreras de visualización
- **Es completamente gratuito y open source**, disponible para macOS
- **Se integra sin conflictos** con tu setup actual de Laravel y herramientas de build