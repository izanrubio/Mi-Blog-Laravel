---
title: 'Exportar datos a Excel en Laravel: Guía completa con Maatwebsite'
description: 'Aprende a exportar datos a Excel en Laravel usando Maatwebsite/Excel. Incluye ejemplos reales, formateo avanzado y exportaciones masivas.'
pubDate: '2026-04-17'
tags: ['laravel', 'excel', 'exportación', 'maatwebsite', 'php']
---

## Introducción

Trabajar con Excel en aplicaciones web es una necesidad común en muchos proyectos Laravel. Desde reportes financieros hasta listados de usuarios, la capacidad de exportar datos en formato Excel es fundamental para cualquier aplicación empresarial.

El paquete **Maatwebsite/Excel** se ha convertido en el estándar de la comunidad Laravel para manejar importación y exportación de archivos Excel. Con más de 146 millones de descargas en Packagist, es la solución más confiable y ampliamente utilizada.

En este artículo aprenderás desde la instalación básica hasta técnicas avanzadas de exportación, incluyendo formateo personalizado, exportaciones dinámicas y optimizaciones de rendimiento para grandes volúmenes de datos.

## Instalación y configuración de Maatwebsite/Excel

### Instalación del paquete

El primer paso es instalar Maatwebsite/Excel a través de Composer:

```bash
composer require maatwebsite/excel
```

Laravel detectará automáticamente el service provider del paquete gracias a la auto-discovery de paquetes. Si necesitas registrarlo manualmente, añade esto a `config/app.php`:

```php
'providers' => [
    Maatwebsite\Excel\ExcelServiceProvider::class,
],
```

### Publicar configuración

Para personalizar opciones de Excel, publica el archivo de configuración:

```bash
php artisan vendor:publish --provider="Maatwebsite\Excel\ExcelServiceProvider"
```

Esto creará `config/excel.php` donde podrás configurar:

```php
return [
    'exports' => [
        'chunk_size' => 1000,
        'pre_calculate_formulas' => true,
        'csv' => [
            'use_bom' => false,
        ],
    ],
    'imports' => [
        'read_only' => true,
        'heading_row' => true,
    ],
];
```

## Exportaciones básicas con Eloquent

### Crear tu primera exportación

Crea una clase de exportación usando el comando Artisan:

```bash
php artisan make:export UsersExport
```

Esto genera el archivo `app/Exports/UsersExport.php`. Implementa la interfaz `FromQuery` para exportar modelos Eloquent:

```php
<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;

class UsersExport implements FromQuery, WithHeadings
{
    public function query()
    {
        return User::query();
    }

    public function headings(): array
    {
        return ['ID', 'Nombre', 'Email', 'Creado'];
    }
}
```

### Descargar la exportación desde un controlador

En tu controlador, utiliza la clase `Export` de Maatwebsite:

```php
<?php

namespace App\Http\Controllers;

use App\Exports\UsersExport;
use Maatwebsite\Excel\Facades\Excel;

class UserController extends Controller
{
    public function export()
    {
        return Excel::download(new UsersExport(), 'usuarios.xlsx');
    }
}
```

Añade la ruta en `routes/web.php`:

```php
Route::get('/users/export', [UserController::class, 'export'])->name('users.export');
```

## Exportaciones avanzadas con formateo

### Personalizar estilos y formatos

Para aplicar estilos, implementa la interfaz `WithStyles`:

```php
<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Font;

class UsersExport implements FromQuery, WithHeadings, WithStyles
{
    public function query()
    {
        return User::query();
    }

    public function headings(): array
    {
        return ['ID', 'Nombre', 'Email', 'Fecha de Creación'];
    }

    public function styles(Worksheet $sheet)
    {
        return [
            1 => [
                'font' => [
                    'bold' => true,
                    'color' => ['rgb' => 'FFFFFF'],
                    'size' => 12,
                ],
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => '4472C4'],
                ],
                'alignment' => [
                    'horizontal' => 'center',
                    'vertical' => 'center',
                ],
            ],
        ];
    }
}
```

### Mapear propiedades de modelos

A menudo necesitas transformar datos antes de exportarlos. Implementa `WithMapping`:

```php
<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class UsersExport implements FromQuery, WithHeadings, WithMapping
{
    public function query()
    {
        return User::query();
    }

    public function headings(): array
    {
        return ['ID', 'Nombre Completo', 'Email', 'Estado', 'Creado'];
    }

    public function map($user): array
    {
        return [
            $user->id,
            strtoupper($user->name),
            $user->email,
            $user->is_active ? 'Activo' : 'Inactivo',
            $user->created_at->format('d/m/Y'),
        ];
    }
}
```

## Exportaciones dinámicas y filtradas

### Exportar datos con filtros

Frecuentemente necesitas exportar datos filtrados. Pasa parámetros al constructor:

```php
<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class UsersExport implements FromQuery, WithHeadings, WithMapping
{
    protected $status;
    protected $dateFrom;

    public function __construct($status = null, $dateFrom = null)
    {
        $this->status = $status;
        $this->dateFrom = $dateFrom;
    }

    public function query()
    {
        $query = User::query();

        if ($this->status) {
            $query->where('status', $this->status);
        }

        if ($this->dateFrom) {
            $query->where('created_at', '>=', $this->dateFrom);
        }

        return $query;
    }

    public function headings(): array
    {
        return ['ID', 'Nombre', 'Email', 'Estado', 'Creado'];
    }

    public function map($user): array
    {
        return [
            $user->id,
            $user->name,
            $user->email,
            $user->status,
            $user->created_at->format('d/m/Y H:i'),
        ];
    }
}
```

En el controlador:

```php
public function export(Request $request)
{
    $export = new UsersExport(
        $request->input('status'),
        $request->input('date_from')
    );

    return Excel::download($export, 'usuarios.xlsx');
}
```

