---
title: 'Checkpoint en Laravel: Auditoría de Seguridad Automática'
description: 'Automatiza auditorías de seguridad en Laravel con Checkpoint. Detecta CVEs, secretos hardcodeados e inyecciones en 26 verificaciones estáticas.'
pubDate: '2026-06-04'
tags: ['laravel', 'seguridad', 'devops', 'herramientas']
---

## Checkpoint en Laravel: Auditoría de Seguridad Automática

La seguridad en aplicaciones web es una responsabilidad constante para los desarrolladores. Encontrar vulnerabilidades antes de que lleguen a producción es crítico, pero revisar manualmente cada aspecto de tu aplicación Laravel es tedioso y propenso a errores. Aquí es donde entra **Checkpoint**, un comando Artisan que automatiza 26 verificaciones de seguridad estáticas en tu aplicación.

## ¿Qué es Checkpoint?

Checkpoint es una herramienta de desarrollo que ejecuta análisis automáticos de seguridad contra tu proyecto Laravel. Identifica problemas comunes como dependencias vulnerables (CVEs), secretos expuestos en el código, riesgos de inyección y configuraciones de aplicación potencialmente inseguras.

Lo mejor es que funciona como un comando Artisan simple, sin requiere configuración compleja ni servicios externos obligatorios. Es perfecto para integrar en tu pipeline de CI/CD o ejecutar localmente antes de hacer commits.

## Instalación de Checkpoint

Instalar Checkpoint es tan simple como cualquier paquete de Composer:

```bash
composer require --dev laravel/checkpoint
```

Una vez instalado, verás un nuevo comando disponible en Artisan:

```bash
php artisan checkpoint
```

Ejecutarlo es inmediato y no requiere configuración adicional. El comando está diseñado para ser dev-only, lo que significa que no añade overhead a tu aplicación en producción.

## Tipos de Verificaciones que Realiza

Checkpoint ejecuta 26 verificaciones estáticas diferentes. Aquí están los principales tipos de problemas que detecta:

### Vulnerabilidades en Dependencias (CVEs)

Checkpoint escanea tu `composer.lock` buscando paquetes con CVEs conocidos:

```bash
$ php artisan checkpoint

[CVE] Found vulnerable dependency: laravel/framework 13.0.0
   └─ CVE-2024-XXXXX: Remote Code Execution in Blade templates
```

Esto es equivalente a ejecutar `composer audit`, pero integrado en tu flujo de desarrollo.

### Secretos Hardcodeados

Detecta información sensible como API keys, tokens y contraseñas directamente en tu código:

```php
// ❌ Checkpoint detectará esto
const API_KEY = 'sk-1234567890abcdef';

// ✅ Usa variables de entorno en su lugar
const API_KEY = env('STRIPE_API_KEY');
```

### Riesgos de Inyección SQL

Verifica patrones peligrosos en consultas de base de datos:

```php
// ❌ Vulnerable a SQL injection
$users = DB::select("SELECT * FROM users WHERE email = '{$email}'");

// ✅ Usa placeholders
$users = DB::select("SELECT * FROM users WHERE email = ?", [$email]);

// ✅ O mejor aún, usa Eloquent
$users = User::where('email', $email)->get();
```

### Validación Incompleta de Formularios

Detecta rutas que no validan entrada de usuario:

```php
// ❌ Sin validación
Route::post('/users', function (Request $request) {
    User::create($request->all()); // Peligroso
});

// ✅ Con validación
Route::post('/users', function (Request $request) {
    $validated = $request->validate([
        'email' => 'required|email|unique:users',
        'password' => 'required|min:8|confirmed'
    ]);
    User::create($validated);
});
```

### Errores CORS Mal Configurados

Identifica configuraciones de CORS que podrían permitir acceso no autorizado:

```php
// ❌ Potencialmente peligroso - permite cualquier origen
'allowed_origins' => ['*'],

// ✅ Especifica orígenes concretos
'allowed_origins' => [
    'https://ejemplo.com',
    'https://app.ejemplo.com'
],
```

## Ejecutar Checkpoint en tu Proyecto

### Análisis Completo

El comando básico ejecuta todas las verificaciones:

```bash
php artisan checkpoint
```

Output típico:

```
╭─ Checkpoint Security Audit ──────────────────────────────╮
│                                                            │
│  ✓ Dependency Vulnerabilities    26/26 passed            │
│  ✓ Hardcoded Secrets             45/45 passed            │
│  ✓ SQL Injection Risks           120/120 passed          │
│  ✓ CSRF Protection                Enabled                │
│  ✓ CORS Configuration             Configured Safely      │
│  ✓ Database Encryption            Enabled                │
│  ✓ Environment Variables          All Secure             │
│                                                            │
│  All security checks passed! ✓                            │
│                                                            │
╰────────────────────────────────────────────────────────────╯
```

### Con Problemas Encontrados

Si detecta vulnerabilidades:

