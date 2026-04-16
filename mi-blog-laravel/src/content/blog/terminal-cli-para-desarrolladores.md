---
title: 'Terminal y línea de comandos para desarrolladores Laravel'
description: 'Domina la terminal para trabajar con Laravel. Aprende los comandos esenciales de Linux/Mac y PowerShell para navegar, gestionar archivos y ejecutar proyectos PHP.'
pubDate: '2026-04-16'
tags: ['laravel', 'terminal', 'roadmap']
---

Si vienes de un entorno donde todo se hace con clicks, la terminal puede parecer intimidante. Pero si vas a trabajar con Laravel, la terminal es tu espacio de trabajo principal. Artisan, Composer, Git, los servidores de desarrollo: todo se maneja desde ahí. Este artículo te da las bases para moverte con soltura.

## Por qué la terminal importa para desarrolladores Laravel

Laravel está diseñado para usarse desde la línea de comandos. Cada vez que ejecutas `php artisan make:controller`, `composer require` o `php artisan migrate` estás usando la terminal. Además:

- Los servidores de producción (Linux) no tienen interfaz gráfica.
- Las tareas automatizadas, los scripts de despliegue y los entornos de CI/CD son todos CLI.
- Es más rápido ejecutar un comando que navegar por menús.

No necesitas memorizar cientos de comandos. Con los que cubre este artículo tienes suficiente para el día a día.

## Navegación básica

### pwd — dónde estás

```bash
pwd
# /home/carlos/proyectos/mi-blog
```

`pwd` (print working directory) te dice en qué directorio estás en este momento. Útil cuando te pierdes o quieres confirmar tu ubicación antes de ejecutar algo.

### ls — qué hay aquí

```bash
# Listar archivos y carpetas
ls

# Con detalles (permisos, tamaño, fecha)
ls -l

# Incluir archivos ocultos (los que empiezan con punto)
ls -la

# Solo archivos PHP
ls *.php
```

En un proyecto Laravel `ls -la` te muestra los archivos ocultos como `.env` y `.gitignore`, que son importantes.

### cd — moverse entre directorios

```bash
# Entrar a una carpeta
cd mi-proyecto

# Subir un nivel
cd ..

# Subir dos niveles
cd ../..

# Ir al directorio home
cd ~

# Ir a la ruta absoluta
cd /var/www/html/mi-blog

# Volver al directorio anterior
cd -
```

Cuando clonas un proyecto o lo creas con Composer, siempre necesitas hacer `cd nombre-del-proyecto` para entrar.

### mkdir y rmdir — crear y eliminar directorios

```bash
# Crear un directorio
mkdir nueva-carpeta

# Crear directorios anidados de una vez
mkdir -p app/Services/Payment

# Eliminar un directorio vacío
rmdir carpeta-vacia

# Eliminar un directorio con contenido (con cuidado)
rm -rf carpeta-con-archivos
```

El flag `-rf` en `rm` elimina de forma recursiva y sin pedir confirmación. Úsalo con cuidado: no hay papelera de reciclaje en la terminal.

## Operaciones con archivos

```bash
# Copiar un archivo
cp archivo.txt copia.txt

# Copiar una carpeta completa
cp -r carpeta/ carpeta-copia/

# Mover o renombrar
mv archivo.txt nuevo-nombre.txt
mv archivo.txt ../otra-carpeta/

# Eliminar un archivo
rm archivo.txt

# Ver el contenido de un archivo
cat .env

# Ver solo las primeras líneas
head -20 storage/logs/laravel.log

# Ver solo las últimas líneas (útil para logs)
tail -50 storage/logs/laravel.log

# Seguir el archivo en tiempo real
tail -f storage/logs/laravel.log
```

El comando `tail -f` es especialmente útil en Laravel para monitorizar los logs mientras desarrollas o depuras un problema en producción.

## Permisos con chmod y chown

En servidores Linux los permisos de archivos son críticos. Laravel necesita escribir en ciertos directorios, y si los permisos no son correctos, la aplicación falla.

### chmod — cambiar permisos

```bash
# Dar permisos de escritura a storage y bootstrap/cache
chmod -R 775 storage
chmod -R 775 bootstrap/cache

# Dar permisos de ejecución a artisan
chmod +x artisan

# Ver permisos actuales
ls -la storage/
```

Los números representan permisos: `7` = lectura + escritura + ejecución, `5` = lectura + ejecución, `0` = sin permisos. El orden es: propietario, grupo, otros. `775` significa que el propietario y el grupo tienen control total, y el resto solo puede leer y ejecutar.

### chown — cambiar propietario

```bash
# Cambiar el propietario de los archivos a www-data (usuario del servidor web)
sudo chown -R www-data:www-data storage
sudo chown -R www-data:www-data bootstrap/cache

# Cambiar al usuario actual
sudo chown -R $USER:$USER .
```

En producción con Nginx o Apache, el usuario del servidor web (`www-data` en Ubuntu) necesita ser el propietario de `storage/` y `bootstrap/cache/` para que Laravel pueda escribir logs, cachés y sesiones.

