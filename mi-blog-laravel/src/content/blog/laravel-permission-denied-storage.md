---
title: 'Permission denied en storage y bootstrap/cache en Laravel'
description: 'Soluciona el error Permission denied en Laravel: configura correctamente los permisos de storage/ y bootstrap/cache/ en Linux, Mac y Docker.'
pubDate: '2026-04-09'
tags: ['laravel', 'errores', 'permisos', 'storage']
---

# Permission denied en storage y bootstrap/cache en Laravel

Si tu aplicación Laravel en producción muestra un error como "The stream or file could not be opened in append mode" o "Permission denied" relacionado con las carpetas `storage/` o `bootstrap/cache/`, estás ante uno de los problemas de configuración más comunes al desplegar Laravel en un servidor Linux.

En esta guía vamos a entender por qué ocurre, cuál es la solución correcta y qué errores comunes hay que evitar.

## ¿Por qué ocurre el error de permisos?

Laravel necesita escribir archivos en dos carpetas principales:

- `storage/`: logs, caché de vistas compiladas, archivos de sesión, archivos subidos, caché del framework
- `bootstrap/cache/`: caché de configuración, caché de rutas, caché de servicios

El problema surge porque hay **dos usuarios diferentes** involucrados:

1. **Tu usuario**: el que usas para conectarte por SSH, clonar el repositorio y crear los archivos. Por ejemplo, `deploy` o `ubuntu`.
2. **El usuario del servidor web**: Nginx/Apache corre como `www-data` en Ubuntu/Debian o `nginx` en CentOS/RHEL.

Cuando clonas el repositorio, los archivos son del usuario `deploy`. Cuando Nginx recibe una petición y PHP intenta escribir en `storage/logs/laravel.log`, lo hace como el usuario `www-data`. Si `www-data` no tiene permisos de escritura en esa carpeta, obtienes el error "Permission denied".

## La solución correcta para producción (Linux/Ubuntu)

Hay varias formas de resolver esto. La más limpia y segura en producción es:

```php
// Opción 1: El servidor web (www-data) como propietario
sudo chown -R www-data:www-data /var/www/mi-app/storage
sudo chown -R www-data:www-data /var/www/mi-app/bootstrap/cache
sudo chmod -R 775 /var/www/mi-app/storage
sudo chmod -R 775 /var/www/mi-app/bootstrap/cache
```

Con esto, `www-data` es el propietario de las carpetas y puede escribir en ellas.

### Opción recomendada: usar grupos para mantener acceso dual

Si necesitas que tanto `www-data` (el servidor web) como tu usuario `deploy` puedan escribir, usa el sistema de grupos:

```php
// 1. Agregar tu usuario al grupo www-data
sudo usermod -a -G www-data deploy

// 2. Cambiar el propietario a deploy pero el grupo a www-data
sudo chown -R deploy:www-data /var/www/mi-app/storage
sudo chown -R deploy:www-data /var/www/mi-app/bootstrap/cache

// 3. Dar permisos de lectura/escritura al propietario y al grupo
sudo chmod -R 775 /var/www/mi-app/storage
sudo chmod -R 775 /var/www/mi-app/bootstrap/cache
```

Con 775: el propietario (deploy) tiene rwx, el grupo (www-data) tiene rwx, otros tienen r-x.

Para que el cambio de grupo tenga efecto en tu sesión SSH, cierra sesión y vuelve a conectar.

### Configurar el umask de PHP-FPM

Para que los archivos nuevos que crea PHP también tengan los permisos correctos, configura el umask en PHP-FPM:

```php
// /etc/php/8.2/fpm/pool.d/www.conf
[www]
user = www-data
group = www-data
; Agrega o modifica:
umask = 0002  ; Esto hace que los archivos nuevos sean 664 y carpetas 775
```

Reinicia PHP-FPM:

```php
sudo systemctl restart php8.2-fpm
```

## El error más común: chmod 777

Muchos tutoriales antiguos (o respuestas de Stack Overflow desactualizadas) sugieren:

```php
// NO hagas esto en producción:
sudo chmod -R 777 storage
sudo chmod -R 777 bootstrap/cache
```

El permiso 777 significa que **cualquier usuario en el sistema puede leer, escribir y ejecutar** en esas carpetas. Esto es un agujero de seguridad enorme. Si un atacante encuentra cualquier vulnerabilidad en tu aplicación que le permita ejecutar código PHP, tendría acceso completo para escribir archivos maliciosos en tu servidor.

La alternativa correcta es siempre 775 (o incluso 755 si solo el propietario necesita escribir) y gestionar correctamente qué usuario es el propietario.

## Solución para desarrollo local en Linux/macOS

En desarrollo con `php artisan serve`, el servidor corre con tu usuario actual, así que no debería haber problemas de permisos. Si los hay:

```php
chmod -R 775 storage bootstrap/cache
```

Sin `sudo`, porque en desarrollo eres el propietario de los archivos.

Si usas Nginx local con PHP-FPM (en vez de `php artisan serve`), puede que necesites ajustar el usuario de PHP-FPM para que coincida con tu usuario:

```php
// /etc/php/8.2/fpm/pool.d/www.conf
[www]
user = tu_usuario   ; Cambia www-data por tu nombre de usuario
group = tu_usuario
```

## Solución en macOS

En macOS con `php artisan serve`, el problema de permisos es raro. Si lo encuentras:

```php
chmod -R 775 storage bootstrap/cache
```

