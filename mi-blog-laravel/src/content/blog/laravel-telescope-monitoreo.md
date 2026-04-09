---
title: 'Laravel Telescope — Monitorea tu aplicación en desarrollo'
description: 'Instala y usa Laravel Telescope para depurar tu app: monitorea requests, queries, jobs, logs y excepciones en tiempo real con una interfaz visual elegante.'
pubDate: '2026-04-09'
tags: ['laravel', 'telescope', 'debug', 'herramientas', 'desarrollo']
---

¿Cuántas veces has puesto un `dd()` en el código, has recargado la página, has buscado el output y luego has tenido que quitarlo antes de hacer el commit? O peor, ¿cuántas veces has dejado un `dd()` olvidado en producción? Todos hemos pasado por eso.

Laravel Telescope es la herramienta que cambia completamente la forma de depurar aplicaciones Laravel. En lugar de depender de `dd()`, `dump()` y `Log::info()` esparcidos por el código, Telescope registra automáticamente todo lo que pasa en tu aplicación y te lo muestra en una interfaz visual elegante. Vamos a ver cómo instalarlo y sacarle el máximo partido.

## Qué es Telescope y por qué usarlo

Telescope es un paquete oficial de Laravel que funciona como un debugger en tiempo real para tu aplicación. Registra automáticamente:

- Todos los requests HTTP con sus parámetros, headers y respuestas
- Todas las queries SQL ejecutadas, con sus tiempos
- Los jobs de las colas
- Las notificaciones enviadas
- Los correos generados
- Las excepciones y errores
- Los logs de la aplicación
- Las operaciones de caché
- Y mucho más

La diferencia con `dd()` es que Telescope no interrumpe la ejecución del código. Simplemente observa y registra todo en segundo plano, y tú puedes consultarlo cuando quieras a través de su interfaz web en `/telescope`.

## Instalación

Telescope está diseñado principalmente para desarrollo, así que se instala como dependencia de desarrollo:

```php
composer require laravel/telescope --dev
```

Después de instalar el paquete, ejecutas el comando de instalación que publica los assets y crea la migración:

```php
php artisan telescope:install
php artisan migrate
```

Esto crea la tabla `telescope_entries` en tu base de datos donde se almacenarán todos los registros. También publica el archivo de configuración en `config/telescope.php` y el `TelescopeServiceProvider`.

Ahora accede a `http://tu-app.test/telescope` y verás la interfaz de Telescope.

## Asegurarse de que Telescope solo corre en desarrollo

Por defecto, Telescope se registra solo si `APP_ENV=local`, pero es importante verificar que tu `TelescopeServiceProvider` esté configurado correctamente:

```php
// app/Providers/TelescopeServiceProvider.php
public function register(): void
{
    Telescope::night(); // modo oscuro, opcional

    $this->hideSensitiveRequestDetails();

    $enabled = Telescope::isEnabled();

    Telescope::filter(function (IncomingEntry $entry) use ($enabled) {
        if ($this->app->environment('local')) {
            return true; // en local, registra todo
        }

        // En otros entornos, solo registra excepciones y errores
        return $entry->isReportableException() ||
               $entry->isFailedRequest() ||
               $entry->isFailedJob() ||
               $entry->hasMonitoredTag();
    });
}
```

También puedes controlar desde el `.env` si Telescope está activo:

```php
TELESCOPE_ENABLED=true
```

Y en el `TelescopeServiceProvider`:

```php
public function register(): void
{
    if (! config('telescope.enabled')) {
        return;
    }
    // resto del código...
}
```

## El watcher de Requests

El watcher de Requests es probablemente el más usado. Registra cada request HTTP que llega a tu aplicación con toda la información relevante:

- URL y método HTTP (GET, POST, PUT, DELETE)
- Parámetros de la query string
- Datos del body del request
- Headers de entrada
- Respuesta devuelta (status code, headers, body)
- Tiempo de respuesta total
- Uso de memoria

