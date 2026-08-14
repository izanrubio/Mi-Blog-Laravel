---
title: 'Double: Mocking Avanzado en Tests de Laravel sin Dolor'
description: 'Aprende a usar Double, la librería de mocking PHP que simplifica tus tests con una API unificada, spies y mensajes de error claros.'
pubDate: '2025-01-15'
tags: ['laravel', 'testing', 'php', 'pest', 'phpunit']
---

## Double: Mocking Avanzado en Tests de Laravel sin Dolor

Si has trabajado con tests en Laravel, probablemente conoces la frustración de lidiar con múltiples librerías de mocking. Mockery, PHPUnit mocks, spies... cada una con su propia sintaxis y comportamiento. **Double** es una librería creada por Jason McCreary que simplifica todo esto con una API unificada y mensajes de error que realmente te ayudan a entender qué falló.

En este artículo exploraremos cómo integrar Double en tus tests de Laravel, cuándo usarla y cómo obtiene lo mejor de mocks, spies y partials en una sola interfaz.

## ¿Qué es Double y por qué debería usarla?

Double es una librería de mocking para PHP diseñada con un propósito claro: **hacer que los tests sean más fáciles de escribir y entender**. A diferencia de otras librerías que requieren aprender diferentes APIs para diferentes tipos de doubles, Double ofrece:

- **API unificada**: Un solo conjunto de métodos para crear mocks, spies y partials
- **Mensajes de error legibles**: Cuando algo falla, ves exactamente qué se llamó y qué se esperaba
- **Sintaxis intuitiva**: Menos boilerplate, más claridad
- **Integración suave**: Funciona perfectamente con Pest y PHPUnit

## Instalación de Double en tu Proyecto Laravel

Comenzamos instalando Double vía Composer:

```bash
composer require --dev jasonmccreary/double
```

Una vez instalado, Double está listo para usar en tus tests. No necesitas configuración adicional.

## Tipos de Doubles: Mocks, Spies y Partials

### Qué es un Mock

Un **mock** es un objeto doble que reemplaza una dependencia completamente. Te permite definir qué métodos deben ser llamados, con qué argumentos y qué deben retornar.

```php
use Double\Double;

it('sends email on user registration', function () {
    $mailer = Double::mock();
    $mailer->expects('send')->with('user@example.com');
    
    $service = new UserRegistrationService($mailer);
    $service->register('user@example.com');
});
```

En este ejemplo, creamos un mock que espera que el método `send` sea llamado con un email específico. Si no se llama o se llama diferente, el test falla.

### Qué es un Spy

Un **spy** es diferente. No reemplaza completamente la dependencia, sino que observa las llamadas sin cambiar el comportamiento original. Útil cuando necesitas verificar que algo se llamó pero sin interferir en la lógica real.

```php
use Double\Double;

it('logs user actions', function () {
    $logger = Double::spy(new FileLogger());
    
    $userService = new UserService($logger);
    $userService->createUser('john@example.com');
    
    expect($logger)->toHaveBeenCalled('log');
});
```

### Qué es un Partial

Un **partial** es un objeto real con algunos métodos reemplazados. Combina lo mejor de ambos mundos: la lógica real donde la necesitas, mocks donde los necesitas.

```php
use Double\Double;

it('processes payment with mocked gateway', function () {
    $gateway = Double::partial(new PaymentGateway());
    $gateway->allows('charge')->andReturn(true);
    
    $processor = new PaymentProcessor($gateway);
    $result = $processor->process(100);
    
    expect($result)->toBeTrue();
});
```

## API Unificada de Double

### Creando Doubles

```php
// Mock completo
$mock = Double::mock();

// Spy sobre un objeto real
$spy = Double::spy($realObject);

// Partial (mezcla de real y mock)
$partial = Double::partial($realObject);

// Mock de una clase específica
$classMock = Double::mock(PaymentGateway::class);
```

### Definiendo Expectativas

Double utiliza una sintaxis fluida para definir qué esperas que suceda:

```php
use Double\Double;

it('handles multiple method calls correctly', function () {
    $repository = Double::mock();
    
    // Esperar una llamada específica
    $repository->expects('find')->with(1)->andReturn(['id' => 1, 'name' => 'John']);
    
    // Esperar que se llame al menos una vez
    $repository->expects('save')->times(1);
    
    // Permitir múltiples llamadas
    $repository->allows('delete')->andReturn(true);
    
    // Retorno flexible
    $repository->allows('all')->andReturn([]);
    
    $service = new UserService($repository);
    $service->findAndUpdate(1, ['name' => 'Jane']);
});
```

### Verificando Llamadas

```php
use Double\Double;

it('verifies method calls with Double', function () {
    $notifier = Double::spy(new Notifier());
    
    $service = new AlertService($notifier);
    $service->sendAlert('High temperature detected');
    
    // Verificar que se llamó
    expect($notifier)->toHaveBeenCalled('notify');
    
    // Verificar con argumentos específicos
    expect($notifier)->toHaveBeenCalledWith('notify', 'High temperature detected');
    
    // Verificar número de llamadas
    expect($notifier)->toHaveBeenCalled('notify', times: 1);
});
```

## Casos de Uso Prácticos en Laravel

### Testing de Servicios con Dependencias Externas

