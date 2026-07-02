---
title: 'WhatsApp en Laravel: Integra Meta API y WebJS en una Sola Facade'
description: 'Aprende a integrar WhatsApp en Laravel usando Laravel WhatsApp. Conecta Meta Cloud API y whatsapp-web.js con una única facade y UI de Livewire.'
pubDate: '2024-06-30'
tags: ['laravel', 'whatsapp', 'integraciones', 'livewire']
---

## WhatsApp en Laravel: Integra Meta API y WebJS en una Sola Facade

Las aplicaciones modernas necesitan múltiples canales de comunicación. WhatsApp se ha convertido en una plataforma imprescindible para contactar clientes, enviar notificaciones críticas y construir chatbots inteligentes. Sin embargo, conectar WhatsApp a Laravel siempre ha sido complicado: elegir entre Meta Cloud API o whatsapp-web.js, mantener dos implementaciones diferentes, gestionar webhooks y sesiones manualmente.

**Laravel WhatsApp** soluciona esto al abstraer ambos backends detrás de una única facade elegante, con una interfaz Livewire para administrar sesiones, mensajes y webhooks sin tocar una línea de código manual.

En este artículo exploraremos cómo implementar esta solución, cuándo usar cada backend y cómo integrarla en tus flujos de negocio.

## ¿Por qué dos backends en una sola package?

Antes de implementar Laravel WhatsApp, es importante entender por qué necesitamos dos opciones:

### Meta Cloud API
- ✅ Oficial, con soporte técnico de Meta
- ✅ Escalable y confiable para volúmenes altos
- ✅ Webhooks automáticos integrados
- ❌ Requiere aprobación y verificación de negocio
- ❌ Costo por mensaje
- ❌ Restricciones en templates y contenido

### WhatsApp Web.js (sidecar)
- ✅ Acceso sin aprobación previa
- ✅ Sin costos por mensaje
- ✅ Mayor flexibilidad en contenido
- ❌ Menos estable, depende de cambios en WhatsApp Web
- ❌ Requiere sesiones de usuario
- ❌ Mejor para volúmenes bajos

Laravel WhatsApp te deja cambiar entre ellos sin reescribir código.

## Instalación y Configuración Inicial

Comienza instalando el package via Composer:

```bash
composer require laravel-whatsapp/laravel-whatsapp
```

Publica la configuración:

```bash
php artisan vendor:publish --provider="LaravelWhatsApp\LaravelWhatsAppServiceProvider"
```

Esto crea el archivo `config/whatsapp.php`:

```php
return [
    'default' => env('WHATSAPP_DRIVER', 'meta'),
    
    'drivers' => [
        'meta' => [
            'phone_number_id' => env('WHATSAPP_PHONE_NUMBER_ID'),
            'business_account_id' => env('WHATSAPP_BUSINESS_ACCOUNT_ID'),
            'access_token' => env('WHATSAPP_ACCESS_TOKEN'),
            'webhook_verify_token' => env('WHATSAPP_WEBHOOK_VERIFY_TOKEN'),
        ],
        
        'web' => [
            'storage_path' => storage_path('whatsapp-sessions'),
            'headless' => env('WHATSAPP_WEB_HEADLESS', true),
            'port' => env('WHATSAPP_WEB_PORT', 3000),
        ],
    ],
];
```

Configura tu archivo `.env`:

```env
WHATSAPP_DRIVER=meta
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=secure_random_token
```

## Usando la Facade de WhatsApp

Una vez configurada, la magia comienza con la facade unificada. Envía mensajes sin preocuparte por cuál backend está activo:

```php
<?php

namespace App\Http\Controllers;

use WhatsApp;
use Illuminate\Http\Request;

class MessageController extends Controller
{
    public function sendWelcomeMessage(Request $request)
    {
        $phone = $request->input('phone');
        
        WhatsApp::to($phone)
            ->message('¡Hola! Bienvenido a nuestro servicio.')
            ->send();
        
        return response()->json(['sent' => true]);
    }
}
```

Este mismo código funciona tanto con Meta Cloud API como con whatsapp-web.js. Solo cambia la variable de entorno `WHATSAPP_DRIVER`.

## Envíos Complejos con Templates

Para volúmenes altos con Meta Cloud API, los templates son obligatorios. Laravel WhatsApp simplifica esto:

```php
public function sendOrderConfirmation($order)
{
    WhatsApp::to($order->customer->phone)
        ->template('order_confirmation', [
            '1' => $order->order_number,
            '2' => $order->total,
            '3' => $order->estimated_delivery,
        ])
        ->send();
}
```

El package valida automáticamente que los templates existan en tu cuenta Meta.

## Gestión de Sesiones con UI Livewire

Para el backend `web` (whatsapp-web.js), necesitas gestionar sesiones de usuario. Aquí es donde Livewire entra:

```php
<?php

namespace App\Livewire;

use Livewire\Component;
use WhatsApp;

class WhatsAppSessionManager extends Component
{
    public $sessions = [];
    public $qrCode = '';
    public $loading = false;
    
    public function mount()
    {
        $this->loadSessions();
    }
    
    public function loadSessions()
    {
        $this->sessions = WhatsApp::driver('web')->sessions();
    }
    
    public function initializeSession($sessionName)
    {
        $this->loading = true;
        
        WhatsApp::driver('web')
            ->session($sessionName)
            ->initialize();
        
        // Obtén el QR code
        $this->qrCode = WhatsApp::driver('web')
            ->session($sessionName)
            ->getQrCode();
        
        $this->loading = false;
    }
    
    public function logoutSession($sessionName)
    {
        WhatsApp::driver('web')
            ->session($sessionName)
            ->logout();
        
        $this->loadSessions();
        
        $this->dispatch('notify', 'Sesión cerrada');
    }
    
    public function render()
    {
        return view('livewire.whatsapp-session-manager');
    }
}
```

La vista Livewire correspondiente:

```blade
<div class="space-y-4">
    <div class="flex justify-between items-center">
        <h3 class="text-lg font-bold">Sesiones de WhatsApp</h3>
        <button wire:click="loadSessions" class="btn btn-sm btn-primary">
            Actualizar
        </button>
    </div>
    
    @if($loading)
        <div class="alert alert-info">Inicializando sesión...</div>
    @endif
    
    @if($qrCode)
        <div class="border p-4 rounded-lg">
            <p class="text-sm mb-2">Escanea el código QR con tu teléfono:</p>
            <img src="{{ $qrCode }}" alt="QR Code" class="w-64 h-64">
        </div>
    @endif
    
    <div class="grid grid-cols-1 gap-2">
        @forelse($sessions as $session)
            <div class="flex justify-between items-center border p-3 rounded">
                <div>
                    <p class="font-semibold">{{ $session['name'] }}</p>
                    <p class="text-sm text-gray-500">
                        Estado: <span class="badge badge-{{ $session['authenticated'] ? 'success' : 'warning' }}">
                            {{ $session['authenticated'] ? 'Autenticada' : 'Pendiente' }}
                        </span>
                    </p>
                </div>
                <div class="space-x-2">
                    @if(!$session['authenticated'])
                        <button wire:click="initializeSession('{{ $session['name'] }}')" class="btn btn-sm btn-outline">
                            Conectar
                        </button>
                    @else
                        <button wire:click="logoutSession('{{ $session['name'] }}')" class="btn btn-sm btn-error">
                            Desconectar
                        </button>
                    @endif
                </div>
            </div>
        @empty
            <p class="text-gray-500">No hay sesiones activas.</p>
        @endforelse
    </div>
</div>
```

## Webhooks Automáticos

Configurar webhooks es crítico para recibir mensajes entrantes. Laravel WhatsApp lo simplifica:

```php
<?php

namespace App\Http\Controllers;

use WhatsApp;
use Illuminate\Http\Request;
use App\Models\Message;

class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request)
    {
        // Valida automáticamente el webhook
        return WhatsApp::webhook()->verify($request);
    }
    
    public function handle(Request $request)
    {
        $webhook = WhatsApp::webhook()->process($request);
        
        if ($webhook->isMessage()) {
            Message::create([
                'phone' => $webhook->from(),
                'body' => $webhook->message(),
                'type' => $webhook->messageType(), // text, image, document, etc.
                'raw' => $webhook->data(),
            ]);
            
            // Responde automáticamente
            WhatsApp::to($webhook->from())
                ->message('Recibimos tu mensaje. Pronto nos contactaremos.')
                ->send();
        }
        
        if ($webhook->isStatusUpdate()) {
            // Actualiza estado de mensaje enviado
            Message::where('remote_id', $webhook->messageId())
                ->update(['status' => $webhook->status()]);
        }
        
        return response()->noContent();
    }
}
```

