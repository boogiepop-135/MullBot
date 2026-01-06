export interface VersionNote {
  version: string;
  date: string;
  changes: {
    type: 'new' | 'improved' | 'fixed' | 'security';
    description: string;
  }[];
}

export const VERSION_NOTES: VersionNote[] = [
  {
    version: '1.1.0',
    date: '2025-01-15',
    changes: [
      {
        type: 'new',
        description: 'Sistema de notas de versión con popup al iniciar sesión'
      },
      {
        type: 'improved',
        description: 'Diseño más profesional y serio del panel de administración'
      },
      {
        type: 'improved',
        description: 'Mejor estructura de código con CSS separado'
      },
      {
        type: 'fixed',
        description: 'Mejoras en la experiencia de usuario general'
      }
    ]
  },
  {
    version: '1.0.0',
    date: '2025-01-01',
    changes: [
      {
        type: 'new',
        description: 'Lanzamiento inicial de MüllBot CRM'
      },
      {
        type: 'new',
        description: 'Sistema de gestión de contactos'
      },
      {
        type: 'new',
        description: 'Campañas de mensajería masiva'
      },
      {
        type: 'new',
        description: 'Integración con WhatsApp'
      }
    ]
  }
];

export const CURRENT_VERSION = VERSION_NOTES[0].version;

