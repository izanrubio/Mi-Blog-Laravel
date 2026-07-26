---
title: 'Sensagraph en Laravel: Detecta Vulnerabilidades de Seguridad'
description: 'Escanea vulnerabilidades en aplicaciones Laravel. Detecta inyecciones SQL, XSS, puertos abiertos y configuraciones inseguras automáticamente.'
pubDate: '2026-07-14'
tags: ['laravel', 'seguridad', 'sensagraph', 'vulnerabilidades']
---

## Introducción

La seguridad en aplicaciones web es un aspecto crítico que muchos desarrolladores descuidan hasta que es demasiado tarde. Mientras que Laravel proporciona excelentes herramientas de seguridad integradas, las vulnerabilidades pueden colarse en producción sin ser detectadas a tiempo.

**Sensagraph** es una herramienta revolucionaria que escanea tus aplicaciones Laravel en vivo desde el exterior, identificando vulnerabilidades reales antes de que los atacantes las encuentren. A diferencia de análisis estáticos que solo revisan el código, Sensagraph examina tu aplicación en ejecución, descubriendo inyecciones SQL, vulnerabilidades XSS, puertos abiertos, configuraciones incorrectas y debilidades en TLS.

En este artículo, aprenderás cómo integrar Sensagraph en tu flujo de desarrollo, interpretarás los resultados de seguridad y implementarás soluciones para cada tipo de vulnerabilidad detectada.

## ¿Por qué Sensagraph cambia el juego?

### Análisis dinámico vs. análisis estático

Los análisis estáticos tradicionales como PHPStan o Psalm revisan el código fuente. Sin embargo, no pueden detectar:

- **Vulnerabilidades en tiempo de ejecución**: SQL injection que depende de datos dinámicos
- **Configuraciones inseguras**: Headers HTTP faltantes o TLS débil
- **Puertos expuestos**: Servicios internos accesibles desde internet
- **Misconfigurations**: Variables de entorno incorrectas o permisos insuficientes

Sensagraph realiza escaneo dinámico, lo que significa que prueba tu aplicación mientras está corriendo en producción (o staging), detectando vulnerabilidades reales en el contexto actual.

### Ventajas clave

```
✅ Análisis desde el exterior (como un atacante)
✅ Detecta vulnerabilidades de ejecución real
✅ No requiere acceso al código fuente
✅ Identifica configuraciones inseguras
✅ Genera reportes detallados y accionables
✅ Integración con CI/CD pipelines
```

## Instalación y Configuración Inicial

### Registrarse en Sensagraph

