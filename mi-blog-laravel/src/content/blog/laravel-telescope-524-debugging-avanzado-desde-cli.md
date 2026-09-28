---
title: 'Laravel Telescope 5.24: Debugging Avanzado desde CLI'
description: 'Inspecciona tus aplicaciones Laravel desde la terminal con los nuevos comandos Artisan de Telescope 5.24 sin abrir el dashboard web.'
pubDate: '2026-09-13'
tags: ['laravel', 'debugging', 'telescope', 'artisan']
---

# Laravel Telescope 5.24: Debugging Avanzado desde CLI

Laravel Telescope es una herramienta poderosa para inspeccionar lo que sucede en tu aplicación durante el desarrollo. Sin embargo, hasta ahora, revisando los datos registrados siempre requerías abrir el dashboard web en tu navegador. Con la versión 5.24.0, esto cambió: ahora puedes inspeccionar todas las entradas directamente desde tu terminal usando nuevos comandos Artisan.

## ¿Por qué esto es importante?

Como desarrollador, probablemente pasas la mayor parte de tu tiempo en la terminal. Cambiar entre la terminal y el navegador constantemente interrumpe tu flujo de trabajo. Los nuevos comandos de Telescope permiten:

- **Debugging más rápido**: obtén información sin abandonar tu terminal
- **Automatización**: integra inspecciones en scripts y pipelines CI/CD
- **Mejor experiencia en SSH**: si trabajas en servidores remotos, ahora puedes debuggear sin necesidad de tunelización web
- **Análisis de logs**: procesa datos programáticamente para análisis avanzados

## Instalación y configuración

Si aún no tienes Telescope instalado, configúralo en tu proyecto:

```bash
composer require laravel/telescope --dev
php artisan telescope:install
```

Para actualizar a la versión 5.24.0:

```bash
composer update laravel/telescope
```

Asegúrate de que Telescope esté habilitado en tu aplicación. Verifica el archivo `config/telescope.php`:

```php
'enabled' => env('TELESCOPE_ENABLED', true),
```

## Los nuevos comandos Artisan

### telescope:query

Este comando permite inspeccionar todas las queries ejecutadas en tu aplicación:

```bash
php artisan telescope:query
```

**Salida esperada:**

```
┌─────┬──────────────────────────────────────────┬────────┐
│ Id  │ Query                                    │ Time   │
├─────┼──────────────────────────────────────────┼────────┤
│ 1   │ select * from users where id = ?         │ 1.25ms │
│ 2   │ select * from posts where user_id = ?    │ 0.89ms │
│ 3   │ select count(*) from comments where ...  │ 2.15ms │
└─────┴──────────────────────────────────────────┴────────┘
```

Puedes filtrar por tiempo mínimo:

```bash
php artisan telescope:query --min=1.5
```

Esto mostrará solo queries que tardaron más de 1.5ms, útil para detectar N+1 problems:

```bash
php artisan telescope:query --min=1 | grep "select"
```

### telescope:request

Inspecciona todas las requests HTTP que ha recibido tu aplicación:

```bash
php artisan telescope:request
```

**Salida esperada:**

```
┌────┬─────────┬──────────────────┬─────────┬──────────┐
│ Id │ Method  │ URL              │ Status  │ Duration │
├────┼─────────┼──────────────────┼─────────┼──────────┤
│ 1  │ GET     │ /posts           │ 200     │ 145ms    │
│ 2  │ POST    │ /posts           │ 201     │ 287ms    │
│ 3  │ GET     │ /posts/1/edit    │ 200     │ 98ms     │
└────┴─────────┴──────────────────┴─────────┴──────────┘
```

Filtra por código de status:

```bash
php artisan telescope:request --status=500
```

O por método HTTP:

```bash
php artisan telescope:request --method=POST
```

### telescope:jobs

Monitorea todos los jobs que tu aplicación ha despachado:

```bash
php artisan telescope:jobs
```

**Salida esperada:**

```
┌────┬──────────────────────┬──────────┬─────────────┐
│ Id │ Job                  │ Status   │ Duration    │
├────┼──────────────────────┼──────────┼─────────────┤
│ 1  │ SendEmailNotification│ Finished │ 2345ms      │
│ 2  │ ProcessImage         │ Failed   │ 1200ms      │
│ 3  │ ExportData           │ Queued   │ -           │
└────┴──────────────────────┴──────────┴─────────────┘
```

Filtra por estado:

```bash
php artisan telescope:jobs --status=failed
```

## Casos de uso avanzados

### Debugging de N+1 problems

Ejecuta tus queries desde Tinker y luego inspecciona desde CLI:

```php
$ php artisan tinker
>>> $users = User::with('posts')->get();
>>> exit;

$ php artisan telescope:query --min=0.5
```

Verás exactamente cuántas queries se ejecutaron y cuáles son lentas.

### Análisis de rendimiento en CI/CD

Integra Telescope en tus pipelines de testing:

```yaml
# .github/workflows/tests.yml
- name: Run tests
  run: php artisan test

- name: Check slow queries
  run: php artisan telescope:query --min=5 | grep -c "select" > /tmp/slow_queries
  continue-on-error: true

- name: Fail if too many slow queries
  run: |
    SLOW=$(cat /tmp/slow_queries)
    if [ $SLOW -gt 3 ]; then
      echo "⚠️ Found $SLOW slow queries"
      exit 1
    fi
```

### Exportar datos para análisis

Puedes crear comandos personalizados que usen la API de Telescope:

