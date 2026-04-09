---
title: 'Cómo instalar Laravel en Mac con Homebrew'
description: 'Instala Laravel en macOS usando Homebrew, PHP y Composer. La forma más rápida y limpia de empezar a desarrollar con Laravel en Mac.'
pubDate: '2024-01-12'
tags: ['laravel', 'instalacion', 'mac']
---

# Cómo instalar Laravel en Mac con Homebrew

macOS es probablemente el sistema operativo favorito de los desarrolladores Laravel, y con razón: la terminal es potente, el ecosistema de herramientas es excelente y la instalación de dependencias es mucho más fluida que en Windows. En esta guía vamos a instalar Laravel usando Homebrew, que es el gestor de paquetes estándar de macOS.

## ¿Qué vamos a instalar?

- **Homebrew**: el gestor de paquetes de macOS
- **PHP 8.2+**: el lenguaje que necesita Laravel
- **Composer**: el gestor de dependencias de PHP
- **Laravel**: mediante `composer create-project`

Al final también mencionamos **Laravel Herd**, que es una alternativa aún más simple si prefieres no hacer nada de esto manualmente.

## Paso 1: Instalar Homebrew

Si ya tienes Homebrew instalado, puedes saltarte este paso. Para verificarlo, abre Terminal y ejecuta:

```php
// brew --version
// Homebrew 4.x.x
```

Si no lo tienes, instálalo con este comando (copiado directamente de brew.sh):

```php
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

El instalador te pedirá tu contraseña y puede tardar varios minutos. También instalará las **Xcode Command Line Tools** si no las tienes, que incluyen herramientas básicas de compilación necesarias para muchos paquetes.

### Configurar Homebrew en el PATH (Apple Silicon)

Si tienes un Mac con chip Apple Silicon (M1, M2, M3), Homebrew se instala en `/opt/homebrew` en lugar de `/usr/local`. Es posible que necesites agregar esto a tu archivo de configuración de shell:

```php
// Agrega esta línea a tu ~/.zshrc (macOS usa zsh por defecto)
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zshrc
source ~/.zshrc
```

## Paso 2: Instalar PHP con Homebrew

Homebrew tiene PHP en su repositorio principal. Instala la última versión estable con:

```php
brew install php
```

Esto instalará PHP y todas sus extensiones básicas necesarias para Laravel. Una ventaja enorme frente a la instalación manual en Windows.

Verifica la instalación:

```php
// php --version
// PHP 8.3.x (cli)
```

### ¿Necesitas una versión específica de PHP?

Si un proyecto requiere una versión concreta, puedes instalar varias versiones con Homebrew y cambiar entre ellas:

```php
// Instalar una versión específica
brew install php@8.2

// Cambiar la versión activa
brew link --overwrite --force php@8.2

// Verificar cuál está activa
php --version
```

## Paso 3: Instalar Composer

Hay dos formas de instalar Composer en Mac. La más limpia es usando Homebrew:

```php
brew install composer
```

Alternativamente, puedes descargarlo directamente como se indica en la documentación oficial:

```php
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
sudo mv composer.phar /usr/local/bin/composer
```

Con cualquiera de los dos métodos, verifica que Composer está disponible:

```php
// composer --version
// Composer version 2.x.x
```

## Paso 4: Crear un proyecto Laravel

Navega a tu carpeta de proyectos y crea un nuevo proyecto:

```php
cd ~/Sites  // o donde guardes tus proyectos
composer create-project laravel/laravel mi-proyecto
cd mi-proyecto
```

El comando descargará Laravel y todas sus dependencias. La primera vez puede tardar un par de minutos.

## Paso 5: Configurar el archivo .env

El archivo `.env` contiene la configuración de tu entorno. Ábrelo con tu editor favorito:

```php
APP_NAME="Mi Proyecto"
APP_ENV=local
APP_KEY=base64:... // Se genera automáticamente
APP_DEBUG=true
APP_URL=http://localhost:8000
```

Si el `APP_KEY` está vacío o quieres regenerarlo:

```php
php artisan key:generate
```

Para conectar a una base de datos, configura la sección DB:

```php
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=nombre_base_datos
DB_USERNAME=root
DB_PASSWORD=
```

Si usas SQLite (perfecto para empezar sin necesidad de instalar MySQL):

```php
DB_CONNECTION=sqlite
// El archivo de base de datos se crea automáticamente en database/database.sqlite
```

Y luego ejecuta:

```php
php artisan migrate
```

## Paso 6: Levantar el servidor de desarrollo

```php
php artisan serve
```

Abre `http://localhost:8000` en tu navegador. Deberías ver la página de bienvenida de Laravel con la versión instalada.

Para detener el servidor, presiona `Ctrl + C` en la terminal.

