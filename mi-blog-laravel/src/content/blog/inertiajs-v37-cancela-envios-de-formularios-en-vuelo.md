---
title: 'Inertia.js v3.7: Cancela Envíos de Formularios en Vuelo'
description: 'Domina la cancelación de requests en Inertia.js v3.7 con cancelOnUnmount y el método cancel. Controla formularios dinámicos sin comportamientos inesperados.'
pubDate: '2025-01-15'
tags: ['laravel', 'inertia', 'javascript', 'formularios']
---

## Inertia.js v3.7: Cancela Envíos de Formularios en Vuelo

La versión 3.7 de Inertia.js trae una mejora significativa para desarrolladores que trabajan con formularios dinámicos: la capacidad de **cancelar requests en vuelo** antes de que se completen. En este artículo, exploraremos cómo esta funcionalidad resuelve problemas reales en aplicaciones modernas y cómo implementarla correctamente en tus proyectos Laravel con Inertia.

### Por qué cancalar formularios importa

En aplicaciones web reales, los usuarios no siempre esperan a que un formulario termine de enviarse. Pueden cambiar de página, cerrar el navegador o enviar múltiples veces el mismo formulario por accidente. Sin control adecuado, esto genera:

- **Requests duplicadas** que crean datos inconsistentes
- **Comportamientos inesperados** cuando un usuario navega antes de completar el envío
- **Experiencia de usuario pobre** sin feedback visual adecuado
- **Carga innecesaria** en tu servidor

Inertia.js v3.7 resuelve esto de forma elegante con dos nuevas funcionalidades: `cancelOnUnmount` y el método `cancel()`.

### Entendiendo cancelOnUnmount

La propiedad `cancelOnUnmount` automáticamente **cancela cualquier request en vuelo cuando el componente se desmonta**. Esto es especialmente útil cuando tienes navegación rápida entre páginas.

```javascript
// resources/js/Pages/Users/Create.jsx
import { useForm } from '@inertiajs/react';

export default function CreateUser() {
  const { data, setData, post, processing } = useForm({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    // Con cancelOnUnmount: true, si el usuario navega,
    // la request se cancela automáticamente
    post('/users', {
      cancelOnUnmount: true,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={data.name}
        onChange={(e) => setData('name', e.target.value)}
        placeholder="Nombre"
      />
      <input
        value={data.email}
        onChange={(e) => setData('email', e.target.value)}
        placeholder="Email"
      />
      <button disabled={processing}>
        {processing ? 'Guardando...' : 'Guardar Usuario'}
      </button>
    </form>
  );
}
```

Esta opción es especialmente útil en formularios largos donde el usuario podría navegar antes de completar el envío. Sin `cancelOnUnmount`, la request continuaría en segundo plano, posiblemente creando datos duplicados.

### Usando el método cancel() explícitamente

A veces necesitas más control sobre cuándo cancelar. El nuevo método `cancel()` te permite cancelar requests de forma programática.

```javascript
// resources/js/Pages/Products/Edit.jsx
import { useForm } from '@inertiajs/react';
import { useEffect } from 'react';

export default function EditProduct({ product }) {
  const { data, setData, put, processing, cancel } = useForm({
    name: product.name,
    price: product.price,
    description: product.description,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    put(`/products/${product.id}`);
  };

  const handleCancel = () => {
    // Cancela la request si está en vuelo
    cancel();
    // Opcionalmente, resetea el formulario
    setData({
      name: product.name,
      price: product.price,
      description: product.description,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={data.name}
        onChange={(e) => setData('name', e.target.value)}
      />
      <input
        value={data.price}
        onChange={(e) => setData('price', e.target.value)}
        type="number"
        step="0.01"
      />
      <textarea
        value={data.description}
        onChange={(e) => setData('description', e.target.value)}
      />
      <button disabled={processing}>
        {processing ? 'Actualizando...' : 'Actualizar'}
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={!processing}
      >
        Cancelar
      </button>
    </form>
  );
}
```

En este ejemplo, el usuario puede hacer clic en "Cancelar" para detener el envío en cualquier momento, incluso mostrando un botón deshabilitado si no hay una request en vuelo.

### Caso práctico: Formulario con auto-guardado

Imagina un formulario que se auto-guarda mientras el usuario escribe. Sin cancelación, podrías tener múltiples requests en conflicto.