Esto es especialmente útil cuando estás desarrollando una API. En lugar de usar Postman y revisar la respuesta, puedes ver directamente en Telescope qué recibió el servidor y qué devolvió, incluyendo el stack trace si hubo un error.

```php
// Puedes excluir rutas del monitoreo en TelescopeServiceProvider
Telescope::filter(function (IncomingEntry $entry) {
    if ($entry->type === EntryType::REQUEST) {
        // No registrar las rutas de health check
        return ! str_contains($entry->content['uri'], '/health');
    }
    return true;
});
```

## El watcher de Queries

El watcher de Queries es donde Telescope brilla especialmente. Registra todas las queries SQL ejecutadas durante cada request, incluyendo:

- La query SQL completa con los parámetros ya interpolados
- El tiempo de ejecución en milisegundos
- El request que la originó

Esto hace que detectar el problema N+1 sea trivial. Si ves que en un request se ejecutan 51 queries donde 50 son idénticas excepto por el ID, tienes un problema N+1. Ve al código, agrega `with()` y en el siguiente request verás solo 2 queries.

Telescope también puede alertarte sobre queries lentas. En `config/telescope.php`:

```php
'watchers' => [
    Watchers\QueryWatcher::class => [
        'enabled' => env('TELESCOPE_QUERY_WATCHER', true),
        'slow' => 100, // queries que tarden más de 100ms se marcan como lentas
    ],
],
```

Las queries marcadas como lentas aparecen resaltadas en rojo en la interfaz, haciendo muy fácil identificarlas.

## El watcher de Jobs

Si tu aplicación usa colas (queues), el watcher de Jobs te muestra el estado de cada job:

- Nombre de la clase del job
- Si fue exitoso o falló
- Tiempo de ejecución
- Número de intentos
- El payload completo del job
- El stack trace si falló

```php
// Ejemplo de job que Telescope va a monitorear automáticamente
class SendWelcomeEmail implements ShouldQueue
{
    public function __construct(private User $user) {}

    public function handle(): void
    {
        Mail::to($this->user)->send(new WelcomeMail($this->user));
    }
}
```

Cuando despachas este job con `dispatch(new SendWelcomeEmail($user))`, Telescope lo registra. Si falla, puedes ver exactamente qué excepción se lanzó y en qué línea, sin necesidad de revisar los logs manualmente.

## El watcher de Logs

Todo lo que escribes con la facade `Log` aparece en Telescope:

```php
Log::info('Usuario registrado', ['user_id' => $user->id, 'email' => $user->email]);
Log::warning('Intento de acceso fallido', ['ip' => request()->ip()]);
Log::error('Error al procesar pago', ['exception' => $e->getMessage()]);
```

Telescope agrupa los logs por request, así que puedes ver todos los logs que se generaron durante un request específico junto con las queries y la respuesta. Esto hace el debugging mucho más contextual.

## El watcher de Exceptions

Las excepciones no manejadas (y las que sí manejas pero registras) aparecen en el watcher de Exceptions con:

- El tipo de excepción
- El mensaje
- El stack trace completo
- El request que la causó

```php
try {
    $result = $this->processPayment($order);
} catch (PaymentException $e) {
    // Telescope registra esto automáticamente si la excepción no se captura
    // Para capturarlas manualmente:
    report($e); // esto la envía a Telescope aunque la estés manejando
    return back()->withError('Error al procesar el pago');
}
```

## El watcher de Mail

Cada correo generado por tu aplicación aparece en Telescope con una preview visual del correo. Esto es increíblemente útil para desarrollar emails sin tener que enviarlos realmente ni usar herramientas como Mailtrap.

En desarrollo, puedes combinar esto con el driver de mail `log` o `array`:

```php
// .env en desarrollo
MAIL_MAILER=log
```

```php
// Y en el código
Mail::to($user)->send(new OrderConfirmation($order));
```

El email aparece en Telescope con su diseño HTML renderizado, puedes ver el asunto, destinatarios, y el contenido completo.

## El watcher de Models

