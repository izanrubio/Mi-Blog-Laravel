---
title: 'HTTP Client PSR-18: Cliente HTTP Estándar en Laravel'
description: 'Descubre cómo usar el HTTP Client de Laravel como cliente PSR-18 para integración estándar con librerías PHP'
pubDate: '2026-01-15'
tags: ['laravel', 'http-client', 'psr-18', 'api', 'php']
---

## Introducción

Desde Laravel 13.13.0, el HTTP Client puede funcionar como un cliente PSR-18 totalmente compatible. Esto representa un hito importante para la interoperabilidad de Laravel con el ecosistema PHP moderno. La especificación PSR-18 define una interfaz estándar para clientes HTTP que permite que múltiples librerías funcionen juntas sin depender de implementaciones específicas.

En este artículo veremos cómo aprovechar esta funcionalidad para escribir código más portable, testeable y compatible con el resto del ecosistema PHP.

## ¿Qué es PSR-18?

PSR-18 (PHP Standards Recommendation 18) es un estándar que define una interfaz común para clientes HTTP. Antes de PSR-18, cada librería podía implementar su propio cliente HTTP, lo que causaba problemas de compatibilidad.

La interfaz PSR-18 define un contrato simple:

```php
interface ClientInterface
{
    public function sendRequest(RequestInterface $request): ResponseInterface;
}
```

Las librerías que respetan PSR-18 pueden aceptar cualquier cliente que implemente esta interfaz, sin estar vinculadas a una implementación específica como Guzzle, Curl o el cliente de Laravel.

## El HTTP Client de Laravel es ahora PSR-18

El HTTP Client de Laravel ahora implementa la interfaz `Psr\Http\Client\ClientInterface`, lo que significa que puedes usarlo en cualquier lugar donde se espere un cliente PSR-18.

### Ventajas principales

**Interoperabilidad**: Puedes usar el cliente de Laravel con librerías que esperan un cliente PSR-18 estándar.

**Testabilidad**: Los tests se vuelven más simples porque puedes mockear la interfaz estándar en lugar de clases específicas de Laravel.

**Portabilidad**: Tu código es más fácil de migrar entre proyectos sin dependencias de Laravel.

**Ecosistema**: Accedes a herramientas que se integran con PSR-18.

## Usando el HTTP Client como PSR-18

### Inyectar el cliente en servicios

Muchas librerías de PHP esperan recibir un cliente PSR-18 en el constructor. Aquí está el patrón de inyección:

```php
<?php

namespace App\Services;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\RequestInterface;

class PaymentGatewayService
{
    public function __construct(
        private ClientInterface $client,
        private RequestFactoryInterface $requestFactory,
    ) {}

    public function verifyPayment(string $transactionId): array
    {
        $request = $this->requestFactory->createRequest(
            'GET',
            "https://api.payment.com/verify/{$transactionId}"
        );

        $response = $this->client->sendRequest($request);

        return json_decode($response->getBody()->getContents(), true);
    }
}
```

En tu contenedor de servicios (service provider), registra el cliente:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Psr\Http\Client\ClientInterface;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(
            ClientInterface::class,
            fn() => new \Illuminate\Http\Client\HttpClientAdapter()
        );
    }
}
```

### Trabajar con librerías PSR-18

Muchas librerías modernas de PHP esperan un cliente PSR-18. Por ejemplo, si usas una librería que requiere un cliente PSR-18:

```php
<?php

namespace App\Services;

use Psr\Http\Client\ClientInterface;
use Some\ThirdParty\ApiClient;

class IntegrationsService
{
    public function __construct(
        private ClientInterface $httpClient,
    ) {}

    public function setupThirdPartyApi(): ApiClient
    {
        // ApiClient espera un cliente PSR-18
        return new ApiClient($this->httpClient);
    }

    public function fetchData(): array
    {
        $api = $this->setupThirdPartyApi();
        return $api->getData();
    }
}
```

Laravel inyecta automáticamente el cliente PSR-18 cuando lo solicitas en un constructor.

## Diferencias entre HTTP Client de Laravel y PSR-18

Aunque ahora es compatible con PSR-18, el HTTP Client de Laravel tiene características adicionales que no están en la especificación.

### HTTP Client de Laravel (con características adicionales)

```php
use Illuminate\Support\Facades\Http;

// Sintaxis fluida
$response = Http::baseUrl('https://api.example.com')
    ->withHeaders(['Authorization' => 'Bearer token'])
    ->retry(3, 100)
    ->timeout(30)
    ->get('/users');
```

### Cliente PSR-18 (interfaz estándar)

```php
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;

class Service
{
    public function __construct(
        private ClientInterface $client,
        private RequestFactoryInterface $requestFactory,
    ) {}

