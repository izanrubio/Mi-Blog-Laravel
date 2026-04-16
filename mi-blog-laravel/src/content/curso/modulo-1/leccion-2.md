---
modulo: 1
leccion: 2
title: 'Instalación en Windows, Mac y Linux'
description: 'Guía paso a paso para instalar Laravel en los tres sistemas operativos principales: Windows, macOS y Linux, con todos sus prerequisitos.'
duracion: '20 min'
quiz:
  - pregunta: '¿Cuál es la versión mínima de PHP requerida para instalar Laravel 11?'
    opciones:
      - 'PHP 7.4'
      - 'PHP 8.0'
      - 'PHP 8.2'
      - 'PHP 8.3'
    correcta: 2
    explicacion: 'Laravel 11 requiere PHP 8.2 como mínimo. Es importante mantener PHP actualizado para poder aprovechar las versiones más recientes de Laravel y sus mejoras de rendimiento.'
  - pregunta: '¿Qué herramienta se usa para crear un nuevo proyecto Laravel desde la terminal?'
    opciones:
      - 'npm create laravel'
      - 'composer create-project laravel/laravel'
      - 'laravel new proyecto'
      - 'Tanto B como C son correctas'
    correcta: 3
    explicacion: 'Puedes crear un proyecto Laravel de dos formas: usando Composer directamente con "composer create-project laravel/laravel" o instalando el instalador global de Laravel y usando "laravel new proyecto". Ambas son válidas.'
  - pregunta: '¿Qué comando de Artisan arranca el servidor de desarrollo de Laravel?'
    opciones:
      - 'php artisan run'
      - 'php artisan start'
      - 'php artisan serve'
      - 'php artisan up'
    correcta: 2
    explicacion: 'El comando "php artisan serve" arranca el servidor de desarrollo integrado de PHP en http://localhost:8000 por defecto. Es la forma más sencilla de probar tu aplicación Laravel localmente.'
---

## Introducción

Antes de escribir una sola línea de código Laravel, necesitas tener el entorno de desarrollo listo. En esta lección cubriremos la instalación completa en **Windows**, **macOS** y **Linux**. Sigue las instrucciones de tu sistema operativo y al final tendrás Laravel corriendo en tu máquina.

## Requisitos previos

Independientemente del sistema operativo, Laravel necesita lo siguiente:

| Requisito | Versión mínima |
|---|---|
| PHP | 8.2 |
| Composer | 2.x |
| Node.js + NPM | 18.x (recomendado) |
| Base de datos | MySQL 8.0 / PostgreSQL 13 / SQLite 3 |

---

## Instalación en Windows

### Opción 1: Laragon (recomendada para principiantes)

**Laragon** es el entorno de desarrollo más popular para Laravel en Windows. Instala PHP, MySQL, Nginx/Apache y Composer en un solo clic.

