---
title: 'Toolkit en Laravel: Herramientas Reutilizables para IA'
description: 'Domina Toolkit, el catálogo de herramientas reutilizables para Laravel AI SDK. Integra búsqueda web, consultas a BD y más en tus apps con IA.'
pubDate: '2026-06-13'
tags: ['laravel', 'ia', 'ai-sdk', 'toolkit']
---

# Toolkit en Laravel: Herramientas Reutilizables para IA

La inteligencia artificial ha llegado para quedarse, y Laravel está apostando fuerte por hacerla accesible a través del **Laravel AI SDK**. Pero aquí viene lo interesante: no necesitas reinventar la rueda cada vez que quieres conectar tu aplicación con capacidades de IA. Entra en juego **Toolkit**, un catálogo comunitario de herramientas pequeñas, independientes e instalables que expanden significativamente lo que puedes hacer con el AI SDK.

En este artículo te mostraré qué es Toolkit, cómo usarlo, y cómo construir tus propias herramientas reutilizables para que tus agentes IA sean más poderosos y flexibles.

## ¿Qué es Toolkit?

Toolkit es un ecosistema de paquetes independientes diseñados para extender el **Laravel AI SDK** con funcionalidades especializadas. Piensa en él como un marketplace de superpoderes para tus agentes IA.

En lugar de tener un único paquete monolítico con todo, Toolkit promueve la filosofía Unix: pequeños componentes que hacen una cosa bien y se combinan fácilmente. Esto significa:

- **Instalación modular**: Solo instalas lo que necesitas
- **Independencia**: Cada herramienta funciona sin depender de otras
- **Contribución comunitaria**: Cualquiera puede crear y compartir nuevas herramientas
- **Facilidad de mantenimiento**: Código más limpio y especializado

Entre las herramientas disponibles encontramos operaciones matemáticas, consultas de solo lectura a bases de datos, búsqueda web, y muchas más.

## Por Qué Toolkit Importa

Imagina que estás construyendo un asistente IA para tu aplicación SaaS. Sin Toolkit, tendrías que:

1. Escribir toda la lógica manualmente
2. Mantenerla en tu codebase
3. Testearla extensamente
4. Documentarla adecuadamente

Con Toolkit, simplemente instalas la herramienta que necesitas, la configuras mínimamente, y ya está lista. Es como la diferencia entre construir un auto desde cero versus ensamblar piezas ya probadas.

## Instalación de Herramientas Toolkit

El proceso es sencillo. Primero, necesitas tener el Laravel AI SDK instalado:

```bash
composer require laravel/ai
```

Luego, instala las herramientas Toolkit que necesites. Por ejemplo, para la búsqueda web:

```bash
composer require toolkit/web-search
```

Para operaciones matemáticas:

```bash
composer require toolkit/math
```

Para consultas de base de datos:

```bash
composer require toolkit/database-query
```

Instala solo lo que necesites. La belleza de Toolkit es su modularidad.

## Usando Herramientas Toolkit en tu Aplicación

### Ejemplo 1: Búsqueda Web

Una de las herramientas más útiles es la búsqueda web. Permite que tus agentes IA busquen información en internet en tiempo real.

```php
<?php

namespace App\Services;

use Laravel\AI\Agents\Agent;
use Toolkit\WebSearch\WebSearchTool;

class ResearchAssistant
{
    public function analyzeNews(string $topic): string
    {
        $agent = new Agent([
            new WebSearchTool(),
        ]);

        return $agent->prompt(
            "Investiga los últimos artículos sobre {$topic} " .
            "y resume los puntos principales en 3 párrafos."
        )->text();
    }
}
```

Cuando el agente ejecuta esto, puede automáticamente buscar información actual sobre el tema, sin que tengas que proporcionar datos pre-cargados.

### Ejemplo 2: Consultas de Base de Datos Seguras

La herramienta de base de datos de Toolkit permite a los agentes IA hacer consultas de **solo lectura** de forma segura:

