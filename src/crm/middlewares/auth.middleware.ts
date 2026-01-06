import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../utils/auth.util';
import logger from '../../configs/logger.config';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Intentar obtener el token de múltiples formas
    const authHeader = req.header('Authorization') || req.get('Authorization') || req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Access Token Required' });
    }

    // Extraer el token (puede venir como "Bearer <token>" o solo "<token>")
    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token || token.trim() === '') {
      return res.status(401).json({ error: 'Access Token Required' });
    }

    const decoded = await AuthService.verifyToken(token.trim());
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = decoded;
    next();
  } catch (error: any) {
    // Manejar errores de JWT específicamente
    if (error?.message?.includes('jwt') || error?.name === 'JsonWebTokenError') {
      logger.error('JWT error:', error.message);
      return res.status(401).json({ error: 'Invalid or malformed token' });
    }
    logger.error('Authentication error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
  // El rol viene del JWT como 'ADMIN' o 'USER' (enum de Prisma)
  if (req.user.role !== 'ADMIN' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};