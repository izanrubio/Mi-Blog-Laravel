---
title: 'Laravel Rulebook: Reglas de Negocio Dinámicas por Fecha'
description: 'Aprende a implementar reglas de negocio que cambian según la fecha con Laravel Rulebook. Gestiona versiones de reglas sin complejidad.'
pubDate: '2026-09-09'
tags: ['laravel', 'reglas-negocio', 'paquetes']
---

## Laravel Rulebook: Reglas de Negocio Dinámicas por Fecha

En aplicaciones empresariales complejas, frecuentemente nos encontramos con la necesidad de aplicar diferentes reglas de negocio según la fecha en que ocurre una acción. Imagina un sistema de e-commerce donde los descuentos, impuestos o políticas de envío cambian en determinadas épocas del año, o una plataforma SaaS donde los planes de precios evolucionan con el tiempo.

**Laravel Rulebook** es un paquete que resuelve exactamente este problema: permite definir múltiples versiones de una regla de negocio, determina automáticamente cuál aplica en una fecha específica, y te explica por qué esa regla ganó sobre las demás.

## ¿Por qué necesitas Rulebook?

Cuando trabajas sin una solución dedicada, terminas con código como este:

```php
public function calculateShippingCost($order, $date)
{
    if ($date >= '2025-01-01' && $date < '2025-03-31') {
        return $order->weight * 2.5; // Promoción de invierno
    } elseif ($date >= '2025-04-01' && $date < '2025-06-30') {
        return $order->weight * 1.8; // Precio normal
    } elseif ($date >= '2025-07-01') {
        return $order->weight * 3.2; // Temporada alta
    }
}
```

Este enfoque es problemático:
- **Difícil de mantener**: Cada nueva regla requiere modificar código existente
- **Poco testeable**: Las fechas están dispersas sin estructura clara
- **Sin auditoría**: No queda constancia de qué regla se aplicó y por qué
- **Propenso a errores**: Fácil crear solapamientos o huecos entre períodos

## Instalación y configuración

Instala Rulebook vía Composer:

```bash
composer require coderflex/laravel-rulebook
```

Publica la configuración si necesitas personalizarla:

```bash
php artisan vendor:publish --provider="Coderflex\Rulebook\RulebookServiceProvider"
```

## Definiendo reglas dinámicas por fecha

La forma más elegante de trabajar con Rulebook es crear clases dedicadas para cada regla de negocio. Veamos un ejemplo completo:

```php
<?php

namespace App\Rules;

use Coderflex\Rulebook\Contracts\RuleContract;
use DateTime;

class ShippingCostRule implements RuleContract
{
    public function __construct(
        private DateTime $validFrom,
        private DateTime $validTo,
        private float $costPerKg,
        private string $description
    ) {}

    public function validFrom(): DateTime
    {
        return $this->validFrom;
    }

    public function validTo(): DateTime
    {
        return $this->validTo;
    }

    public function apply($context)
    {
        return $context['weight'] * $this->costPerKg;
    }

    public function description(): string
    {
        return $this->description;
    }
}
```

Ahora crea el resolvedor de reglas que determina cuál aplica:

```php
<?php

namespace App\Services;

use Coderflex\Rulebook\Rulebook;
use App\Rules\ShippingCostRule;
use DateTime;

class ShippingRuleResolver
{
    private Rulebook $rulebook;

    public function __construct()
    {
        $this->rulebook = new Rulebook();
    }

    public function registerRules(): void
    {
        // Promoción de invierno (enero a marzo)
        $this->rulebook->register(new ShippingCostRule(
            new DateTime('2025-01-01'),
            new DateTime('2025-03-31'),
            2.5,
            'Tarifa de invierno - Promoción especial'
        ));

        // Tarifa normal (abril a junio)
        $this->rulebook->register(new ShippingCostRule(
            new DateTime('2025-04-01'),
            new DateTime('2025-06-30'),
            1.8,
            'Tarifa estándar'
        ));

        // Temporada alta (julio en adelante)
        $this->rulebook->register(new ShippingCostRule(
            new DateTime('2025-07-01'),
            new DateTime('2025-12-31'),
            3.2,
            'Tarifa de temporada alta'
        ));
    }

    public function resolveShippingCost(float $weight, DateTime $date): array
    {
        $this->registerRules();

        $context = ['weight' => $weight];
        
        // Obtiene la regla ganadora para la fecha específica
        $rule = $this->rulebook->resolve($date, $context);

        return [
            'cost' => $rule->apply($context),
            'rule_applied' => $rule->description(),
            'valid_from' => $rule->validFrom()->format('Y-m-d'),
            'valid_to' => $rule->validTo()->format('Y-m-d'),
        ];
    }
}
```

## Usando Rulebook en controladores

Implementar esto en tu aplicación es sencillo:

