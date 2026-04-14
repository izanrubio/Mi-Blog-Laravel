---
title: 'Relay WebSocket: alternativa a Reverb sin PHP'
description: 'Descubre Relay, servidor WebSocket en Go compatible con Pusher. Alternativa standalone a Laravel Reverb sin dependencias PHP ni Laravel.'
pubDate: '2026-04-14'
tags: ['laravel', 'websockets', 'devops', 'go']
---

# Relay WebSocket: La Alternativa Standalone a Laravel Reverb

Si trabajas con Laravel y necesitas WebSockets en tiempo real, probablemente conoces **Laravel Reverb**. Es una solución excelente, pero tiene una limitación importante: requiere que una aplicación Laravel esté ejecutándose constantemente solo para hostear el servidor WebSocket.

¿Qué pasa si quieres una solución más ligera, sin dependencias PHP, sin Composer, sin necesidad de mantener una instancia de Laravel solo para esto? Aquí es donde entra **Relay**, un servidor WebSocket open source escrito en Go que es compatible con Pusher y puede ejecutarse como un binario standalone.

En este artículo exploraremos qué es Relay, cómo configurarlo con tu aplicación Laravel, y cuándo deberías considerarlo sobre Reverb.

## ¿Qué es Relay y por qué es diferente?

Relay es un servidor WebSocket escrito en Go que mantiene compatibilidad con el protocolo Pusher. Esto significa que puedes usar la misma forma que usas Pusher o Reverb en Laravel, pero apuntando a tu instancia de Relay.

La diferencia fundamental es que **Relay no necesita PHP ni Laravel**. Es un binario que descargas, configuras y ejecutas. Puedes ponerlo en:

- Un servidor dedicado
- Una máquina Linux barata
- Un contenedor Docker
- Tu VPS existente (incluso el mismo que tu app Laravel)

Esto lo hace ideal para:

- **Proyectos pequeños/medianos** donde no justifica tener una instancia Laravel completa solo para WebSockets
- **Infraestructura minimalista** donde quieres menos dependencias
- **Hosting compartido** donde no puedes ejecutar múltiples procesos PHP

## Comparativa: Relay vs Reverb vs Pusher

Antes de decidir, aquí está la comparativa técnica:

| Aspecto | Relay | Reverb | Pusher |
|---------|-------|--------|--------|
| **Lenguaje** | Go | PHP (Laravel) | SaaS |
| **Instalación** | Binario standalone | Artisan command | Nada (SaaS) |
| **Dependencias** | Ninguna | Laravel app | Internet |
| **Costo** | Gratis (open source) | Gratis (incluido) | Desde $49/mes |
| **Self-hosted** | Sí | Sí | No |
| **Escalabilidad** | Horizontal | Vertical | Ilimitada |
| **Compatibilidad** | Pusher API | Pusher API | Pusher API |

## Instalando y configurando Relay

### Paso 1: Descargar Relay

