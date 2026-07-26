---
title: 'Vocalizer en Laravel: Text-to-Speech Local sin Dependencias'
description: 'Integra síntesis de voz local en Laravel con Vocalizer. Genera audio desde texto sin APIs externas. Guía completa con ejemplos.'
pubDate: '2026-07-18'
tags: ['laravel', 'php', 'audio', 'vocalizer']
---

## Vocalizer en Laravel: Text-to-Speech Local sin Dependencias

La generación de audio desde texto es cada vez más común en aplicaciones modernas. Notificaciones habladas, accesibilidad, videos con narración automática... son casos de uso reales que ves en producción. El problema tradicional: depender de APIs externas como Google Cloud Text-to-Speech o Amazon Polly que tienen costos, latencia y requieren conexión a internet.

**Vocalizer** cambia el juego. Es una extensión nativa de PHP que integra **sherpa-onnx** y **audio.cpp** para ejecutar ocho familias de modelos TTS (Text-to-Speech) localmente. Puedes clonar voces, usar modelos preentrenados, y todo sin abandonar tu infraestructura.

En este artículo aprendrás a integrar Vocalizer en Laravel de forma práctica, con ejemplos reales que puedes usar mañana.

## ¿Por qué Vocalizer y no APIs externas?

Antes de meternos en el código, déjame explicar por qué esto importa:

### Ventajas de síntesis local

- **Sin costos por uso**: No pagas por cada solicitud de síntesis
- **Privacidad**: El texto nunca sale de tu servidor
- **Latencia predecible**: No depende de latencia de red
- **Funcionamiento offline**: Genera audio sin conexión a internet
- **Control total**: Modelos locales que puedes versionear

### Limitaciones que debes conocer

- **Consumo de CPU**: La síntesis requiere procesamiento local
- **Espacio en disco**: Los modelos ocupan varios MB
- **Curva de aprendizaje**: Menos documentación que APIs populares

Es ideal para aplicaciones de **SaaS multitenancy**, **asistentes de voz internos**, **contenido educativo** y **accesibilidad**.

## Instalación de Vocalizer

La instalación varía según tu entorno. Vocalizer se proporciona como extensión de PHP compilada.

### En Linux/Ubuntu

```bash
# Descarga la extensión desde el repositorio oficial
git clone https://github.com/thenpingme/vocalizer-php /tmp/vocalizer

cd /tmp/vocalizer

# Compila la extensión
phpize
./configure
make
sudo make install

# Activa la extensión en php.ini
echo "extension=vocalizer.so" | sudo tee -a /etc/php/8.3/cli/php.ini
echo "extension=vocalizer.so" | sudo tee -a /etc/php/8.3/fpm/php.ini

# Reinicia PHP-FPM
sudo systemctl restart php8.3-fpm
```

### En macOS con Homebrew

```bash
brew tap thenpingme/vocalizer
brew install vocalizer
```

### Verificar instalación

```bash
php -m | grep vocalizer
```

Si ves `vocalizer` en la lista, ¡listo!

## Descargar modelos TTS

Vocalizer viene sin modelos preincorporados. Necesitas descargarlos:

```bash
# Descarga un modelo de ejemplo (Kokoro, muy recomendado)
mkdir -p storage/tts-models
cd storage/tts-models

# Descarga el modelo Kokoro en inglés (pequeño, ~100MB)
curl -L https://huggingface.co/thenpingme/kokoro-v0_19/resolve/main/kokoro-v0_19.en.onnx -o kokoro.onnx
curl -L https://huggingface.co/thenpingme/kokoro-v0_19/resolve/main/voices.bin -o voices.bin
```

Los modelos disponibles incluyen:
- **Kokoro**: Voz natural, rápida (recomendada)
- **XTTS v2**: Clonación de voz
- **Piper**: Ligera, múltiples idiomas
- **Glow-TTS**: Calidad alta
- **FastPitch**: Baja latencia

## Integración básica en Laravel

Crea un servicio para encapsular la lógica de síntesis:

```php
<?php

namespace App\Services;

use Vocalizer\TextToSpeech;
use Illuminate\Support\Facades\Storage;

class VocalizerService
{
    protected TextToSpeech $tts;
    protected string $modelPath;
    protected string $voicesPath;

    public function __construct()
    {
        $this->modelPath = storage_path('tts-models/kokoro.onnx');
        $this->voicesPath = storage_path('tts-models/voices.bin');
        
        $this->tts = new TextToSpeech($this->modelPath);
    }

    /**
     * Sintetiza texto a audio WAV
     */
    public function synthesize(
        string $text,
        string $speaker = 'af_bella',
        float $speed = 1.0
    ): string {
        // Genera audio
        $audio = $this->tts->speak(
            text: $text,
            speaker: $speaker,
            speed: $speed,
            voiceFile: $this->voicesPath
        );

        return $audio; // Retorna datos WAV en bytes
    }

    /**
     * Sintetiza y guarda a archivo
     */
    public function synthesizeToFile(
        string $text,
        string $filename = null,
        string $speaker = 'af_bella'
    ): string {
        if (!$filename) {
            $filename = 'audio-' . uniqid() . '.wav';
        }

        $audio = $this->synthesize($text, $speaker);
        
        Storage::disk('local')->put(
            'public/audio/' . $filename,
            $audio
        );

        return asset('storage/audio/' . $filename);
    }

    /**
     * Lista voces disponibles
     */
    public function listVoices(): array
    {
        return $this->tts->getAvailableVoices($this->voicesPath);
    }
}
```

Registra el servicio en tu contenedor:

```php
// app/Providers/AppServiceProvider.php
public function register(): void
{
    $this->app->singleton(VocalizerService::class, function () {
        return new VocalizerService();
    });
}
```

## Casos de uso prácticos

### 1. Notificaciones por audio

```php
<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use App\Services\VocalizerService;

class AlertNotification extends Notification
{
    public function __construct(private string $message) {}

    public function via(object $notifiable): array
    {
        return ['email', 'audio'];
    }

    public function toAudio(object $notifiable): array
    {
        $vocalizerService = app(VocalizerService::class);
        
        $audioUrl = $vocalizerService->synthesizeToFile(
            text: $this->message,
            filename: "alert-{$notifiable->id}.wav"
        );

        return [
            'audio_url' => $audioUrl,
            'speaker' => 'am_adam', // voz masculina
        ];
    }
}
```

### 2. Sintetizar contenido en cola

Para textos largos, usa Jobs para no bloquear la request:

```php
<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use App\Services\VocalizerService;
use App\Models\Article;

class SynthesizeArticleAudio implements ShouldQueue
{
    use Queueable;

    public function __construct(private Article $article) {}

    public function handle(VocalizerService $vocalizer): void
    {
        // Extrae el texto del artículo
        $text = strip_tags($this->article->content);

        // Divide en chunks para evitar límites de memoria
        $chunks = str_split($text, 500);
        
        foreach ($chunks as $index => $chunk) {
            $audioUrl = $vocalizer->synthesizeToFile(
                text: $chunk,
                filename: "article-{$this->article->id}-part-{$index}.wav",
                speaker: 'af_bella'
            );

            // Guarda referencia en DB
            $this->article->audioChunks()->create([
                'part_number' => $index,
                'audio_url' => $audioUrl,
            ]);
        }

        $this->article->update(['audio_synthesized' => true]);
    }
}
```

Despacha desde un controlador:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Article;
use App\Jobs\SynthesizeArticleAudio;

class ArticleController extends Controller
{
    public function generateAudio(Article $article)
    {
        dispatch(new SynthesizeArticleAudio($article));

        return response()->json([
            'message' => 'Audio en proceso de generación',
            'status' => 'processing'
        ]);
    }
}
```

### 3. Accesibilidad: Narración de UI

```php
<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use App\Services\VocalizerService;

class ProductResource extends JsonResource
{
    public function toArray($request): array
    {
        $vocalizer = app(VocalizerService::class);

        $description = "{$this->name}. Precio: {$this->price} pesos.";
        
        $audioUrl = $vocalizer->synthesizeToFile(
            text: $description,
            filename: "product-{$this->id}-narration.wav",
            speaker: 'am_adam'
        );

        return [
            'id' => $this->id,
            'name' => $this->name,
            'price' => $this->price,
            'narration_audio' => $audioUrl, // Incluye en respuesta JSON
            'narration_text' => $description,
        ];
    }
}
```

En el frontend:

```javascript
// Escucha la narración con Audio Web API
const audio = new Audio(response.data.narration_audio);
audio.play();
```

### 4. Clonación de voz con XTTS

Para un nivel avanzado, puedes usar modelos XTTS v2 que clonan voces:

```php
<?php

