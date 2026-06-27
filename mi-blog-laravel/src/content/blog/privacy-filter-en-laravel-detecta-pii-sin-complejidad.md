---
title: 'Privacy Filter en Laravel: Detecta PII sin Complejidad'
description: 'Detecta datos personales en textos con Privacy Filter en Laravel. Guía completa con ejemplos de código para proteger información sensible.'
pubDate: '2025-01-15'
tags: ['laravel', 'seguridad', 'privacidad', 'pii']
---

# Privacy Filter en Laravel: Detecta PII sin Complejidad

La protección de datos personales es una responsabilidad crítica en cualquier aplicación moderna. Si trabajas con Laravel y necesitas detectar información sensible (nombres, emails, números de teléfono, direcciones) en textos, **Privacy Filter** es una solución elegante que simplifica esta tarea.

En este artículo te mostraremos cómo integrar Privacy Filter en tu aplicación Laravel, detectar información sensible (PII - Personally Identifiable Information) con confianza de coincidencia, y cómo utilizarla en casos reales de tu día a día como desarrollador.

## ¿Qué es Privacy Filter?

Privacy Filter es un wrapper de Laravel alrededor del binario `privacy-filter.cpp`, un motor de detección de entidades privadas desarrollado por DirectoryTree. Esta herramienta:

- **Detecta automáticamente** información sensible en textos libres
- **Proporciona puntuaciones de confianza** para cada entidad encontrada
- **Retorna offsets de bytes** para ubicación exacta en el texto
- **Incluye fakes para testing** para facilitar las pruebas unitarias

¿Por qué es importante? Imagina que tu aplicación procesa comentarios de usuarios, notas de soporte técnico, o publicaciones generadas por usuarios. Sin una forma confiable de detectar PII, podrías exponer accidentalmente información sensible.

## Instalación y Configuración

### Instalación del paquete

La instalación es sencilla a través de Composer:

```bash
composer require directoryxtree/privacy-filter
```

### Verificar la instalación

Una vez instalado, puedes verificar que el paquete está disponible:

```bash
php artisan vendor:publish --provider="DirectoryTree\PrivacyFilter\PrivacyFilterServiceProvider"
```

El paquete es relativamente ligero y no requiere configuración compleja. La mayoría de desarrolladores puede empezar a usarlo inmediatamente después de la instalación.

## Uso Básico de Privacy Filter

### Detección simple de PII

El uso más básico es detectar entidades privadas en un texto:

```php
<?php

use DirectoryTree\PrivacyFilter\PrivacyFilter;

$text = "Mi nombre es Juan García y mi email es juan@example.com";

$entities = PrivacyFilter::detect($text);

foreach ($entities as $entity) {
    echo "Tipo: {$entity->type}" . PHP_EOL;
    echo "Valor: {$entity->value}" . PHP_EOL;
    echo "Confianza: {$entity->confidence}" . PHP_EOL;
    echo "Offset: {$entity->offset}" . PHP_EOL;
}
```

**Salida esperada:**
```
Tipo: PERSON
Valor: Juan García
Confianza: 0.95
Offset: 11

Tipo: EMAIL
Valor: juan@example.com
Confianza: 0.99
Offset: 42
```

### Entender los resultados

Cada entidad detectada contiene:

- **type**: Tipo de información (PERSON, EMAIL, PHONE, ADDRESS, etc.)
- **value**: El texto exacto identificado como PII
- **confidence**: Puntuación de 0 a 1 indicando certeza (1.0 = seguro)
- **offset**: Posición en bytes donde comienza la entidad

## Casos de Uso Prácticos

### 1. Validación de Comentarios de Usuarios

Un caso común es validar que los comentarios públicos no contengan información sensible:

```php
<?php

namespace App\Http\Controllers;

use DirectoryTree\PrivacyFilter\PrivacyFilter;
use App\Models\Comment;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'text' => 'required|string|max:1000',
        ]);

        // Detectar PII en el comentario
        $entities = PrivacyFilter::detect($validated['text']);
        
        // Filtrar solo entidades con alta confianza
        $sensitiveData = $entities->filter(fn($entity) => $entity->confidence > 0.8);

        if ($sensitiveData->isNotEmpty()) {
            return response()->json([
                'message' => 'Tu comentario contiene información sensible',
                'blocked_types' => $sensitiveData->pluck('type')->unique(),
            ], 422);
        }

        Comment::create([
            'user_id' => auth()->id(),
            'text' => $validated['text'],
        ]);

        return response()->json(['message' => 'Comentario publicado'], 201);
    }
}
```

### 2. Anonimización de Datos

Si necesitas anonimizar textos que contienen PII antes de almacenarlos o procesarlos:

```php
<?php

use DirectoryTree\PrivacyFilter\PrivacyFilter;

class DataAnonymizer
{
    public static function anonymize(string $text): string
    {
        $entities = PrivacyFilter::detect($text);
        
        // Ordenar por offset descendente para reemplazar de atrás hacia adelante
        // Esto evita que los offsets cambien durante las sustituciones
        $entities = $entities->sortByDesc('offset');

        foreach ($entities as $entity) {
            $replacement = match($entity->type) {
                'PERSON' => '[NOMBRE]',
                'EMAIL' => '[EMAIL]',
                'PHONE' => '[TELÉFONO]',
                'ADDRESS' => '[DIRECCIÓN]',
                default => '[DATO_SENSIBLE]',
            };

            $text = substr_replace(
                $text,
                $replacement,
                $entity->offset,
                strlen($entity->value)
            );
        }

        return $text;
    }
}

// Uso
$originalText = "Contacta a María López en maria@example.com o 555-123-4567";
$anonymized = DataAnonymizer::anonymize($originalText);
// Resultado: "Contacta a [NOMBRE] en [EMAIL] o [TELÉFONO]"
```

