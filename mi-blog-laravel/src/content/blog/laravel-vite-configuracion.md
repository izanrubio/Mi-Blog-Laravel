---
title: 'Laravel + Vite: configuración completa para tu proyecto'
description: 'Configura Vite en Laravel 11 correctamente: assets, CSS, JavaScript, HMR en desarrollo y build para producción. Guía completa con ejemplos.'
pubDate: '2024-01-18'
tags: ['laravel', 'vite', 'configuracion', 'frontend']
---

# Laravel + Vite: configuración completa para tu proyecto

Desde Laravel 9, Vite reemplazó a Laravel Mix como la herramienta estándar para compilar assets de frontend. Si vienes de proyectos anteriores que usaban Webpack (a través de Mix), Vite puede parecer diferente al principio, pero es considerablemente más rápido y la experiencia de desarrollo es mucho mejor. En esta guía aprenderás todo lo que necesitas saber para configurar Vite en Laravel correctamente.

## ¿Por qué Vite?

Vite (pronunciado "vit") fue creado por Evan You (el creador de Vue.js) y resuelve uno de los problemas más frustrantes del desarrollo moderno: el tiempo de arranque del servidor de desarrollo. Con Webpack/Mix, compilar el proyecto al iniciar podía tardar 30-60 segundos. Con Vite, el servidor arranca prácticamente al instante porque sirve los archivos como módulos ES nativos en lugar de compilar todo primero.

Las ventajas principales:

- **Inicio instantáneo** del servidor de desarrollo
- **Hot Module Replacement (HMR)** ultrarrápido: los cambios se reflejan en el navegador sin recargar la página
- **Build de producción optimizado** usando Rollup internamente
- **Soporte nativo** para TypeScript, JSX, CSS modules, etc.

## La estructura básica de Vite en Laravel

Cuando creas un nuevo proyecto Laravel, ya viene con Vite configurado. Los archivos relevantes son:

```
mi-proyecto/
├── vite.config.js          // Configuración principal de Vite
├── package.json            // Dependencias de npm
├── resources/
│   ├── css/
│   │   └── app.css         // CSS principal
│   └── js/
│       └── app.js          // JavaScript principal
└── public/
    └── build/              // Aquí van los assets compilados (no en git)
```

## El archivo vite.config.js

Este es el corazón de tu configuración. El archivo por defecto que crea Laravel es:

```php
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
    ],
});
```

Vamos a entender cada parte:

### El plugin de Laravel para Vite

`laravel-vite-plugin` es el puente entre Vite y Laravel. Se encarga de:

1. Generar el archivo `public/build/manifest.json` que Laravel usa para encontrar los assets compilados.
2. Manejar el Hot Module Replacement con las vistas Blade.
3. Copiar los assets a `public/build/` al hacer el build de producción.

### La opción `input`

Define los archivos de entrada que Vite debe procesar. Puedes agregar múltiples archivos:

```php
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    plugins: [
        laravel({
            input: [
                'resources/css/app.css',
                'resources/css/admin.css',
                'resources/js/app.js',
                'resources/js/admin.js',
            ],
            refresh: true,
        }),
    ],
});
```

### La opción `refresh`

Con `refresh: true`, cuando modificas un archivo Blade, PHP o de rutas, Vite recarga automáticamente el navegador. Esto hace que el desarrollo sea mucho más fluido.

## La directiva @vite en Blade

Para incluir los assets compilados en tus vistas Blade, usa la directiva `@vite`:

```php
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi App</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    {{ $slot }}
</body>
</html>
```

Esta directiva hace cosas diferentes según el contexto:

- **En desarrollo** (con `npm run dev` corriendo): genera un script que se conecta al servidor de Vite en `http://localhost:5173` y carga los archivos directamente desde allí.
- **En producción** (después de `npm run build`): genera etiquetas `<link>` y `<script>` que apuntan a los archivos compilados en `public/build/`, con sus hashes para cache busting.

## Desarrollo vs Producción

### Modo desarrollo: npm run dev

```php
npm run dev
```

Este comando inicia el servidor de desarrollo de Vite en `http://localhost:5173`. Los archivos no se compilan a `public/build/`, sino que se sirven directamente desde memoria. Cualquier cambio que hagas en CSS o JavaScript se refleja en el navegador en milisegundos.

Mantén este proceso corriendo mientras desarrollas. No necesitas reiniciarlo a menos que cambies `vite.config.js`.

### Modo producción: npm run build

```php
npm run build
```

Este comando compila y optimiza todos los assets para producción:

- Minifica el CSS y JavaScript
- Genera hashes en los nombres de archivo para cache busting
- Copia todo a `public/build/`
- Genera `public/build/manifest.json`

Después de ejecutar este comando, la directiva `@vite` en Blade usará automáticamente los archivos compilados.

**Importante**: en producción, primero ejecuta `npm run build` y luego sube los archivos de `public/build/` al servidor. Muchos desarrolladores agregan `public/build/` al `.gitignore` y ejecutan `npm run build` como parte del proceso de despliegue.

## Trabajando con CSS en Vite