Ve a [https://github.com/relayprotocol/relay](https://github.com/relayprotocol/relay) y descarga el binario para tu sistema operativo:

```bash
# En Linux x64
wget https://github.com/relayprotocol/relay/releases/download/v1.0.0/relay-linux-amd64
chmod +x relay-linux-amd64

# En Mac
wget https://github.com/relayprotocol/relay/releases/download/v1.0.0/relay-darwin-amd64
chmod +x relay-darwin-amd64
```

### Paso 2: Configurar el archivo .env de Laravel

Actualiza tu `.env` para usar Relay:

```env
# Cambiar de driver de broadcast
BROADCAST_DRIVER=pusher

# Credenciales de Relay (debes generarlas)
PUSHER_APP_ID=your-app-id
PUSHER_APP_KEY=your-app-key
PUSHER_APP_SECRET=your-app-secret
PUSHER_APP_CLUSTER=mt1

# Host donde corre Relay
PUSHER_HOST=localhost
PUSHER_PORT=6001
PUSHER_SCHEME=http
```

### Paso 3: Crear archivo de configuración de Relay

Crea un archivo `relay-config.json`:

```json
{
  "port": 6001,
  "appId": "your-app-id",
  "appKey": "your-app-key",
  "appSecret": "your-app-secret",
  "debug": false,
  "maxConnections": 10000,
  "authentication": {
    "enabled": true,
    "timeout": 30
  },
  "cors": {
    "enabled": true,
    "origins": ["http://localhost:3000", "http://localhost:8000"]
  },
  "ssl": {
    "enabled": false,
    "certPath": "/path/to/cert.pem",
    "keyPath": "/path/to/key.pem"
  }
}
```

### Paso 4: Ejecutar Relay

```bash
./relay-linux-amd64 --config relay-config.json
```

Deberías ver algo como:

```
2026-04-14 10:30:45 [INFO] Relay WebSocket Server started on :6001
2026-04-14 10:30:45 [INFO] Listening for connections...
```

## Usando Relay en tu aplicación Laravel

La belleza de usar Relay es que **el código en Laravel es idéntico** al de Pusher o Reverb. No necesitas cambiar nada en tu código si ya estabas usando `broadcast()`.

### Broadcasting un evento

```php
<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $message;

    public function __construct($message)
    {
        $this->message = $message;
    }

    public function broadcastOn()
    {
        return new Channel('chat');
    }

    public function broadcastAs()
    {
        return 'message.sent';
    }
}
```

### En tu controlador

```php
<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;

class ChatController extends Controller
{
    public function sendMessage(Request $request)
    {
        $message = $request->validate(['message' => 'required|string']);
        
        // Broadcast el evento
        broadcast(new MessageSent($message['message']));
        
        return response()->json(['success' => true]);
    }
}
```

### En tu JavaScript (Blade o Vue)

```javascript
// Usando Laravel Echo (que funciona con cualquier servidor Pusher-compatible)
Echo.channel('chat')
    .listen('message.sent', (e) => {
        console.log('Nuevo mensaje:', e.message);
        addMessageToUI(e.message);
    });
```

## Autenticación privada con Relay

Para canales privados, Relay necesita validar que el usuario tiene permisos:

```php
// routes/channels.php
Broadcast::channel('chat.{id}', function ($user, $id) {
    // Verificar que el usuario puede acceder a este chat
    return $user->id === (int)$id;
});
```

Relay hará una solicitud POST a tu aplicación Laravel para validar esto:

```php
// routes/api.php
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
});
```

## Optimizando Relay en producción

### 1. Usar SSL/TLS

Si tu app está en HTTPS, Relay también debe estar en HTTPS:

```json
{
  "ssl": {
    "enabled": true,
    "certPath": "/etc/letsencrypt/live/example.com/fullchain.pem",
    "keyPath": "/etc/letsencrypt/live/example.com/privkey.pem"
  }
}
```

### 2. Ejecutar como servicio systemd

Crea `/etc/systemd/system/relay.service`:

```ini
[Unit]
Description=Relay WebSocket Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/relay
ExecStart=/opt/relay/relay-linux-amd64 --config relay-config.json
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Luego:

```bash
sudo systemctl daemon-reload
sudo systemctl enable relay
sudo systemctl start relay
sudo systemctl status relay
```

### 3. Monitorear conexiones

Relay expone un endpoint `/metrics` (si está habilitado en config) para ver estadísticas:

```bash
curl http://localhost:6001/metrics
```

### 4. Usar Nginx como proxy reverso

Si quieres agregar caché, rate limiting, o balanceo de carga:

```nginx
upstream relay {
    server localhost:6001;
}

server {
    listen 80;
    server_name ws.example.com;

    location / {
        proxy_pass http://relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Cuándo usar Relay vs Reverb

### Usa Relay si:

- Quieres **minimizar dependencias** en producción
- Tienes un **VPS pequeño** con recursos limitados
- No necesitas las integraciones avanzadas de Reverb
- Prefieres un **binario simple** sin complejidad PHP
- Quieres **hostear múltiples apps** con un solo servidor WebSocket

### Usa Reverb si:

- Ya estás cómodo con el **ecosistema Laravel**
- Necesitas **integración profunda** con Laravel (queues, eventos, etc.)
- Quieres soporte oficial de Laravel
- Tu app es **muy compleja** y los WebSockets son una pequeña parte

## Troubleshooting común

### Conexiones rechazadas

```
Connection refused on :6001
```

Verifica que Relay está ejecutándose y escuchando:

```bash
netstat -tlnp | grep 6001
# o
lsof -i :6001
```

### CORS errors

Actualiza el `relay-config.json` con los orígenes correctos:

```json
{
  "cors": {
    "enabled": true,
    "origins": ["https://example.com", "https://app.example.com"]
  }
}
```

### Autenticación fallida

Asegúrate de que tu ruta de broadcasting auth devuelve respuesta JSON válida:

```php
// routes/api.php debe estar registrada ANTES de la ruta de broadcast auth
Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');
```

## Puntos clave

- **Relay es un servidor WebSocket Go** que no requiere PHP ni Laravel, ideal para infraestructura minimalista
- **Compatible con Pusher**, por lo que el código Laravel no cambia; solo cambia la configuración
- **Instalación simple**: descargar binario, configurar JSON, ejecutar como servicio
- **Perfectamente útil para proyectos medianos** que no justifican Pusher SaaS ni Reverb overkill
- **Puedes auto-hostear gratis** o usar su servicio en la nube si prefieres
- **Requiere validación manual** de canales privados a través de endpoints POST a tu app
- **En producción**: usa SSL, systemd, y Nginx como proxy reverso para máxima confiabilidad
- **Menos overhead que Reverb** porque no hay proceso PHP adicional ejecutándose