```bash
$ php artisan checkpoint

╭─ Checkpoint Security Audit ──────────────────────────────╮
│  ✗ Hardcoded Secrets             3 issues found         │
│  ✗ SQL Injection Risks           1 issue found          │
│  ✗ Environment Variables         2 warnings             │
╰────────────────────────────────────────────────────────────╯

Issues:
  1. app/Services/StripeService.php:15 - API key hardcoded
  2. routes/api.php:42 - Possible SQL injection
  3. config/app.php:8 - Debug mode enabled in config
```

## Integración en CI/CD

El verdadero valor de Checkpoint emerge cuando lo integras en tu pipeline de CI/CD. Aquí está configurado con GitHub Actions:

```yaml
# .github/workflows/security.yml
name: Security Audit

on: [push, pull_request]

jobs:
  checkpoint:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '8.3'
      
      - name: Install dependencies
        run: composer install
      
      - name: Run Checkpoint
        run: php artisan checkpoint
```

Con esta configuración, cada pull request automáticamente ejecutará auditorías de seguridad. Si hay problemas, el CI fallará y impedirá el merge.

## Uso en Pre-commit Hooks

También puedes ejecutar Checkpoint antes de hacer commit:

```bash
#!/bin/bash
# .git/hooks/pre-commit

php artisan checkpoint
if [ $? -ne 0 ]; then
    echo "❌ Checkpoint security audit failed. Fix issues before committing."
    exit 1
fi
```

Hazlo ejecutable:

```bash
chmod +x .git/hooks/pre-commit
```

## Configuración Personalizada

Aunque Checkpoint es dev-only por defecto, puedes crear un archivo de configuración para personalizar comportamientos:

```php
// config/checkpoint.php
return [
    'enabled' => env('CHECKPOINT_ENABLED', true),
    
    'checks' => [
        'cve' => true,
        'secrets' => true,
        'injection' => true,
        'cors' => true,
        'csrf' => true,
        'database_encryption' => true,
    ],
    
    'ignore' => [
        // Rutas a ignorar en ciertos checks
        'routes/api.php',
    ],
    
    'fail_on_warnings' => false, // Si true, warnings = error
];
```

## Mejores Prácticas al Usar Checkpoint

### 1. Ejecuta Localmente Antes de Pushear

```bash
# Antes de git push
php artisan checkpoint
git push origin feature/nueva-funcionalidad
```

### 2. Revisa Warnings, No Solo Errores

Checkpoint diferencia entre **errores críticos** (que rompen la seguridad) y **warnings** (mejoras recomendadas). Revisa ambos.

### 3. Documenta Excepciones

Si ignoras un warning deliberadamente, documéntalo:

```php
// ⚠️ Ignored by Checkpoint: Legacy API integration
// TODO: Refactor to use prepared statements
$result = DB::select("SELECT * FROM legacy_table WHERE id = {$id}");
```

### 4. Integra con Otras Herramientas

Combina Checkpoint con otras herramientas de seguridad:

```bash
# Ejecutar múltiples auditorías
php artisan checkpoint           # Static analysis
composer audit                   # Dependency CVEs
phpstan analyse                  # Type checking
php-cs-fixer fix                 # Code standards
```

## Limitaciones de Checkpoint

Es importante entender que Checkpoint hace análisis **estático**. No detecta:

- Vulnerabilidades lógicas en tu aplicación
- Race conditions
- Problemas de concurrencia
- Ataques complejos de negocio lógica

Siempre complementa con:

- Testing manual de seguridad
- Auditorías externas
- Monitoreo en producción (Laravel Telescope, APM)

## Comparación con Alternativas

| Herramienta | Tipo | Velocidad | Integración |
|---|---|---|---|
| **Checkpoint** | Static | ⚡ Muy rápido | Nativa (Artisan) |
| **Composer audit** | Dependencias | ⚡ Muy rápido | Limitada |
| **PHPStan** | Type checking | ⚡ Rápido | Manual |
| **SonarQube** | Full-stack | 🐢 Lento | Cloud/Self-hosted |

Checkpoint es el equilibrio perfecto: rápido, enfocado y fácil de integrar.

## Conclusión

Checkpoint es una herramienta esencial para cualquier equipo de desarrollo Laravel que se tome la seguridad en serio. Su instalación es trivial, su ejecución es instantánea y detecta problemas que podrían costar mucho si llegan a producción.

Intégralo en tu flujo de desarrollo ahora mismo: instálalo, ejecútalo, córregelo en tus CIs y duerme más tranquilo. La seguridad no es una característica, es una responsabilidad.

## Puntos Clave

- **Checkpoint es un comando Artisan** que ejecuta 26 verificaciones de seguridad estáticas
- **Detecta CVEs, secretos hardcodeados, SQL injection, CORS mal configurado** y más
- **Es dev-only**: no añade overhead a producción, solo a desarrollo
- **Se integra perfectamente en CI/CD** con GitHub Actions, GitLab CI, etc.
- **Es rápido**: escanea proyectos completos en segundos
- **Complementa, no reemplaza**: úsalo con composer audit, PHPStan y testing manual
- **Instala con** `composer require --dev laravel/checkpoint`
- **Ejecuta con** `php artisan checkpoint` antes de cada push
- **Documenta excepciones** cuando ignores warnings deliberadamente
- **Falla early, falla frecuente**: mejor detectar en dev que en producción