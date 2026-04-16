---
title: 'Git básico para proyectos Laravel: guía desde cero'
description: 'Aprende Git desde cero aplicado a proyectos Laravel. Commits, ramas, .gitignore y flujo de trabajo profesional para no perder nunca tu código.'
pubDate: '2026-04-16'
tags: ['laravel', 'git', 'roadmap']
---

Desarrollar sin Git es como escribir sin guardar el documento. Un error, un experimento que sale mal, un cambio que necesitas deshacer: sin control de versiones pierdes horas de trabajo. Con Git tienes un historial completo de cada cambio, puedes experimentar en ramas separadas y colaborar con otros sin pisarse el trabajo. Para cualquier proyecto Laravel, Git no es opcional.

## Qué es Git y por qué usarlo

Git es un **sistema de control de versiones distribuido**. Registra cada cambio que haces en el código, quién lo hizo y cuándo. Esto te permite:

- Volver a cualquier versión anterior de tu código.
- Trabajar en nuevas funcionalidades sin romper la versión estable.
- Colaborar con otros desarrolladores sin conflictos constantes.
- Desplegar con confianza sabiendo exactamente qué ha cambiado.

Git trabaja de forma local: tienes toda la historia del proyecto en tu máquina. Los servicios como GitHub, GitLab o Bitbucket son plataformas remotas para sincronizar y compartir ese repositorio.

## Instalación y configuración inicial

```bash
# En Ubuntu/Debian
sudo apt install git

# En macOS
brew install git

# Verifica la versión
git --version
# git version 2.43.0

# Configuración inicial (obligatorio antes de hacer commits)
git config --global user.name "Tu Nombre"
git config --global user.email "tu@email.com"

# Editor por defecto para los mensajes de commit
git config --global core.editor nano

# Ver la configuración actual
git config --list
```

## Iniciar un repositorio

Tienes dos formas de empezar con Git:

### git init — nuevo proyecto

```bash
# Crear un nuevo proyecto Laravel
composer create-project laravel/laravel mi-blog

# Entrar al directorio
cd mi-blog

# Inicializar el repositorio Git
git init
# Initialized empty Git repository in /home/carlos/mi-blog/.git/
```

### git clone — proyecto existente

```bash
# Clonar un repositorio remoto
git clone https://github.com/usuario/mi-blog.git

# Clonar en una carpeta con nombre diferente
git clone https://github.com/usuario/mi-blog.git nombre-local

# Entrar al proyecto clonado
cd mi-blog

# Instalar las dependencias PHP
composer install

# Configurar el entorno
cp .env.example .env
php artisan key:generate
```

## El staging area y los commits

Git tiene tres zonas: el **working directory** (tus archivos), el **staging area** (lo que vas a commitear) y el **repositorio** (los commits guardados).

```bash
# Ver el estado actual
git status

# Añadir un archivo específico al staging
git add app/Http/Controllers/PostController.php

# Añadir múltiples archivos
git add app/Models/Post.php database/migrations/

# Añadir todos los cambios (con cuidado)
git add .

# Ver qué hay en el staging antes de commitear
git diff --staged

# Crear el commit con mensaje
git commit -m "feat: añadir CRUD completo de posts"

# Commit saltándose el staging (para archivos ya tracked)
git commit -am "fix: corregir validación del formulario de contacto"
```

### Buenos mensajes de commit

Un buen mensaje de commit explica el "qué" y el "por qué":

```bash
# Formato convencional (muy usado en proyectos profesionales)
git commit -m "feat: añadir sistema de autenticación con email"
git commit -m "fix: corregir error 500 al subir imágenes mayores de 2MB"
git commit -m "refactor: extraer lógica de pago a PaymentService"
git commit -m "docs: actualizar README con instrucciones de instalación"
git commit -m "chore: actualizar dependencias de Composer"
```

Prefijos comunes: `feat` (nueva funcionalidad), `fix` (corrección de bug), `refactor`, `docs`, `test`, `chore`.

## Ramas (branches)

Las ramas te permiten trabajar en paralelo sin interferir con el código estable:

```bash
# Ver todas las ramas
git branch

# Crear una nueva rama
git branch feature/sistema-comentarios

# Cambiar a una rama existente
git checkout feature/sistema-comentarios

# Crear y cambiar en un solo comando (lo más usado)
git checkout -b feature/sistema-comentarios

# Sintaxis moderna (Git 2.23+)
git switch -c feature/sistema-comentarios

# Ver en qué rama estás
git branch --show-current
```

### Flujo de trabajo típico con ramas

```bash
# Estás en main, todo estable
git branch
# * main

# Creas una rama para la nueva funcionalidad
git checkout -b feature/autenticacion

# Trabajas y haces commits
git add .
git commit -m "feat: añadir middleware de autenticación"
git commit -m "feat: crear vistas de login y registro"
git commit -m "test: añadir tests para el flujo de autenticación"

# Vuelves a main y fusionas
git checkout main
git merge feature/autenticacion

# Eliminas la rama ya mergeada
git branch -d feature/autenticacion
```

## Repositorios remotos

El remoto es la copia del repositorio en un servidor (GitHub, GitLab, etc.):