Con Laravel Herd o Valet, el servidor web corre con tu usuario, así que tampoco debería haber problemas.

## Solución con Docker/Laravel Sail

En Docker, el usuario dentro del contenedor puede ser diferente al usuario en el host. Sail usa el usuario `sail` (UID 1000) dentro del contenedor.

Si ves errores de permisos con Sail, el problema suele ser que los archivos en el host son del usuario root o de otro usuario:

```php
// Verificar qué usuario ejecuta los procesos en el contenedor:
sail shell
id
// uid=1000(sail) gid=1000(sail)

// Cambiar permisos desde el host (tu máquina):
sudo chown -R $USER:$USER storage bootstrap/cache
chmod -R 775 storage bootstrap/cache
```

Si creas archivos desde dentro del contenedor (como archivos de log), pueden quedar con permisos de root en el host. Para evitarlo, configura `WWWUSER` y `WWWGROUP` en `.env`:

```php
WWWUSER=1000  // Tu UID (obtenlo con: id -u)
WWWGROUP=1000 // Tu GID (obtenlo con: id -g)
```

## La carpeta storage y sus subcarpetas

La carpeta `storage/` tiene una estructura específica:

```
storage/
├── app/
│   ├── public/          → Archivos públicos (avatares, uploads)
│   └── private/         → Archivos privados
├── framework/
│   ├── cache/           → Caché del framework
│   │   └── data/
│   ├── sessions/        → Archivos de sesión (si SESSION_DRIVER=file)
│   └── views/           → Vistas Blade compiladas
└── logs/
    └── laravel.log      → Log de la aplicación
```

Todas estas subcarpetas necesitan permisos de escritura para `www-data`.

Si alguna subcarpeta no existe, créala:

```php
mkdir -p storage/framework/cache/data
mkdir -p storage/framework/sessions
mkdir -p storage/framework/views
mkdir -p storage/logs

// Y aplica los permisos:
sudo chown -R www-data:www-data storage/
sudo chmod -R 775 storage/
```

## El enlace simbólico de storage

Laravel permite acceder a archivos en `storage/app/public/` a través de la URL pública mediante un enlace simbólico. Para crearlo:

```php
php artisan storage:link
```

Esto crea `public/storage` que apunta a `storage/app/public/`. Si el enlace simbólico ya existe y necesitas recrearlo:

```php
php artisan storage:link --force
```

En algunos setups, este enlace simbólico puede tener problemas de permisos. Verifica:

```php
ls -la public/storage
// Debería mostrar: lrwxrwxrwx storage -> /var/www/mi-app/storage/app/public
```

## Verificar los permisos actuales

Para diagnosticar problemas de permisos:

```php
// Ver los permisos de las carpetas críticas:
ls -la /var/www/mi-app/storage/
ls -la /var/www/mi-app/bootstrap/cache/

// Ver el usuario bajo el que corre PHP-FPM:
ps aux | grep php-fpm

// Ver el usuario de Nginx:
ps aux | grep nginx
```

## Script de configuración rápida de permisos

Para un VPS Ubuntu típico con Nginx + PHP-FPM + usuario `deploy`:

```php
#!/bin/bash
# Guardar como setup-permissions.sh y ejecutar con sudo

APP_DIR="/var/www/mi-app"
DEPLOY_USER="deploy"
WEB_USER="www-data"

# Propietario del proyecto: deploy
chown -R $DEPLOY_USER:$WEB_USER $APP_DIR

# Permisos generales: rwxr-xr-x (755)
find $APP_DIR -type f -exec chmod 644 {} \;
find $APP_DIR -type d -exec chmod 755 {} \;

# storage/ y bootstrap/cache/ necesitan escritura para www-data
chmod -R 775 $APP_DIR/storage
chmod -R 775 $APP_DIR/bootstrap/cache

# El archivo .env solo debería leerlo el propietario
chmod 600 $APP_DIR/.env

echo "Permisos configurados correctamente."
```

## Troubleshooting: el error persiste después de aplicar chmod

Si después de aplicar los permisos el error sigue:

### Verifica que la carpeta de logs existe

```php
ls -la storage/logs/
// Si no existe:
mkdir storage/logs
touch storage/logs/laravel.log
chmod 664 storage/logs/laravel.log
chown www-data:www-data storage/logs/laravel.log
```

### Verifica el SELinux (en CentOS/RHEL)

Si tu VPS usa CentOS o RHEL, SELinux puede bloquear el acceso incluso con los permisos de filesystem correctos:

```php
// Ver el estado de SELinux:
getenforce

// Cambiar el contexto de SELinux para storage/:
chcon -R -t httpd_sys_rw_content_t storage/
chcon -R -t httpd_sys_rw_content_t bootstrap/cache/
```

### Reinicia PHP-FPM después de cambios

Algunos cambios de permisos no se reflejan hasta reiniciar PHP-FPM:

```php
sudo systemctl restart php8.2-fpm
```

## Conclusión

Los errores de permisos en `storage/` y `bootstrap/cache/` son un rito de paso para cualquier desarrollador Laravel que despliega en producción por primera vez. La solución correcta siempre involucra entender qué usuario ejecuta PHP y dar permisos de escritura a ese usuario sobre esas carpetas específicas.

Nunca uses 777. Usa 775 con el usuario correcto como propietario o como parte del grupo. En Ubuntu/Debian, el usuario del servidor web es `www-data`. En tu máquina de desarrollo, es tu propio usuario.
