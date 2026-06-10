---
title: 'PSR-18 en Laravel: Cliente HTTP Estándar'
description: 'Integra clientes HTTP compatibles con PSR-18 en Laravel 13. Guía práctica con ejemplos reales para APIs robustas y escalables.'
pubDate: '2026-06-07'
tags: ['laravel', 'http', 'psr-18', 'api']
---

## PSR-18 en Laravel: Cliente HTTP Estándar para APIs Robustas

Laravel 13.13 introdujo soporte nativo para **PSR-18**, el estándar PHP para clientes HTTP. Esta característica permite integrar diferentes clientes HTTP manteniendo compatibilidad con el ecosistema PHP. En este artículo, aprenderás cómo implementar PSR-18 en tus aplicaciones Laravel y cuándo usarlo.

## ¿Qué es PSR-18?

**PSR-18** es una especificación de PHP-FIG (Framework Interoperability Group) que estandariza interfaces para clientes HTTP. Define un contrato único (`ClientInterface`) que cualquier librería HTTP puede implementar.

Antes de PSR-18, cada librería HTTP (Guzzle, cURL, etc.) tenía su propia API. Esto creaba problemas de compatibilidad:

- Si usabas Guzzle en tu proyecto y una librería de terceros usaba otra cliente, tenías dos implementaciones diferentes
- No había forma estándar de intercambiar clientes
- El código era menos portable

PSR-18 resuelve esto proporcionando una interfaz única:

```php
namespace Psr\Http\Client;

interface ClientInterface
{
    public function sendRequest(RequestInterface $request): ResponseInterface;
}
```

## ¿Por qué importa en Laravel?

Laravel ha incluido durante años su propio cliente HTTP (Laravel HTTP Client). Con PSR-18, ahora puedes:

1. **Usar cualquier cliente compatible** sin reescribir código
2. **Integrar librerías de terceros** que requieran PSR-18
3. **Mantener compatibilidad** con el ecosistema PHP más amplio
4. **Testear más fácilmente** inyectando diferentes implementaciones

## El Cliente HTTP de Laravel (HTTP Client)

Primero, veamos cómo Laravel ya era compatible con PSR-18. El cliente HTTP nativo es excelente:

```php
use Illuminate\Support\Facades\Http;

// Solicitud GET simple
$response = Http::get('https://api.github.com/users/laravel');

if ($response->successful()) {
    $user = $response->json();
    echo $user['name'];
}

// POST con datos
$response = Http::post('https://api.example.com/users', [
    'name' => 'Juan Pérez',
    'email' => 'juan@example.com'
]);

// Con headers y autenticación
$response = Http::withToken('mi-token-api')
    ->withHeaders(['X-Custom' => 'valor'])
    ->post('https://api.example.com/orders', [
        'product_id' => 123,
        'quantity' => 5
    ]);
```

Ahora, en Laravel 13.13+, puedes usar **cualquier cliente PSR-18** en lugar del nativo.

## Implementar PSR-18 Personalizado

Supongamos que quieres usar **HTTPlug**, un cliente PSR-18 con características avanzadas:

### 1. Instalar el paquete PSR-18

```bash
composer require php-http/client-common php-http/discovery
```

### 2. Crear un Service Provider personalizado

Crea un provider que registre tu cliente PSR-18 en el contenedor:

```php
// app/Providers/HttpClientProvider.php
namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Psr\Http\Client\ClientInterface;
use Http\Discovery\HttpClientDiscovery;

class HttpClientProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(
            ClientInterface::class,
            function () {
                return HttpClientDiscovery::find();
            }
        );
    }
}
```

### 3. Registrar el provider

En `config/app.php`:

```php
'providers' => [
    // ... otros providers
    App\Providers\HttpClientProvider::class,
],
```

### 4. Usar PSR-18 en tu código

```php
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;

class GitHubService
{
    public function __construct(
        private ClientInterface $httpClient,
        private RequestFactoryInterface $requestFactory
    ) {}

    public function getUser(string $username): array
    {
        $request = $this->requestFactory->createRequest(
            'GET',
            "https://api.github.com/users/{$username}"
        );

        $response = $this->httpClient->sendRequest($request);

        if ($response->getStatusCode() === 200) {
            return json_decode(
                (string)$response->getBody(),
                true
            );
        }

        throw new \Exception("No se pudo obtener usuario: {$username}");
    }
}
```

## Caso Real: Cliente API con Reintentos

Aquí hay un ejemplo práctico donde PSR-18 brilla. Vamos a crear un cliente API con reintentos automáticos:

```php
// app/Services/ResilientApiClient.php
namespace App\Services;

use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\StreamFactoryInterface;

class ResilientApiClient
{
    private const MAX_RETRIES = 3;
    private const RETRY_DELAY_MS = 1000;

    public function __construct(
        private ClientInterface $httpClient,
        private RequestFactoryInterface $requestFactory,
        private StreamFactoryInterface $streamFactory
    ) {}

    public function post(
        string $url,
        array $data,
        array $headers = []
    ): array {
        $attempt = 0;

        while ($attempt < self::MAX_RETRIES) {
            try {
                $stream = $this->streamFactory->createStream(
                    json_encode($data)
                );

                $request = $this->requestFactory->createRequest(
                    'POST',
                    $url
                )
                    ->withBody($stream)
                    ->withHeader('Content-Type', 'application/json');

                // Agregar headers personalizados
                foreach ($headers as $key => $value) {
                    $request = $request->withHeader($key, $value);
                }

                $response = $this->httpClient->sendRequest($request);

                if ($response->getStatusCode() >= 200 
                    && $response->getStatusCode() < 300) {
                    return json_decode(
                        (string)$response->getBody(),
                        true
                    );
                }

                if ($response->getStatusCode() >= 500) {
                    throw new \Exception(
                        "Error servidor: " . $response->getStatusCode()
                    );
                }

                // 4xx no se reintenta
                throw new \Exception(
                    "Error cliente: " . $response->getStatusCode()
                );

            } catch (\Exception $e) {
                $attempt++;

                if ($attempt >= self::MAX_RETRIES) {
                    throw $e;
                }

                // Esperar antes de reintentar
                usleep(self::RETRY_DELAY_MS * 1000 * $attempt);
            }
        }
    }
}
```

## Usar el cliente robusto en un Controller

```php
// app/Http/Controllers/OrderController.php
namespace App\Http\Controllers;

use App\Services\ResilientApiClient;

class OrderController extends Controller
{
    public function __construct(
        private ResilientApiClient $apiClient
    ) {}

    public function store($request)
    {
        $orderData = [
            'customer_id' => $request->customer_id,
            'total' => $request->total,
            'items' => $request->items
        ];

        $result = $this->apiClient->post(
            'https://billing.example.com/api/orders',
            $orderData,
            ['Authorization' => 'Bearer ' . config('services.billing.token')]
        );

        return response()->json([
            'success' => true,
            'order_reference' => $result['reference']
        ]);
    }
}
```

## Testing con PSR-18

Una ventaja importante: puedes mockear fácilmente clientes PSR-18:

```php
// tests/Unit/ResilientApiClientTest.php
namespace Tests\Unit;

use App\Services\ResilientApiClient;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface;
use Psr\Http\Message\RequestFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\StreamFactoryInterface;

class ResilientApiClientTest extends TestCase
{
    public function test_successful_post_request()
    {
        // Mock del cliente HTTP
        $httpClient = $this->createMock(ClientInterface::class);
        $response = $this->createMock(ResponseInterface::class);

        $response->method('getStatusCode')->willReturn(201);
        $response->method('getBody')
            ->willReturn(
                stream_for(json_encode(['id' => 123, 'status' => 'created']))
            );

        $httpClient->method('sendRequest')->willReturn($response);

        // Mocks para factories
        $requestFactory = $this->createMock(RequestFactoryInterface::class);
        $streamFactory = $this->createMock(StreamFactoryInterface::class);

        $client = new ResilientApiClient(
            $httpClient,
            $requestFactory,
            $streamFactory
        );

        $result = $client->post(
            'https://api.example.com/orders',
            ['total' => 100]
        );

        $this->assertEquals(123, $result['id']);
    }
}
```

## PSR-18 vs Laravel HTTP Client

| Aspecto | PSR-18 | Laravel HTTP Client |
|---------|--------|-------------------|
| Estándar | Sí | No |
| Integración | Requiere setup | Built-in |
| Simplicidad | Media | Alta |
| Compatibilidad | Ecosistema PHP | Solo Laravel |
| Testabilidad | Excelente | Muy buena |
| Documentación | Estándar | Amplia |

**Recomendación**: Usa Laravel HTTP Client para proyectos típicos. Usa PSR-18 cuando:

- Integres librerías de terceros que requieran PSR-18
- Necesites máxima portabilidad
- Crees una librería reutilizable
- Requieras características avanzadas (reintentos, circuit breakers)

## Conclusión

PSR-18 trae al mundo Laravel la capacidad de usar cualquier cliente HTTP estándar del ecosistema PHP. Aunque Laravel HTTP Client es perfecto para la mayoría de casos, PSR-18 proporciona flexibilidad, interoperabilidad y robustez cuando los necesitas.

La adopción de estándares como PSR-18 hace que el código PHP sea más portable, testeable y mantenible a largo plazo. En Laravel 13.13+, implementar PSR-18 es directo y sin fricción.

## Puntos clave

- **PSR-18** es el estándar PHP para clientes HTTP que unifica interfaces
- Laravel 13.13+ permite usar cualquier cliente PSR-18 como implementación
- El cliente HTTP nativo de Laravel sigue siendo excelente para la mayoría de casos
- PSR-18 brilla cuando integras librerías de terceros o creas código reutilizable
- Implementar PSR-18 requiere crear un Service Provider que registre la implementación
- Los clientes PSR-18 son más fáciles de mockear en tests
- La inyección de dependencias hace que cambiar entre clientes sea trivial
- Considera PSR-18 para clientes API con requisitos avanzados (reintentos, caching)