```php
use Double\Double;

class OrderService
{
    public function __construct(
        protected PaymentGateway $gateway,
        protected OrderRepository $repository,
        protected NotificationService $notifier
    ) {}
    
    public function placeOrder(Order $order): bool
    {
        $charged = $this->gateway->charge($order->total);
        
        if (!$charged) {
            return false;
        }
        
        $this->repository->save($order);
        $this->notifier->sendConfirmation($order);
        
        return true;
    }
}

it('places order with all dependencies mocked', function () {
    $gateway = Double::mock();
    $gateway->expects('charge')->with(99.99)->andReturn(true);
    
    $repository = Double::mock();
    $repository->expects('save');
    
    $notifier = Double::mock();
    $notifier->expects('sendConfirmation');
    
    $service = new OrderService($gateway, $repository, $notifier);
    
    $order = new Order(['total' => 99.99]);
    expect($service->placeOrder($order))->toBeTrue();
});
```

### Testing con Partials para Lógica Compleja

```php
use Double\Double;

class ReportGenerator
{
    public function __construct(protected Database $database) {}
    
    public function generateMonthlyReport(int $month): Report
    {
        $data = $this->database->query('SELECT * FROM sales WHERE MONTH = ?', [$month]);
        return new Report($data);
    }
}

it('generates report with mocked database', function () {
    $database = Double::partial(new Database());
    
    // Mock solo el método query
    $database->allows('query')->andReturn([
        ['product' => 'Widget', 'sales' => 100],
        ['product' => 'Gadget', 'sales' => 50],
    ]);
    
    $generator = new ReportGenerator($database);
    $report = $generator->generateMonthlyReport(1);
    
    expect($report->total())->toBe(150);
});
```

### Spying en Testing de Eventos

```php
use Double\Double;

it('spies on event listener calls', function () {
    $listener = Double::spy(new UserEventListener());
    
    Event::fake();
    Event::listen(UserCreated::class, [$listener, 'handle']);
    
    $user = User::factory()->create();
    
    expect($listener)->toHaveBeenCalled('handle');
});
```

## Mensajes de Error Claros de Double

Una de las mayores ventajas de Double es cómo reporta fallos. En lugar de mensajes genéricos, ves exactamente qué sucedió:

```php
$mock = Double::mock();
$mock->expects('send');

// Este test fallará con un mensaje claro mostrando:
// - Qué método se esperaba
// - Qué métodos se llamaron realmente
// - Los argumentos exactos

$mock->notify(); // ← Error: esperaba 'send' pero se llamó 'notify'
```

## Integración con Pest y PHPUnit

Double funciona sin problemas con Pest:

```php
// tests/Feature/OrderTest.php
use Double\Double;

describe('Order Processing', function () {
    it('completes order successfully', function () {
        $payment = Double::mock();
        $payment->expects('process')->andReturn(true);
        
        $service = new OrderService($payment);
        $result = $service->execute();
        
        expect($result)->toBeTrue();
    });
    
    it('handles payment failure', function () {
        $payment = Double::mock();
        $payment->expects('process')->andReturn(false);
        
        $service = new OrderService($payment);
        $result = $service->execute();
        
        expect($result)->toBeFalse();
    });
});
```

Y también con PHPUnit tradicional:

```php
// tests/Unit/UserServiceTest.php
use Double\Double;
use PHPUnit\Framework\TestCase;

class UserServiceTest extends TestCase
{
    public function test_creates_user_with_email_verification()
    {
        $mailer = Double::mock();
        $mailer->expects('send');
        
        $service = new UserService($mailer);
        $service->create('user@example.com');
        
        $this->assertTrue(true); // Double valida automáticamente
    }
}
```

## Mejores Prácticas al Usar Double

### 1. Mantén Mocks Simples

```php
// ✅ Bien: Mock con una responsabilidad clara
$repository = Double::mock();
$repository->allows('find')->andReturn($user);

// ❌ Evita: Mocks con comportamiento complejo
$repository = Double::mock();
$repository->allows('find')->andReturn(condition ? $user1 : $user2);
```

### 2. Usa Spies para Observar Objetos Reales

```php
// ✅ Bien: Espiar un objeto real para verificar comportamiento
$logger = Double::spy(new Logger());
$service = new Service($logger);
$service->execute();
expect($logger)->toHaveBeenCalled('info');

// ❌ Evita: Crear mocks cuando podrías usar spies
$logger = Double::mock(); // Si necesitas el comportamiento real
```

### 3. Sé Explícito con Expectativas

```php
// ✅ Bien: Expectativas claras
$gateway->expects('charge')->with(99.99)->andReturn(true);

// ❌ Menos claro: Expectativas vagas
$gateway->allows('charge')->andReturn(true);
```

## Puntos Clave

- **Double** proporciona una API unificada para mocks, spies y partials sin cambiar de librería
- Los **mocks** reemplazan completamente las dependencias para test aislados
- Los **spies** observan objetos reales sin alterar su comportamiento
- Los **partials** combinan lógica real con métodos mockeados cuando lo necesitas
- Los mensajes de error de Double muestran exactamente qué llamadas se hicieron y cuáles se esperaban
- Funciona perfectamente integrado con Pest y PHPUnit
- Reduce el boilerplate y hace tus tests más legibles y mantenibles
- Ideal para testing de servicios con dependencias externas como gateways, APIs y bases de datos