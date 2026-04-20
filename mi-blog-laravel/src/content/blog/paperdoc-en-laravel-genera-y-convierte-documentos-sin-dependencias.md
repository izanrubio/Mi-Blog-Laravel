---
title: 'Paperdoc en Laravel: Genera y Convierte Documentos sin Dependencias'
description: 'Aprende a usar Paperdoc para generar, parsear y convertir PDF, Excel, Word y más en Laravel sin librerías externas.'
pubDate: '2026-04-20'
tags: ['laravel', 'php', 'documentos', 'paperdoc']
---

## Introducción

Uno de los desafíos más comunes en desarrollo web es la manipulación de documentos. Desde generar reportes en PDF hasta importar datos desde Excel, siempre necesitamos herramientas confiables que no añadan peso innecesario a nuestros proyectos.

**Paperdoc** es una librería PHP moderna y sin dependencias externas que resuelve este problema de forma elegante. Te permite generar, parsear y convertir documentos en múltiples formatos: PDF, HTML, CSV, DOCX, XLSX, PPTX, Markdown y más.

En este artículo te mostraré cómo integrar Paperdoc en tus aplicaciones Laravel y automatizar la generación y conversión de documentos de forma profesional.

## ¿Qué es Paperdoc y por qué usarlo?

Paperdoc es una librería PHP de código abierto que simplifica la manipulación de documentos. Su principal ventaja es que **no depende de librerías externas** como LibreOffice, Ghostscript o ImageMagick, lo que facilita enormemente el despliegue en servidores compartidos y contenedores Docker.

### Ventajas principales

- **Zero dependencias**: No requiere instalaciones adicionales en el servidor
- **Múltiples formatos**: Soporta PDF, DOCX, XLSX, PPTX, HTML, CSV, Markdown y más
- **Conversión bidireccional**: Lee y escribe en los mismos formatos
- **Fácil integración**: Funciona perfectamente con Laravel
- **Ligero y rápido**: Ideal para aplicaciones de alto rendimiento

### Cuándo usar Paperdoc

- Generar reportes y facturas automáticamente
- Exportar datos a Excel de forma programática
- Convertir documentos entre formatos
- Procesar documentos en colas (Jobs) sin bloquear
- Crear plantillas dinámicas de documentos

## Instalación y Configuración

### Paso 1: Instalar Paperdoc via Composer

```bash
composer require paperdoc/paperdoc
```

### Paso 2: Crear un Service Provider (opcional pero recomendado)

Aunque Paperdoc funciona sin configuración especial, es buena práctica crear un Service Provider en Laravel para encapsular la lógica.

```bash
php artisan make:provider PaperdocServiceProvider
```

```php
<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Paperdoc\Paperdoc;

class PaperdocServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton('paperdoc', function () {
            return new Paperdoc();
        });
    }

    public function boot(): void
    {
        // Aquí puedes añadir configuración adicional si lo necesitas
    }
}
```

Registra el provider en `config/app.php`:

```php
'providers' => [
    // ... otros providers
    App\Providers\PaperdocServiceProvider::class,
],
```

### Paso 3: Crear una clase helper

Es recomendable crear una clase para centralizar la lógica de documentos:

```php
<?php

namespace App\Services;

use Paperdoc\Paperdoc;
use Paperdoc\Document;

class DocumentService
{
    private Paperdoc $paperdoc;

    public function __construct()
    {
        $this->paperdoc = new Paperdoc();
    }

    public function createDocument(string $format = 'pdf'): Document
    {
        return $this->paperdoc->document($format);
    }
}
```

## Casos de Uso Prácticos

### Caso 1: Generar Facturas en PDF

Una de las aplicaciones más comunes es la generación automática de facturas. Aquí te muestro cómo hacerlo:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Services\DocumentService;
use Paperdoc\Paperdoc;