1. Descarga Laragon desde [laragon.org](https://laragon.org/download/).
2. Ejecuta el instalador y sigue los pasos (siguiente, siguiente, instalar).
3. Abre Laragon y haz clic en **"Start All"**.
4. Verifica que PHP está disponible:

```bash
php -v
# PHP 8.2.x (cli)
```

5. Verifica que Composer está disponible:

```bash
composer -V
# Composer version 2.x.x
```

### Opción 2: Manual con XAMPP + Composer

Si ya usas XAMPP:

1. Descarga XAMPP con PHP 8.2 desde [apachefriends.org](https://www.apachefriends.org/).
2. Agrega `C:\xampp\php` a la variable de entorno `PATH`:
   - Panel de control → Sistema → Configuración avanzada del sistema → Variables de entorno.
   - Edita la variable `Path` y agrega la ruta de PHP.
3. Descarga e instala Composer desde [getcomposer.org](https://getcomposer.org/download/).
4. El instalador de Composer detectará automáticamente tu PHP de XAMPP.

### Crear tu primer proyecto en Windows

Abre la terminal de Laragon (o CMD/PowerShell) y ejecuta:

```bash
# Navega a la carpeta de proyectos
cd C:\laragon\www

# Crea el proyecto
composer create-project laravel/laravel mi-proyecto

# Entra al proyecto
cd mi-proyecto

# Arranca el servidor
php artisan serve
```

Abre tu navegador en `http://localhost:8000` y verás la página de bienvenida de Laravel.

---

## Instalación en macOS

### Opción 1: Homebrew (recomendada)

Homebrew es el gestor de paquetes más popular para macOS. Si no lo tienes instalado, ábrelo desde la terminal:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Una vez instalado Homebrew, instala PHP:

```bash
brew install php

# Verifica la instalación
php -v
# PHP 8.2.x (cli)
```

### Instalar Composer en macOS

```bash
# Descarga el instalador de Composer
curl -sS https://getcomposer.org/installer | php

# Mueve Composer a una ubicación global
sudo mv composer.phar /usr/local/bin/composer

# Verifica
composer -V
```

### Opción 2: Laravel Herd

**Laravel Herd** es la solución oficial de Laravel para macOS. Instala PHP, Nginx y todo lo necesario con una interfaz gráfica muy sencilla.

1. Descarga Herd desde [herd.laravel.com](https://herd.laravel.com/).
2. Abre la aplicación e instala los componentes que te pida.
3. Herd agrega automáticamente PHP y Composer a tu PATH.

### Crear tu primer proyecto en macOS

```bash
# Navega a tu carpeta de proyectos
cd ~/Sites

# Crea el proyecto
composer create-project laravel/laravel mi-proyecto

# Entra al proyecto y arranca el servidor
cd mi-proyecto
php artisan serve
```

---

## Instalación en Linux

Las instrucciones aquí son para **Ubuntu/Debian**. Si usas Fedora, Arch u otra distribución, los nombres de los paquetes pueden variar ligeramente.

### Paso 1: Actualizar el sistema

```bash
sudo apt update && sudo apt upgrade -y
```

### Paso 2: Instalar PHP 8.2 y sus extensiones

```bash
# Agregar el repositorio de Ondřej Surý (PHP actualizado)
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update

# Instalar PHP 8.2 y las extensiones necesarias para Laravel
sudo apt install -y php8.2 php8.2-cli php8.2-common php8.2-mysql \
    php8.2-xml php8.2-curl php8.2-mbstring php8.2-zip \
    php8.2-bcmath php8.2-tokenizer php8.2-fileinfo

# Verificar
php -v
```

### Paso 3: Instalar Composer

```bash
# Descarga e instala Composer globalmente
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer

# Verifica
composer -V
```

### Paso 4: Instalar MySQL (opcional, puedes usar SQLite para empezar)

```bash
sudo apt install -y mysql-server

# Asegurar la instalación
sudo mysql_secure_installation

# Iniciar el servicio
sudo systemctl start mysql
sudo systemctl enable mysql
```

### Paso 5: Crear el proyecto

```bash
cd ~/projects  # o la carpeta que prefieras

composer create-project laravel/laravel mi-proyecto

cd mi-proyecto
php artisan serve
```

---

## Usar el instalador global de Laravel

En cualquier sistema operativo, una vez que tienes Composer, puedes instalar el **instalador global de Laravel**:

```bash
composer global require laravel/installer
```

Asegúrate de que el directorio global de Composer esté en tu PATH:

- **Linux/macOS**: agrega `~/.composer/vendor/bin` a tu `.bashrc` o `.zshrc`:

```bash
echo 'export PATH="$HOME/.composer/vendor/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

- **Windows**: el instalador de Composer suele agregar esto automáticamente.

Con el instalador global, crear proyectos es aún más sencillo:

```bash
laravel new mi-proyecto
```

El instalador interactivo te preguntará qué stack quieres usar (Blade, Livewire, Inertia/Vue, Inertia/React), si quieres autenticación y qué base de datos prefieres.

---

## Verificar que todo funciona

Después de crear tu proyecto, verifica que la estructura básica está correcta:

```bash
# Dentro de la carpeta del proyecto
php artisan --version
# Laravel Framework 11.x.x

php artisan serve
# INFO  Server running on [http://127.0.0.1:8000].
```

Abre `http://localhost:8000` en tu navegador. Deberías ver la pantalla de bienvenida de Laravel con el logo y la versión.

## Instalar Node.js (para assets front-end)

Laravel usa **Vite** para compilar assets (CSS y JavaScript). Para ello necesitas Node.js:

```bash
# En macOS/Linux con nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
nvm use --lts

# Verifica
node -v
npm -v
```

Una vez instalado Node, dentro de tu proyecto Laravel instala las dependencias de front-end:

```bash
npm install
npm run dev  # inicia el servidor de Vite en modo desarrollo
```

## Resumen de comandos esenciales

```bash
# Crear un nuevo proyecto
composer create-project laravel/laravel nombre-proyecto
# o
laravel new nombre-proyecto

# Arrancar el servidor de desarrollo
php artisan serve

# Ver la versión de Laravel
php artisan --version

# Instalar dependencias de front-end
npm install && npm run dev
```

¡Ya tienes Laravel instalado! En la siguiente lección exploraremos en detalle la estructura de carpetas del proyecto para entender qué hace cada directorio y archivo.