```javascript
// resources/js/Pages/Documents/Edit.jsx
import { useForm } from '@inertiajs/react';
import { useEffect, useRef } from 'react';

export default function EditDocument({ document }) {
  const { data, setData, patch, processing, cancel, errors } = useForm({
    title: document.title,
    content: document.content,
  });

  const timeoutRef = useRef(null);
  const requestRef = useRef(null);

  const autoSave = (newData) => {
    // Cancela el auto-guardado anterior si está en vuelo
    if (requestRef.current) {
      cancel();
    }

    // Limpia el timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Espera 2 segundos sin cambios antes de guardar
    timeoutRef.current = setTimeout(() => {
      requestRef.current = patch(`/documents/${document.id}`, {
        cancelOnUnmount: true,
      });
    }, 2000);
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setData('content', newContent);
    autoSave({ content: newContent });
  };

  useEffect(() => {
    // Limpia los timeouts y cancela requests al desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (requestRef.current) {
        cancel();
      }
    };
  }, [cancel]);

  return (
    <div>
      <input
        value={data.title}
        onChange={(e) => setData('title', e.target.value)}
        placeholder="Título"
      />
      <textarea
        value={data.content}
        onChange={handleContentChange}
        placeholder="Contenido del documento"
        rows={10}
      />
      {processing && <span>Auto-guardando...</span>}
      {errors.content && <p className="error">{errors.content}</p>}
    </div>
  );
}
```

Este patrón es común en editores de documentos, notas o dashboards colaborativos donde necesitas guardar cambios sin interferir con el usuario.

### Polling con estado en usePoll

Inertia.js v3.7 también añade soporte para **polling state** desde el hook `usePoll`, permitiéndote monitorear el estado de encuestas periódicas.

```javascript
// resources/js/Pages/Orders/Show.jsx
import { usePoll } from '@inertiajs/react';

export default function ShowOrder({ order }) {
  const { data: orderData } = usePoll(
    // URL a llamar
    `/api/orders/${order.id}`,
    {
      // Intervalo en milisegundos
      interval: 5000, // 5 segundos
    }
  );

  return (
    <div>
      <h1>Pedido #{orderData.id}</h1>
      <p>Estado: <strong>{orderData.status}</strong></p>
      <p>Total: ${orderData.total}</p>
      {orderData.status === 'processing' && (
        <p>Tu pedido se está procesando...</p>
      )}
    </div>
  );
}
```

### Props que persisten en instant visits

Una característica relacionada es que ahora puedes marcar props para que **persistan en instant visits** (navegación sin recargar la página). Esto es útil para datos que no cambian entre páginas.

```javascript
// En tu controlador Laravel
return inertia('Dashboard', [
    'user' => auth()->user(),
    'stats' => [
        'total_users' => User::count(),
        'total_revenue' => Order::sum('total'),
    ],
], [
    'props' => [
        'user' => ['persist' => 'localStorage'],
    ]
]);
```

### Buenas prácticas

1. **Siempre usa `cancelOnUnmount`** en formularios que podrían ser abandonados
2. **Combina `cancel()` con feedback visual** para que el usuario sepa qué está pasando
3. **Maneja errores de cancelación** en tu middleware de errores
4. **Limpia timeouts y referencias** en `useEffect` cleanup functions
5. **Prueba la cancelación** antes de navegar en tests de integración

### Manejo de errores en cancelación

Es importante que manejes correctamente los errores cuando se cancela:

```javascript
import { useForm } from '@inertiajs/react';

export default function MyForm() {
  const form = useForm({
    email: '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    form.post('/subscribe', {
      onError: (errors) => {
        // Se ejecuta solo si hay errores de validación
        console.error('Validation errors:', errors);
      },
      onCancel: () => {
        // Se ejecuta cuando la request es cancelada
        console.log('Request was cancelled');
      },
      onSuccess: () => {
        console.log('Successfully subscribed!');
      },
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={form.data.email}
        onChange={(e) => form.setData('email', e.target.value)}
        type="email"
      />
      <button disabled={form.processing}>Suscribirse</button>
    </form>
  );
}
```

## Conclusión

La versión 3.7 de Inertia.js proporciona herramientas robustas para manejar formularios dinámicos con elegancia. `cancelOnUnmount` automatiza el manejo de cambios de página, mientras que el método `cancel()` te da control explícito cuando lo necesitas.

Estas mejoras son especialmente valiosas en aplicaciones modernas donde la navegación rápida y el auto-guardado son comunes. Implementarlas correctamente mejora tanto la experiencia del usuario como la estabilidad de tu aplicación.

### Puntos clave

- `cancelOnUnmount: true` cancela requests automáticamente cuando el componente se desmonta
- El método `cancel()` te permite cancelar requests de forma programática
- Combina cancelación con debouncing para auto-guardado eficiente
- Siempre limpia timeouts y referencias en cleanup functions
- Maneja errores de cancelación separadamente en callbacks
- Usa polling state para monitorear cambios periódicamente
- Las props persistentes en instant visits reducen re-renders innecesarios
- Prueba la cancelación antes de navegar en tus tests de integración