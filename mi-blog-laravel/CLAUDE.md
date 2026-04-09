# CLAUDE.md — Instrucciones para Claude Code

Este archivo define el flujo de trabajo que Claude debe seguir en cada tarea en este proyecto.

## Stack

- **Framework**: Astro 6 con Content Collections (glob loader)
- **CSS**: Tailwind CSS v4 (vía `@tailwindcss/vite`)
- **Deploy**: Vercel
- **Contenido**: Markdown `.md` en `src/content/blog/`
- **Rama de desarrollo**: `dev` (nunca trabajar directo en `main`)

## Regla principal — Test → Fix → Push

**Cada vez que hagas un cambio, SIEMPRE:**

1. **Ejecuta el build** para verificar que no hay errores de compilación:
   ```bash
   cd mi-blog-laravel && npm run build
   ```

2. **Si el build falla**: Analiza el error, corrígelo y vuelve a ejecutar el build. Repite hasta que pase.

3. **Si el build pasa**: Hace commit y push a la rama `dev`:
   ```bash
   git add -A
   git commit -m "descripción del cambio"
   git push origin dev
   ```

4. **Nunca hacer push** si el build tiene errores.

## Convenciones del proyecto

### Artículos de blog
- Ubicación: `src/content/blog/<slug>.md`
- Frontmatter obligatorio:
  ```yaml
  ---
  title: 'Título del artículo'
  description: 'Descripción SEO de 150-160 caracteres'
  pubDate: 'YYYY-MM-DD'
  tags: ['laravel', 'categoria']
  ---
  ```
- `heroImage` es opcional. Si se incluye, debe apuntar a un archivo existente con ruta relativa, ej: `../../assets/blog-placeholder-1.jpg`
- Sin `heroImage` si no existe la imagen (evita errores de build)

### Frontmatter schema (src/content.config.ts)
- `title`: string (requerido)
- `description`: string (requerido)
- `pubDate`: fecha (requerido)
- `updatedDate`: fecha (opcional)
- `heroImage`: image() de astro:content (opcional)
- `tags`: array de strings (opcional, default [])

### Componentes
- `src/components/Header.astro` — Navegación sticky con colores Laravel
- `src/components/Footer.astro` — Footer con fondo oscuro
- `src/layouts/BlogPost.astro` — Layout de artículo con reading time y related posts
- `src/pages/index.astro` — Home page con hero + categorías + artículos recientes
- `src/pages/blog/index.astro` — Listado de todos los artículos
- `src/pages/blog/[...slug].astro` — Página individual del artículo

### Colores del tema
- **Rojo Laravel**: `#FF2D20`
- **Rojo oscuro**: `#CC2419`
- **Fondo**: `#ffffff`
- **Fondo claro**: `#f9fafb`
- **Texto principal**: `#111827`
- **Texto secundario**: `#6b7280`

### Rama de trabajo
- Siempre trabajar en la rama `dev`
- `main` solo recibe merges después de verificar que todo funciona

## Comandos útiles

```bash
# Directorio del proyecto
cd /home/izaanrubiio/Documentos/PROYECTOS/Mi-Blog-Laravel/mi-blog-laravel

# Servidor de desarrollo
npm run dev

# Build de producción (SIEMPRE ejecutar antes de push)
npm run build

# Preview del build
npm run preview

# Ver rama actual
git branch

# Cambiar a dev si no estás en ella
git checkout dev
```

## Flujo para añadir un artículo nuevo

1. Crear el archivo `.md` en `src/content/blog/`
2. Rellenar frontmatter y contenido (mínimo 800 palabras)
3. Ejecutar `npm run build`
4. Si pasa: `git add src/content/blog/nuevo-articulo.md && git commit -m "add: artículo sobre X" && git push origin dev`
5. Si falla: revisar el error (normalmente frontmatter incorrecto o imagen no encontrada)

## Flujo para cambiar el diseño

1. Editar el archivo correspondiente
2. Ejecutar `npm run build`
3. Si pasa: commit + push
4. Si falla: corregir y repetir

## Notas importantes

- **Imágenes en artículos**: Usar rutas relativas `../../assets/blog-placeholder-N.jpg` (N = 1 al 5) o simplemente omitir `heroImage`
- **Lang HTML**: Todos los archivos `.astro` deben tener `lang="es"` en el tag `<html>`
- **SEO**: Cada artículo debe tener una descripción entre 150-160 caracteres
- **Tags**: Usar tags en minúsculas, sin acentos, separados por comas
- **URLs**: Los slugs son el nombre del archivo sin `.md`, en kebab-case