## Problemas comunes en macOS

### "composer: command not found" después de instalarlo con Homebrew

Cierra y vuelve a abrir la terminal. Si sigue sin funcionar, verifica que Homebrew está en tu PATH:

```php
// echo $PATH
// Deberías ver /opt/homebrew/bin o /usr/local/bin en la lista
```

### PHP no tiene las extensiones necesarias

Homebrew instala las extensiones más comunes, pero si te falta alguna como `php-gd` o `php-imagick`, puedes instalarlas:

```php
brew install php-gd
// o con pecl:
// pecl install imagick
```

### Error de permisos en la carpeta storage

En macOS rara vez ocurre este error con `php artisan serve`, pero si lo ves:

```php
chmod -R 775 storage bootstrap/cache
```

### El puerto 8000 ya está en uso

Si otro proceso usa el puerto 8000, puedes usar otro:

```php
php artisan serve --port=8080
```

## Opción alternativa: Laravel Herd

**Laravel Herd** ([herd.laravel.com](https://herd.laravel.com)) es una aplicación nativa para macOS (y Windows) creada por el equipo de Laravel. Es la forma más rápida y sencilla de tener un entorno Laravel funcionando sin tocar la terminal.

### ¿Qué hace Herd?

- Instala PHP (varias versiones), Nginx y dnsmasq de forma transparente.
- Cualquier proyecto que pongas en `~/Herd/` queda disponible automáticamente en `http://nombre-proyecto.test`.
- Gestiona múltiples versiones de PHP por proyecto.
- Incluye una interfaz gráfica para gestionar sitios, versiones de PHP y servicios.

### Instalación de Herd

1. Descarga el instalador desde [herd.laravel.com](https://herd.laravel.com).
2. Arrastra la aplicación a tu carpeta de Aplicaciones.
3. Abre Herd. Te pedirá permisos de administrador para instalar los componentes del sistema.
4. Listo. Mueve tu proyecto a `~/Herd/mi-proyecto` y accede en `http://mi-proyecto.test`.

### Herd vs Instalación manual con Homebrew

| Aspecto | Homebrew + Manual | Laravel Herd |
|---|---|---|
| Tiempo de setup | 15-20 minutos | 2-3 minutos |
| Control | Total | Limitado |
| Múltiples proyectos | Necesita configuración | Automático |
| Dominios .test | Configuración manual | Automático |
| Precio | Gratis | Gratis (Pro de pago) |

Para la mayoría de desarrolladores que empiezan, Herd es la mejor opción. Para entornos de producción o configuraciones muy específicas, la instalación manual te da más control.

## Gestión de bases de datos en Mac

Para trabajar con MySQL en Mac tienes varias opciones:

### MySQL con Homebrew

```php
brew install mysql
brew services start mysql

// Configurar la contraseña de root:
// mysql_secure_installation
```

### DBngin (recomendado para principiantes)

[DBngin](https://dbngin.com) es una aplicación gratuita para macOS que te permite levantar instancias de MySQL, PostgreSQL o Redis con un clic, sin instalar nada en tu sistema.

### TablePlus para gestionar la base de datos

[TablePlus](https://tableplus.com) es el cliente de base de datos más popular entre los desarrolladores Laravel en Mac. Tiene una interfaz limpia, soporte para múltiples bases de datos y una versión gratuita muy generosa.

## Estructura del proyecto creado

Una vez dentro de tu proyecto, esta es la estructura que encontrarás:

```php
mi-proyecto/
├── app/
│   ├── Http/
│   │   ├── Controllers/    // Controladores HTTP
│   │   └── Middleware/     // Middlewares personalizados
│   ├── Models/             // Modelos Eloquent
│   └── Providers/          // Service Providers
├── config/                 // Configuraciones (database, mail, etc.)
├── database/
│   ├── migrations/         // Migraciones de base de datos
│   └── seeders/            // Datos de prueba
├── public/                 // Archivos públicos (index.php, assets)
├── resources/
│   └── views/              // Plantillas Blade
├── routes/
│   ├── web.php             // Rutas web
│   └── api.php             // Rutas API
├── storage/                // Logs, caché, archivos
└── .env                    // Configuración del entorno
```

## Conclusión

Instalar Laravel en macOS con Homebrew es uno de los procesos más sencillos en el ecosistema de desarrollo web. En menos de 15 minutos tienes un entorno completamente funcional. Si prefieres aún menos configuración, Laravel Herd lo reduce a 2 minutos.

Mi recomendación: si eres principiante, empieza con Herd para quitarte la fricción inicial de la configuración del entorno y concentrarte en aprender Laravel. Si ya tienes experiencia y quieres más control sobre tus versiones de PHP y configuración del sistema, la ruta de Homebrew es la más flexible.