El archivo `resources/css/app.css` es tu punto de entrada para CSS. Si usas Tailwind CSS:

```php
// resources/css/app.css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

O si usas CSS estándar con imports:

```php
/* resources/css/app.css */
@import './variables.css';
@import './components/buttons.css';
@import './components/forms.css';

:root {
    --color-primary: #3b82f6;
    --color-secondary: #10b981;
}

body {
    font-family: 'Inter', sans-serif;
}
```

### Instalar Tailwind CSS con Vite

```php
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

Configura `tailwind.config.js` para que procese tus archivos Blade:

```php
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./resources/**/*.blade.php",
        "./resources/**/*.js",
        "./resources/**/*.vue",
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}
```

## Trabajando con JavaScript en Vite

El archivo `resources/js/app.js` es tu punto de entrada de JavaScript. Puedes usar módulos ES nativos:

```php
// resources/js/app.js
import './bootstrap';
import Alpine from 'alpinejs';

// Inicializar Alpine.js
window.Alpine = Alpine;
Alpine.start();

// O con módulos propios:
import { formatDate } from './utils/date';
import { initModal } from './components/modal';

document.addEventListener('DOMContentLoaded', () => {
    initModal();
});
```

### Instalar dependencias de JavaScript

```php
// Instalar Alpine.js
npm install alpinejs

// Instalar Axios (ya viene incluido en Laravel)
// npm install axios

// Instalar Vue.js
npm install vue @vitejs/plugin-vue
```

### Configurar Vue.js con Vite en Laravel

```php
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
});
```

## Variables de entorno en Vite

Vite tiene su propio sistema de variables de entorno. Para exponer variables a tu JavaScript, deben empezar con el prefijo `VITE_`:

```php
// En el .env
APP_URL=http://localhost:8000
VITE_APP_URL="${APP_URL}"
VITE_API_KEY=tu_clave_publica
```

En tu JavaScript:

```php
// resources/js/app.js
const appUrl = import.meta.env.VITE_APP_URL;
const apiKey = import.meta.env.VITE_API_KEY;

console.log(appUrl); // "http://localhost:8000"
```

**Nota importante**: las variables `VITE_*` se incrustan en el JavaScript en el momento del build. Nunca pongas claves secretas en variables `VITE_*` porque quedan expuestas en el código del navegador.

## Errores comunes con Vite en Laravel

### Error: "Vite manifest not found"

Este error ocurre cuando accedes a la aplicación sin haber ejecutado `npm run dev` (en desarrollo) o `npm run build` (en producción).

Solución en desarrollo:

```php
npm run dev
// Déjalo corriendo en una terminal aparte
```

Solución en producción:

```php
npm run build
// Esto genera public/build/manifest.json
```

### El CSS o JS no se actualiza en el navegador

Si estás en desarrollo y los cambios no se reflejan, verifica que el servidor de Vite está corriendo. Si lo iniciaste correctamente, revisa si hay algún error en la terminal donde corre `npm run dev`.

Si estás en producción, asegúrate de haber ejecutado `npm run build` y de que los nuevos archivos de `public/build/` se han subido al servidor.

### El servidor de Vite corre en un puerto diferente

Por defecto, Vite usa el puerto `5173`. Si ese puerto está ocupado, Vite usará el siguiente disponible y te lo indicará en la terminal. La directiva `@vite` detecta automáticamente el puerto correcto leyendo el archivo `public/hot`.

Si necesitas cambiar el puerto manualmente:

```php
// vite.config.js
export default defineConfig({
    server: {
        port: 3000,
    },
    plugins: [
        laravel({ ... }),
    ],
});
```

### Problemas con HTTPS en desarrollo

Si tu aplicación Laravel usa HTTPS en desarrollo, el servidor de Vite también necesita HTTPS para evitar problemas de contenido mixto:

```php
// vite.config.js
import fs from 'fs';

export default defineConfig({
    server: {
        https: {
            key: fs.readFileSync('/path/to/key.pem'),
            cert: fs.readFileSync('/path/to/cert.pem'),
        },
    },
    plugins: [
        laravel({ ... }),
    ],
});
```

Laravel Valet y Laravel Herd gestionan esto automáticamente.

## Alias de rutas en Vite

Para evitar imports relativos largos en JavaScript, puedes configurar alias:

```php
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
            '@components': path.resolve(__dirname, './resources/js/components'),
        },
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,
        }),
    ],
});
```

Ahora puedes usar:

```php
// resources/js/app.js
import { Button } from '@components/Button.vue';
// En lugar de:
import { Button } from '../../components/Button.vue';
```

## Conclusión

Vite ha mejorado enormemente la experiencia de desarrollo frontend en Laravel. El inicio instantáneo del servidor y el HMR ultrarrápido hacen que iterar sobre el diseño y el comportamiento de tu aplicación sea mucho más ágil que con las soluciones anteriores.

Los puntos clave a recordar: usa `npm run dev` mientras desarrollas, `npm run build` antes de desplegar, y la directiva `@vite(['archivo.css', 'archivo.js'])` en tus layouts Blade. El resto se gestiona automáticamente.
