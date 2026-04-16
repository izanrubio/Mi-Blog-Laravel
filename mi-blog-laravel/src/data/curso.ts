export type Leccion = {
  slug: string;
  title: string;
  duracion: string;
};

export type Modulo = {
  slug: string;
  number: number;
  title: string;
  description: string;
  icon: string;
  lecciones: Leccion[];
};

export const cursoData: Modulo[] = [
  {
    slug: 'modulo-1',
    number: 1,
    title: 'Introducción y primeros pasos',
    description: 'Instala Laravel y crea tu primera aplicación desde cero.',
    icon: '🚀',
    lecciones: [
      { slug: 'leccion-1', title: '¿Qué es Laravel y por qué usarlo?', duracion: '10 min' },
      { slug: 'leccion-2', title: 'Instalación en Windows, Mac y Linux', duracion: '20 min' },
      { slug: 'leccion-3', title: 'Estructura de carpetas explicada', duracion: '15 min' },
      { slug: 'leccion-4', title: 'El archivo .env — configuración básica', duracion: '12 min' },
      { slug: 'leccion-5', title: 'Artisan CLI — tu mejor amigo', duracion: '15 min' },
      { slug: 'leccion-6', title: 'Tu primera ruta y respuesta', duracion: '20 min' },
    ],
  },
  {
    slug: 'modulo-2',
    number: 2,
    title: 'Vistas y Blade',
    description: 'Aprende a crear vistas dinámicas con el motor de plantillas Blade.',
    icon: '🗡️',
    lecciones: [
      { slug: 'leccion-1', title: 'Introducción a las vistas en Laravel', duracion: '12 min' },
      { slug: 'leccion-2', title: 'Blade: el motor de plantillas', duracion: '20 min' },
      { slug: 'leccion-3', title: 'Layouts y componentes Blade', duracion: '18 min' },
      { slug: 'leccion-4', title: 'Pasar datos a las vistas', duracion: '15 min' },
      { slug: 'leccion-5', title: 'Directivas Blade más usadas', duracion: '20 min' },
    ],
  },
  {
    slug: 'modulo-3',
    number: 3,
    title: 'Base de datos con Eloquent',
    description: 'Maneja tu base de datos con migraciones y el ORM Eloquent.',
    icon: '💎',
    lecciones: [
      { slug: 'leccion-1', title: 'Configurar la base de datos', duracion: '12 min' },
      { slug: 'leccion-2', title: 'Migraciones — crear y modificar tablas', duracion: '20 min' },
      { slug: 'leccion-3', title: 'Seeders y Factories — datos de prueba', duracion: '18 min' },
      { slug: 'leccion-4', title: 'Eloquent ORM básico — CRUD completo', duracion: '25 min' },
      { slug: 'leccion-5', title: 'Relaciones entre modelos', duracion: '25 min' },
      { slug: 'leccion-6', title: 'Query Builder vs Eloquent', duracion: '20 min' },
    ],
  },
  {
    slug: 'modulo-4',
    number: 4,
    title: 'Controladores y rutas',
    description: 'Estructura tu aplicación con controladores, rutas avanzadas y middlewares.',
    icon: '🎮',
    lecciones: [
      { slug: 'leccion-1', title: 'Controladores — qué son y cómo crearlos', duracion: '15 min' },
      { slug: 'leccion-2', title: 'Resource Controllers', duracion: '20 min' },
      { slug: 'leccion-3', title: 'Rutas avanzadas — grupos, prefijos, nombres', duracion: '18 min' },
      { slug: 'leccion-4', title: 'Middlewares — proteger rutas', duracion: '20 min' },
      { slug: 'leccion-5', title: 'Validación de formularios', duracion: '20 min' },
      { slug: 'leccion-6', title: 'Autenticación con Laravel Breeze', duracion: '25 min' },
    ],
  },
  {
    slug: 'modulo-5',
    number: 5,
    title: 'Laravel profesional',
    description: 'Lleva tu aplicación al siguiente nivel con APIs, queues, caché y testing.',
    icon: '⭐',
    lecciones: [
      { slug: 'leccion-1', title: 'API REST con Laravel', duracion: '25 min' },
      { slug: 'leccion-2', title: 'API Resources — formatear respuestas JSON', duracion: '20 min' },
      { slug: 'leccion-3', title: 'Jobs y Queues — tareas en segundo plano', duracion: '25 min' },
      { slug: 'leccion-4', title: 'Caché — mejorar el rendimiento', duracion: '20 min' },
      { slug: 'leccion-5', title: 'Testing básico en Laravel', duracion: '25 min' },
      { slug: 'leccion-6', title: 'Despliegue en producción', duracion: '30 min' },
    ],
  },
];

export const totalLecciones = cursoData.reduce((acc, m) => acc + m.lecciones.length, 0);
