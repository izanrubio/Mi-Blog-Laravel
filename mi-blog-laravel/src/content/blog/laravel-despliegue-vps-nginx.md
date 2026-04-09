---
title: 'Cómo desplegar Laravel en un VPS con Nginx'
description: 'Despliega tu aplicación Laravel en un VPS Ubuntu con Nginx, PHP-FPM, MySQL y SSL gratis con Certbot. Guía completa para producción.'
pubDate: '2024-01-28'
tags: ['laravel', 'deploy', 'nginx', 'vps', 'produccion']
---

# Cómo desplegar Laravel en un VPS con Nginx

Desplegar una aplicación Laravel en un VPS puede parecer complejo la primera vez, pero una vez que entiendes los pasos y el rol de cada componente, el proceso es bastante directo. En esta guía vamos a desplegar Laravel en Ubuntu 22.04 con Nginx, PHP-FPM, MySQL, SSL gratis con Certbot y supervisord para los workers de cola.

## Arquitectura del servidor

Antes de empezar, entendamos qué vamos a instalar y por qué cada componente es necesario:

- **Nginx**: el servidor web que recibe las peticiones HTTP/HTTPS y las pasa a PHP-FPM.
- **PHP-FPM**: el proceso de PHP que ejecuta tu aplicación Laravel.
- **MySQL**: la base de datos.
- **Certbot**: para obtener certificados SSL gratuitos de Let's Encrypt.
- **Supervisord**: para mantener el worker de colas siempre corriendo.
- **Git**: para clonar y actualizar el código desde el repositorio.

## Paso 1: Preparar el servidor

Conecta al VPS por SSH y actualiza el sistema:

```php
ssh root@tu-ip-del-vps
apt update && apt upgrade -y
```

Crea un usuario no-root para mayor seguridad:

```php
adduser deploy
usermod -aG sudo deploy
// Copia las claves SSH al nuevo usuario
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

A partir de ahora, trabaja con el usuario `deploy`:

```php
su - deploy
```

## Paso 2: Instalar Nginx

```php
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

Verifica que Nginx está corriendo:

```php
sudo systemctl status nginx
```

## Paso 3: Instalar PHP y sus extensiones

Agrega el repositorio de PHP:

```php
sudo apt install -y software-properties-common
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
```

Instala PHP 8.2 con las extensiones necesarias para Laravel:

```php
sudo apt install -y \
    php8.2-fpm \
    php8.2-cli \
    php8.2-mysql \
    php8.2-mbstring \
    php8.2-xml \
    php8.2-curl \
    php8.2-zip \
    php8.2-bcmath \
    php8.2-tokenizer \
    php8.2-fileinfo \
    php8.2-gd \
    php8.2-redis
```

Verifica que PHP-FPM está corriendo:

```php
sudo systemctl status php8.2-fpm
```

## Paso 4: Instalar MySQL

```php
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

Crea la base de datos y el usuario para tu aplicación:

```php
sudo mysql -u root -p
```

Dentro de MySQL:

```php
CREATE DATABASE nombre_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'password_muy_seguro_aqui';
GRANT ALL PRIVILEGES ON nombre_app.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Paso 5: Instalar Composer

```php
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
sudo chmod +x /usr/local/bin/composer
```

## Paso 6: Clonar el proyecto

```php
// Crea el directorio para los proyectos web
sudo mkdir -p /var/www
sudo chown -R deploy:deploy /var/www

// Clona tu repositorio
cd /var/www
git clone https://github.com/tu-usuario/tu-proyecto.git mi-app
cd mi-app
```

Si el repositorio es privado, necesitarás configurar las claves SSH del servidor en tu cuenta de GitHub/GitLab.

## Paso 7: Instalar dependencias y configurar el proyecto

```php
// Instalar dependencias de PHP (sin las de desarrollo)
composer install --no-dev --optimize-autoloader

// Crear el archivo .env para producción
cp .env.example .env
nano .env
```

Configura el `.env` para producción:

```php
APP_NAME="Mi Aplicación"
APP_ENV=production
APP_KEY=
APP_DEBUG=false
APP_URL=https://tudominio.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_app
DB_USERNAME=app_user
DB_PASSWORD=password_muy_seguro_aqui

CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

Genera la clave de aplicación:

```php
php artisan key:generate
```

## Paso 8: Configurar permisos

El servidor web (Nginx/PHP-FPM) corre como `www-data`. Las carpetas `storage` y `bootstrap/cache` deben ser escribibles por este usuario:

```php
sudo chown -R deploy:www-data /var/www/mi-app
sudo chmod -R 755 /var/www/mi-app
sudo chmod -R 775 /var/www/mi-app/storage
sudo chmod -R 775 /var/www/mi-app/bootstrap/cache
```

Crea el enlace simbólico para el almacenamiento público:

```php
php artisan storage:link
```

## Paso 9: Ejecutar las migraciones

```php
php artisan migrate --force
```

El flag `--force` es necesario en producción porque Laravel pide confirmación cuando el entorno es production.

## Paso 10: Optimizar para producción

```php
// Cachear la configuración
php artisan config:cache

