---
title: 'Adjuntar PDFs a Mailables en Laravel: Guía con laravel-pdf'
description: 'Aprende a generar y adjuntar PDFs directamente en tus emails con Laravel 13 y laravel-pdf 2.6.0. Ejemplos prácticos paso a paso.'
pubDate: '2026-04-16'
tags: ['laravel', 'pdf', 'email', 'mailable']
---

## Adjuntar PDFs a Mailables en Laravel: Guía con laravel-pdf

Uno de los requisitos más comunes en aplicaciones web es generar y enviar documentos PDF por correo electrónico. Desde facturas hasta reportes, presupuestos o certificados, la capacidad de adjuntar PDFs a tus emails es fundamental.

En Laravel 13, con la nueva versión de `laravel-pdf 2.6.0`, este proceso se ha simplificado significativamente. En esta guía completa aprenderás cómo integrar esta funcionalidad en tus aplicaciones de forma práctica y segura.

## ¿Qué es laravel-pdf y por qué usarlo?

**laravel-pdf** es un paquete oficial mantenido por la comunidad Laravel que facilita la generación de PDFs usando la librería Barryvdh. La versión 2.6.0 introduce mejoras importantes para adjuntar PDFs directamente a Mailables sin escribir archivos temporales en el servidor.

### Ventajas de esta aproximación

- **Seguridad**: No necesitas almacenar PDFs temporales en disco
- **Rendimiento**: Genera y envía el PDF en memoria
- **Simplicidad**: API intuitiva y bien documentada
- **Flexibilidad**: Soporta múltiples PDFs en un mismo email

## Instalación y configuración

### Paso 1: Instalar el paquete

```bash
composer require barryvdh/laravel-pdf
```

Si aún no tienes laravel-pdf instalado en tu proyecto Laravel 13:

```bash
composer require barryvdh/laravel-pdf:^2.6
```

### Paso 2: Publicar la configuración

```bash
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

Esto creará un archivo `config/pdf.php` donde puedes personalizar opciones como el formato de página, márgenes y fuentes.

### Paso 3: Configurar las variables de entorno (opcional)

En tu archivo `.env`, asegúrate de tener configurado tu driver de mail:

```env
MAIL_DRIVER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=tu_usuario
MAIL_PASSWORD=tu_contraseña
MAIL_FROM_ADDRESS=noreply@tuapp.com
```

## Crear un Mailable con PDF adjunto

### Generar el Mailable

Primero, crea un Mailable nuevo con Laravel Artisan:

```bash
php artisan make:mail InvoiceMail
```

Esto generará un archivo en `app/Mail/InvoiceMail.php`. Ahora lo configuraremos para adjuntar un PDF:

```php
<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoiceMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public int $invoiceId,
        public string $customerEmail
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Tu factura #{$this->invoiceId}",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.invoice',
            with: [
                'invoiceId' => $this->invoiceId,
            ],
        );
    }

    public function attachments(): array
    {
        $pdf = Pdf::loadView('pdfs.invoice', [
            'invoiceId' => $this->invoiceId,
        ]);

        return [
            Attachment::fromData(
                fn () => $pdf->output(),
                "factura-{$this->invoiceId}.pdf"
            )->withMime('application/pdf'),
        ];
    }
}
```

### Entender el proceso

**El método clave es `attachments()`**. Aquí ocurre la magia:

1. `Pdf::loadView()` genera el PDF desde una vista Blade
2. `Attachment::fromData()` crea el adjunto sin escribir en disco
3. La función anónima `fn () => $pdf->output()` genera el contenido bajo demanda
4. `.withMime()` especifica el tipo MIME correcto

## Crear las vistas necesarias

### Vista del email (HTML)

Crea `resources/views/emails/invoice.blade.php`:

```blade
<x-mail::message>
# Factura Generada

Tu factura **#{{ $invoiceId }}** ha sido generada correctamente.

Adjunto encontrarás el documento PDF con todos los detalles.