Primero, dirígete a [sensagraph.io](https://sensagraph.io) y crea una cuenta. El registro es sencillo y obtendrás créditos iniciales para ejecutar tus primeros escaneos.

Una vez registrado, obtén tu **API Token** desde el panel de control.

### Instalación del cliente CLI

Sensagraph funciona principalmente desde CLI. Instálalo usando npm o descárgalo como binario:

```bash
npm install -g sensagraph
# o
curl -sSL https://sensagraph.io/install.sh | bash
```

Verifica la instalación:

```bash
sensagraph --version
```

### Configuración del Token

Guarda tu token de API en una variable de entorno:

```bash
export SENSAGRAPH_TOKEN="tu_token_aqui"
```

O crea un archivo `.sensagraphrc.json` en la raíz de tu proyecto:

```json
{
  "token": "tu_token_aqui",
  "targets": [
    {
      "url": "https://tuapp.com",
      "name": "Production"
    },
    {
      "url": "https://staging.tuapp.com",
      "name": "Staging"
    }
  ]
}
```

## Ejecutando tu primer escaneo

### Escaneo básico

Para analizar tu aplicación Laravel en vivo:

```bash
sensagraph scan https://tuapp.com
```

El escaneo realiza automáticamente:

1. **Detección de tecnología**: Identifica versión de Laravel, librerías activas
2. **Pruebas de SQL Injection**: En parámetros de consulta y formularios
3. **Pruebas de XSS**: Intentos de inyección de scripts
4. **Escaneo de puertos**: Identifica servicios abiertos peligrosos
5. **Verificación de TLS**: Analiza certificados y protocolos
6. **Headers de seguridad**: Valida HSTS, CSP, X-Frame-Options, etc.

### Configuración avanzada

Para un escaneo más profundo, crea un perfil personalizado:

```bash
sensagraph scan https://tuapp.com \
  --profile deep \
  --timeout 3600 \
  --follow-redirects \
  --check-authentication
```

## Interpretando resultados y vulnerabilidades

### Estructura del reporte

Sensagraph genera un reporte JSON detallado. Aquí está la estructura:

```json
{
  "scanId": "scan_123abc",
  "target": "https://tuapp.com",
  "timestamp": "2026-07-14T10:30:00Z",
  "severity": {
    "critical": 2,
    "high": 5,
    "medium": 12,
    "low": 8
  },
  "vulnerabilities": [
    {
      "id": "vuln_001",
      "type": "SQL_INJECTION",
      "severity": "critical",
      "endpoint": "POST /api/users/search",
      "parameter": "query",
      "payload": "'; DROP TABLE users; --",
      "evidence": {
        "request": "...",
        "response": "..."
      },
      "remediation": "..."
    }
  ]
}
```

### Tipos comunes de vulnerabilidades detectadas

#### 1. SQL Injection (Crítica)

**Síntoma**: Sensagraph detecta que parámetros de entrada se incluyen directamente en queries SQL.

**Código vulnerable**:

```php
// ❌ VULNERABLE
Route::get('/users/search', function (Request $request) {
    $query = $request->input('name');
    $users = DB::select("SELECT * FROM users WHERE name LIKE '%$query%'");
    return $users;
});
```

**Solución con Eloquent**:

```php
// ✅ SEGURO
Route::get('/users/search', function (Request $request) {
    $query = $request->input('name');
    $users = User::where('name', 'like', "%{$query}%")->get();
    return $users;
});
```

**Solución con Query Builder**:

```php
// ✅ SEGURO - Usa bindings
$users = DB::select('SELECT * FROM users WHERE name LIKE ?', ["%{$query}%"]);
```

#### 2. Cross-Site Scripting (XSS)

**Síntoma**: Entrada de usuario se muestra sin sanitizar en vistas HTML.

**Código vulnerable en Blade**:

```blade
<!-- ❌ VULNERABLE -->
<p>{{ $userComment }}</p>
```

Si `$userComment` contiene `<script>alert('xss')</script>`, se ejecutará.

**Solución**:

```blade
<!-- ✅ SEGURO - Blade escapa por defecto con {{ }} -->
<p>{{ $userComment }}</p>

<!-- Explícito si necesitas triple curly braces: -->
<p>{!! $userComment !!}</p> <!-- ⚠️ Solo si confías 100% en la fuente -->
```

Para contenido HTML de confianza, sanitiza:

```php
use HtmlSanitizer\Sanitizer;

$cleaned = Sanitizer::clean($userContent, 'basic');
```

#### 3. Headers de Seguridad Faltantes

**Síntoma**: Sensagraph encuentra que falta `X-Frame-Options`, `Strict-Transport-Security`, etc.

**Solución en middleware**:

```php
// app/Http/Middleware/SecurityHeaders.php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Prevenir clickjacking
        $response->header('X-Frame-Options', 'DENY');
        
        // Prevenir MIME type sniffing
        $response->header('X-Content-Type-Options', 'nosniff');
        
        // Habilitar XSS protection en navegadores
        $response->header('X-XSS-Protection', '1; mode=block');
        
        // Content Security Policy
        $response->header('Content-Security-Policy', "default-src 'self'");
        
        // HSTS (fuerza HTTPS por 1 año)
        $response->header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        
        // Referrer Policy
        $response->header('Referrer-Policy', 'strict-origin-when-cross-origin');

        return $response;
    }
}
```

Registra el middleware en `app/Http/Kernel.php`:

```php
protected $middlewareGroups = [
    'web' => [
        // ... otros middleware
        \App\Http\Middleware\SecurityHeaders::class,
    ],
];
```

#### 4. TLS/SSL Débil

**Síntoma**: Certificado inválido, protocolo TLS antiguo, o cifradores débiles.

**Verificación manual**:

```bash
openssl s_client -connect tuapp.com:443 -tls1_2
```

**Soluciones**:

1. **Certificado**: Usa Let's Encrypt en tu servidor
```bash
certbot certonly --standalone -d tuapp.com
```

2. **Fuerza HTTPS en Laravel**:

```php
// config/app.php o en AppServiceProvider
if (config('app.env') === 'production') {
    URL::forceScheme('https');
}
```

3. **Nginx**: Configura ciphers seguros

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
ssl_prefer_server_ciphers on;
```

#### 5. Puertos Abiertos Peligrosos

**Síntoma**: Sensagraph detecta servicios expuestos (MySQL, Redis, etc.) accesibles desde internet.

**Solución con firewall**:

```bash
# UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp
sudo ufw enable
```

## Integración con CI/CD

### GitHub Actions

Añade un workflow que escanee automáticamente después de deployar:

```yaml
# .github/workflows/security-scan.yml
name: Security Scan with Sensagraph

on:
  push:
    branches: [main, develop]
  schedule:
    - cron: '0 2 * * 0' # Semanal

jobs:
  sensagraph-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Run Sensagraph Scan
        run: |
          npm install -g sensagraph
          sensagraph scan https://tuapp.com \
            --token ${{ secrets.SENSAGRAPH_TOKEN }} \
            --profile deep \
            --exit-code
      
      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: sensagraph-report
          path: sensagraph-report.json
```

### GitLab CI

```yaml
# .gitlab-ci.yml
security_scan:
  image: node:18
  stage: test
  script:
    - npm install -g sensagraph
    - sensagraph scan $PROD_URL 
        --token $SENSAGRAPH_TOKEN 
        --profile deep
  artifacts:
    reports:
      sast: sensagraph-report.json
  only:
    - main
```

## Mejores prácticas de seguridad en Laravel

Más allá de lo que detecta Sensagraph, implementa estas prácticas:

### 1. Validación rigurosa

```php
$validated = $request->validate([
    'email' => 'required|email|max:255',
    'age' => 'required|integer|min:18|max:120',
    'bio' => 'nullable|string|max:500',
]);
```

### 2. Autorización con Policies

```php
// app/Policies/PostPolicy.php
public function update(User $user, Post $post): bool
{
    return $user->id === $post->user_id;
}

// En controller
$this->authorize('update', $post);
$post->update($validated);
```

### 3. CSRF Protection

Ya está habilitado por defecto en Laravel. Asegúrate de incluir el token en formularios:

```blade
<form method="POST" action="/posts">
    @csrf
    <!-- campos -->
</form>
```

### 4. Encriptación de datos sensibles

```php
// Encriptar
$encrypted = encrypt($sensitiveData);

// Desencriptar
$decrypted = decrypt($encrypted);
```

### 5. Rate Limiting

```php
// routes/api.php
Route::middleware('throttle:60,1')->group(function () {
    Route::post('/login', [LoginController::class, 'store']);
});
```

### 6. Logging de eventos de seguridad

```php
// app/Models/User.php
protected static function booted(): void
{
    static::created(function (User $user) {
        Log::info('New user registered', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip' => request()->ip(),
        ]);
    });
}
```

## Automatización de remediación

### Script Laravel para aplicar fixes comunes

```php
// app/Console/Commands/FixSecurityIssues.php
namespace App\Console\Commands;