// Cachear las rutas
php artisan route:cache

// Cachear las vistas Blade
php artisan view:cache

// Optimizar el autoloader de Composer
composer dump-autoload --optimize
```

O usa el comando que hace todo esto:

```php
php artisan optimize
```

## Paso 11: Compilar assets de frontend

Si tu proyecto tiene assets de frontend (Vite):

```php
// Instalar Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

// Instalar dependencias y compilar
npm ci
npm run build
```

## Paso 12: Configurar Nginx

Crea el archivo de configuración de Nginx para tu aplicación:

```php
sudo nano /etc/nginx/sites-available/mi-app
```

Con este contenido:

```php
server {
    listen 80;
    listen [::]:80;
    server_name tudominio.com www.tudominio.com;
    root /var/www/mi-app/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

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

Activa el sitio y verifica la configuración:

```php
sudo ln -s /etc/nginx/sites-available/mi-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Paso 13: Configurar SSL con Certbot

```php
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Certbot detectará automáticamente tu configuración de Nginx, obtendrá el certificado de Let's Encrypt y modificará el archivo de configuración para usar HTTPS. También configura la renovación automática.

Verifica que la renovación automática funciona:

```php
sudo certbot renew --dry-run
```

## Paso 14: Configurar el worker de colas con Supervisord

```php
sudo apt install -y supervisor
sudo nano /etc/supervisor/conf.d/mi-app-worker.conf
```

Contenido del archivo:

```php
[program:mi-app-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/mi-app/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/mi-app/storage/logs/worker.log
stopwaitsecs=3600
```

Activa el worker:

```php
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start mi-app-worker:*
```

## Paso 15: Configurar el scheduler de Laravel

Laravel tiene un programador de tareas (scheduler) que necesita una entrada en el crontab:

```php
sudo crontab -e -u www-data
```

Agrega esta línea:

```php
* * * * * cd /var/www/mi-app && php artisan schedule:run >> /dev/null 2>&1
```

## Proceso de actualización del código

Cuando tienes que desplegar una nueva versión:

```php
cd /var/www/mi-app

// Activar modo de mantenimiento (opcional)
php artisan down

// Obtener los últimos cambios
git pull origin main

// Actualizar dependencias PHP
composer install --no-dev --optimize-autoloader

// Actualizar dependencias de frontend y compilar
npm ci && npm run build

// Ejecutar nuevas migraciones
php artisan migrate --force

// Limpiar y regenerar la caché
php artisan optimize:clear
php artisan optimize

// Reiniciar los workers para que cojan el nuevo código
php artisan queue:restart

// Desactivar modo de mantenimiento
php artisan up
```

## Instalar y configurar Redis

Si usas Redis para caché, sesiones o colas:

```php
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis

// Configurar Redis para mayor seguridad (desactivar comandos peligrosos)
sudo nano /etc/redis/redis.conf
// Cambia: bind 127.0.0.1 ::1  (para que solo escuche localmente)
// Agrega: requirepass tu_redis_password

sudo systemctl restart redis
```

## Consejos de seguridad adicionales

### Configurar el firewall

```php
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

### Deshabilitar el usuario root para SSH

```php
sudo nano /etc/ssh/sshd_config
// Cambia: PermitRootLogin no
sudo systemctl restart sshd
```

### Configurar fail2ban para proteger contra ataques de fuerza bruta

```php
sudo apt install -y fail2ban
sudo systemctl start fail2ban
sudo systemctl enable fail2ban
```

## Conclusión

Desplegar Laravel en un VPS requiere seguir varios pasos, pero cada uno tiene su razón de ser. Nginx es el punto de entrada, PHP-FPM ejecuta tu aplicación, MySQL guarda los datos, Certbot asegura la conexión, y Supervisord mantiene los workers corriendo.

El punto más crítico es la configuración de permisos (Paso 8) y el archivo `.env` de producción con `APP_DEBUG=false`. Sin estos dos correctamente configurados, tu aplicación puede exponer información sensible o simplemente no funcionar.

Para proyectos serios, considera usar [Laravel Forge](https://forge.laravel.com) que automatiza todo este proceso y añade funcionalidades adicionales como despliegues automáticos desde GitHub.