class InvoiceController extends Controller
{
    public function downloadInvoice(Invoice $invoice, DocumentService $documentService)
    {
        $paperdoc = new Paperdoc();
        
        // Crear documento PDF
        $pdf = $paperdoc->document('pdf');
        
        // Añadir contenido HTML
        $pdf->html(view('invoices.template', [
            'invoice' => $invoice,
            'company' => config('app.company'),
        ])->render());
        
        // Generar y descargar
        return response($pdf->render(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="factura-'.$invoice->id.'.pdf"',
        ]);
    }
}
```

**Vista de plantilla** (`resources/views/invoices/template.blade.php`):

```blade
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .invoice-header { text-align: center; margin-bottom: 30px; }
        .invoice-number { font-size: 24px; font-weight: bold; }
        .items-table { width: 100%; border-collapse: collapse; }
        .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; }
        .total { font-weight: bold; font-size: 18px; }
    </style>
</head>
<body>
    <div class="invoice-header">
        <div class="invoice-number">Factura #{{ $invoice->id }}</div>
        <div>{{ $company['name'] }}</div>
    </div>
    
    <div>
        <h3>Detalles del Cliente</h3>
        <p>{{ $invoice->customer->name }}</p>
        <p>{{ $invoice->customer->email }}</p>
    </div>
    
    <table class="items-table">
        <thead>
            <tr>
                <th>Concepto</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($invoice->items as $item)
            <tr>
                <td>{{ $item->description }}</td>
                <td>{{ $item->quantity }}</td>
                <td>${{ number_format($item->price, 2) }}</td>
                <td>${{ number_format($item->quantity * $item->price, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>
    
    <div class="total" style="margin-top: 20px;">
        Total: ${{ number_format($invoice->total, 2) }}
    </div>
</body>
</html>
```

### Caso 2: Exportar Datos a Excel

Paperdoc también permite generar archivos Excel directamente:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Paperdoc\Paperdoc;

class ProductController extends Controller
{
    public function exportExcel()
    {
        $paperdoc = new Paperdoc();
        $excel = $paperdoc->document('xlsx');
        
        // Obtener datos
        $products = Product::all();
        
        // Crear estructura de datos
        $data = [
            ['ID', 'Nombre', 'Precio', 'Stock', 'Categoría'],
        ];
        
        foreach ($products as $product) {
            $data[] = [
                $product->id,
                $product->name,
                $product->price,
                $product->stock,
                $product->category->name ?? 'Sin categoría',
            ];
        }
        
        // Añadir datos al documento
        $excel->data($data);
        
        // Descargar
        return response($excel->render(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="productos-'.date('Y-m-d').'.xlsx"',
        ]);
    }
}
```

### Caso 3: Convertir entre Formatos

Paperdoc permite convertir documentos entre diferentes formatos:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Paperdoc\Paperdoc;
use Illuminate\Support\Facades\Storage;

class ConvertDocumentFormat implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private string $sourcePath,
        private string $targetFormat = 'pdf',
    ) {}

    public function handle(): void
    {
        $paperdoc = new Paperdoc();
        
        // Leer documento original
        $sourceContent = Storage::get($this->sourcePath);
        $sourceFormat = pathinfo($this->sourcePath, PATHINFO_EXTENSION);
        
        // Cargar el documento
        $document = $paperdoc->document($sourceFormat);
        $document->read($sourceContent);
        
        // Convertir al formato destino
        $targetDocument = $paperdoc->document($this->targetFormat);
        $targetDocument->html($document->html());
        
        // Guardar el resultado
        $targetPath = str_replace(
            '.'.$sourceFormat,
            '.'.$this->targetFormat,
            $this->sourcePath
        );
        
        Storage::put($targetPath, $targetDocument->render());
    }
}
```

### Caso 4: Generar Reportes Complejos

Para reportes más complejos, podemos combinar Paperdoc con vistas Blade:

```php
<?php

namespace App\Services;

use App\Models\Order;
use Paperdoc\Paperdoc;
use Illuminate\Support\Facades\View;

class ReportService
{
    public function generateSalesReport($startDate, $endDate)
    {
        $paperdoc = new Paperdoc();
        
        // Obtener datos
        $orders = Order::whereBetween('created_at', [$startDate, $endDate])->get();
        
        $stats = [
            'total_orders' => $orders->count(),
            'total_revenue' => $orders->sum('total'),
            'average_order' => $orders->avg('total'),
            'top_products' => $this->getTopProducts($orders),
        ];
        
        // Renderizar vista
        $html = View::make('reports.sales', [
            'startDate' => $startDate,
            'endDate' => $endDate,
            'stats' => $stats,
            'orders' => $orders,
        ])->render();
        
        // Crear PDF
        $pdf = $paperdoc->document('pdf');
        $pdf->html($html);
        
        return $pdf;
    }

    private function getTopProducts($orders)
    {
        return $orders->flatMap->items
            ->groupBy('product_id')
            ->map(fn($items) => [
                'quantity' => $items->sum('quantity'),
                'revenue' => $items->sum(fn($item) => $item->quantity * $item->price),
            ])
            ->sortByDesc('revenue')
            ->take(10);
    }
}
```

## Integración con Colas (Jobs)

Para no bloquear la aplicación con operaciones pesadas, es recomendable generar documentos en background:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use App\Models\Invoice;
use Paperdoc\Paperdoc;
use Illuminate\Support\Facades\Storage;

class GenerateInvoicePdf implements ShouldQueue
{
    use Queueable;

    public function __construct(private Invoice $invoice) {}

    public function handle(): void
    {
        $paperdoc = new Paperdoc();
        $pdf = $paperdoc->document('pdf');
        
        $html = view('invoices.template', [
            'invoice' => $this->invoice,
        ])->render();
        
        $pdf->html($html);
        
        // Guardar en storage
        $filename = "invoices/invoice-{$this->invoice->id}.pdf";
        Storage::put($filename, $pdf->render());
        
        // Actualizar modelo
        $this->invoice->update(['pdf_path' => $filename]);
    }
}
```

Disparar el job desde el controlador:

```php
public function createInvoice(CreateInvoiceRequest $request)
{
    $invoice = Invoice::create($request->validated());
    
    // Generar PDF en background
    GenerateInvoicePdf::dispatch($invoice)->onQueue('documents');
    
    return redirect()->route('invoices.show', $invoice)
        ->with('success', 'Factura creada. El PDF se generará en breve.');
}
```

## Manejo de Errores y Validación

Es importante validar y manejar errores correctamente:

```php
<?php

namespace App\Services;

use Paperdoc\Paperdoc;
use Exception;
use Illuminate\Support\Facades\Log;

class SafeDocumentService
{
    public function generateDocument($format, $content)
    {
        try {
            // Validar formato soportado
            $supportedFormats = ['pdf', 'xlsx', 'docx', 'html', 'csv'];
            
            if (!in_array($format, $supportedFormats)) {
                throw new Exception("Formato '$format' no soportado");
            }
            
            $paperdoc = new Paperdoc();
            $document = $paperdoc->document($format);
            
            // Validar contenido
            if (empty($content)) {
                throw new Exception('El contenido del documento no puede estar vacío');
            }
            
            $document->html($content);
            
            return $document->render();
            
        } catch (Exception $e) {
            Log::error('Error generando documento', [
                'format' => $format,
                'error' => $e->getMessage(),
            ]);
            
            throw $e;
        }
    }
}
```

## Optimizaciones y Buenas Prácticas

### 1. Cachear Documentos Estáticos

```php
public function generateReport($year, $month)
{
    $cacheKey = "report:{$year}:{$month}";
    
    return Cache::remember($cacheKey, now()->addDays(30), function () use ($year, $month) {
        $paperdoc = new Paperdoc();
        // ... generar documento
        return $pdf->render();
    });
}
```

### 2. Limitar Tamaño de Documentos

```php
public function validateDocumentSize($content, $maxSize = 10 * 1024 * 1024)
{
    if (strlen($content) > $maxSize) {
        throw new Exception('El contenido excede el tamaño máximo permitido');
    }
}
```

### 3. Usar Streams para Documentos Grandes

```php
public function streamLargeDocument($query)
{
    $paperdoc = new Paperdoc();
    $csv = $paperdoc->document('csv');
    
    // Procesar en chunks
    $query->chunk(1000, function ($records) use ($csv) {
        foreach ($records as $record) {
            $csv->add