```bash
# Ver los remotos configurados
git remote -v

# Añadir un remoto
git remote add origin https://github.com/usuario/mi-blog.git

# Subir tu código al remoto por primera vez
git push -u origin main

# Subir cambios después (ya con -u configurado)
git push

# Bajar cambios del remoto
git pull

# Bajar sin fusionar automáticamente
git fetch origin

# Ver el historial de commits
git log --oneline
git log --oneline --graph --all
```

## .gitignore para proyectos Laravel

El archivo `.gitignore` le dice a Git qué archivos debe ignorar. En Laravel es crítico ignorar correctamente:

```bash
# .gitignore para Laravel

# Dependencias (se instalan con composer install)
/vendor/

# Variables de entorno y secretos
.env
.env.backup
.env.production

# Dependencias de Node
/node_modules/

# Caché y archivos generados
/bootstrap/cache/*.php
/storage/*.key
storage/app/public
storage/framework/cache/
storage/framework/sessions/
storage/framework/views/

# Archivos del sistema operativo
.DS_Store
Thumbs.db

# Editor y IDE
.idea/
.vscode/
*.swp

# Archivos compilados
/public/hot
/public/storage
/public/mix-manifest.json

# Logs
*.log

# Tests
.phpunit.result.cache
```

Laravel ya incluye un `.gitignore` por defecto al crear el proyecto, pero conviene revisarlo y adaptarlo. Lo más importante es que **`.env` nunca debe subirse al repositorio**. Contiene las contraseñas de tu base de datos y otras credenciales.

En su lugar, sube `.env.example` con los nombres de las variables pero sin valores secretos:

```bash
# .env.example (este sí va en git)
APP_NAME=Laravel
APP_ENV=local
APP_KEY=
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_bd
DB_USERNAME=usuario
DB_PASSWORD=
```

## git log y git status

```bash
# Estado del working directory
git status

# Historial compacto
git log --oneline
# a3f9b2c feat: añadir paginación a listado de posts
# 9e1d4a1 fix: corregir redirección tras login
# 7c2f8b3 feat: crear modelo y migraciones de Category

# Historial con ramas visualizado
git log --oneline --graph --all

# Ver qué cambió en un commit concreto
git show a3f9b2c

# Ver diferencias no commiteadas
git diff

# Ver diferencias en staging
git diff --staged
```

## Resolver conflictos básicos

Un conflicto ocurre cuando dos ramas modificaron la misma línea del mismo archivo:

```bash
# Al hacer merge, Git avisa del conflicto
git merge feature/nueva-funcionalidad
# CONFLICT (content): Merge conflict in app/Http/Controllers/HomeController.php

# Ver qué archivos tienen conflicto
git status

# Abrir el archivo con conflicto
nano app/Http/Controllers/HomeController.php
```

El archivo mostrará marcadores como estos:

```php
<<<<<<< HEAD
public function index(): View
{
    $posts = Post::latest()->take(6)->get();
=======
public function index(): View
{
    $posts = Post::with('category')->latest()->paginate(9);
>>>>>>> feature/nueva-funcionalidad
```

Editas el archivo para dejar el código correcto (una de las versiones, ambas combinadas, o algo nuevo), eliminas los marcadores y luego:

```bash
# Marcar el conflicto como resuelto
git add app/Http/Controllers/HomeController.php

# Completar el merge
git commit -m "merge: integrar paginación con categorías"
```

## Flujo de trabajo típico en Laravel

Este es el flujo que usa la mayoría de equipos:

```bash
# 1. Actualizar main antes de empezar
git checkout main
git pull origin main

# 2. Crear rama para la nueva funcionalidad
git checkout -b feature/sistema-tags

# 3. Desarrollar: crear migraciones, modelos, controladores
php artisan make:migration create_tags_table
php artisan make:model Tag -mc
# ... código ...

# 4. Commitear en pasos lógicos
git add database/migrations/
git commit -m "feat: añadir migración para tabla de tags"

git add app/Models/Tag.php
git commit -m "feat: crear modelo Tag con relación a Post"

git add app/Http/Controllers/TagController.php
git commit -m "feat: crear TagController con index y show"

# 5. Subir la rama al remoto
git push -u origin feature/sistema-tags

# 6. Crear Pull Request en GitHub/GitLab
# (desde la interfaz web o con gh pr create)

# 7. Tras aprobación, merge a main
git checkout main
git pull origin main
```

## Comandos de rescate

```bash
# Deshacer cambios en un archivo (volver al último commit)
git checkout -- app/Models/Post.php

# Sacar un archivo del staging sin perder los cambios
git restore --staged app/Models/Post.php

# Deshacer el último commit manteniendo los cambios
git reset --soft HEAD~1

# Ver todos los commits, incluyendo los "perdidos"
git reflog
```

## Conclusión

Git es una herramienta que se aprende usando. Los comandos básicos los automatizas en pocos días: `git status`, `git add`, `git commit`, `git push`. Las ramas y los merges los dominas en pocas semanas. Con el `.gitignore` correcto, un flujo de ramas limpio y commits descriptivos, tu proyecto Laravel tendrá un historial legible y profesional desde el primer día.