```php
// app/Console/Commands/AnalyzeTelescope.php
namespace App\Console\Commands;

use Laravel\Telescope\Telescope;
use Illuminate\Console\Command;

class AnalyzeTelescope extends Command
{
    protected $signature = 'telescope:analyze {--type=query}';
    protected $description = 'Analyze Telescope entries';

    public function handle()
    {
        $type = $this->option('type');
        
        $entries = Telescope::model()
            ->where('type', $type)
            ->where('created_at', '>=', now()->subHour())
            ->get();
        
        $avgTime = $entries->avg('content.time') ?? 0;
        $maxTime = $entries->max('content.time') ?? 0;
        $count = $entries->count();
        
        $this->table(
            ['Métrica', 'Valor'],
            [
                ['Total', $count],
                ['Tiempo promedio', round($avgTime, 2) . 'ms'],
                ['Tiempo máximo', round($maxTime, 2) . 'ms'],
            ]
        );
    }
}
```

Ejecuta:

```bash
php artisan telescope:analyze --type=query
```

## Mejoras adicionales en Telescope 5.24

### Cancelación de requests stale

Cuando navegas rápidamente en el dashboard web, el navegador cancela automáticamente requests que ya no son necesarias. Esto reduce carga innecesaria en el servidor.

### Mejor interfaz de inspección

El dashboard ahora muestra más contexto al inspeccionar entries individuales. Cuando ejecutas:

```bash
php artisan telescope:request
```

Y quieres más detalles de una request específica, la interfaz web proporciona toda la información:

```php
// Para ver headers, payload, response, etc.
// Accede a telescope en: http://localhost:8000/telescope
```

## Integración con herramientas externas

### Alertas personalizadas

Crea un comando que alerte si hay muchas queries lentas:

```php
// app/Console/Commands/CheckSlowQueries.php
namespace App\Console\Commands;

use Laravel\Telescope\Telescope;
use Illuminate\Console\Command;

class CheckSlowQueries extends Command
{
    protected $signature = 'telescope:check-slow {--threshold=2}';

    public function handle()
    {
        $threshold = $this->option('threshold');
        
        $slowQueries = Telescope::model()
            ->where('type', 'query')
            ->where('created_at', '>=', now()->subMinutes(5))
            ->get()
            ->filter(fn($q) => ($q->content['time'] ?? 0) > $threshold);
        
        if ($slowQueries->isNotEmpty()) {
            $this->error("⚠️ Found {$slowQueries->count()} slow queries!");
            
            foreach ($slowQueries as $query) {
                $this->line(
                    "  {$query->content['query']} ({$query->content['time']}ms)"
                );
            }
            
            return 1; // Exit with error code
        }
        
        $this->info("✓ All queries are fast!");
        return 0;
    }
}
```

### Webhook para notificaciones

Envia alertas automáticas a Slack cuando detectes problemas:

```php
// config/telescope.php
'watchers' => [
    // ...
],

// En tu comando personalizado:
if ($slowQueries->count() > 5) {
    $this->dispatch(new NotifySlackAboutSlowQueries($slowQueries));
}
```

## Mejores prácticas

### 1. Monitorea regularmente durante desarrollo

```bash
# En una ventana de terminal durante desarrollo
watch -n 2 'php artisan telescope:query --min=1'
```

### 2. Limpia los datos regularmente

Telescope puede crecer rápidamente. Programa una limpieza:

```php
// In app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    $schedule->command('telescope:prune --hours=48')->daily();
}
```

### 3. Desactiva en producción

Asegúrate de que Telescope esté deshabilitado en producción:

```php
// config/telescope.php
'enabled' => env('TELESCOPE_ENABLED', false),
```

### 4. Usa watchers selectivos

No todos los watchers deben estar activos. Configura solo los que necesites:

```php
'watchers' => [
    \Laravel\Telescope\Watchers\QueryWatcher::class => [
        'enabled' => env('TELESCOPE_QUERY_WATCHER', true),
        'slow' => 100, // Registra queries > 100ms
    ],
    // ... otros watchers
],
```

## Conclusión

Los nuevos comandos Artisan de Telescope 5.24 transforman cómo debuggeamos aplicaciones Laravel. Ya no estamos limitados al dashboard web; podemos inspeccionar, analizar y automatizar verificaciones directamente desde la terminal.

Esta mejora es especialmente valiosa para desarrolladores que:
- Trabajan con workflow de terminal-first
- Integran debugging en CI/CD
- Analizan datos de rendimiento programáticamente
- Depuran en servidores remotos

Combina estos comandos con tus workflows existentes y descubrirás problemas de rendimiento más rápidamente que nunca.

## Puntos clave

- **Telescope 5.24.0** añade comandos Artisan para inspeccionar queries, requests y jobs sin abrir el dashboard
- **`telescope:query`** detecta N+1 problems y queries lentas desde CLI
- **`telescope:request`** analiza requests HTTP con filtros por status y método
- **`telescope:jobs`** monitorea jobs en segundo plano desde la terminal
- Puedes **filtrar resultados** con opciones como `--min`, `--status`, `--method`
- Integra Telescope en **CI/CD pipelines** para validar rendimiento automáticamente
- **Crea comandos personalizados** para análisis avanzados y alertas
- Desactiva siempre Telescope en **producción** mediante variables de entorno
- Limpia datos regularmente con `telescope:prune` para evitar sobrecarga
- El flujo terminal-first mejora significativamente tu productividad en debugging