<x-mail::button :url="route('invoices.show', $invoiceId)">
Ver Factura Online
</x-mail::button>

Gracias por tu confianza,<br>
{{ config('app.name') }}
</x-mail::message>
```

### Vista del PDF

Crea `resources/views/pdfs/invoice.blade.php`:

```blade
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 40px;
            color: #333;
        }
        .header {
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
        }
        .invoice-number {
            color: #666;
            font-size: 14px;
            margin-top: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 30px 0;
        }
        th {
            background-color: #f8f9fa;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            border-bottom: 2px solid #dee2e6;
        }
        td {
            padding: 12px;
            border-bottom: 1px solid #dee2e6;
        }
        .total {
            font-weight: bold;
            font-size: 18px;
            color: #007bff;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="invoice-title">FACTURA</div>
        <div class="invoice-number">
            Número: #{{ $invoiceId }}<br>
            Fecha: {{ now()->format('d/m/Y') }}
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Concepto</th>
                <th style="text-align: right;">Cantidad</th>
                <th style="text-align: right;">Precio Unit.</th>
                <th style="text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Servicio de desarrollo</td>
                <td style="text-align: right;">1</td>
                <td style="text-align: right;">$1,500.00</td>
                <td style="text-align: right;">$1,500.00</td>
            </tr>
            <tr>
                <td>Soporte técnico (30 días)</td>
                <td style="text-align: right;">1</td>
                <td style="text-align: right;">$300.00</td>
                <td style="text-align: right;">$300.00</td>
            </tr>
        </tbody>
    </table>

    <div style="text-align: right; margin-top: 30px;">
        <div style="font-size: 14px; margin-bottom: 10px;">
            Subtotal: <strong>$1,800.00</strong>
        </div>
        <div style="font-size: 14px; margin-bottom: 10px;">
            IVA (21%): <strong>$378.00</strong>
        </div>
        <div style="font-size: 18px; color: #007bff; font-weight: bold;">
            Total: <strong>$2,178.00</strong>
        </div>
    </div>
</body>
</html>
```

## Enviar el email con PDF adjunto

### Desde un Controller

```php
<?php

namespace App\Http\Controllers;

use App\Mail\InvoiceMail;
use Illuminate\Support\Facades\Mail;

class InvoiceController extends Controller
{
    public function sendInvoice($invoiceId)
    {
        $customerEmail = 'cliente@example.com';

        Mail::to($customerEmail)->send(
            new InvoiceMail($invoiceId, $customerEmail)
        );

        return response()->json([
            'message' => 'Factura enviada correctamente',
            'invoice_id' => $invoiceId,
        ]);
    }
}
```

### Con Queue (Recomendado)

Si el Mailable implementa `ShouldQueue`, Laravel lo procesará en background:

```php
// El email se enviará automáticamente en cola
Mail::to($customerEmail)->queue(
    new InvoiceMail($invoiceId, $customerEmail)
);
```

Asegúrate de que tu worker de colas esté ejecutándose:

```bash
php artisan queue:work
```

## Adjuntar múltiples PDFs

A veces necesitas enviar varios documentos. Aquí te muestro cómo:

```php
public function attachments(): array
{
    $invoice = Pdf::loadView('pdfs.invoice', [
        'invoiceId' => $this->invoiceId,
    ]);

    $receipt = Pdf::loadView('pdfs.receipt', [
        'invoiceId' => $this->invoiceId,
    ]);

    return [
        Attachment::fromData(
            fn () => $invoice->output(),
            "factura-{$this->invoiceId}.pdf"
        )->withMime('application/pdf'),
        
        Attachment::fromData(
            fn () => $receipt->output(),
            "recibo-{$this->invoiceId}.pdf"
        )->withMime('application/pdf'),
    ];
}
```

## Optimizaciones y buenas prácticas

### 1. Cachear PDFs complejos

Si el PDF es complejo, considera cachearlo temporalmente:

```php
public function attachments(): array
{
    $cacheKey = "invoice-pdf-{$this->invoiceId}";
    
    $pdfContent = Cache::remember($cacheKey, 3600, function () {
        $pdf = Pdf::loadView('pdfs.invoice', [
            'invoiceId' => $this->invoiceId,
        ]);
        return $pdf->output();
    });

    return [
        Attachment::fromData(
            fn () => $pdfContent,
            "factura-{$this->invoiceId}.pdf"
        )->withMime('application/pdf'),
    ];
}
```

### 2. Manejo de errores

```php
public function attachments(): array
{
    try {
        $pdf = Pdf::loadView('pdfs.invoice', [
            'invoiceId' => $this->invoiceId,
        ]);

        return [
            Attachment::fromData(
                fn () => $pdf->output(),
                "factura-{$this->invoiceId}.pdf"
            )->withMime('application/pdf'),
        ];
    } catch (\Exception $e) {
        \Log::error('Error generando PDF para email', [
            'invoice_id' => $this->invoiceId,
            'error' => $e->getMessage(),
        ]);
        
        return [];
    }
}
```

### 3. Usar Storage para archivos largos

Si el PDF es muy pesado, almacena primero en Storage:

```php
use Illuminate\Support\Facades\Storage;

public function attachments(): array
{
    $pdf = Pdf::loadView('pdfs.invoice', [
        'invoiceId' => $this->invoiceId,
    ]);

    $path = "invoices/factura-{$this->invoiceId}.pdf";
    Storage::disk('local')->put($path, $pdf->output());

    return [
        Attachment::fromStorageDisk(
            'local',
            $path
        ),
    ];
}
```

## Testing de Mailables con PDFs

Para testear que el email se envía correctamente con el PDF:

```php
<?php

namespace Tests\Feature;

use App\Mail\InvoiceMail;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class InvoiceMailTest extends TestCase
{
    public function test_invoice_mail_can_be_sent()
    {
        Mail::fake();

        Mail::to('test@example.com')->send(new InvoiceMail(123, 'test@example.com'));

        Mail::assertSent(InvoiceMail::class, function ($mail) {
            // Verificar que tiene adjuntos
            return count($mail->attachments) > 0;
        });
    }

    public function test_invoice_pdf_attachment_has_correct_filename()
    {
        Mail::fake();

        Mail::to('test@example.com')->send(new InvoiceMail(123, 'test@example.com'));

        Mail::assertSent(InvoiceMail::class, function ($mail) {
            $attachment = $mail->attachments[0];
            return $attachment->filename === 'factura-123.pdf';
        });
    }
}
```

## Troubleshooting común

### Error: "Class 'Pdf' not found"

Verifica que hayas publicado la configuración:

```bash
php artisan vendor:publish --provider="Barryvdh\DomPDF\ServiceProvider"
```

### El PDF se ve sin estilos

Usa URLs absolutas en tus vistas PDF:

```blade
<img src="{{ asset('images/logo.png') }}" alt="Logo">
```

### Timeout en emails encolados

Aumenta el timeout en `config/queue.php`:

```php
'timeout' => 300,
```

## Conclusión

La nueva funcionalidad de laravel-pdf 2.6.0 para adjuntar PDFs directamente en Mailables es un avance importante. Simplifica el código, mejora la seguridad y optimiza el rendimiento al evitar archivos temporales.

Recuerda siempre:
- Usa **colas** para emails con PDFs pesados
- Implementa **manejo de errores** robusto
- **Testea** tus Mailables antes de producción
- Considera el **rendimiento** en vistas PDF complejas

Con esta guía estás listo para implementar generación y envío de PDFs en tus aplicaciones Laravel 13.

## Puntos clave

- **laravel-pdf 2.6.0** permite adjuntar PDFs en memoria sin archivos temporales
- El método `attachments()` en Mailables retorna un array de adjuntos
- `Attachment::fromData()` ace