import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import EnvConfig from '../../configs/env.config';
import logger from '../../configs/logger.config';

export class AuthService {
  static async register(username: string, password: string, role: 'admin' | 'user' = 'user') {
    const existingUser = await UserModel.findOne({ username });
    if (existingUser) {
      throw new Error('Username already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new UserModel({ username, password: hashedPassword, role });
    await user.save();

    return user;
  }

  static async login(username: string, password: string) {
    const user = await UserModel.findOne({ username });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      EnvConfig.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return { token, user };
  }

  static async verifyToken(token: string) {
    try {
      return jwt.verify(token, EnvConfig.JWT_SECRET);
    } catch (error: any) {
      // Log el error pero con nivel info para tokens inválidos comunes
      if (error?.name === 'JsonWebTokenError' || error?.message?.includes('malformed')) {
        logger.error(error.message);
      } else {
        logger.error('Token verification failed:', error);
      }
      return null;
    }
  }

  /**
   * Cambiar contraseña de un usuario
   */
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Validar nueva contraseña
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    logger.info(`Password changed for user: ${user.username}`);
    return user;
  }

  /**
   * Cambiar contraseña de un usuario por admin (sin verificar contraseña actual)
   */
  static async changePasswordByAdmin(userId: string, newPassword: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validar nueva contraseña
    if (newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    // Hashear nueva contraseña
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    logger.info(`Password changed by admin for user: ${user.username}`);
    return user;
  }

  /**
   * Actualizar nombre de usuario (admin only)
   */
  static async updateUsername(userId: string, newUsername: string) {
    // Verificar que el nuevo nombre de usuario no exista
    const existingUser = await UserModel.findOne({ username: newUsername });
    if (existingUser && existingUser._id.toString() !== userId) {
      throw new Error('Username already exists');
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validar nuevo nombre de usuario
    if (!newUsername || newUsername.trim().length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    const oldUsername = user.username;
    user.username = newUsername.trim();
    await user.save();

    logger.info(`Username changed by admin from ${oldUsername} to ${newUsername}`);
    return user;
  }

  /**
   * Eliminar usuario (admin only)
   */
  static async deleteUser(userId: string) {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verificar que no sea el único admin
    if (user.role === 'admin') {
      const adminCount = await UserModel.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last admin user');
      }
    }

    await UserModel.findByIdAndDelete(userId);
    logger.info(`User deleted: ${user.username}`);
    return user;
  }
}