## Variables de entorno

Las variables de entorno son pares clave-valor que configuran el comportamiento del sistema y las aplicaciones. Laravel las lee desde el archivo `.env`.

```bash
# Ver todas las variables de entorno
env

# Ver una variable específica
echo $HOME
echo $PATH

# Definir una variable para la sesión actual
export APP_ENV=local

# Verificar que se guardó
echo $APP_ENV
# local
```

En Laravel el archivo `.env` define las variables de entorno de la aplicación:

```bash
# Ver el contenido del .env
cat .env

# Copiar el ejemplo al .env
cp .env.example .env

# Generar la APP_KEY
php artisan key:generate
```

Nunca subas el `.env` a git. Contiene credenciales de base de datos, claves de API y otros secretos.

## El PATH

`PATH` es una variable de entorno especial que le dice al sistema en qué directorios buscar los ejecutables:

```bash
echo $PATH
# /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/home/carlos/.composer/vendor/bin
```

Cuando instalas Composer globalmente o ejecutas `composer global require laravel/installer`, el binario `laravel` se guarda en `~/.composer/vendor/bin`. Si ese directorio no está en tu `PATH`, el comando `laravel` no funcionará.

Para añadirlo permanentemente, edita `~/.bashrc` o `~/.zshrc`:

```bash
# Añadir al final de ~/.bashrc
echo 'export PATH="$HOME/.composer/vendor/bin:$PATH"' >> ~/.bashrc

# Recargar la configuración
source ~/.bashrc
```

## Ejecutar PHP desde la CLI

PHP puede ejecutarse directamente desde la terminal sin ningún servidor web:

```bash
# Ejecutar un archivo PHP
php mi-script.php

# Ejecutar código PHP directamente
php -r "echo phpversion();"

# Abrir el REPL interactivo de PHP
php -a

# Verificar la sintaxis de un archivo
php -l app/Http/Controllers/HomeController.php

# Ver la configuración de PHP
php --ini
```

Artisan es en realidad un script PHP que se ejecuta desde la CLI:

```bash
# Listar todos los comandos disponibles
php artisan list

# Ver las rutas registradas
php artisan route:list

# Crear un controlador
php artisan make:controller ProductoController

# Ejecutar las migraciones
php artisan migrate

# Iniciar el servidor de desarrollo
php artisan serve
# Server running on http://127.0.0.1:8000
```

## Pipe y redirección

El pipe (`|`) encadena comandos, pasando la salida de uno como entrada del siguiente:

```bash
# Buscar en los logs de Laravel
cat storage/logs/laravel.log | grep "ERROR"

# Ver solo los errores de hoy
cat storage/logs/laravel.log | grep "2026-04-16" | grep "ERROR"

# Contar cuántas rutas tiene tu app
php artisan route:list | wc -l

# Ver las rutas que empiezan por "api"
php artisan route:list | grep "api"
```

La redirección (`>` y `>>`) envía la salida a un archivo:

```bash
# Guardar la lista de rutas en un archivo (sobreescribe)
php artisan route:list > rutas.txt

# Añadir al final sin sobreescribir
php artisan route:list >> rutas.txt

# Descartar la salida de error
php artisan migrate 2>/dev/null
```

## Alias útiles para Laravel

Los alias son atajos para comandos largos. Guárdalos en `~/.bashrc` o `~/.zshrc`:

```bash
# Alias para artisan
alias art="php artisan"
alias serve="php artisan serve"
alias migrate="php artisan migrate"
alias tinker="php artisan tinker"

# Alias para proyectos Laravel
alias pf="php artisan test --filter"
alias routes="php artisan route:list"

# Recarga la configuración
source ~/.bashrc
```

Con estos alias tu flujo de trabajo se acelera:

```bash
# En lugar de: php artisan serve
serve

# En lugar de: php artisan test --filter NombreDelTest
pf NombreDelTest

# En lugar de: php artisan route:list
routes
```

## PowerShell en Windows

Si trabajas en Windows con PowerShell, los comandos básicos tienen equivalentes:

```powershell
# Equivalentes de comandos Unix
Get-Location         # pwd
Set-Location ..      # cd ..
Get-ChildItem        # ls
New-Item carpeta -ItemType Directory  # mkdir
Remove-Item archivo  # rm

# Los comandos PHP, Composer y Artisan funcionan igual
php artisan serve
composer install
php artisan migrate
```

WSL (Windows Subsystem for Linux) es una alternativa popular: te da una terminal Linux real dentro de Windows, y es lo que muchos desarrolladores Laravel en Windows usan en producción.

## Conclusión

La terminal deja de ser intimidante en cuanto empiezas a usarla a diario. No necesitas memorizar todo: los comandos de navegación, los permisos de storage y los comandos de Artisan son los que más vas a usar. El resto los vas aprendiendo según los necesitas. Con esta base estás listo para crear tu primer proyecto Laravel, ejecutarlo, configurarlo y depurarlo sin salir de la terminal.
