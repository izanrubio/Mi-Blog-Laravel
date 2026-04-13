---
title: 'CI/CD en Laravel: Pipelines automatizados con GitHub Actions'
description: 'Aprende a configurar pipelines CI/CD en Laravel usando GitHub Actions. Automatiza tests, deployments y mejora la calidad de tu código.'
pubDate: '2026-04-12'
tags: ['laravel', 'ci-cd', 'devops', 'github-actions', 'automatización']
---

## Introducción

En el desarrollo moderno de aplicaciones Laravel, la integración continua y el despliegue continuo (CI/CD) se han convertido en una práctica indispensable. Sin embargo, muchos desarrolladores todavía despliegan manualmente sus aplicaciones, ejecutan tests localmente y confían en procesos manuales que son propensos a errores.

Los pipelines CI/CD automatizan estos procesos, garantizando que cada cambio en tu código sea probado, validado y desplegado de manera consistente. GitHub Actions es la solución perfecta para esto: es gratuita, está integrada en GitHub y es relativamente sencilla de configurar.

En este artículo, te mostraré cómo configurar un pipeline CI/CD completo para tus proyectos Laravel, desde la ejecución de tests hasta el despliegue automático en producción.

## ¿Qué es un pipeline CI/CD?

Un pipeline CI/CD es un conjunto de automatizaciones que se ejecutan cuando realizas cambios en tu código. Típicamente incluye:

- **Integración Continua (CI)**: Ejecuta tests y valida la calidad del código automáticamente
- **Despliegue Continuo (CD)**: Despliega tu aplicación en servidores de producción de manera automática

### Beneficios principales

- Detectar errores antes de llegar a producción
- Reducir errores humanos en el despliegue
- Acelerar el ciclo de desarrollo
- Mantener estándares de calidad consistentes
- Despliegues más frecuentes y confiables

## Configuración inicial de GitHub Actions

GitHub Actions utiliza archivos YAML ubicados en `.github/workflows/` para definir los pipelines. Vamos a crear nuestro primer workflow.

### Crear el archivo de configuración

Crea el archivo `.github/workflows/laravel.yml`:

```yaml
name: Laravel CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  laravel-tests:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: laravel_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
        ports:
          - 3306:3306

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup PHP
      uses: shivammathur/setup-php@v2
      with:
        php-version: '8.3'
        extensions: dom, curl, libxml, mbstring, zip
        coverage: pcov

    - name: Get Composer Cache Directory
      id: composer-cache
      run: echo "dir=$(composer config cache-files-dir)" >> $GITHUB_OUTPUT

    - name: Cache Composer Dependencies
      uses: actions/cache@v3
      with:
        path: ${{ steps.composer-cache.outputs.dir }}
        key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
        restore-keys: ${{ runner.os }}-composer-

    - name: Install Dependencies
      run: composer install --no-interaction --prefer-dist

    - name: Create Environment File
      run: cp .env.example .env.testing

    - name: Generate Application Key
      run: php artisan key:generate --env=testing

    - name: Run Migrations
      run: php artisan migrate --env=testing
      env:
        DB_CONNECTION: mysql
        DB_HOST: 127.0.0.1
        DB_PORT: 3306
        DB_DATABASE: laravel_test
        DB_USERNAME: root
        DB_PASSWORD: root

    - name: Run Tests
      run: php artisan test --coverage
      env:
        DB_CONNECTION: mysql
        DB_HOST: 127.0.0.1
        DB_PORT: 3306
        DB_DATABASE: laravel_test
        DB_USERNAME: root
        DB_PASSWORD: root

    - name: Run PHP Code Sniffer
      run: ./vendor/bin/phpcs app --standard=PSR12
      continue-on-error: true

    - name: Run Laravel Pint
      run: ./vendor/bin/pint --test
      continue-on-error: true

    - name: Upload Coverage Reports
      uses: codecov/codecov-action@v3
      if: always()
      with:
        files: ./coverage.xml
```

## Explicación detallada del workflow