```php
<?php

namespace App\Http\Controllers;

use App\Services\ShippingRuleResolver;
use Illuminate\Http\Request;
use DateTime;

class ShippingController extends Controller
{
    public function __construct(private ShippingRuleResolver $resolver) {}

    public function calculateShipping(Request $request)
    {
        $validated = $request->validate([
            'weight' => 'required|numeric|min:0.1',
            'date' => 'required|date_format:Y-m-d',
        ]);

        $shippingInfo = $this->resolver->resolveShippingCost(
            $validated['weight'],
            new DateTime($validated['date'])
        );

        return response()->json($shippingInfo);
    }
}
```

### Ejemplo de respuesta:

```json
{
    "cost": 22.5,
    "rule_applied": "Tarifa de invierno - Promoción especial",
    "valid_from": "2025-01-01",
    "valid_to": "2025-03-31"
}
```

## Casos de uso avanzados

### Reglas con lógica condicional compleja

```php
class TaxRuleByRegion implements RuleContract
{
    public function __construct(
        private DateTime $validFrom,
        private DateTime $validTo,
        private array $regions,
        private float $taxRate
    ) {}

    public function apply($context)
    {
        // Solo aplica si la región está en la lista
        if (!in_array($context['region'], $this->regions)) {
            return 0;
        }

        return $context['amount'] * $this->taxRate;
    }

    // ... otros métodos requeridos ...
}
```

### Combinando múltiples resolvedores

```php
class OrderPricingService
{
    public function __construct(
        private ShippingRuleResolver $shippingRules,
        private TaxRuleResolver $taxRules,
        private DiscountRuleResolver $discountRules
    ) {}

    public function calculateFinalPrice($order)
    {
        $shipping = $this->shippingRules->resolve($order->date);
        $tax = $this->taxRules->resolve($order->date);
        $discount = $this->discountRules->resolve($order->date);

        return [
            'subtotal' => $order->amount,
            'shipping' => $shipping['cost'],
            'tax' => $tax['amount'],
            'discount' => $discount['amount'],
            'total' => $order->amount + $shipping['cost'] + $tax['amount'] - $discount['amount'],
            'breakdown' => compact('shipping', 'tax', 'discount'),
        ];
    }
}
```

## Testing de reglas dinámicas

Rulebook facilita enormemente los tests:

```php
<?php

namespace Tests\Unit;

use Tests\TestCase;
use App\Services\ShippingRuleResolver;
use DateTime;

class ShippingRuleTest extends TestCase
{
    private ShippingRuleResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = new ShippingRuleResolver();
    }

    public function test_winter_promotion_applies_correctly()
    {
        $date = new DateTime('2025-02-15');
        $result = $this->resolver->resolveShippingCost(10, $date);

        $this->assertEquals(25.0, $result['cost']);
        $this->assertStringContainsString('invierno', $result['rule_applied']);
    }

    public function test_high_season_rate_applies()
    {
        $date = new DateTime('2025-07-20');
        $result = $this->resolver->resolveShippingCost(10, $date);

        $this->assertEquals(32.0, $result['cost']);
        $this->assertStringContainsString('temporada alta', $result['rule_applied']);
    }

    public function test_standard_rate_applies_in_spring()
    {
        $date = new DateTime('2025-05-01');
        $result = $this->resolver->resolveShippingCost(10, $date);

        $this->assertEquals(18.0, $result['cost']);
    }
}
```

## Ventajas de usar Rulebook

**Separación de preocupaciones**: Cada regla vive en su propia clase, siguiendo el principio de responsabilidad única.

**Auditoría integrada**: Siempre sabes qué regla se aplicó, cuándo y por qué. Perfecto para cumplimiento normativo.

**Fácil de extender**: Agregar nuevas reglas no requiere modificar código existente.

**Testeable**: Cada regla puede probarse independientemente.

**Documentación clara**: Las descripciones de reglas sirven como documentación viva del comportamiento del sistema.

## Limitaciones y consideraciones

- **Rendimiento**: Para aplicaciones con miles de reglas activas, considera cachear el resultado de la resolución
- **Complejidad**: Si tus reglas son simples, Rulebook podría ser excesivo
- **Base de datos**: Rulebook en memoria funciona bien, pero para sistemas distribuidos considera guardar reglas en BD

## Puntos clave

- **Laravel Rulebook** automatiza la gestión de reglas de negocio que varían según la fecha
- Define reglas implementando `RuleContract` con fechas de validez explícitas
- El paquete resuelve automáticamente cuál regla aplica para una fecha específica
- Proporciona auditoría integrada mostrando qué regla se aplicó y por qué
- Facilita significativamente los tests unitarios de lógica de negocio compleja
- Ideal para sistemas e-commerce, SaaS y plataformas con políticas cambiantes
- Combina bien con múltiples resolvedores para cálculos complejos (precios, impuestos, descuentos)
- Mantiene el código limpio, testeable y fácil de mantener a lo largo del tiempo