    public function fetch(): void
    {
        $request = $this->requestFactory->createRequest(
            'GET',
            'https://api.example.com/users'
        );
        
        $request = $request->withHeader('Authorization', 'Bearer token');

        $response = $this->client->sendRequest($request);
    }
}
```

## Casos de uso prácticos

### Integración con OpenAI

Muchas librerías de integración con OpenAI esperan un cliente PSR-18:

```php
<?php

namespace App\Services;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;

class AiService
{
    public function __construct(
        private ClientInterface $httpClient,
        private RequestFactoryInterface $requestFactory,
        private StreamFactoryInterface $streamFactory,
    ) {}

    public function generateContent(string $prompt): string
    {
        $body = json_encode([
            'model' => 'gpt-4',
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ]);

        $request = $this->requestFactory->createRequest(
            'POST',
            'https://api.openai.com/v1/chat/completions'
        );

        $request = $request
            ->withHeader('Authorization', 'Bearer ' . config('services.openai.key'))
            ->withHeader('Content-Type', 'application/json')
            ->withBody($this->streamFactory->createStream($body));

        $response = $this->httpClient->sendRequest($request);

        $data = json_decode($response->getBody()->getContents(), true);

        return $data['choices'][0]['message']['content'];
    }
}
```

### Middleware personalizado con PSR-18

Puedes crear middleware que funcione con cualquier cliente PSR-18:

```php
<?php

namespace App\Http\Middleware;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class LogRequestsMiddleware implements ClientInterface
{
    public function __construct(
        private ClientInterface $client,
    ) {}

    public function sendRequest(RequestInterface $request): ResponseInterface
    {
        \Log::debug('HTTP Request', [
            'method' => $request->getMethod(),
            'url' => (string) $request->getUri(),
            'headers' => $request->getHeaders(),
        ]);

        $response = $this->client->sendRequest($request);

        \Log::debug('HTTP Response', [
            'status' => $response->getStatusCode(),
            'headers' => $response->getHeaders(),
        ]);

        return $response;
    }
}
```

### Testing con PSR-18

La compatibilidad con PSR-18 facilita enormemente los tests:

```php
<?php

namespace Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use App\Services\WeatherService;

class WeatherServiceTest extends TestCase
{
    public function test_fetch_weather_data(): void
    {
        $mockResponse = $this->createMock(ResponseInterface::class);
        $mockResponse->method('getBody')
            ->willReturn(json_encode(['temperature' => 25]));

        $mockClient = $this->createMock(ClientInterface::class);
        $mockClient->method('sendRequest')
            ->willReturn($mockResponse);

        $service = new WeatherService($mockClient);
        $weather = $service->getWeather('Madrid');

        $this->assertEquals(25, $weather['temperature']);
    }
}
```

## Configuración en el contenedor

Para integración completa, configura todas las interfaces PSR-18 necesarias:

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;
use Psr\Http\Message\UriFactoryInterface;

class HttpServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Cliente HTTP
        $this->app->bind(
            ClientInterface::class,
            fn() => new \Illuminate\Http\Client\HttpClientAdapter()
        );

        // Factory de requests
        $this->app->bind(
            RequestFactoryInterface::class,
            fn() => new \Nyholm\Psr7\Factory\HttplugFactory()
        );

        // Factory de streams
        $this->app->bind(
            StreamFactoryInterface::class,
            fn() => new \Nyholm\Psr7\Factory\HttplugFactory()
        );

        // Factory de URIs
        $this->app->bind(
            UriFactoryInterface::class,
            fn() => new \Nyholm\Psr7\Factory\HttplugFactory()
        );
    }
}
```

## Conclusión

La compatibilidad de Laravel con PSR-18 es un paso importante hacia una arquitectura más modular y portable. Ahora puedes:

- Escribir código que no dependa de Laravel específicamente
- Integrar librerías que esperan un cliente PSR-18 estándar
- Crear tests más robustos y simples
- Participar plenamente en el ecosistema PHP moderno

Si estás desarrollando aplicaciones que necesitan ser testables, mantenibles y portables, PSR-18 es el camino correcto. Laravel 13.13.0+ te proporciona todo lo que necesitas sin configuración adicional.

## Puntos clave

- **PSR-18** es el estándar PHP para clientes HTTP que permite interoperabilidad
- **Laravel 13.13.0+** implementa completamente la interfaz `ClientInterface` de PSR-18
- Puedes inyectar el cliente como `ClientInterface` en cualquier clase
- PSR-18 funciona bien para **tests**, **middleware** e **integraciones**
- El HTTP Client de Laravel mantiene sus características fluidas además de ser PSR-18
- Las librerías modernas de PHP esperan clientes PSR-18 para máxima compatibilidad
- Configura el contenedor de servicios para las interfaces PSR-18 necesarias
- Los tests son más simples al mockear la interfaz estándar en lugar de clases específicas