### Triggers del workflow

```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```

El workflow se ejecuta cuando:
- Haces push a las ramas `main` o `develop`
- Se crea un pull request a esas ramas

### Configuración del entorno

```yaml
services:
  mysql:
    image: mysql:8.0
    env:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: laravel_test
```

Iniciamos un servicio MySQL en paralelo para que los tests puedan interactuar con la base de datos.

### Instalación de dependencias

```yaml
- name: Cache Composer Dependencies
  uses: actions/cache@v3
  with:
    path: ${{ steps.composer-cache.outputs.dir }}
    key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
```

Cachea las dependencias de Composer para acelerar las ejecuciones futuras.

## Agregar validación de código

### Configurar Laravel Pint

Laravel Pint es el formateador de código oficial de Laravel. Asegúrate de que esté instalado:

```bash
composer require --dev laravel/pint
```

Crea un archivo `pint.json` en la raíz de tu proyecto:

```json
{
    "preset": "laravel",
    "exclude": [
        "vendor",
        "node_modules"
    ]
}
```

### Agregar Static Analysis

Agrega PHPStan para análisis estático de código:

```bash
composer require --dev phpstan/phpstan
```

Crea `phpstan.neon`:

```neon
includes:
    - phpstan-baseline.neon

parameters:
    level: 5
    paths:
        - app
    excludePaths:
        - app/Providers
    tmpDir: build/phpstan
```

Actualiza tu workflow para incluir PHPStan:

```yaml
- name: Run PHPStan
  run: ./vendor/bin/phpstan analyse
  continue-on-error: true
```

## Despliegue automático a producción

Una vez que tus tests pasen, puedes desplegar automáticamente. Aquí está una configuración para desplegar a un servidor VPS:

```yaml
deploy:
  needs: laravel-tests
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  
  steps:
  - uses: actions/checkout@v4
  
  - name: Deploy to Production
    uses: appleboy/ssh-action@master
    with:
      host: ${{ secrets.HOST }}
      username: ${{ secrets.USERNAME }}
      key: ${{ secrets.SSH_PRIVATE_KEY }}
      script: |
        cd /var/www/app
        git pull origin main
        composer install --no-interaction --prefer-dist --optimize-autoloader
        php artisan migrate --force
        php artisan cache:clear
        php artisan config:clear
        sudo systemctl restart php-fpm
```

### Configurar secretos en GitHub

Ve a tu repositorio → Settings → Secrets and variables → Actions y agrega:
- `HOST`: IP de tu servidor
- `USERNAME`: Usuario SSH
- `SSH_PRIVATE_KEY`: Tu clave privada SSH

## Ejemplo práctico: Pipeline completo

Aquí está un workflow más robusto que combina todo:

```yaml
name: Complete Laravel Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: laravel_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
        ports:
          - 3306:3306

    strategy:
      matrix:
        php-version: ['8.2', '8.3']

    steps:
    - uses: actions/checkout@v4

    - name: Setup PHP ${{ matrix.php-version }}
      uses: shivammathur/setup-php@v2
      with:
        php-version: ${{ matrix.php-version }}
        extensions: dom, curl, libxml, mbstring, zip, pdo, mysql
        coverage: pcov

    - name: Install Composer dependencies
      run: composer install --prefer-dist --no-progress

    - name: Copy environment file
      run: cp .env.example .env.testing

    - name: Generate app key
      run: php artisan key:generate --env=testing

    - name: Run migrations
      run: php artisan migrate --env=testing
      env:
        DB_HOST: 127.0.0.1

    - name: Execute tests
      run: php artisan test --coverage --coverage-clover=coverage.xml
      env:
        DB_HOST: 127.0.0.1

    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        files: ./coverage.xml

  code-quality:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4

    - name: Setup PHP
      uses: shivammathur/setup-php@v2
      with:
        php-version: '8.3'

    - name: Install dependencies
      run: composer install --prefer-dist

    - name: Run Pint
      run: ./vendor/bin/pint --test

    - name: Run PHPStan
      run: ./vendor/bin/phpstan analyse
      continue-on-error: true

  deploy:
    needs: [test, code-quality]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
    - uses: actions/checkout@v4

    - name: Deploy to server
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.DEPLOY_HOST }}
        username: ${{ secrets.DEPLOY_USER }}
        key: ${{ secrets.DEPLOY_KEY }}
        script: |
          cd /var/www/laravel-app
          git fetch origin
          git checkout main
          git pull
          composer install --no-dev --optimize-autoloader
          php artisan migrate --force
          php artisan cache:clear
          php artisan config:clear
          php artisan queue:restart
```