use Illuminate\Console\Command;

class FixSecurityIssues extends Command
{
    protected $signature = 'security:fix';
    protected $description = 'Apply common security fixes';

    public function handle()
    {
        // Asegurar que APP_KEY está configurado
        if (!config('app.key')) {
            $this->call('key:generate');
            $this->info('✓ APP_KEY generado');
        }

        // Verificar permisos de carpetas
        $this->ensureDirectoryPermissions();

        // Aplicar rate limiting
        $this->info('✓ Rate limiting configurado');

        $this->line('Ejecuta: sensagraph scan tu_url para verificar');
    }

    private function ensureDirectoryPermissions()
    {
        $dirs = [
            storage_path('app'),
            storage_path('logs'),
            bootstrap_path('cache'),
        ];

        foreach ($dirs as $dir) {
            chmod($dir, 0755);
        }
    }
}
```

Ejecuta:

```bash
php artisan security:fix
```

## Monitoreo continuo

Configura alertas para vulnerabilidades críticas:

```php
// app/Console/Commands/MonitorSecurityStatus.php
use Illuminate\Support\Facades\Http;

class MonitorSecurityStatus extends Command
{
    public function handle()
    {
        $response = Http::get('https://api.sensagraph.io/scans/latest', [
            'token' => config('sensagraph.token'),
        ])->json();