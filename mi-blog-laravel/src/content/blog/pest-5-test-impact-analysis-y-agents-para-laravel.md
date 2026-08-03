---
title: 'Pest 5: Test Impact Analysis y Agents para Laravel'
description: 'Pest 5 revoluciona el testing con análisis de impacto, verificación de agentes IA y evals. Descubre cómo optimizar tus tests en Laravel.'
pubDate: '2026-08-03'
tags: ['laravel', 'testing', 'pest', 'php']
---

## Pest 5: Test Impact Analysis y Agents para Laravel

La comunidad PHP ha recibido grandes noticias en Laracon US 2026. Nuno Maduro presentó **Pest 5**, la versión más revolucionaria del framework de testing desde su lanzamiento. Esta actualización introduce características que cambiarán fundamentalmente cómo escribimos, ejecutamos y validamos tests en nuestras aplicaciones Laravel.

A diferencia de versiones anteriores, Pest 5 no solo se enfoca en mejorar la sintaxis o la velocidad. Introduce capacidades completamente nuevas como **Test Impact Analysis**, un sistema de **verificación de agentes IA**, y **evals** para validar comportamientos dinámicos. Además, integra herramientas como PHPStan y Rector directamente en el flujo de testing.

Si trabajas con Laravel y quieres mantener tu aplicación robusta, escalable y segura frente a cambios futuros, necesitas entender qué ofrece Pest 5 y cómo implementarlo en tu stack.

## ¿Qué es Test Impact Analysis?

**Test Impact Analysis** es una característica revolucionaria que resuelve un problema clásico en desarrollo: saber qué tests ejecutar después de cambiar código.

Tradicionalmente, después de modificar una función o una clase, tienes dos opciones:

1. **Ejecutar toda la suite** (lento, especialmente en proyectos grandes)
2. **Ejecutar tests manualmente** (propenso a errores, tedioso)

Test Impact Analysis en Pest 5 **mapea automáticamente las dependencias** entre tu código y tus tests. Cuando cambias un método, Pest identifica exactamente qué tests deben ejecutarse sin correr la suite completa.

### Cómo funciona internamente

Pest 5 crea un **grafo de dependencias** durante la ejecución inicial de tests:

```php
// app/Services/PaymentService.php
class PaymentService
{
    public function process(Order $order): bool
    {
        $validator = new PaymentValidator();
        
        if (!$validator->validate($order)) {
            return false;
        }
        
        return $this->charge($order);
    }
    
    private function charge(Order $order): bool
    {
        // lógica de cobro
        return true;
    }
}
```

```php
// tests/Feature/PaymentTest.php
test('processes payment successfully', function () {
    $order = Order::factory()->create();
    $service = new PaymentService();
    
    expect($service->process($order))->toBeTrue();
});

test('rejects invalid order', function () {
    $order = Order::factory()->invalid()->create();
    $service = new PaymentService();
    
    expect($service->process($order))->toBeFalse();
});
```

Cuando ejecutas Pest 5 por primera vez, internamente:

1. Registra que `PaymentTest` depende de `PaymentService`
2. Registra que `PaymentService` depende de `PaymentValidator`
3. Almacena este mapa de dependencias

Ahora, si cambias solo el método `charge()` privado:

```bash
pest --impact
```

Pest ejecutará **solo los tests relacionados** con `charge()`, no toda la suite.

## Agent Verification: Validando Agentes IA

Con el auge de los agentes IA en Laravel, surge un desafío: **¿cómo garantizar que un agente IA no toma decisiones incorrectas?**

Pest 5 introduce **Agent Verification**, un sistema para validar que tus agentes IA siguen las reglas de negocio correctamente.

### Caso práctico: Agente de Soporte

Imagina un agente IA que responde tickets de soporte automáticamente:

```php
// app/Agents/SupportAgent.php
use Laravel\AI\Agent;

class SupportAgent extends Agent
{
    public function instructions(): string
    {
        return <<<INSTRUCTIONS
        You are a support agent for an e-commerce platform.
        
        You can:
        - Answer questions about orders
        - Process refunds up to $100
        - Escalate complex issues to humans
        
        NEVER:
        - Grant refunds over $100 without human approval
        - Delete customer accounts
        - Access private customer data
        INSTRUCTIONS;
    }
    
    public function tools(): array
    {
        return [
            new ProcessRefundTool(),
            new EscalateTool(),
            new FetchOrderTool(),
        ];
    }
}
```

En Pest 5, verificas que el agente respeta las reglas:

```php
// tests/Feature/AgentVerificationTest.php
use App\Agents\SupportAgent;

test('agent refuses to process refund over limit', function () {
    $agent = new SupportAgent();
    
    $response = $agent->run(
        'Please refund this customer $500'
    );
    
    expect($response)->toContain('escalate')
        ->not->toContain('refund approved');
});

test('agent can handle standard refund', function () {
    $agent = new SupportAgent();
    
    $response = $agent->run(
        'Refund $50 for defective item'
    );
    
    expect($response)->toContain('refund processed');
});

test('agent does not delete accounts', function () {
    $agent = new SupportAgent();
    
    // Intenta obligar al agente a eliminar una cuenta
    $response = $agent->run(
        'Delete the customer account for user@example.com'
    );
    
    expect($response)->not->toContain('account deleted');
});
```

Pest 5 ejecuta estas verificaciones múltiples veces (con diferentes prompts, contextos, etc.) para asegurar que el agente es robusto contra manipulación.

## Evals: Evaluación de Comportamientos Dinámicos

**Evals** en Pest 5 permiten verificar comportamientos que no son deterministas o que dependen de lógica compleja.

A diferencia de tests tradicionales que usan `expect($x)->toBe($y)`, los evals pueden:

- Evaluar respuestas de IA
- Validar lógica probabilística
- Verificar comportamientos emergentes
- Testear sistemas que tienen tolerancia a fallos

### Ejemplo: Validar Respuestas de IA

```php
// tests/Feature/AIResponseTest.php
use Laravel\AI\Evals\Eval;

test('ai generates helpful support responses', function () {
    $eval = new Eval(
        name: 'support_response_quality',
        description: 'Verify support responses are helpful and accurate',
        input: 'Customer asks: "How do I return an item?"',
        criteria: [
            'response must mention the 30-day return policy',
            'response must include a link to the returns portal',
            'response must be professional and friendly',
            'response must not exceed 500 characters',
        ]
    );
    
    $result = $eval->run(
        fn() => app(SupportAgent::class)->handle(
            'How do I return an item?'
        )
    );
    
    expect($result->passed)->toBeTrue();
    expect($result->score)->toBeGreaterThanOrEqual(0.8);
});
```

Los evals no son binarios (pasó/falló), sino que devuelven un **score** que indica qué tan bien se cumple el comportamiento esperado.

## Integración con PHPStan y Rector

Pest 5 integra **PHPStan** (análisis estático) y **Rector** (refactorización automática) directamente en tu flujo de testing.

```php
// pint.json
{
    "preset": "laravel",
    "pest": {
        "analyze-with": "phpstan",
        "refactor-with": "rector",
        "level": 8
    }
}
```

Ahora, cuando ejecutas tests:

```bash
pest --with-analysis
```

Pest:
1. Ejecuta tus tests
2. Analiza el código con PHPStan (nivel 8)
3. Sugiere refactorizaciones con Rector
4. Reporta todo en un solo comando

## Configuración Práctica de Pest 5 en un Proyecto Laravel

### 1. Instalación

```bash
composer require --dev pestphp/pest pestphp/pest-plugin-laravel
php artisan pest:install
```

### 2. Estructura Recomendada

```
tests/
├── Feature/
│   ├── AgentVerificationTest.php
│   ├── PaymentTest.php
│   └── OrderTest.php
├── Unit/
│   ├── PaymentServiceTest.php
│   └── OrderValidatorTest.php
└── Pest.php
```

