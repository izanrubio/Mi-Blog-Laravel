---
title: 'Vacuum en Laravel: Monitoreo PostgreSQL y Linting de Schema'
description: 'Detecta bloat, wraparound e índices no utilizados en PostgreSQL. Valida migraciones en CI y optimiza tu base de datos automáticamente.'
pubDate: '2025-01-15'
tags: ['laravel', 'postgresql', 'base-datos', 'devops']
---

## Introducción

Cuando trabajas con bases de datos PostgreSQL en producción, es fácil que problemas silenciosos crezcan sin ser detectados. El bloat de tablas, el wraparound de transacciones, índices huérfanos y claves foráneas sin indexar pueden degradar el rendimiento de tu aplicación Laravel sin aviso previo.

**Vacuum** es una herramienta que trae el monitoreo de PostgreSQL directamente a tu flujo de desarrollo en Laravel. Detecta problemas de esquema durante CI/CD, proporciona análisis de producción en tiempo real y valida migraciones antes de aplicarlas.

En este artículo exploraremos cómo integrar Vacuum en tu proyecto Laravel, qué problemas detecta y cómo usarlo para mantener tu base de datos optimizada.

## ¿Qué es Vacuum?

Vacuum es un linter de esquema PostgreSQL diseñado específicamente para aplicaciones Laravel. Realiza análisis profundos en tu base de datos para identificar:

- **Bloat en tablas y índices**: Espacio no utilizado por eliminaciones o actualizaciones
- **Wraparound de transacciones**: Cuando el contador de IDs de transacción se acerca al límite
- **Índices no utilizados**: Que consumen recursos sin beneficio
- **Claves foráneas sin indexar**: Aumentan el riesgo de bloqueos
- **Violaciones de convenciones**: Inconsistencias de naming y estructura

Lo poderoso es que Vacuum se integra en tu pipeline CI/CD como comando artisan y también proporciona un dashboard web para monitoreo en producción.

## Instalación y configuración

Primero, instala Vacuum vía Composer:

```bash
composer require laravelmetrics/vacuum --dev
```

Luego, publica la configuración:

```bash
php artisan vendor:publish --provider="LaravelMetrics\Vacuum\VacuumServiceProvider"
```

Esto crea `config/vacuum.php`:

```php
<?php

return [
    'enabled' => env('VACUUM_ENABLED', true),

    'database' => env('DB_CONNECTION', 'pgsql'),

    'checks' => [
        'bloat' => true,
        'wraparound' => true,
        'unused_indexes' => true,
        'unindexed_foreign_keys' => true,
        'naming_conventions' => true,
    ],

    'thresholds' => [
        'bloat_percentage' => 20,      // Alerta si > 20% bloat
        'wraparound_percentage' => 75, // Alerta si > 75% del límite
        'unused_index_size' => 10_485_760, // 10MB en bytes
    ],

    'dashboard' => [
        'enabled' => env('VACUUM_DASHBOARD', true),
        'path' => 'vacuum',
        'middleware' => ['web', 'auth'],
    ],
];
```

## Validar migraciones en CI/CD

El caso de uso más poderoso es ejecutar Vacuum durante tus pipelines CI/CD. Detecta problemas antes de llegar a producción:

```bash
php artisan vacuum:check
```

Este comando analiza tu base de datos actual y retorna un código de salida no-cero si encuentra problemas:

```bash
$ php artisan vacuum:check

╔════════════════════════════════════════════════════════╗
║            PostgreSQL Schema Analysis                  ║
╚════════════════════════════════════════════════════════╝

⚠️  Table "orders" has 34% bloat
   Suggested: VACUUM FULL orders;

⚠️  Index "idx_users_email" is not used
   Size: 2.3 MB
   Suggested: DROP INDEX idx_users_email;

⚠️  Foreign key "fk_orders_user_id" on table "orders" is not indexed
   May cause lock contention
   Suggested: CREATE INDEX idx_orders_user_id ON orders(user_id);

✓ Transaction wraparound: 2.1% used (healthy)

Total issues found: 3
Exit code: 1
```

En tu `github/workflows/tests.yml`:

```yaml
name: Tests
on: [push, pull_request]

jobs:
  database:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: 8.3
      
      - name: Install dependencies
        run: composer install --no-interaction
      
      - name: Setup database
        run: |
          cp .env.example .env
          php artisan key:generate
          php artisan migrate
      
      - name: Check schema with Vacuum
        run: php artisan vacuum:check --fail-on-warnings
```

El flag `--fail-on-warnings` causa que CI falle si hay advertencias, garantizando que nunca mergees código que introduzca problemas de base de datos.

## Analizar claves foráneas no indexadas

Las claves foráneas sin índices son una causa común de contención de bloqueos. Vacuum las detecta automáticamente:

```bash
php artisan vacuum:check --only=unindexed-foreign-keys
```

Ejemplo de salida:

```
⚠️  Foreign key constraints without indexes:

┌─────────────────┬──────────────┬───────────────────────┐
│ Table           │ Column       │ References            │
├─────────────────┼──────────────┼───────────────────────┤
│ orders          │ user_id      │ users(id)             │
│ order_items     │ order_id     │ orders(id)            │
│ invoices        │ company_id   │ companies(id)         │
└─────────────────┴──────────────┴───────────────────────┘

Recommended migration:

    Schema::table('orders', function (Blueprint $table) {
        $table->index('user_id');
    });
```

Vacuum incluso genera el código de migración que necesitas:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Índices sugeridos por Vacuum
        Schema::table('orders', function (Blueprint $table) {
            $table->index('user_id');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->index('order_id');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['user_id']);
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropIndex(['order_id']);
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropIndex(['company_id']);
        });
    }
};
```

## Monitoreo de producción con dashboard

Vacuum incluye un dashboard web para monitorear tu base de datos en producción:

```bash
php artisan route:list | grep vacuum
```

Accede a `/vacuum` en tu aplicación (protegido por middleware auth por defecto):

```php
// En tu RouteServiceProvider o routes/web.php

Route::middleware(['auth', 'admin'])
    ->prefix('admin')
    ->group(function () {
        // Otras rutas admin...
    });

// Vacuum se registra automáticamente en /vacuum
```

El dashboard muestra:

- **Historial de análisis**: Tendencias de bloat a lo largo del tiempo
- **Top 10 tablas por bloat**: Prioridades de mantenimiento
- **Índices no utilizados**: Candidatos a eliminación
- **Salud general**: Score de 0-100 del estado de tu schema
- **Recomendaciones**: Acciones sugeridas con prioridad

## Ejecutar análisis manualmente

Para un análisis profundo sin guardar datos, ejecuta:

```bash
php artisan vacuum:analyze
```

Muestra más detalles sin persistir en la base de datos:

```php
<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use LaravelMetrics\Vacuum\Facades\Vacuum;

class AnalyzeDatabaseHealth extends Command
{
    protected $signature = 'db:health-check';
    
    public function handle()
    {
        $analysis = Vacuum::analyze();

        $this->table(
            ['Métrica', 'Valor', 'Estado'],
            [
                ['Bloat Máximo', '34%', '⚠️ Crítico'],
                ['Wraparound', '2.1%', '✓ Healthy'],
                ['Índices Huérfanos', '5', '⚠️ Alto'],
                ['FK sin Indexar', '3', '⚠️ Moderado'],
            ]
        );

        // Integrar con alertas
        if ($analysis['max_bloat'] > 30) {
            // Enviar Slack, email, etc.
            $this->warn('Bloat crítico detectado!');
        }
    }
}
```

Ejecuta desde schedule:

```php
// app/Console/Kernel.php

protected function schedule(Schedule $schedule)
{
    $schedule->command('db:health-check')
        ->daily()
        ->at('02:00')
        ->onOneServer();

    $schedule->command('vacuum:check')
        ->weekly()
        ->mondays()
        ->at('03:00');
}
```

## Integraciones y webhooks

Vacuum puede dispara webhooks cuando detecta problemas críticos:

```php
// config/vacuum.php

'webhooks' => [
    'critical' => env('VACUUM_WEBHOOK_CRITICAL'),
    'warning' => env('VACUUM_WEBHOOK_WARNING'),
],