## Mejores prácticas para CI/CD en Laravel

### 1. Usa variables de entorno específicas para testing

```php
// .env.testing
APP_ENV=testing
DB_CONNECTION=testing
CACHE_DRIVER=array
QUEUE_CONNECTION=sync
```

### 2. Mantén tests rápidos

```php
// tests/Unit/ExampleTest.php
class ExampleTest extends TestCase
{
    #[Test]
    public function it_returns_expected_result()
    {
        $result = calculateSomething();
        
        $this->assertEquals(expected: true, actual: $result);
    }
}
```

### 3. Usa matrizas para probar múltiples versiones

```yaml
strategy:
  matrix:
    php-version: ['8.2', '8.3']
    laravel-version: ['11', '13']
```

### 4. Cachea dependencias agresivamente

```yaml
- name: Cache dependencies
  uses: actions/cache@v3
  with:
    path: ~/.composer/cache
    key: ${{ runner.os }}-composer-${{ hashFiles('**/composer.lock') }}
```

### 5. Notifica sobre fallos

```yaml
- name: Slack Notification
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Pipeline failed for ${{ github.repository }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

## Troubleshooting común

### Problema: Tests fallan por base de datos no lista

**Solución**: Asegúrate de que MySQL esté completamente iniciado:

```yaml
services:
  mysql:
    options: >-
      --health-cmd="mysqladmin ping"
      --health-interval=10s
      --health-timeout=5s
      --health-retries=3
```

### Problema: Composer cache no funciona

**Solución**: Obtén correctamente la ruta del cache:

```yaml
- name: Get Composer Cache
  id: composer-cache
  run: echo "dir=$(composer config cache-files-dir)" >> $GITHUB_OUTPUT

- uses: actions/cache@v3
  with:
    path: ${{ steps.composer-cache.outputs.dir }}
```

### Problema: Despliegue falla por permisos

**Solución**: Verifica que tu usuario SSH tenga permisos adecuados en el servidor:

```bash
# En tu servidor
sudo usermod -aG www-data deploy-user
sudo chown -R deploy-user:www-data /var/www/app
```

## Conclusión

Implementar CI/CD en tus proyectos Laravel con GitHub Actions te proporciona automatización, confiabilidad y tranquilidad. Con la configuración que te mostré en este artículo, ahora puedes:

- Ejecutar tests automáticamente en cada push
- Validar la calidad del código
- Desplegar automáticamente a producción
- Detectar errores antes de que lleguen a usuarios

La clave es comenzar simple y escalar gradualmente. Empieza con tests, luego agrega análisis de código, y finalmente automatiza tus despliegues.

## Puntos clave

- **GitHub Actions** es gratuito y está integrado en GitHub, ideal para CI/CD en Laravel
- **Cachea dependencias** de Composer para acelerar los workflows
- **Usa servicios** como MySQL para testear con bases de datos reales
- **Configura múltiples jobs** (test, análisis, despliegue) que se ejecutan en paralelo
- **Valida código** con Laravel Pint y PHPStan antes del despliegue
- **Automatiza despliegues** solo en ramas principales (main/production)
- **Usa secretos** de GitHub para credenciales SSH y tokens
- **Monitorea** el estado con notificaciones en Slack o correo
- **Prueba múltiples versiones** de PHP usando matrices
- **Mantén workflows simples** al inicio y evoluciona según necesidades