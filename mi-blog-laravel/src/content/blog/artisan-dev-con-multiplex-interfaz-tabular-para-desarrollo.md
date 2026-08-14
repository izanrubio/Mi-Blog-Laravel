---
title: 'artisan dev con Multiplex: Interfaz Tabular para Desarrollo'
description: 'Laravel 13.25 ejecuta artisan dev en una interfaz tabular moderna con búsqueda, reinicio por proceso y timestamps automáticos'
pubDate: '2025-08-14'
tags: ['laravel', 'cli', 'desarrollo', 'herramientas', 'artisan']
---

## artisan dev con Multiplex: Interfaz Tabular para Desarrollo

Desarrollar una aplicación Laravel moderna implica ejecutar múltiples procesos simultáneamente: el servidor web, Node.js para compilación de assets, cola de trabajos, y potencialmente otros servicios. Hasta ahora, esto significaba abrir varias pestaña de terminal o usar tmux manualmente. **Laravel 13.25 soluciona este problema de manera elegante**: el comando `artisan dev` ahora ejecuta todos tus procesos en una interfaz tabular integrada usando **@laravel/multiplex**.

### ¿Qué es Multiplex en Laravel 13.25?

Multiplex es una herramienta que transforma la forma en que ves tus procesos de desarrollo. En lugar de tener múltiples ventanas de terminal desordenadas, obtienes una interfaz unificada donde cada proceso ocupa su propia pestaña dentro del mismo comando.

Las características principales incluyen:

- **Tabs por proceso**: Cada servicio (web, queue, watch) tiene su propia sección
- **Búsqueda integrada**: Encuentra líneas específicas en los logs sin necesidad de scrollear manualmente
- **Reinicio por proceso**: Detén y reinicia un servicio específico sin afectar los otros
- **Timestamps automáticos**: Cada línea incluye marca de tiempo para debugging
- **Vista unificada**: Todo en una pantalla sin necesidad de herramientas externas como tmux

### Instalación y Configuración Básica

La buena noticia es que no requiere configuración adicional si ya actualizaste a Laravel 13.25. El comando `artisan dev` funciona automáticamente con la nueva interfaz.

Para verificar tu versión actual:

```bash
php artisan --version
```

Si tienes Laravel 13.25 o superior, simplemente ejecuta:

```bash
php artisan dev
```

### Estructura del Archivo de Configuración

El archivo `Procfile` en la raíz de tu proyecto define qué procesos ejecutar. Un ejemplo típico se ve así:

```procfile
web: php artisan serve
queue: php artisan queue:work
watch: npm run dev
```

Laravel detecta automáticamente este archivo y ejecuta cada línea en su propia pestaña. Si no tienes este archivo, Laravel 13.25 crea uno por defecto con los procesos más comunes.

### Personalizar tus Procesos

Puedes ajustar el `Procfile` según las necesidades de tu proyecto. Por ejemplo:

```procfile
web: php artisan serve --port=8000
queue: php artisan queue:work --max-jobs=100
watch: npm run dev
scheduler: php artisan schedule:work
cache: php artisan tinker --execute="Cache::flush()"
```

Cada línea debe seguir el formato `nombre: comando`. El nombre aparecerá como etiqueta en la pestaña de la interfaz.

### Navegación en la Interfaz Tabular

Una vez ejecutes `artisan dev`, verás algo como esto:

```
┌─ web ──────────────────────────────────────────┐
│ [2025-08-14 10:23:45] Starting Laravel server │
│ [2025-08-14 10:23:46] Server running at       │
│ [2025-08-14 10:23:47] port: 8000              │
├─ queue ────────────────────────────────────────┤
│ [2025-08-14 10:23:45] Processing jobs...      │
│ [2025-08-14 10:23:47] Processed: 1 jobs      │
├─ watch ────────────────────────────────────────┤
│ [2025-08-14 10:23:46] Watching for changes... │
│ [2025-08-14 10:23:48] app.css rebuilt        │
```

**Controles principales:**

- `Tab` o flechas: Navega entre pestaña
- `/`: Abre búsqueda en la pestaña actual
- `r`: Reinicia el proceso de la pestaña seleccionada
- `q`: Cierra la interfaz (detiene todos los procesos)
- `Space`: Pausa/reanuda un proceso individual

### Búsqueda Integrada: Debugging Más Rápido

Presiona `/` en cualquier pestaña para abrir la búsqueda. Esto es especialmente útil cuando depuras errores:

```bash
# Estás en la pestaña 'web' y buscar "error"
/error

# Multiplex resalta todas las líneas que contienen "error"
# Usa arrow keys para navegar entre coincidencias
```

### Reinicio Individual de Procesos

