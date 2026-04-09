---
title: 'Cómo instalar Laravel en Ubuntu y Linux'
description: 'Instala Laravel en Ubuntu 22.04 o cualquier distro Linux. Guía con apt, PHP 8.2, Composer y configuración del proyecto desde cero.'
pubDate: '2026-04-09'
tags: ['laravel', 'instalacion', 'ubuntu', 'linux']
---

# Cómo instalar Laravel en Ubuntu y Linux

Linux es el sistema operativo que más se parece al entorno de producción donde eventualmente vas a desplegar tu aplicación, lo que lo convierte en una excelente opción para desarrollar con Laravel. En esta guía usaremos Ubuntu 22.04, pero los pasos son prácticamente idénticos para Debian, Linux Mint y otras distribuciones basadas en Debian.

## Requisitos del sistema

Laravel 11 requiere:

- **PHP 8.2 o superior**
- **Extensiones PHP**: BCMath, Ctype, cURL, DOM, Fileinfo, JSON, Mbstring, OpenSSL, PCRE, PDO, Tokenizer, XML
- **Composer**: el gestor de dependencias de PHP
- **Servidor de base de datos**: MySQL, PostgreSQL o SQLite

## Paso 1: Actualizar el sistema e instalar dependencias

Siempre es buena práctica empezar con el sistema actualizado:

```php
sudo apt update && sudo apt upgrade -y
```

### Agregar el repositorio de PHP (Ondrej PPA)

Ubuntu 22.04 incluye PHP 8.1 por defecto, pero necesitamos PHP 8.2 o superior. Usaremos el PPA de Ondrej Sury, que es el repositorio más confiable para tener versiones modernas de PHP en Ubuntu:

```php
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
```

## Paso 2: Instalar PHP y sus extensiones

Ahora instala PHP 8.2 con todas las extensiones que Laravel necesita:

```php
sudo apt install -y \
    php8.2 \
    php8.2-cli \
    php8.2-fpm \
    php8.2-mysql \
    php8.2-pgsql \
    php8.2-sqlite3 \
    php8.2-mbstring \
    php8.2-xml \
    php8.2-curl \
    php8.2-zip \
    php8.2-bcmath \
    php8.2-tokenizer \
    php8.2-fileinfo \
    php8.2-dom \
    php8.2-gd \
    unzip \
    git
```

Verifica que PHP está correctamente instalado:

```php
php --version
// PHP 8.2.x (cli)
```

Verifica que las extensiones necesarias están cargadas:

```php
php -m | grep -E "mbstring|xml|curl|zip|bcmath|pdo"
```

Deberías ver las extensiones listadas en la salida.

## Paso 3: Instalar Composer

Composer es el gestor de dependencias de PHP. Vamos a instalarlo globalmente para poder usarlo desde cualquier directorio:

```php
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
```

Verifica la instalación:

```php
composer --version
// Composer version 2.x.x
```

### Actualizar Composer si ya lo tenías instalado

```php
composer self-update
```

## Paso 4: Crear el proyecto Laravel

Navega a tu directorio de proyectos y crea un nuevo proyecto. Si no tienes una carpeta específica, puedes usar `~/proyectos`:

```php
mkdir -p ~/proyectos
cd ~/proyectos
composer create-project laravel/laravel mi-proyecto
cd mi-proyecto
```

Composer descargará Laravel y todas sus dependencias. Este proceso puede tardar entre 1 y 3 minutos dependiendo de tu conexión a internet.

## Paso 5: Configurar permisos

Esta es una parte crítica que muchos tutoriales omiten. Laravel necesita escribir en las carpetas `storage/` y `bootstrap/cache/`. Si el servidor web (Nginx o Apache) no tiene permisos de escritura en estas carpetas, la aplicación fallará.

Para desarrollo local con `php artisan serve`, el usuario que ejecuta el comando ya tiene los permisos correctos. Pero es buena práctica configurarlos correctamente desde el principio:

```php
// Ajusta los permisos de las carpetas que Laravel necesita escribir
chmod -R 775 storage bootstrap/cache

// Si tu usuario actual necesita ser propietario:
chown -R $USER:$USER storage bootstrap/cache
```

Si en producción usas Nginx con PHP-FPM, el usuario del servidor web suele ser `www-data`:

```php
// En producción (no en desarrollo local):
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

## Paso 6: Configurar el archivo .env

El archivo `.env` ya se creó automáticamente durante `composer create-project`. Ábrelo con nano o tu editor favorito:

```php
nano .env
```

Las variables más importantes son:

```php
APP_NAME="Mi Proyecto Laravel"
APP_ENV=local
APP_KEY=base64:clave_generada_automaticamente
APP_DEBUG=true
APP_URL=http://localhost:8000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_base_datos
DB_USERNAME=tu_usuario
DB_PASSWORD=tu_password
```

Si no tienes MySQL instalado todavía, puedes usar SQLite para empezar sin configurar nada:

```php
DB_CONNECTION=sqlite
// Basta con dejar las otras variables DB_* sin valor o comentarlas
```

Con SQLite, crea el archivo de base de datos:

```php
touch database/database.sqlite
```

Genera la clave de aplicación si por algún motivo no se generó:

```php
php artisan key:generate
```

## Paso 7: Ejecutar las migraciones (opcional)

Si tienes la base de datos configurada, ejecuta las migraciones iniciales:

```php
php artisan migrate
```

Si usas MySQL, primero necesitas crear la base de datos. Puedes hacerlo desde la terminal de MySQL:

```php
// Instalar MySQL si no lo tienes:
sudo apt install -y mysql-server
sudo mysql_secure_installation

// Crear la base de datos:
sudo mysql -u root -p
```

```php
// Dentro de MySQL:
CREATE DATABASE nombre_base_datos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tu_usuario'@'localhost' IDENTIFIED BY 'tu_password';
GRANT ALL PRIVILEGES ON nombre_base_datos.* TO 'tu_usuario'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Paso 8: Levantar el servidor de desarrollo

```php
php artisan serve
```

Abre tu navegador en `http://localhost:8000` y verás la pantalla de bienvenida de Laravel.

Para que el servidor sea accesible desde otros dispositivos en tu red local (útil para pruebas en móvil):

```php
php artisan serve --host=0.0.0.0 --port=8000
```

## Instalar Node.js y npm (necesario para el frontend)

Laravel usa Vite para compilar assets de frontend. Para usar CSS y JavaScript necesitas Node.js:

```php
// Instalar Node.js usando NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

// Verificar
node --version
npm --version
```

Una vez instalado Node.js, instala las dependencias de frontend:

```php
npm install
npm run dev  // Para desarrollo con Hot Module Replacement
```

## Problemas comunes en Ubuntu y Linux

### Error: "Unable to locate package php8.2"

Esto ocurre cuando no agregaste el PPA de Ondrej. Ejecuta:

```php
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install php8.2
```

### Error: "composer: Permission denied"

El archivo composer.phar no tiene permisos de ejecución o no está en el PATH:

```php
sudo chmod +x /usr/local/bin/composer
// O reinstala siguiendo el Paso 3
```

### Error: "The stream or file could not be opened" en logs

Problema de permisos en `storage/`:

```php
sudo chmod -R 775 storage bootstrap/cache
// Si usas www-data como servidor web:
sudo chown -R www-data:$USER storage bootstrap/cache
```

### PHP no encuentra las extensiones

Después de instalar extensiones de PHP, puede que necesites reiniciar PHP-FPM o simplemente verificar que la extensión está habilitada:

```php
php -m | grep mbstring
// Si no aparece, verifica que está instalada:
sudo apt install php8.2-mbstring
```

### Error: "SQLSTATE[HY000] [2002] Connection refused"

MySQL no está corriendo. Inícialo con:

```php
sudo systemctl start mysql
sudo systemctl enable mysql  // Para que inicie automáticamente
```

## Configurar un servidor web real (Nginx) para desarrollo

Aunque `php artisan serve` es suficiente para desarrollo básico, si quieres un setup más parecido a producción puedes instalar Nginx:

```php
sudo apt install -y nginx
```

Crea un archivo de configuración para tu proyecto:

```php
sudo nano /etc/nginx/sites-available/mi-proyecto
```

Con este contenido:

```php
server {
    listen 80;
    server_name mi-proyecto.local;
    root /home/tu-usuario/proyectos/mi-proyecto/public;

    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

Activa el sitio:

```php
sudo ln -s /etc/nginx/sites-available/mi-proyecto /etc/nginx/sites-enabled/
sudo nginx -t  // Verificar configuración
sudo systemctl reload nginx
```

Agrega el dominio local a `/etc/hosts`:

```php
sudo nano /etc/hosts
// Agrega esta línea:
// 127.0.0.1  mi-proyecto.local
```

## Conclusión

Ubuntu y Linux en general son excelentes plataformas para desarrollar con Laravel. La experiencia es más fluida que en Windows porque el ecosistema de herramientas está diseñado pensando en sistemas Unix. Con PHP, Composer e instalados y los permisos correctos en `storage/`, tienes todo lo necesario para construir aplicaciones robustas.

El siguiente paso natural es aprender sobre migraciones, Eloquent ORM y el sistema de rutas de Laravel. ¡Buena suerte!
