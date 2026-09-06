---
title: 'Compoships en Laravel: Relaciones en Múltiples Columnas'
description: 'Aprende a crear relaciones Eloquent en múltiples columnas con Compoships. Guía completa con claves primarias compuestas y ejemplos prácticos.'
pubDate: '2025-01-15'
tags: ['laravel', 'eloquent', 'relaciones', 'base-datos']
---

## Compoships en Laravel: Relaciones en Múltiples Columnas

Las relaciones Eloquent en Laravel son poderosas, pero por defecto funcionan basándose en una única columna de clave externa. ¿Qué sucede cuando necesitas relacionar modelos utilizando múltiples columnas? Aquí es donde entra en juego **Compoships**, un paquete que extiende las capacidades de Eloquent para soportar relaciones basadas en claves compuestas.

En este artículo descubrirás cómo implementar relaciones complejas en tu aplicación Laravel, manejar claves primarias compuestas y simplificar consultas que de otro modo serían tediosamente complicadas.

## ¿Qué es Compoships y por qué lo necesitas?

Compoships es un paquete Laravel que añade soporte nativo para relaciones Eloquent basadas en múltiples columnas. Mientras que Eloquent tradicional maneja relaciones como `belongsTo()` o `hasMany()` usando una sola clave foránea, Compoships permite trabajar con escenarios más complejos donde múltiples columnas definen la relación.

### Casos de uso comunes

- **Sistemas multitenancy**: Relacionar datos por `tenant_id` + `id`
- **Históricos de precios**: Conexiones por `product_id` + `date_range`
- **Configuraciones versioned**: Relaciones por `config_id` + `version`
- **Datos particionados**: Cuando las claves incluyen tanto el identificador como un discriminador

Sin Compoships, tendrías que recurrir a consultas raw o a filtrados manuales. Con Compoships, mantienes la elegancia y funcionalidad de Eloquent.

## Instalación y configuración

Instalar Compoships es tan simple como cualquier otro paquete Laravel:

```bash
composer require topclaudy/compoships
```

No requiere publicación de configuración ni ejecutar migraciones. El paquete está listo para usar inmediatamente.

## Implementando relaciones con Compoships

Compoships proporciona traits y métodos que extienden el comportamiento estándar de Eloquent. Veamos cómo implementarlo en casos prácticos.

### Modelo base con Compoships

Para habilitar relaciones compuestas, utiliza el trait `Compoships` en tus modelos:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class Order extends Model
{
    use Compoships;

    protected $fillable = ['customer_id', 'tenant_id', 'total'];
}
```

### Ejemplo 1: Relación belongsTo con múltiples columnas

Imagina un sistema donde cada orden pertenece a un cliente, pero la relación se define por `customer_id` + `tenant_id`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class Order extends Model
{
    use Compoships;

    protected $fillable = ['customer_id', 'tenant_id', 'total', 'status'];

    /**
     * Relación con cliente usando dos columnas
     */
    public function customer()
    {
        return $this->belongsTo(
            Customer::class,
            ['customer_id', 'tenant_id'],        // columnas locales
            ['id', 'tenant_id']                   // columnas remotas
        );
    }
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class Customer extends Model
{
    use Compoships;

    protected $fillable = ['tenant_id', 'name', 'email'];

    /**
     * Relación con órdenes
     */
    public function orders()
    {
        return $this->hasMany(
            Order::class,
            ['customer_id', 'tenant_id'],
            ['id', 'tenant_id']
        );
    }
}
```

Ahora puedes usar la relación de forma natural:

```php
// Obtener las órdenes de un cliente
$customer = Customer::find(1);
$orders = $customer->orders; // Solo devuelve órdenes del tenant_id del cliente

// Acceder al cliente desde una orden
$order = Order::find(1);
$customer = $order->customer;

// Filtrar con eager loading
$customersWithOrders = Customer::with('orders')
    ->where('tenant_id', auth()->user()->tenant_id)
    ->get();
```

### Ejemplo 2: Relación hasMany con claves compuestas

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class Product extends Model
{
    use Compoships;

    protected $fillable = ['tenant_id', 'sku', 'name', 'price'];

    /**
     * Historial de precios usando tenant_id + product_id
     */
    public function priceHistory()
    {
        return $this->hasMany(
            PriceHistory::class,
            ['product_id', 'tenant_id'],
            ['id', 'tenant_id']
        );
    }
}
```

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class PriceHistory extends Model
{
    use Compoships;

    protected $fillable = ['product_id', 'tenant_id', 'price', 'date_from', 'date_to'];

    public function product()
    {
        return $this->belongsTo(
            Product::class,
            ['product_id', 'tenant_id'],
            ['id', 'tenant_id']
        );
    }
}
```

### Ejemplo 3: Relaciones belongsToMany con claves compuestas

Para relaciones many-to-many más complejas:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Topclaudy\Compoships\Compoships;

class Company extends Model
{
    use Compoships;

    protected $fillable = ['tenant_id', 'name'];

    /**
     * Empleados de la empresa (relación many-to-many)
     */
    public function employees()
    {
        return $this->belongsToMany(
            Employee::class,
            'company_employee',
            'company_id',
            'employee_id',
            'id',
            'id'
        )->withPivot('tenant_id');
    }
}
```

## Operaciones CRUD con relaciones compuestas

Compoships mantiene la compatibilidad total con operaciones estándar de Eloquent:

### Crear registros relacionados

```php
// Crear una orden para un cliente específico
$order = $customer->orders()->create([
    'tenant_id' => $customer->tenant_id,
    'total' => 150.00,
    'status' => 'pending'
]);

