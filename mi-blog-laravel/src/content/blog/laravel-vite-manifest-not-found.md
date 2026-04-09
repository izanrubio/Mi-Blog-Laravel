---
title: 'Laravel Vite manifest not found — Cómo solucionarlo'
description: 'Error Vite manifest not found en Laravel: qué lo causa y cómo solucionarlo ejecutando npm run build o npm run dev antes de servir la aplicación.'
pubDate: '2024-02-17'
tags: ['laravel', 'errores', 'vite', 'frontend']
---

# Laravel Vite manifest not found — Cómo solucionarlo

Pocas cosas son tan desconcertantes para alguien que está empezando con Laravel como clonar un proyecto, ejecutar `php artisan serve` y encontrarse con un error que dice "Vite manifest not found at: /ruta/del/proyecto/public/build/manifest.json". La aplicación parece rota, pero el código PHP está bien. El problema está en los assets de frontend.

En esta guía explicamos qué es el manifest de Vite, por qué es necesario, cuándo aparece este error y cómo solucionarlo en cada situación.

## ¿Qué es el manifest.json de Vite?

Cuando Vite compila tus assets (CSS, JavaScript), añade un hash único al nombre de cada archivo para el cache busting. Por ejemplo:

- `resources/css/app.css` → `public/build/assets/app-Bh52jgmU.css`
- `resources/js/app.js` → `public/build/assets/app-CXbYnJfD.js`

El `manifest.json` es un archivo que mapea los nombres originales con los nombres compilados (con hash). La directiva `@vite()` en tus vistas Blade usa este archivo para saber qué archivo servir:

```php
// manifest.json generado por npm run build
{
    "resources/css/app.css": {
        "file": "assets/app-Bh52jgmU.css",
        "src": "resources/css/app.css",
        "isEntry": true
    },
    "resources/js/app.js": {
        "file": "assets/app-CXbYnJfD.js",
        "src": "resources/js/app.js",
        "isEntry": true
    }
}
```

Cuando Laravel no encuentra este archivo en `public/build/manifest.json`, no sabe qué archivos de assets servir y lanza el error.

## ¿Por qué aparece el error?

El error aparece porque:

1. **Nunca ejecutaste `npm run build`** (el caso más común): los assets no están compilados.
2. **Ejecutaste `npm run dev` pero la app intenta leer el manifest** en lugar de conectar al servidor de Vite.
3. **`public/build/` está en el `.gitignore`**: clonaste el proyecto pero los assets compilados no están en el repositorio.
4. **`npm run dev` no está corriendo** cuando deberías estar en modo desarrollo.
5. **Quedó un archivo `.hot` obsoleto** que confunde a Laravel sobre si está en modo dev o no.

## Solución 1: ejecutar npm run build (para producción)

La solución más común y directa. Después de clonar el proyecto o en un entorno de producción:

```php
// 1. Instalar las dependencias de npm
npm install
// O con una instalación limpia y reproducible:
npm ci

// 2. Compilar los assets para producción
npm run build
```

Esto crea la carpeta `public/build/` con:
- `manifest.json` — el mapa de archivos
- `assets/` — los archivos CSS y JS compilados y optimizados

Después de ejecutar `npm run build`, el error desaparece porque `manifest.json` ya existe.

## Solución 2: ejecutar npm run dev (para desarrollo)

En desarrollo, no necesitas compilar. Usas el servidor de Vite que sirve los assets directamente:

```php
npm run dev
```

Deja este proceso corriendo en una terminal separada mientras desarrollas. Verás algo como:

```
  VITE v5.x.x  ready in 432 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help

  LARAVEL v11.x.x  plugin v1.x.x

  ➜  APP_URL: http://localhost:8000
```

Mientras `npm run dev` está corriendo, la directiva `@vite()` en Blade se conecta al servidor de Vite en lugar de leer el `manifest.json`. Si cierras ese proceso, Laravel intentará leer el manifest y fallará si no está compilado.

## Entender cuándo usa Laravel el manifest vs el servidor de Vite

La directiva `@vite()` tiene una lógica de prioridad:

1. Si existe el archivo `public/hot`, conecta al servidor de Vite en desarrollo.
2. Si no existe `public/hot`, intenta leer `public/build/manifest.json`.
3. Si tampoco existe el manifest, lanza el error.

El archivo `public/hot` lo crea Vite automáticamente cuando ejecutas `npm run dev` y lo borra cuando lo detienes. Contiene la URL del servidor de Vite:

```php
// Contenido de public/hot cuando npm run dev está corriendo:
http://localhost:5173
```

## Problema: el archivo public/hot quedó obsoleto

Un caso especial: si el servidor de Vite murió inesperadamente (el proceso fue matado, el sistema se reinició, etc.), puede que el archivo `public/hot` quede en disco. Cuando esto pasa:

