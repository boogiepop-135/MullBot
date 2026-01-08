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
    version: '2.0.0',
    date: '2025-01-07',
    changes: [
      {
        type: 'new',
        description: '🤖 Sistema inteligente de gestión de modelos de IA con fallback automático entre Gemini 2.0, 1.5 Flash y 1.5 Pro'
      },
      {
        type: 'new',
        description: '📱 Autenticación por código de vinculación (Pairing Code) como alternativa al código QR - más estable y rápido'
      },
      {
        type: 'new',
        description: '🖥️ Monitor de IA en tiempo real con dashboard completo de estadísticas, alertas y métricas de rendimiento'
      },
      {
        type: 'new',
        description: '💾 Sistema de caché inteligente para respuestas frecuentes - ahorra hasta 75% de llamadas a API'
      },
      {
        type: 'new',
        description: '📊 Métricas de rendimiento por modelo: tiempo de respuesta, tasa de éxito, distribución de carga'
      },
      {
        type: 'new',
        description: '🔄 Cooldown automático de 15 minutos para modelos agotados con reactivación inteligente'
      },
      {
        type: 'new',
        description: '💰 Estimación en tiempo real de ahorro de costos por uso del caché'
      },
      {
        type: 'new',
        description: '🔔 Sistema de alertas proactivas cuando los modelos están agotados o con errores'
      },
      {
        type: 'improved',
        description: 'Auto-refresh cada 30 segundos en el monitor de IA sin perder el estado'
      },
      {
        type: 'improved',
        description: 'Exportación de estadísticas a CSV con todas las métricas de modelos'
      },
      {
        type: 'improved',
        description: 'Top queries del caché para identificar patrones de uso'
      },
      {
        type: 'security',
        description: 'Validación robusta de números de teléfono en pairing code'
      },
      {
        type: 'fixed',
        description: 'Manejo mejorado de errores 429 (Quota Exceeded) y 503 (Service Unavailable)'
      },
      {
        type: 'fixed',
        description: 'Optimización de rendimiento con caché LRU en memoria'
      }
    ]
  },
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