// O usar fill y save
$order = new Order();
$order->fill([
    'customer_id' => $customer->id,
    'tenant_id' => $customer->tenant_id,
    'total' => 250.00
]);
$order->save();
```

### Actualizar registros

```php
// Actualizar órdenes de un cliente
$customer->orders()->update(['status' => 'shipped']);

// O actualizar un modelo individual
$order->update(['status' => 'delivered']);
```

### Eliminar registros

```php
// Eliminar todas las órdenes de un cliente
$customer->orders()->delete();

// O eliminar un modelo específico
$order->delete();
```

### Refrescar modelos

Una característica importante de Compoships es que mantiene sincronización correcta al refrescar:

```php
$order = Order::find(1);
$order->total = 500;
$order->refresh(); // Se refrescará correctamente con claves compuestas
```

## Consultas avanzadas con Compoships

### Eager loading

```php
// Cargar órdenes con sus clientes en una sola consulta
$orders = Order::with('customer')
    ->where('status', 'pending')
    ->get();

// Eager loading anidado
$customers = Customer::with('orders.items')
    ->get();
```

### Filtrar a través de relaciones

```php
// Clientes que tienen órdenes pendientes
$customers = Customer::whereHas('orders', function ($query) {
    $query->where('status', 'pending');
})->get();

// Contar relaciones
$customersWithOrdersCount = Customer::withCount('orders')->get();
```

### Joining con relaciones compuestas

```php
// Usar join con múltiples columnas
$orders = Order::join('customers', function ($join) {
    $join->on('orders.customer_id', '=', 'customers.id')
         ->on('orders.tenant_id', '=', 'customers.tenant_id');
})
->select('orders.*', 'customers.name')
->get();
```

## Consideraciones de rendimiento

Cuando trabajes con Compoships, considera estos puntos:

### Índices de base de datos

Asegúrate de crear índices compuestos para tus claves:

```php
// En una migración
Schema::create('orders', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('customer_id');
    $table->unsignedBigInteger('tenant_id');
    $table->decimal('total');
    $table->timestamps();
    
    // Índice compuesto crítico
    $table->index(['customer_id', 'tenant_id']);
    $table->index(['tenant_id', 'customer_id']);
});
```

### Evitar N+1 queries

Siempre usa eager loading:

```php
// ❌ Malo: genera N+1 queries
foreach (Order::all() as $order) {
    echo $order->customer->name;
}

// ✅ Bien: una sola consulta
foreach (Order::with('customer')->get() as $order) {
    echo $order->customer->name;
}
```

## Limitaciones y alternativas

### Cuándo Compoships puede no ser suficiente

- **Relaciones ultra-complejas**: Si necesitas lógica muy específica, queries raw podrían ser más claras
- **Performance crítica**: Para sistemas con millones de registros, considera sharding o arquitecturas especializadas
- **Múltiples tenants**: Asegúrate de implementar correctamente verificaciones de seguridad

### Combinación con Query Builder

A veces es útil combinar Compoships con Query Builder:

```php
$orders = Order::query()
    ->where('tenant_id', auth()->user()->tenant_id)
    ->whereHas('customer', function ($query) {
        $query->where('status', 'active');
    })
    ->with(['customer', 'items'])
    ->paginate(15);
```

## Migrando código existente a Compoships

Si ya tienes relaciones complejas implementadas manualmente:

```php
// ❌ Antes: Filtrado manual
$orders = Order::all()
    ->filter(function ($order) use ($customerId, $tenantId) {
        return $order->customer_id === $customerId 
            && $order->tenant_id === $tenantId;
    });

// ✅ Después: Con Compoships
$customer = Customer::find($customerId);
$orders = $customer->orders()->where('tenant_id', $tenantId)->get();
```

## Conclusión

**Compoships** transforma la forma en que trabajas con relaciones complejas en Laravel. Al permitir relaciones basadas en múltiples columnas, simplifica considerablemente el código en sistemas multitenancy, históricos versionados y otras arquitecturas complejas.

La clave es entender que Compoships no reemplaza Eloquent, sino que lo extiende de forma elegante y coherente. Mantiene la sintaxis familiar, la encadenabilidad y todas las operaciones CRUD que conoces, simplemente permitiendo que funcionen con claves compuestas.

Para aplicaciones que requieren separación de datos por tenant o cualquier forma de relaciones multicolumna, Compoships es una inversión en claridad de código y mantenibilidad a largo plazo.

## Puntos clave

- **Compoships extiende Eloquent** para soportar relaciones basadas en múltiples columnas
- **El trait `Compoships`** debe añadirse a cualquier modelo que use relaciones compuestas
- **Sintaxis familiar**: `belongsTo()`, `hasMany()`, etc., pero con arrays de columnas
- **Crear índices compuestos** en tu base de datos para optimizar el rendimiento
- **Siempre usa eager loading** con `with()` para evitar queries N+1
- **Funciona con todas las operaciones CRUD**: create, update, delete, refresh
- **Ideal para multitenancy** donde `tenant_id` + `id` define la relación
- **Mantiene seguridad**: Verifica permisos de tenant en tus queries
- **Compatible con Query Builder** para consultas más avanzadas cuando sea necesario
- **Considera índices inversos** `[tenant_id, customer_id]` además de `[customer_id, tenant_id]`