```php
<?php

namespace App\Services;

use Laravel\AI\Agents\Agent;
use Toolkit\DatabaseQuery\DatabaseQueryTool;

class AnalyticsAssistant
{
    public function generateReport(): string
    {
        $agent = new Agent([
            new DatabaseQueryTool([
                'tables' => ['users', 'orders', 'products'],
                'read_only' => true,
            ]),
        ]);

        return $agent->prompt(
            "Analiza la tabla de órdenes y cuéntame: " .
            "¿Cuál es el valor promedio de las compras? " .
            "¿Cuántos clientes nuevos tenemos este mes?"
        )->text();
    }
}
```

**Nota importante**: La herramienta `DatabaseQueryTool` está configurada como `read_only`, lo que es crítico para seguridad. El agente puede consultar datos, pero nunca modificar o eliminar nada.

### Ejemplo 3: Operaciones Matemáticas

Para cálculos complejos:

```php
<?php

namespace App\Services;

use Laravel\AI\Agents\Agent;
use Toolkit\Math\MathTool;

class FinancialAdvisor
{
    public function calculateProjection(float $initialAmount, float $monthlyContribution, float $annualReturn): string
    {
        $agent = new Agent([
            new MathTool(),
        ]);

        return $agent->prompt(
            "Calcula la proyección financiera con: " .
            "- Cantidad inicial: \$$initialAmount " .
            "- Aporte mensual: \$$monthlyContribution " .
            "- Retorno anual: {$annualReturn}% " .
            "Dame la proyección a 10 años."
        )->text();
    }
}
```

## Creando tu Propia Herramienta Toolkit

La verdadera potencia de Toolkit es que **puedes crear tus propias herramientas**. Aquí te muestro cómo construir una herramienta personalizada que integre tu lógica de negocio específica.

### Estructura Base de una Herramienta

```php
<?php

namespace App\Tools;

use Laravel\AI\Tool;
use Laravel\AI\ToolParameter;

class CustomerLookupTool extends Tool
{
    public function name(): string
    {
        return 'customer-lookup';
    }

    public function description(): string
    {
        return 'Busca información de clientes por email o ID en la base de datos.';
    }

    public function parameters(): array
    {
        return [
            new ToolParameter(
                name: 'query',
                description: 'Email o ID del cliente a buscar',
                type: 'string',
                required: true,
            ),
            new ToolParameter(
                name: 'include_orders',
                description: 'Incluir historial de órdenes',
                type: 'boolean',
                required: false,
            ),
        ];
    }

    public function execute(array $arguments): string
    {
        $query = $arguments['query'];
        $includeOrders = $arguments['include_orders'] ?? false;

        // Lógica para buscar clientes
        $customer = Customer::where('email', $query)
            ->orWhere('id', $query)
            ->first();

        if (!$customer) {
            return "Cliente no encontrado.";
        }

        $response = [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'created_at' => $customer->created_at,
        ];

        if ($includeOrders) {
            $response['orders'] = $customer->orders()
                ->select('id', 'total', 'created_at')
                ->latest()
                ->take(5)
                ->get()
                ->toArray();
        }

        return json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }
}
```

### Usando tu Herramienta Personalizada

```php
<?php

namespace App\Services;

use App\Tools\CustomerLookupTool;
use Laravel\AI\Agents\Agent;

class CustomerServiceAssistant
{
    public function handleCustomerQuery(string $userQuery): string
    {
        $agent = new Agent([
            new CustomerLookupTool(),
        ]);

        return $agent->prompt($userQuery)->text();
    }
}
```

Un usuario podría preguntar: *"Busca al cliente juan@ejemplo.com e incluye sus últimas compras"*, y el agente usaría automáticamente tu `CustomerLookupTool` para recuperar esa información.

## Mejores Prácticas para Herramientas Toolkit

### 1. Seguridad Primero

Siempre valida y sanitiza los parámetros. Las herramientas de base de datos deben ser de **solo lectura** cuando sea posible:

```php
public function execute(array $arguments): string
{
    $query = trim($arguments['query']);
    
    // Validación
    if (strlen($query) < 2) {
        return "La búsqueda debe tener al menos 2 caracteres.";
    }

    // Sanitización adicional si es necesario
    $query = htmlspecialchars($query);

    // Tu lógica...
}
```

### 2. Manejo de Errores Robusto