### 3. Logging Seguro

Evita guardar información sensible en logs:

```php
<?php

namespace App\Logging;

use DirectoryTree\PrivacyFilter\PrivacyFilter;
use Monolog\LogRecord;

class SensitiveDataFilter
{
    public function __invoke(LogRecord $record): LogRecord
    {
        if (is_string($record->message)) {
            $entities = PrivacyFilter::detect($record->message);
            
            if ($entities->isNotEmpty()) {
                $sanitized = $this->sanitizeText(
                    $record->message,
                    $entities
                );
                $record['message'] = $sanitized;
            }
        }

        return $record;
    }

    private function sanitizeText(string $text, $entities): string
    {
        $entities = $entities->sortByDesc('offset');

        foreach ($entities as $entity) {
            if ($entity->confidence > 0.9) {
                $text = substr_replace(
                    $text,
                    '[REDACTED]',
                    $entity->offset,
                    strlen($entity->value)
                );
            }
        }

        return $text;
    }
}
```

## Testing con Privacy Filter Fakes

Privacy Filter incluye un fake para testing que es muy útil:

```php
<?php

namespace Tests\Feature;

use DirectoryTree\PrivacyFilter\Testing\FakePrivacyFilter;
use Tests\TestCase;

class CommentValidationTest extends TestCase
{
    public function test_rejects_comments_with_pii()
    {
        FakePrivacyFilter::fake([
            'email' => 'john@example.com',
            'phone' => '555-123-4567',
        ]);

        $response = $this->postJson('/api/comments', [
            'text' => 'Contact john@example.com at 555-123-4567',
        ]);

        $response->assertStatus(422);
    }

    public function test_accepts_clean_comments()
    {
        FakePrivacyFilter::fake([]); // Sin PII detectado

        $response = $this->postJson('/api/comments', [
            'text' => 'Este comentario es completamente seguro',
        ]);

        $response->assertStatus(201);
    }
}
```

## Mejores Prácticas

### 1. Filtrar por Confianza

No todas las detecciones tienen la misma certeza. Es prudente establecer umbrales:

```php
$highConfidenceEntities = PrivacyFilter::detect($text)
    ->filter(fn($entity) => $entity->confidence > 0.85);
```

### 2. Cachear Resultados

Si analiza el mismo texto varias veces, considera cachear:

```php
$cacheKey = 'pii_detection_' . md5($text);

$entities = cache()->remember($cacheKey, 3600, function () use ($text) {
    return PrivacyFilter::detect($text);
});
```

### 3. Reportar Seguridad

Considera registrar intentos de publicar PII para auditoría:

```php
if ($sensitiveData->isNotEmpty()) {
    Log::warning('PII attempt detected', [
        'user_id' => auth()->id(),
        'entities' => $sensitiveData->toArray(),
        'ip' => request()->ip(),
    ]);
}
```

### 4. Documentar Claramente

Comunica a tus usuarios por qué ciertos comentarios son rechazados:

```php
$response = response()->json([
    'message' => 'No podemos publicar comentarios que contengan información personal. '
        . 'Por favor, revisa tu comentario e intenta de nuevo.',
    'help_text' => 'Evita incluir nombres completos, emails o teléfonos',
], 422);
```

## Rendimiento y Consideraciones

### Costo de CPU

El análisis de PII consume recursos. Para grandes volúmenes:

```php
// Usar jobs asincronos para análisis pesado
if (strlen($text) > 5000) {
    AnalyzePiiJob::dispatch($text, $commentId);
} else {
    $entities = PrivacyFilter::detect($text);
}
```

### Limitaciones

- El paquete funciona mejor con texto en inglés
- Algunos idiomas pueden tener menor precisión
- Requiere el binario `privacy-filter.cpp` compilado

## Conclusión

Privacy Filter en Laravel proporciona una forma sencilla y confiable de detectar información sensible en textos. Ya sea para validar comentarios de usuarios, anonimizar datos antes de procesarlos, o asegurar que tus logs no contienen PII, esta herramienta se integra perfectamente en el ecosistema Laravel.

La capacidad de obtener puntuaciones de confianza y ubicaciones exactas de entidades hace que sea flexible para diferentes casos de uso. Combinado con las prácticas de testing y caching adecuadas, Privacy Filter es una adición valiosa a tu caja de herramientas de seguridad.

## Puntos clave

- **Privacy Filter detecta automáticamente** información sensible (PII) en textos con puntuaciones de confianza
- **Los resultados incluyen** tipo de entidad, valor, confianza y offset de bytes para máxima precisión
- **Casos prácticos comunes** incluyen validación de comentarios, anonimización de datos y logging seguro
- **Siempre filtra por confianza** para evitar falsos positivos en detecciones
- **Cachea resultados** de textos largos para optimizar rendimiento
- **Usa testing fakes** para facilitar pruebas unitarias sin dependencias externas
- **Documenta claramente** a usuarios por qué el contenido es rechazado por contener PII
- **Considera el idioma** del texto: funciona mejor en inglés, otros idiomas pueden ser menos precisos