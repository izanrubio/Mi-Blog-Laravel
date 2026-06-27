---
title: 'Server-Driven UI con Lattice en Laravel'
description: 'Aprende a construir interfaces dinámicas en Laravel con Lattice, renderizando React desde PHP sin escribir JavaScript.'
pubDate: '2026-06-19'
tags: ['laravel', 'inertia', 'react', 'frontend']
---

# Server-Driven UI con Lattice en Laravel: Interfaces Dinámicas sin JavaScript

En los últimos años, la forma en que construimos interfaces de usuario en Laravel ha evolucionado significativamente. Desde los tiempos de Blade puro, pasando por Vue.js, hasta llegar a Inertia.js, siempre hemos buscado la forma más eficiente de crear UIs modernas. Ahora surge **Lattice**, un framework que promete cambiar el juego permitiéndote describir interfaces completamente en PHP y renderizarlas como componentes React tipados.

## ¿Qué es Lattice y por qué deberías usarlo?

Lattice es un framework de **server-driven UI** diseñado específicamente para Laravel. Su propuesta de valor es simple pero poderosa: define tus páginas, formularios y tablas completamente en PHP, y Lattice se encarga de renderizarlas automáticamente como componentes React tipados a través de Inertia.js.

Esto significa que puedes:
- Eliminar la necesidad de escribir componentes React manuales
- Mantener toda la lógica de negocio en el servidor
- Obtener tipado fuerte automáticamente en el frontend
- Reducir significativamente el código JavaScript que mantienes

## Ventajas principales de Lattice

### Desarrollo más rápido
Al definir la interfaz en PHP, reduces la complejidad de tener que mantener código en múltiples lenguajes. Una sola fuente de verdad.

### Type-Safe por defecto
Lattice genera tipos TypeScript automáticamente basándose en tu definición PHP. No más desconexiones entre lo que espera el backend y lo que usa el frontend.

### Menor código boilerplate
Olvídate de crear componentes React para formularios básicos. Lattice lo hace por ti.

### Flexibilidad
A pesar de ser opinionado, Lattice permite personalización profunda cuando la necesitas.

## Instalación y configuración

### Paso 1: Instalar Lattice

Comienza instalando el paquete a través de Composer:

```bash
composer require lattice/framework
```

### Paso 2: Publicar los assets

```bash
php artisan vendor:publish --provider="Lattice\ServiceProvider"
```

Esto publicará los assets necesarios y creará los directorios de configuración.

### Paso 3: Configurar Inertia (si aún no lo has hecho)

Lattice funciona sobre Inertia.js, así que asegúrate de tener Inertia instalado:

```bash
npm install @inertiajs/react
npm install -D @inertiajs/plugin-react
```

## Tu primera página con Lattice

Vamos a crear una página simple de listado de productos. Supongamos que tienes un modelo `Product`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $fillable = ['name', 'price', 'description', 'stock'];
}
```

Ahora crea un controlador que use Lattice:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Lattice\Page;
use Lattice\Table;
use Lattice\Columns\TextColumn;
use Lattice\Columns\MoneyColumn;
use Lattice\Columns\IntegerColumn;

class ProductController extends Controller
{
    public function index()
    {
        $products = Product::all();

        return Page::make('Products')
            ->add(
                Table::make($products)
                    ->column('name', TextColumn::make('Producto'))
                    ->column('price', MoneyColumn::make('Precio'))
                    ->column('stock', IntegerColumn::make('Stock'))
            )
            ->render();
    }
}
```

En tu archivo `routes/web.php`:

```php
use App\Http\Controllers\ProductController;

Route::get('/products', [ProductController::class, 'index']);
```

Y eso es todo. Lattice automáticamente renderizará una tabla completamente funcional con los datos.

## Trabajando con Formularios

Los formularios son donde Lattice realmente brilla. Veamos cómo crear un formulario para editar un producto:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Lattice\Form;
use Lattice\Fields\TextField;
use Lattice\Fields\MoneyField;
use Lattice\Fields\TextareaField;
use Lattice\Fields\IntegerField;

class ProductFormController extends Controller
{
    public function edit(Product $product)
    {
        return Form::make('Editar Producto')
            ->model($product)
            ->field('name', TextField::make('Nombre del Producto')
                ->required()
                ->maxLength(255)
            )
            ->field('description', TextareaField::make('Descripción')
                ->nullable()
            )
            ->field('price', MoneyField::make('Precio')
                ->required()
                ->min(0.01)
            )
            ->field('stock', IntegerField::make('Stock')
                ->required()
                ->min(0)
            )
            ->submit('Guardar')
            ->cancel('/products')
            ->render();
    }