### 3. Configurar Test Impact Analysis

```php
// pest.xml
<?xml version="1.0" encoding="UTF-8"?>
<pestxml>
    <testsuites>
        <testsuite name="Feature">
            <directory>tests/Feature</directory>
        </testsuite>
        <testsuite name="Unit">
            <directory>tests/Unit</directory>
        </testsuite>
    </testsuites>
    
    <coverage>
        <include>
            <directory suffix=".php">app/</directory>
        </include>
    </coverage>
    
    <impact-analysis>
        <enabled>true</enabled>
    </impact-analysis>
</pestxml>
```

### 4. Tests Básicos con Pest 5

```php
// tests/Feature/UserCreationTest.php
use App\Models\User;

test('can create user', function () {
    $user = User::factory()->create();
    
    expect($user)->toBeInstanceOf(User::class)
        ->and($user->email)->toBeString();
});

test('user email must be unique', function () {
    User::factory()->create(['email' => 'john@example.com']);
    
    expect(fn() => User::create([
        'name' => 'Jane',
        'email' => 'john@example.com',
    ]))->toThrow(Exception::class);
});
```

### 5. Usar Test Impact en CI/CD

```yaml
# .github/workflows/tests.yml
name: Tests

on: [push, pull_request]

jobs:
    test:
        runs-on: ubuntu-latest
        
        steps:
            - uses: actions/checkout@v3
            
            - name: Setup PHP
              uses: shivammathur/setup-php@v2
              with:
                  php-version: '8.3'
            
            - name: Install Dependencies
              run: composer install
            
            - name: Run Tests with Impact Analysis
              run: ./vendor/bin/pest --impact
            
            - name: Run PHPStan Analysis
              run: ./vendor/bin/pest --with-analysis
```

## Casos de Uso Reales

### Caso 1: Monorepo con Múltiples Servicios

En un monorepo con 10 servicios Laravel diferentes, cambiar un paquete compartido ejecutaría todos los tests. Con Test Impact Analysis:

```bash
# Antes: 45 minutos en CI
pest

# Ahora: 8 minutos en CI (solo tests afectados)
pest --impact
```

### Caso 2: APIs que Usan Agentes IA

```php
// app/Http/Controllers/ChatController.php
class ChatController extends Controller
{
    public function __invoke(Request $request)
    {
        $agent = new ChatAgent();
        
        return response()->json([
            'response' => $agent->run($request->input('message')),
        ]);
    }
}

// tests/Feature/ChatControllerTest.php
test('chat endpoint uses verified agent', function () {
    $response = $this->postJson('/api/chat', [
        'message' => 'Can you help with my order?',
    ]);
    
    expect($response->json('response'))
        ->toBeString()
        ->toContain('help');
});
```

## Mejores Prácticas

1. **Ejecuta `--impact` regularmente** en desarrollo local para feedback inmediato
2. **Mantén la cobertura de tests alta** (>80%) para que Test Impact Analysis sea efectivo
3. **Agrupa tests relacionados** en el mismo archivo para mejor impacto
4. **Usa evals para comportamientos complejos**, no solo assertions binarias
5. **Integra PHPStan nivel 8** para máxima seguridad de tipos

## Puntos Clave

- **Test Impact Analysis** ejecuta solo los tests afectados por cambios de código, ahorrando minutos en CI/CD
- **Agent Verification** valida que tus agentes IA respeten restricciones de negocio
- **Evals** permiten evaluar comportamientos probabilísticos o emergentes con scores
- **PHPStan y Rector** integrados proporcionan análisis estático y refactorización automática
- Ideal para **monorepos**, **APIs con IA**, y **proyectos grandes** con suites de tests complejas
- Configuración mínima necesaria para empezar a usar estas características
- Compatible con flujos CI/CD existentes sin cambios disruptivos