---
title: 'Vite+ en Laravel: Herramientas Unificadas para Web'
description: 'Descubre Vite+ en Laravel: una única herramienta de linting y formatting para React, Vue, Svelte y Livewire sin configuración compleja.'
pubDate: '2025-01-15'
tags: ['laravel', 'vite', 'frontend', 'herramientas']
---

## Vite+ en Laravel: Herramientas Unificadas para Desarrollo Frontend

Los **starter kits de Laravel** acaban de experimentar una transformación significativa. A partir de ahora, todos incluyen **Vite+**, una nueva herramienta que unifica el linting y formatting del código frontend. Adiós a ESLint y Prettier configurados por separado: Vite+ proporciona un único comando `vp check` que funciona sin fricciones en React, Vue, Svelte y Livewire.

Si desarrollas con Laravel y trabajas en proyectos modernos, esta es una noticia que simplificará tu flujo de trabajo. En este artículo, exploraremos qué es Vite+, por qué representa un cambio importante, y cómo integrarlo en tus proyectos.

## ¿Qué es Vite+ y por qué importa?

Vite+ no es simplemente otro nombre para Vite. Es una evolución que añade capacidades de linting y formatting nativamente, sin necesidad de instalar y configurar múltiples herramientas.

### El problema anterior

Hasta ahora, un proyecto Laravel típico requería:

- **Vite** para bundling y desarrollo
- **ESLint** para análisis estático de código
- **Prettier** para formateo automático
- Múltiples archivos de configuración (`.eslintrc`, `.prettierrc`, `vite.config.js`)
- Scripts adicionales en `package.json` para ejecutar cada herramienta

Esta fragmentación aumentaba la complejidad del proyecto y la curva de aprendizaje para nuevos desarrolladores.

### La solución: Vite+

Vite+ consolidar todo en una única herramienta con filosofía **zero-config**. Un solo comando (`vp check`) reemplaza múltiples herramientas y proporciona:

- **Linting** automático (análisis de código)
- **Formatting** (formateo de código)
- **Soporte multiframework** (React, Vue, Svelte, Livewire)
- **Configuración minimal** (plug and play)

## Cómo instalar y configurar Vite+ en Laravel

### Instalación en proyectos nuevos

Si estás creando un nuevo proyecto Laravel con un starter kit, Vite+ ya viene incluido:

```bash
laravel new mi-proyecto --starter=breeze
cd mi-proyecto
npm install
```

Los starter kits oficiales (Breeze, Jetstream) ya incluyen Vite+ en su configuración.

### Actualizar un proyecto existente

Si tienes un proyecto existente con Vite, ESLint y Prettier, puedes migrar a Vite+:

**Paso 1: Desinstalar herramientas antiguas**

```bash
npm uninstall eslint prettier eslint-config-prettier eslint-plugin-react
npm uninstall -D @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

**Paso 2: Instalar Vite+**

```bash
npm install -D vite-plus
```

**Paso 3: Actualizar `package.json`**

Reemplaza los scripts antiguos:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "vp check",
    "format": "vp check --fix"
  }
}
```

**Paso 4: Crear archivo de configuración (opcional)**

Crea un archivo `vite.config.js` en la raíz del proyecto:

```javascript
import { defineConfig } from 'vite'
import laravel from 'laravel-vite-plugin'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    laravel({
      input: 'resources/js/app.jsx',
      refresh: true,
    }),
    react(),
  ],
})
```

## Uso en la práctica: Comandos principales

### Verificar código

```bash
npm run lint
```

Este comando analiza tu código JavaScript/TypeScript y reporta problemas:

```
resources/js/app.jsx:15:5 - error: 'useState' is defined but never used
resources/components/Button.jsx:8:2 - warning: Missing prop types
```

### Formatear automáticamente

```bash
npm run format
```

Arregla automáticamente problemas de espaciado, comillas y sintaxis:

```bash
# Antes
const nombre="Juan";const edad=  30

# Después
const nombre = "Juan";
const edad = 30;
```

### Ejecutar con opciones específicas

```bash
# Verificar solo componentes React
vp check resources/js/components/**/*.jsx

# Formatear y mostrar cambios
vp check --fix --report

# Verificar en modo strict
vp check --strict
```

## Integración con Laravel Breeze y Jetstream

### En Laravel Breeze

Breeze ahora incluye Vite+ preconfigurado para React o Vue:

```bash
laravel new mi-app --starter=breeze --stack=react
cd mi-app
npm install
npm run lint  # ¡Listo para usar!
```

### En Laravel Jetstream

Jetstream también viene con Vite+ optimizado:

```bash
laravel new mi-app --starter=jetstream --stack=livewire
cd mi-app
npm install
npm run format  # Formatea todo automáticamente
```

## Ejemplo práctico: Componente Livewire con Vite+

Imagina que tienes un componente Livewire mal formateado:

```jsx
// resources/js/components/UserCard.jsx - Código sin formato
const UserCard = ({ user }) => {
  const [isOpen,setIsOpen] = React.useState(false)
  const handleClick=()=>{setIsOpen(!isOpen)}
  
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <button onClick={handleClick}>
        {isOpen?'Cerrar':'Abrir'}
      </button>
    </div>
  )
}

export default UserCard
```

Ejecuta `npm run format`:

```jsx
// Código formateado automáticamente
const UserCard = ({ user }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="card">
      <h3>{user.name}</h3>
      <button onClick={handleClick}>
        {isOpen ? "Cerrar" : "Abrir"}
      </button>
    </div>
  );
};

export default UserCard;
```

## Integración en CI/CD

Para asegurar que todo el código cumpla estándares, añade verificación en tu pipeline de GitHub Actions:

```yaml
# .github/workflows/lint.yml
name: Lint

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run lint
```

Ahora, cualquier PR con código mal formateado fallará automáticamente.

## Soporte multiframework: React, Vue, Svelte, Livewire

### React

```javascript
// resources/js/app.jsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App'

const root = createRoot(document.getElementById('app'))
root.render(<App />)
```

Vite+ entiende JSX automáticamente.

### Vue

```vue
<!-- resources/js/components/Counter.vue -->
<template>
  <div>
    <p>{{ count }}</p>
    <button @click="increment">Incrementar</button>
  </div>
</template>

<script>
export default {
  data() {
    return {
      count: 0,
    }
  },
  methods: {
    increment() {
      this.count++
    },
  },
}
</script>
```

Vite+ valida la sintaxis Vue automáticamente.

### Livewire

```php
// app/Livewire/Counter.php
namespace App\Livewire;

use Livewire\Component;

class Counter extends Component
{
    public $count = 0;

    public function increment()
    {
        $this->count++;
    }

    public function render()
    {
        return view('livewire.counter');
    }
}
```

Vite+ también funciona con Livewire, verificando archivos JavaScript asociados.

## Configuración avanzada

### Crear configuración personalizada

Aunque Vite+ es zero-config, puedes crear `vp.config.js` para personalización:

```javascript
// vp.config.js
export default {
  extends: 'recommended',
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
  },
  ignorePatterns: ['node_modules/**', 'dist/**'],
}
```

### Ignorar archivos

Crea `.vpignore`:

```
node_modules/
dist/
resources/views/**
vendor/
```

### Configurar TypeScript

Si usas TypeScript, Vite+ lo detecta automáticamente:

```javascript
// resources/js/app.ts
import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')
```

Vite+ valida tipos automáticamente.

## Ventajas clave de Vite+

| Aspecto | Antes (ESLint + Prettier) | Ahora (Vite+) |
|--------|---------------------------|--------------|
| **Configuración** | Múltiples archivos | Una herramienta |
| **Comando** | `npm run lint && npm run format` | `npm run lint` |
| **Aprendizaje** | Curva pronunciada | Zero-config |
| **Mantenimiento** | Actualizar 2-3 dependencias | 1 dependencia |
| **Velocidad** | Más lento (múltiples pasadas) | Optimizado |

## Migración de proyectos existentes

Si tienes un proyecto antiguo sin Vite+, la migración es sencilla:

**Paso 1:** Instala Vite+
```bash
npm install -D vite-plus
```

**Paso 2:** Elimina herramientas antiguas
```bash
npm uninstall eslint prettier
```

**Paso 3:** Actualiza scripts en `package.json`
```json
{
  "scripts": {
    "lint": "vp check",
    "format": "vp check --fix"
  }
}
```

**Paso 4:** Ejecuta verificación
```bash
npm run lint
```

Eso es todo. Tu proyecto ahora usa Vite+.

## Conclusión

**Vite+** representa un paso importante en la simplificación del desarrollo frontend con Laravel. Al consolidar linting y formatting en una única herramienta, reduce la complejidad de configuración, acelera el setup de nuevos proyectos y mejora la experiencia del desarrollador.

Para cualquiera que comience un nuevo proyecto Laravel en 2025, Vite+ ya viene integrado en los starter kits. Para proyectos existentes, la migración es trivial y los beneficios inmediatos.

Si aún no lo has probado, te recomendamos actualizar tu proyecto y experimentar con `npm run lint`. La simplificación que verás hará que preguntes por qué no se hizo hace años.

## Puntos clave

- **Vite+** unifica linting y formatting en una única herramienta sin configuración compleja
- **Un comando** (`vp check`) reemplaza ESLint y Prettier por separado
- **Soporta** React, Vue, Svelte y Livewire automáticamente
- **Viene preinstalado** en todos los starter kits de Laravel (Breeze, Jetstream)
- **Migración fácil** desde proyectos existentes (desinstalar antiguas herramientas, instalar Vite+)
- **Ideal para CI/CD** en GitHub Actions y otros pipelines
- **Zero-config por defecto**, pero personalizable si lo necesitas
- **Mejora la productividad** reduciendo configuración y comandos duplicados
- **Mejor experiencia** para desarrolladores junior sin conocimiento de ESLint/Prettier
- **Futuro de Laravel** - esperaremos que se convierta en estándar en el ecosistema