## Exportaciones masivas y optimización

### Chunking para grandes volúmenes

Maatwebsite/Excel procesa datos en chunks por defecto (1000 registros). Para optimizar la memoria en exportaciones grandes, modifica `config/excel.php`:

```php
'exports' => [
    'chunk_size' => 5000, // Aumenta según tu servidor
],
```

### Exportar múltiples hojas

Crea exportaciones con varias hojas usando `WithMultipleSheets`:

```php
<?php

namespace App\Exports;

use App\Models\User;
use App\Models\Order;
use Maatwebsite\Excel\Concerns\Exportable;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

class ComprehensiveExport implements WithMultipleSheets
{
    use Exportable;

    public function sheets(): array
    {
        return [
            'Usuarios' => new UsersSheet(),
            'Pedidos' => new OrdersSheet(),
        ];
    }
}
```

Define cada hoja como una clase separada:

```php
<?php

namespace App\Exports\Sheets;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;

class UsersSheet implements FromQuery, WithHeadings
{
    public function query()
    {
        return User::query();
    }

    public function headings(): array
    {
        return ['ID', 'Nombre', 'Email'];
    }
}
```

### Limitar columnas y filas

Para exportaciones muy grandes, selecciona solo las columnas necesarias:

```php
public function query()
{
    return User::query()
        ->select('id', 'name', 'email', 'status')
        ->where('deleted_at', null)
        ->with('profile:id,user_id,phone');
}
```

## Casos de uso avanzados

### Exportar con fórmulas y cálculos

Maatwebsite integra PhpSpreadsheet, permitiendo agregar fórmulas:

```php
<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class SalesExport implements FromArray, WithHeadings
{
    public function array(): array
    {
        return [
            ['Producto', 'Cantidad', 'Precio', 'Total'],
            ['Laptop', 5, 1000, '=B2*C2'],
            ['Mouse', 20, 25, '=B3*C3'],
            ['Teclado', 10, 75, '=B4*C4'],
        ];
    }

    public function headings(): array
    {
        return ['Producto', 'Cantidad', 'Precio', 'Total'];
    }
}
```

### Exportar con imágenes

Para incluir imágenes en la exportación, necesitas procesar manualmente:

```php
<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithDrawings;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

class ProductsExport implements FromCollection, WithDrawings
{
    public function collection()
    {
        // Retorna datos de productos
    }

    public function drawings()
    {
        $drawing = new Drawing();
        $drawing->setName('Logo');
        $drawing->setDescription('Mi Logo');
        $drawing->setPath(public_path('images/logo.png'));
        $drawing->setHeight(100);
        $drawing->setCoordinates('A1');

        return [$drawing];
    }
}
```

### Monitorear progreso de exportación

Para exportaciones muy largas, proporciona feedback al usuario:

```php
<?php

namespace App\Exports;

use App\Models\User;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\BeforeExport;
use Maatwebsite\Excel\Events\AfterSheet;

class UsersExport implements FromQuery, WithHeadings, WithEvents
{
    private $progress = 0;

    public function query()
    {
        return User::query();
    }

    public function headings(): array
    {
        return ['ID', 'Nombre', 'Email'];
    }

    public function registerEvents(): array
    {
        return [
            BeforeExport::class => function(BeforeExport $event) {
                // Lógica antes de iniciar
            },
            AfterSheet::class => function(AfterSheet $event) {
                // Lógica después de completar
            },
        ];
    }
}
```

## Buenas prácticas de rendimiento

### 1. Selecciona solo columnas necesarias

```php
public function query()
{
    return User::query()
        ->select('id', 'name', 'email') // No selecciones todo
        ->with('profile:id,user_id,phone');
}
```

### 2. Usa paginación para datos enormes

```php
public function query()
{
    return User::query()
        ->where('status', 'active')
        ->limit(50000); // Limita registros
}
```

### 3. Cachea exportaciones

```php
public function export()
{
    $cacheKey = 'export_users_' . auth()->id();

    if (Cache::has($cacheKey)) {
        return Cache::get($cacheKey);
    }

    $export = Excel::download(new UsersExport(), 'usuarios.xlsx');
    Cache::put($cacheKey, $export, now()->addHour());

    return $export;
}
```

### 4. Ejecuta exportaciones en colas

Para exportaciones masivas, procesa en background:

```php
<?php

namespace App\Jobs;

use App\Exports\UsersExport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Bus\Queueable;
use Illuminate\Queue\SerializesModels;

class ExportUsersJob implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function handle()
    {
        Excel::store(new UsersExport(), 'exports/usuarios.xlsx');
        // Notifica al usuario que la exportación está lista
    }
}
```

## Conclusión

Maatwebsite/Excel es una herramienta poderosa que simplifica dramáticamente el manejo de archivos Excel en Laravel. Desde exportaciones básicas hasta casos de uso complejos con múltiples hojas, formateo avanzado y optimizaciones de rendimiento, el paquete proporciona todas las herramientas necesarias.

La clave para implementaciones exitosas es entender tus necesidades específicas: si exportas pocos registros, una exportación simple es suficiente; pero para datos masivos, implementa chunking, colas y cacheo. Siempre considera el rendimiento y la experiencia del usuario.

Con los ejemplos y técnicas proporcionadas en este artículo, estarás preparado para implementar exportaciones robustas en tus aplicaciones Laravel.

## Puntos clave

- **Instalación simple**: `composer require maatwebsite/excel` con auto-discovery automático
- **FromQuery es ideal**: Exporta directamente desde consultas Eloquent sin cargar todo en memoria
- **WithMapping permite transformaciones**: Personaliza datos antes de exportar (mayúsculas,