- Existe `public/hot` → Laravel intenta conectar al servidor de Vite
- El servidor de Vite no está corriendo → el navegador no puede cargar los assets
- La página carga pero sin CSS ni JavaScript, o muestra errores en la consola

**Solución**: borra el archivo `public/hot`:

```php
rm public/hot
```

Y luego levanta Vite correctamente con `npm run dev`.

## Configuración correcta del flujo de trabajo

### En desarrollo local

```php
// Terminal 1: servidor PHP
php artisan serve

// Terminal 2: servidor de Vite (dejarlo corriendo siempre)
npm run dev

// Accede en http://localhost:8000
// Los assets se cargan desde http://localhost:5173
```

### En producción o staging

```php
// En el proceso de deploy:
npm ci                 // Instalar dependencias
npm run build          // Compilar assets
php artisan optimize   // Cachear configuración, rutas y vistas
```

Los archivos en `public/build/` se sirven directamente por Nginx como archivos estáticos, no necesitan Vite corriendo.

## El .gitignore y los assets compilados

Por convención, `public/build/` se añade al `.gitignore` porque:

1. Los archivos compilados son grandes y cambian en cada build
2. Deben regenerarse en cada despliegue con el código fuente correcto
3. Guardarlos en Git causaría conflictos innecesarios

```php
// .gitignore (Laravel por defecto)
/public/build
```

Esto significa que cuando clonas un proyecto, **siempre** debes ejecutar `npm install && npm run build` (o `npm run dev`) antes de que los assets funcionen.

## La variable VITE_APP_URL y APP_URL

Una causa menos frecuente del error es que `APP_URL` en el `.env` no coincide con la URL desde la que accedes a la aplicación. Vite usa `APP_URL` para configurar el servidor de desarrollo y para generar las URLs de los assets.

```php
// .env
APP_URL=http://localhost:8000  // Debe coincidir con donde accedes

// Si accedes desde http://127.0.0.1:8000 pero APP_URL es http://localhost:8000,
// pueden surgir problemas de HMR (Hot Module Replacement)
```

Si ves que el HMR no funciona (los cambios no se reflejan en el navegador), verifica que `APP_URL` coincide con la URL que usas en el navegador.

## Error en producción: el manifest existe pero la app sigue fallando

Si desplegaste con `npm run build` y el `manifest.json` existe pero sigues viendo el error, puede que la caché de configuración de Laravel esté apuntando a una ruta incorrecta:

```php
// Limpiar toda la caché de Laravel:
php artisan optimize:clear

// Y si usas config:cache en producción, regenerarla:
php artisan optimize
```

También verifica que el path en el error coincide con la ruta real de tu proyecto. A veces hay discrepancia entre la ruta en la caché y la ruta real del proyecto en el servidor.

## Personalizar la carpeta de build de Vite

Si por alguna razón necesitas cambiar la carpeta de build (por ejemplo, si tienes restricciones de configuración del servidor):

```php
// vite.config.js
import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';

export default defineConfig({
    build: {
        outDir: 'public/dist',  // Cambia public/build a public/dist
    },
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            buildDirectory: 'dist',  // Indica al plugin la carpeta de build
            refresh: true,
        }),
    ],
});
```

Si cambias la carpeta de build, también debes actualizar tu configuración de servidor web para servir los archivos estáticos desde la nueva carpeta.

## Automatizar la compilación en el deploy

Para no olvidar ejecutar `npm run build` en cada deploy, agrégalo a tu proceso de deploy. Si usas un script de bash:

```php
#!/bin/bash
# deploy.sh

set -e  # Parar si hay algún error

cd /var/www/mi-app

echo "Activando modo mantenimiento..."
php artisan down

echo "Actualizando código..."
git pull origin main

echo "Instalando dependencias de PHP..."
composer install --no-dev --optimize-autoloader

echo "Instalando dependencias de Node.js y compilando assets..."
npm ci
npm run build

echo "Ejecutando migraciones..."
php artisan migrate --force

echo "Optimizando Laravel..."
php artisan optimize:clear
php artisan optimize

echo "Reiniciando workers..."
php artisan queue:restart

echo "Desactivando modo mantenimiento..."
php artisan up

echo "Deploy completado."
```

## Verificar que el build fue exitoso

Después de `npm run build`, verifica que los archivos existen:

```php
ls -la public/build/
// Deberías ver:
// manifest.json
// assets/
//   app-Bh52jgmU.css
//   app-CXbYnJfD.js

cat public/build/manifest.json
// Verifica que el contenido es válido
```

## Conclusión

El error "Vite manifest not found" es uno de los más simples de resolver una vez que entiendes el flujo de trabajo de Vite. La causa siempre es la misma: Laravel busca el manifest de Vite pero no existe porque los assets no han sido compilados.

Recuerda: en desarrollo, `npm run dev` (deja corriendo). En producción, `npm run build` (antes del deploy). Y si ves el error inesperadamente, verifica si hay un archivo `public/hot` obsoleto que puedas borrar.