namespace App\Services;

use Vocalizer\TextToSpeech;

class VoiceCloningService
{
    public function cloneVoiceFromSample(
        string $referenceAudioPath,
        string $textToSpeak,
        string $language = 'en'
    ): string {
        $tts = new TextToSpeech(
            modelPath: storage_path('tts-models/xtts-v2.onnx')
        );

        $audio = $tts->speak(
            text: $textToSpeak,
            referenceAudio: $referenceAudioPath, // Ruta a archivo WAV
            language: $language
        );

        return $audio;
    }
}
```

## Optimización y rendimiento

### Caché de audio sintetizado

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

class OptimizedVocalizerService extends VocalizerService
{
    public function synthesizeToFile(
        string $text,
        string $filename = null,
        string $speaker = 'af_bella',
        int $cacheTtl = 86400 // 1 día
    ): string {
        $cacheKey = 'audio:' . md5($text . $speaker);

        // Intenta recuperar del caché
        if ($cachedUrl = Cache::get($cacheKey)) {
            return $cachedUrl;
        }

        // Sintetiza si no existe
        $url = parent::synthesizeToFile($text, $filename, $speaker);

        // Guarda en caché
        Cache::put($cacheKey, $url, $cacheTtl);

        return $url;
    }
}
```

### Limpia archivos antiguos

```php
<?php

namespace App\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class CleanupOldAudioFiles extends Command
{
    protected $signature = 'audio:cleanup {--days=7}';
    protected $description = 'Elimina archivos de audio más antiguos que N días';

    public function handle(): int
    {
        $days = $this->option('days');
        $before = Carbon::now()->subDays($days);

        $files = Storage::disk('local')
            ->listContents('public/audio')
            ->sortByPath();

        foreach ($files as $file) {
            if ($file->lastModified() < $before->timestamp) {
                Storage::disk('local')->delete($file->path());
                $this->info("Eliminado: {$file->path()}");
            }
        }

        return self::SUCCESS;
    }
}
```

Programa en `app/Console/Kernel.php`:

```php
protected function schedule(Schedule $schedule): void
{
    $schedule->command('audio:cleanup --days=7')
        ->daily()
        ->at('02:00');
}
```

## Monitoreo y errores

Maneja excepciones correctamente:

```php
<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Log;

class VocalizerService
{
    public function synthesize(string $text, string $speaker = 'af_bella'): ?string
    {
        try {
            if (!file_exists($this->modelPath)) {
                throw new Exception(
                    "Modelo TTS no encontrado en {$this->modelPath}"
                );
            }

            if (strlen($text) > 10000) {
                throw new Exception('Texto demasiado largo (máx 10000 caracteres)');
            }

            return $this->tts->speak(
                text: $text,
                speaker: $speaker,
                speed: 1.0,
                voiceFile: $this->voicesPath
            );

        } catch (Exception $e) {
            Log::error('Vocalizer synthesis failed', [
                'error' => $e->getMessage(),
                'text_length' => strlen($text),
                'speaker' => $speaker,
            ]);

            return null;
        }
    }
}
```

En controladores:

```php
public function generateAudio(Request $request)
{
    $audio = $this->vocalizer->synthesize(
        $request->input('text')
    );

    if (!$audio) {
        return response()->json(
            ['error' => 'Error al generar audio'],
            500
        );
    }

    return response($audio, 200, [
        'Content-Type' => 'audio/wav',
        'Content-Disposition' => 'attachment; filename="audio.wav"',
    ]);
}
```

## Comparativa: Vocalizer vs APIs externas

| Aspecto | Vocalizer | Google TTS | AWS Polly |
|---------|-----------|-----------|-----------|
| **Costo** | Gratis | ~$16/1M chars | ~$4/1M chars |
| **Latencia** | <1s local | 1-5s red | 1-5s red |
| **Privacidad** | 100% local | Datos a Google |