```php
public function execute(array $arguments): string
{
    try {
        $result = $this->processData($arguments);
        return json_encode($result);
    } catch (\Exception $e) {
        // Nunca expongas detalles técnicos al agente IA
        return "Error al procesar la solicitud. Por favor, intenta de nuevo.";
    }
}
```

### 3. Documentación Clara

Las descripciones de parámetros deben ser precisas y útiles. El agente IA las usará para decidir cuándo llamar tu herramienta:

```php
public function parameters(): array
{
    return [
        new ToolParameter(
            name: 'email',
            description: 'Email válido del cliente (ej: usuario@dominio.com)',
            type: 'string',
            required: true,
        ),
    ];
}
```

### 4. Limita el Alcance

Cada herramienta debe hacer **una cosa bien**. No intentes crear una herramienta que maneje todo:

```php
// ❌ Malo: Demasiado dentro de una herramienta
class UniversalTool extends Tool {
    // ... busca clientes, productos, procesa pagos, etc.
}

// ✅ Bueno: Herramientas especializadas
class CustomerLookupTool extends Tool { /* ... */ }
class ProductSearchTool extends Tool { /* ... */ }
class PaymentProcessorTool extends Tool { /* ... */ }
```

## Casos de Uso Reales

### Asistente de Servicio al Cliente

Combina múltiples herramientas:

```php
$agent = new Agent([
    new CustomerLookupTool(),
    new OrderHistoryTool(),
    new RefundTool(),
]);

$response = $agent->prompt(
    "Un cliente escribió: 'Compré hace 5 días pero el producto llegó dañado, " .
    "quiero una devolución.' " .
    "¿Puedes manejar esto?"
)->text();
```

### Sistema de Análisis Financiero

```php
$agent = new Agent([
    new DatabaseQueryTool(['tables' => ['transactions', 'accounts']]),
    new MathTool(),
    new ReportGeneratorTool(),
]);

$analysis = $agent->prompt(
    "Genera un análisis de cash flow para Q1 2026"
)->text();
```

### Investigación y Documentación

```php
$agent = new Agent([
    new WebSearchTool(),
    new DocumentationTool(),
    new SummarizerTool(),
]);

$docs = $agent->prompt(
    "Investiga las mejores prácticas de seguridad en APIs REST " .
    "y crea un documento de referencia."
)->text();
```

## Publicar tu Herramienta en el Catálogo

Si construiste una herramienta útil, considera compartirla con la comunidad:

1. Crea un repositorio GitHub con el nombre `toolkit-{nombre}`
2. Asegúrate de que tengas tests adecuados
3. Documenta claramente cómo se usa
4. Publica en Packagist
5. Notifica al equipo de Laravel para que la añadan al catálogo

## Conclusión

Toolkit representa un cambio paradigmático en cómo construimos aplicaciones con IA en Laravel. En lugar de reinventar constantemente funcionalidades, podemos componerlas desde piezas ya probadas y confiables.

La clave es entender que cada herramienta es un punto de conexión entre tu aplicación y las capacidades del agente IA. Bien diseñadas, dan a los agentes **superpoderes específicos del dominio** sin comprometer seguridad o rendimiento.

Comienza explorando las herramientas existentes en el catálogo de Toolkit, entiende cómo funcionan, y cuando tengas una necesidad específica, construye la tuya. La comunidad Laravel se beneficiará.

## Puntos Clave

- **Toolkit es un catálogo modular** de herramientas para el Laravel AI SDK, promoviendo la filosofía Unix de pequeños componentes especializados
- **Solo instala lo que necesitas**: `composer require toolkit/web-search`, `toolkit/math`, etc.
- **La seguridad es crítica**: siempre usa `read_only` en consultas de BD y valida parámetros
- **Crear herramientas personalizadas** es simple: extiende la clase `Tool` y define `name()`, `description()`, `parameters()` y `execute()`
- **Cada herramienta debe hacer una cosa bien**: divide responsabilidades, no crees herramientas monolíticas
- **Combina herramientas** en agentes para crear funcionalidades complejas sin acoplamiento
- **Contribuye a la comunidad**: si creas herramientas útiles, publícalas en el catálogo de Toolkit
- **Los parámetros bien documentados** son esenciales: el agente IA los usa para decidir cuándo llamar tu herramienta