El watcher de Models registra todas las operaciones de Eloquent: creación, actualización, eliminación de modelos. Esto te ayuda a entender qué datos están cambiando durante cada request.

```php
// config/telescope.php
'watchers' => [
    Watchers\ModelWatcher::class => [
        'enabled' => env('TELESCOPE_MODEL_WATCHER', true),
        'events' => ['eloquent.created*', 'eloquent.updated*', 'eloquent.deleted*'],
    ],
],
```

## Personalizar Telescope para producción

Si decides usar Telescope en producción (para monitorear errores reales), debes ser muy cuidadoso con la seguridad y el rendimiento.

### Restringir el acceso

En `TelescopeServiceProvider` puedes definir quién puede acceder a la interfaz:

```php
protected function gate(): void
{
    Gate::define('viewTelescope', function (User $user) {
        return in_array($user->email, [
            'admin@tuapp.com',
            'dev@tuapp.com',
        ]);
    });
}
```

O basarte en un rol:

```php
Gate::define('viewTelescope', function (User $user) {
    return $user->hasRole('developer');
});
```

### Filtrar qué se registra en producción

No quieres registrar todos los requests en producción (consumiría mucho espacio en la base de datos). Filtra solo lo importante:

```php
Telescope::filter(function (IncomingEntry $entry) {
    if ($this->app->environment('local')) {
        return true;
    }

    // En producción, solo registra errores y excepciones
    return $entry->isReportableException() ||
           $entry->isFailedRequest() ||
           $entry->isFailedJob() ||
           $entry->isScheduledTask() ||
           $entry->hasMonitoredTag();
});
```

### Ocultar datos sensibles

Telescope puede registrar los headers y body de los requests, lo que incluiría passwords y tokens. Configura qué ocultar:

```php
protected function hideSensitiveRequestDetails(): void
{
    if ($this->app->environment('local')) {
        return;
    }

    Telescope::hideRequestParameters(['_token', 'password', 'password_confirmation', 'credit_card']);
    Telescope::hideRequestHeaders(['cookie', 'x-csrf-token', 'x-xsrf-token', 'authorization']);
}
```

## Limpiar entradas antiguas

La tabla `telescope_entries` puede crecer muy rápido, especialmente en desarrollo donde registra todo. Configura el pruning automático:

```php
// config/telescope.php
'prune' => [
    'hours' => 48, // elimina entradas de más de 48 horas
],
```

Y agrega el comando de pruning al scheduler en `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule): void
{
    $schedule->command('telescope:prune')->daily();
}
```

También puedes ejecutarlo manualmente:

```php
php artisan telescope:prune
php artisan telescope:prune --hours=24 // mantener solo las últimas 24 horas
```

## Telescope vs. Debugbar — Cuándo usar cada uno

Ahora que conoces ambas herramientas (Debugbar del artículo anterior sobre queries), ¿cuándo usar cada una?

**Usa Debugbar cuando**:
- Quieres ver las queries de una página específica mientras la desarrollas
- Necesitas información rápida inline en el navegador
- Estás en una etapa temprana de desarrollo

**Usa Telescope cuando**:
- Desarrollas APIs (no hay "vista" donde mostrar Debugbar)
- Quieres monitorear jobs de cola
- Necesitas ver el historial de requests anteriores
- Desarrollas el envío de emails
- Quieres monitorear errores en producción de forma controlada

Lo ideal es tener ambos instalados en desarrollo. Debugbar para debugging rápido en el navegador, y Telescope para análisis más profundo y para el desarrollo de APIs y workers.

## Conclusión

Laravel Telescope transforma completamente la experiencia de debugging en Laravel. En lugar de depender de herramientas primitivas como `dd()` y `Log::info()`, tienes una interfaz visual completa que te muestra todo lo que pasa en tu aplicación en tiempo real.

Instalarlo toma menos de 5 minutos, y el beneficio en productividad es enorme. Si todavía no lo usas en tus proyectos Laravel, hoy es un buen día para empezar.
