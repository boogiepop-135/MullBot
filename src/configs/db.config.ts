import prisma from '../database/prisma';
import EnvConfig from './env.config';
import logger from './logger.config';

export async function connectDB() {
  try {
    if (!EnvConfig.DATABASE_URL) {
      throw new Error('DATABASE_URL is not defined in environment variables');
    }

    // Probar la conexión ejecutando una query simple
    await prisma.$connect();
    logger.info('✅ Connected to PostgreSQL via Prisma');
    
    // Verificar que las tablas existan ejecutando un query simple
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection verified');
  } catch (error) {
    logger.error('❌ PostgreSQL connection error:', error);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from PostgreSQL');
  } catch (error) {
    logger.error('Error disconnecting from PostgreSQL:', error);
  }
}