    public function update(Product $product)
    {
        $product->update(request()->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0.01',
            'stock' => 'required|integer|min:0',
        ]));

        return redirect('/products')->with('success', 'Producto actualizado');
    }
}
```

Lattice valida automáticamente en el frontend según las reglas que definas en PHP. Si un campo es `required()`, el formulario no permitirá envío vacío.

## Componentes personalizados

A veces necesitas más control. Lattice permite crear componentes personalizados:

```php
<?php

namespace App\Lattice\Components;

use Lattice\Component;

class RatingField extends Component
{
    protected string $name = 'RatingField';

    public function __construct(
        public string $label,
        public int $max = 5,
    ) {}

    public function toArray()
    {
        return [
            'type' => $this->name,
            'label' => $this->label,
            'max' => $this->max,
        ];
    }
}
```

Luego puedes usarlo en tus formularios:

```php
Form::make('Producto')
    ->field('rating', new RatingField('Calificación', 5))
    ->render();
```

Y en el lado React, defines el componente correspondiente que Lattice inyectará automáticamente.

## Acciones personalizadas en tablas

Las tablas en Lattice pueden tener acciones (botones) completamente tipadas:

```php
Table::make($products)
    ->column('name', TextColumn::make('Producto'))
    ->column('price', MoneyColumn::make('Precio'))
    ->action('edit', 'Editar', function(Product $product) {
        return redirect()->route('products.edit', $product);
    })
    ->action('delete', 'Eliminar', function(Product $product) {
        $product->delete();
        return back();
    }, ['confirm' => '¿Estás seguro?'])
```

## Validación y manejo de errores

Lattice integra la validación de Laravel de forma elegante. Los errores se devuelven automáticamente al frontend de forma estructurada:

```php
Form::make('Crear Producto')
    ->field('name', TextField::make('Nombre')
        ->required()
        ->min(3)
        ->max(255)
        ->rules('unique:products,name')
    )
    ->render();
```

Si la validación falla, los errores aparecen automáticamente en los campos correspondientes del formulario.

## Rendimiento y consideraciones

Aunque Lattice simplifica mucho el desarrollo, es importante considerar:

### Carga de datos
Asegúrate de usar `->paginate()` en tablas grandes:

```php
Table::make(Product::paginate(15))
    ->column('name', TextColumn::make('Producto'))
```

### Relaciones
Lattice carga automáticamente relaciones si las defines en los campos:

```php
TextColumn::make('Categoría')
    ->getAttribute('category.name')
```

### Cacheo
Para datos que no cambian frecuentemente, considera cachear:

```php
$products = Cache::rememberForever('products_list', function() {
    return Product::all();
});

Table::make($products)->column('name', TextColumn::make('Producto'))
```

## Patrones avanzados

### Formularios condicionales

```php
Form::make('Producto')
    ->field('type', SelectField::make('Tipo')
        ->options(['digital', 'physical'])
    )
    ->field('weight', IntegerField::make('Peso (kg)')
        ->when('type', 'equals', 'physical')
    )
    ->render();
```

### Tablas con filtros

```php
Table::make($products)
    ->column('name', TextColumn::make('Producto'))
    ->filter('price_from', MoneyField::make('Precio mínimo'))
    ->filter('category_id', SelectField::make('Categoría')
        ->options(Category::pluck('name', 'id'))
    )
    ->applyFilters(function($query) {
        if(request('price_from')) {
            $query->where('price', '>=', request('price_from'));
        }
        if(request('category_id')) {
            $query->where('category_id', request('category_id'));
        }
        return $query;
    })
    ->render();
```

## Integración con autenticación y autorización

Lattice respeta las Policies de Laravel:

```php
Table::make($products)
    ->column('name', TextColumn::make('Producto'))
    ->action('edit', 'Editar', function(Product $product) {
        return redirect()->route('products.edit', $product);
    }, function(Product $product) {
        return auth()->user()->can('update', $product);
    })
    ->render();
```

## Debugging y desarrollo

Para ver qué datos se están enviando entre servidor y cliente, habilita Laravel Telescope o revisa las Network Tools del navegador. Los datos de Lattice se envían como props normales de Inertia.

Para componentes personalizados, puedes usar `dump()` en PHP o `console.log()` en JavaScript React.

## Puntos clave

- **Lattice es un framework server-driven UI** que permite definir interfaces completamente en PHP
- **Funciona sobre Inertia.js** y renderiza componentes React tipados automáticamente
- **Reduce significativamente el boilerplate** eliminando la necesidad de crear componentes React manualmente
- **Proporciona tipado fuerte por defecto** generando tipos TypeScript desde PHP
- **Incluye validación integrada** que funciona tanto en servidor como en cliente
- **Soporta componentes personalizados** para casos de uso específicos
- **Es compatible con Policies y Gates** de Laravel para autorización
- **Ideal para aplicaciones CRUD** y dashboards administrativos
- **Requiere Inertia.js y React** en tu stack de frontend
- **Considera el rendimiento** usando paginación en tablas grandes y cacheo cuando sea apropiado