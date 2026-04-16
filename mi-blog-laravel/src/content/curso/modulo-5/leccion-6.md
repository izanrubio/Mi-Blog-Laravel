---
modulo: 5
leccion: 6
title: 'Despliegue en producción'
description: 'Guía completa para desplegar una aplicación Laravel en producción: servidor VPS, Nginx, MySQL, variables de entorno, permisos y optimizaciones finales.'
duracion: '30 min'
quiz:
  - pregunta: '¿Qué comando de Artisan se debe ejecutar SIEMPRE en producción para optimizar el rendimiento de Laravel?'
    opciones:
      - 'php artisan serve --env=production'
      - 'php artisan optimize'
      - 'php artisan cache:clear'
      - 'php artisan config:reset'
    correcta: 1
    explicacion: 'php artisan optimize ejecuta config:cache, route:cache y view:cache juntos, guardando en caché la configuración, las rutas y las vistas compiladas de Blade para que Laravel las cargue sin tener que releerlas en cada petición.'
  - pregunta: '¿Qué permisos deben tener los directorios storage/ y bootstrap/cache/ en el servidor?'
    opciones:
      - '644 (lectura para todos)'
      - '400 (solo lectura para el propietario)'
      - '755 (escritura solo para el propietario)'
      - '775 o 777 (escritura para el servidor web)'
    correcta: 3
    explicacion: 'storage/ y bootstrap/cache/ deben ser escribibles por el servidor web (www-data en Nginx/Apache). El permiso recomendado es 775 con el grupo www-data, o 777 si hay problemas de permisos, aunque 777 es menos seguro.'
  - pregunta: '¿Cuál es la diferencia entre APP_ENV=production y APP_DEBUG=false en el archivo .env de producción?'
    opciones:
      - 'Son equivalentes y se puede usar cualquiera de los dos'
      - 'APP_ENV define el entorno y APP_DEBUG controla si se muestran errores detallados al usuario'
      - 'APP_ENV activa las optimizaciones y APP_DEBUG desactiva los logs'
      - 'No hay diferencia, ambas variables hacen lo mismo'
    correcta: 1
    explicacion: 'APP_ENV=production indica a Laravel que está en producción (activa ciertas optimizaciones y comportamientos). APP_DEBUG=false es crítico para la seguridad: evita que los mensajes de error detallados (con stack traces y variables) se muestren a los usuarios.'
---

## Introducción al despliegue

Desplegar una aplicación Laravel en producción implica configurar correctamente el servidor, la base de datos, las variables de entorno y aplicar una serie de optimizaciones para garantizar rendimiento y seguridad. En esta lección cubriremos el proceso completo usando un VPS (servidor privado virtual) con Ubuntu, Nginx y MySQL, que es la configuración más común.

## Requisitos del servidor

Antes de empezar, necesitas un VPS con Ubuntu 22.04 o superior. Los requisitos mínimos son:

- **PHP 8.2+** con las extensiones necesarias
- **Nginx** como servidor web
- **MySQL 8.0+** o MariaDB 10.6+
- **Composer**
- **Node.js y npm** (para compilar assets con Vite)
- **Git**

## Instalar las dependencias del servidor

Conéctate por SSH a tu servidor y ejecuta:

```bash
# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Instalar PHP y extensiones necesarias para Laravel
sudo apt install -y php8.2 php8.2-fpm php8.2-mysql php8.2-mbstring \
  php8.2-xml php8.2-bcmath php8.2-curl php8.2-zip php8.2-intl \
  php8.2-redis php8.2-gd

# Instalar Nginx
sudo apt install -y nginx

# Instalar MySQL
sudo apt install -y mysql-server

# Instalar Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Instalar Node.js (usando nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install --lts
```

## Configurar MySQL

```bash
sudo mysql_secure_installation

# Crear base de datos y usuario para la aplicación
sudo mysql -u root -p
```

```sql
CREATE DATABASE mi_app_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mi_app_user'@'localhost' IDENTIFIED BY 'contraseña_segura_aqui';
GRANT ALL PRIVILEGES ON mi_app_db.* TO 'mi_app_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Clonar y configurar la aplicación

```bash
# Ir al directorio web
cd /var/www