Registra las rutas en `routes/api.php`:

```php
Route::post('/webhooks/whatsapp/verify', [WhatsAppWebhookController::class, 'verify']);
Route::post('/webhooks/whatsapp', [WhatsAppWebhookController::class, 'handle']);
```

## Cambio Dinámico de Drivers

A veces necesitas usar diferentes drivers para diferentes casos. Laravel WhatsApp lo permite:

```php
public function sendUrgentNotification($customer, $message)
{
    // Usa Meta Cloud API para garantizar entrega
    if ($customer->phone_verified) {
        WhatsApp::driver('meta')
            ->to($customer->phone)
            ->message($message)
            ->send();
    } else {
        // Usa Web para clientes no verificados
        WhatsApp::driver('web')
            ->to($customer->phone)
            ->message($message)
            ->send();
    }
}
```

## Manejo de Errores y Reintentos

Los mensajes fallan ocasionalmente. Usa jobs para reintentos automáticos:

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use WhatsApp;

class SendWhatsAppMessage implements ShouldQueue
{
    use Dispatchable, Queueable;
    
    public $tries = 3;
    public $backoff = [60, 300, 900]; // 1 min, 5 min, 15 min
    
    public function __construct(
        private string $phone,
        private string $message,
        private string $driver = 'meta'
    ) {}
    
    public function handle()
    {
        try {
            WhatsApp::driver($this->driver)
                ->to($this->phone)
                ->message($this->message)
                ->send();
        } catch (\Exception $e) {
            // Registra el error
            \Log::error("WhatsApp send failed: {$e->getMessage()}", [
                'phone' => $this->phone,
                'driver' => $this->driver,
            ]);
            
            // Reintentar
            throw $e;
        }
    }
    
    public function failed(\Exception $exception)
    {
        // Notifica al administrador después de agotar reintentos
        \Notification::route('mail', 'admin@app.com')
            ->notify(new WhatsAppSendFailed($this->phone, $exception));
    }
}
```

Despacha el job:

```php
SendWhatsAppMessage::dispatch(
    phone: '+34912345678',
    message: 'Tu código de verificación es: 123456',
    driver: 'meta'
);
```

## Casos de Uso en Producción

### Sistema de Notificaciones de Pedidos

```php
<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use App\Models\Order;

class OrderShipped extends Notification
{
    public function __construct(private Order $order) {}
    
    public function via($notifiable)
    {
        return ['whatsapp'];
    }
    
    public function toWhatsApp($notifiable)
    {
        return WhatsApp::to($notifiable->phone)
            ->template('order_shipped', [
                '1' => $this->order->order_number,
                '2' => $this->order->tracking_number,
                '3' => config('app.url') . '/track/' . $this->order->id,
            ]);
    }
}
```

### Chatbot con Respuestas Inteligentes

```php
<?php

namespace App\Services;

use WhatsApp;

class WhatsAppChatbot
{
    public function handleMessage($phone, $message)
    {
        $intent = $this->detectIntent($message);
        
        return match($intent) {
            'help' => $this->sendHelp($phone),
            'order_status' => $this->sendOrderStatus($phone, $message),
            'contact' => $this->sendContact($phone),
            default => $this->sendDefault($phone),
        };
    }
    
    private function sendHelp($phone)
    {
        WhatsApp::to($phone)
            ->message(
                "¿En qué puedo ayudarte?\n" .
                "1️⃣ Ver estado de mi pedido\n" .
                "2️⃣ Cambiar dirección\n" .
                "3️⃣ Contactar soporte\n" .
                "Responde con el número"
            )
            ->send();
    }
}
```

## Ventajas de Usar Una Sola Facade

1. **Código sin acoplamiento**: No depende de Meta o whatsapp-web.js
2. **Migración fácil**: Cambia de backend editando `.env`
3. **Testing simplificado**: Mock una sola interface
4. **Escalabilidad**: Crece con Meta sin refactoring
5. **Flexibilidad**: Usa ambos simultáneamente

## Puntos clave

- **Laravel WhatsApp unifica dos backends** completos bajo una única facade elegante
- **Meta Cloud API para volúmenes altos** con aprobación previa y costo por mensaje
- **WhatsApp Web.js para acceso inmediato** sin requisitos, ideal para pruebas
- **UI Livewire integrada** para gestionar sesiones sin código manual