Sin cerrar toda la interfaz, puedes reiniciar un proceso específico:

```bash
# Selecciona la pestaña 'queue' y presiona 'r'
# El queue se reinicia mientras web y watch siguen activos
```

Esto es invaluable cuando cambias código que afecta solo a ciertos servicios.

### Caso Práctico: Desarrollo con WebSockets

Imagina que desarrollas con WebSockets en tiempo real. Tu `Procfile` podría ser:

```procfile
web: php artisan serve
queue: php artisan queue:work
websocket: php artisan reverb:start
watch: npm run dev
```

Con multiplex, monitoreas los cuatro simultáneamente. Si necesitas debuggear conexiones WebSocket:

1. Selecciona la pestaña `websocket`
2. Presiona `/` y busca "connected"
3. Ves exactamente cuándo se conectan los clientes
4. Si la conexión falla, reinicia el servicio con `r` sin afectar el servidor web

### Mejoras en Timestamps y Logs

Cada línea incluye automáticamente timestamp en formato ISO 8601:

```
[2025-08-14 10:23:45] Evento importante
[2025-08-14 10:23:46] Otro evento
```

Esto permite correlacionar eventos entre procesos. Por ejemplo, si una cola procesa un job exactamente cuando el servidor registra un error, puedes verlo a simple vista.

### Integración con Testing

Mientras ejecutas `artisan dev`, puedes abrir otra terminal para ejecutar tests:

```bash
# Terminal adicional (no dentro de multiplex)
php artisan test

# O con watch
php artisan test --watch
```

La interfaz de multiplex no interfiere con otros comandos Artisan.

### Exportar Logs de Procesos

Para guardar los logs de una sesión completa:

```bash
# Dentro de multiplex, selecciona una pestaña
# Presiona shift+c para copiar todo el contenido visible
# Luego pégalo en un archivo

# O configura logging en tu Procfile
web: php artisan serve > storage/logs/web.log 2>&1
```

### Comparación: Antes vs Después

**Antes de Laravel 13.25:**

```bash
# Terminal 1
php artisan serve

# Terminal 2
php artisan queue:work

# Terminal 3
npm run dev

# Terminal 4
php artisan schedule:work
# ✗ Caótico, difícil de ver todo
# ✗ Sin forma integrada de buscar
# ✗ Reiniciar un proceso requiere parar y ejecutar manualmente
```

**Con Laravel 13.25:**

```bash
php artisan dev
# ✓ Todo en una interfaz
# ✓ Búsqueda integrada
# ✓ Reinicio individual con una tecla
# ✓ Timestamps automáticos
# ✓ Sincronización de procesos garantizada
```

### Troubleshooting Común

**Problema: Multiplex no aparece**

Verifica que tengas `@laravel/multiplex` instalado:

```bash
npm list @laravel/multiplex
```

Si falta, instálalo:

```bash
npm install @laravel/multiplex --save-dev
```

**Problema: Un proceso se congela**

Selecciona la pestaña del proceso y presiona `r` para reiniciar sin detener todo.

**Problema: Puertos ocupados**

Modifica tu `Procfile` para usar puertos distintos:

```procfile
web: php artisan serve --port=8001
queue: php artisan queue:work
```

### Conclusión

Laravel 13.25 simplifica significativamente el flujo de desarrollo moderno. La interfaz tabular de multiplex elimina la necesidad de tmux, screenrc complicados o múltiples ventanas de terminal. Es especialmente valiosa en proyectos con muchos servicios concurrentes: puedes monitorear, buscar y reiniciar procesos individuales sin fricción.

Si aún usas Laravel 12 o versiones anteriores, actualizar a 13.25 por esta característica sola merece la pena. Para equipos que trabajan con arquitecturas complejas o microservicios locales, multiplex se convierte en una herramienta imprescindible del día a día.

## Puntos clave

- **artisan dev en Laravel 13.25** ejecuta procesos en una interfaz tabular moderna usando @laravel/multiplex
- **Procfile** define qué servicios ejecutar con formato simple `nombre: comando`
- **Búsqueda integrada** (tecla `/`) permite encontrar líneas específicas en logs sin herramientas externas
- **Reinicio individual** (tecla `r`) detiene un proceso específico sin afectar los otros
- **Timestamps automáticos** en cada línea facilitan correlacionar eventos entre procesos
- **Navegación con Tab/flechas** entre pestaña de forma fluida
- **Ideal para proyectos complejos** con queue, websockets, compilación de assets y scheduler simultáneos
- **Sin configuración adicional** requerida en nuevos proyectos Laravel 13.25
- **Mucho más intuitivo** que tmux o múltiples terminales manuales
- **Acelera debugging** permitiendo ver todo en un solo lugar con búsqueda y filtrado