// .env
VACUUM_WEBHOOK_CRITICAL=https://hooks.slack.com/services/YOUR/WEBHOOK
VACUUM_WEBHOOK_WARNING=https://your-monitoring.com/vacuum-webhook
```

Crea un controlador para procesar webhooks:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Slack;

class VacuumWebhookController extends Controller
{
    public function handle(Request $request)
    {
        $data = $request->json()->all();

        Log::warning('Vacuum Alert', $data);

        if ($data['severity'] === 'critical') {
            Slack::send("🚨 Crítico: {$data['message']}\n```{$data['details']}```");
        }

        return response()->json(['status' => 'ok']);
    }
}
```

Registra la ruta:

```php
// routes/webhooks.php

Route::post('/vacuum-alert', 'VacuumWebhookController@handle')
    ->withoutMiddleware('VerifyCsrfToken');
```

## Casos de uso reales

### Detectar índices duplicados

```bash
php artisan vacuum:check --only=duplicate-indexes
```

Vacuum identifica índices redundantes:

```
⚠️  Duplicate indexes detected:

- idx_users_email (covering: email)
- idx_users_email_active (covering: email, active)

First index is redundant. Consider dropping idx_users_email.
```

### Monitorear crecimiento de tabla

```php
$history = \LaravelMetrics\Vacuum\Models\Analysis::where('table_name', 'orders')
    ->orderBy('analyzed_at', 'desc')
    ->limit(30)
    ->get();

foreach ($history as $record) {
    echo "{$record->analyzed_at}: {$record->table_size_mb}MB, {$record->bloat_percentage}% bloat\n";
}
```

### Automatizar mantenimiento

```bash
php artisan vacuum:fix --auto

# Ejecuta automáticamente:
# - VACUUM FULL en tablas con bloat > threshold
# - DROP INDEX en índices no utilizados
# - CREATE INDEX en FKs sin indexar
```

## Mejores prácticas

**1. Ejecutar en CI/CD pero no fallar siempre:**

```bash
php artisan vacuum:check || true  # Log pero no falla
```

**2. Diferente threshold para dev vs producción:**

```php
'thresholds' => [
    'bloat_percentage' => env('APP_ENV') === 'production' ? 15 : 40,
    'wraparound_percentage' => env('APP_ENV') === 'production' ? 50 : 75,
],
```

**3. Agendar mantenimiento en horarios bajos:**

```php
$schedule->command('vacuum:fix')
    ->weeklyOn(Sunday::class, '03:00')
    ->onOneServer();
```

**4. Monitorear tendencias, no valores puntuales:**

```php
$trend = \LaravelMetrics\Vacuum\Models\Analysis::where('table_name', 'orders')
    ->orderBy('analyzed_at', 'desc')
    ->take(7)
    ->avg('bloat_percentage');

if ($trend > 25) {
    // Tomar acción solo si la tendencia es problema
}
```

## Conclusión

Vacuum convierte el monitoreo de PostgreSQL de una tarea manual y reactiva a un proceso automático integrado en tu flujo de desarrollo. Al validar tu schema durante CI/CD y monitorear en producción, evitas degradación silenciosa del rendimiento.

La clave es configurarlo temprano en tu proyecto, ejecutarlo regularmente y actuar sobre las recomendaciones antes de que se conviertan en problemas críticos. Con Vacuum, tu base de datos PostgreSQL en Laravel permanece optimizada y segura.

## Puntos clave

- **Vacuum detecta bloat, wraparound, índices huérfanos y FKs no indexadas** en PostgreSQL
- **Intégrate en CI/CD** con `php artisan vacuum:check --fail-on-warnings` para prevenir problemas antes de producción
- **Dashboard web incluido** para monitoreo continuo en producción con historial y recomendaciones
- **Genera automáticamente migraciones** con índices sugeridos para claves foráneas no indexadas
- **Webhooks y alertas** permiten integración con Slack, email o sistemas de monitoreo propios
- **Thresholds configurables** adaptan los criterios según ambiente (dev/producción)
- **Automatiza mantenimiento** con `vacuum:fix` para ejecutar limpieza en horarios bajos
- **Monitorea tendencias** no solo valores puntuales para evitar acciones prematuras
- **Complementa VACUUM nativo de PostgreSQL** con análisis inteligente a nivel aplicación