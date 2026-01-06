import { PrismaClient } from '@prisma/client';
import logger from '../configs/logger.config';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Singleton pattern para Prisma Client
// En desarrollo, evita crear múltiples instancias debido a hot-reload
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Event handlers para conexión
prisma.$on('error' as never, (e: any) => {
  logger.error('Prisma Client Error:', e);
});

export default prisma;