# Clonar el repositorio
sudo git clone https://github.com/tu-usuario/tu-repo.git mi-app

# Dar permisos al usuario actual
sudo chown -R $USER:www-data /var/www/mi-app
cd /var/www/mi-app

# Instalar dependencias de PHP (sin paquetes de desarrollo)
composer install --optimize-autoloader --no-dev

# Instalar dependencias de Node y compilar assets
npm install
npm run build
```

## Configurar el archivo .env de producción

```bash
cp .env.example .env
nano .env
```

Configura el `.env` para producción:

```bash
APP_NAME="Mi Aplicación"
APP_ENV=production
APP_KEY=         # Se genera en el siguiente paso
APP_DEBUG=false  # MUY IMPORTANTE: false en producción
APP_URL=https://mi-dominio.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=mi_app_db
DB_USERNAME=mi_app_user
DB_PASSWORD=contraseña_segura_aqui

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_HOST=smtp.mailgun.org
MAIL_PORT=587
MAIL_USERNAME=tu_usuario
MAIL_PASSWORD=tu_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=noreply@mi-dominio.com
```

Genera la clave de la aplicación y ejecuta las migraciones:

```bash
php artisan key:generate
php artisan migrate --force
php artisan db:seed --force  # Solo si tienes seeders necesarios
```

## Permisos de directorios

```bash
# El servidor web necesita escribir en estas carpetas
sudo chown -R www-data:www-data /var/www/mi-app/storage
sudo chown -R www-data:www-data /var/www/mi-app/bootstrap/cache

sudo chmod -R 775 /var/www/mi-app/storage
sudo chmod -R 775 /var/www/mi-app/bootstrap/cache

# Enlace simbólico para el storage público
php artisan storage:link
```

## Configurar Nginx

Crea el bloque de servidor para tu dominio:

```bash
sudo nano /etc/nginx/sites-available/mi-app
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mi-dominio.com www.mi-dominio.com;

    root /var/www/mi-app/public;
    index index.php;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

Activa el sitio y reinicia Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/mi-app /etc/nginx/sites-enabled/
sudo nginx -t  # Verificar que la configuración es válida
sudo systemctl restart nginx
```

## Instalar SSL con Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d mi-dominio.com -d www.mi-dominio.com
```

Certbot configurará automáticamente HTTPS y la renovación automática del certificado.

## Optimizaciones de producción

```bash
# Cachear configuración, rutas y vistas (ejecutar siempre en producción)
php artisan optimize

# O por separado:
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Si usas eventos
php artisan event:cache
```

## Flujo de despliegue continuo

Cada vez que hagas una actualización, sigue este orden:

```bash
# 1. Activar modo mantenimiento (los usuarios ven una página de "Volvemos pronto")
php artisan down --retry=60

# 2. Descargar los últimos cambios
git pull origin main

# 3. Instalar nuevas dependencias
composer install --optimize-autoloader --no-dev

# 4. Compilar assets si han cambiado
npm install && npm run build

# 5. Ejecutar migraciones pendientes
php artisan migrate --force

# 6. Actualizar la caché
php artisan optimize

# 7. Reiniciar workers de cola
php artisan queue:restart

# 8. Desactivar modo mantenimiento
php artisan up
```

## Variables críticas de seguridad

Antes de dar el sitio por listo, verifica estas configuraciones:

```bash
# APP_DEBUG debe ser false
grep APP_DEBUG .env

# APP_KEY debe estar generada (no vacía)
grep APP_KEY .env

# La carpeta .env NO debe ser accesible desde el navegador
# (Nginx la bloquea con location ~ /\.(?!well-known).*)
```

Con este proceso tendrás tu aplicación Laravel funcionando en producción de forma segura y optimizada. El mantenimiento continuo (actualizaciones de seguridad, monitoreo con Laravel Telescope u Horizon, backups de base de datos) es igualmente importante para mantener la aplicación saludable a largo plazo.

Felicidades por completar el módulo 5 y el curso completo. Ahora tienes las herramientas para construir aplicaciones Laravel profesionales, desde una API REST hasta el despliegue en producción.
