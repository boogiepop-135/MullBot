import { connectDB } from "../configs/db.config";
import logger from "../configs/logger.config";
import { AuthService } from "../crm/utils/auth.util";
import prisma from "../database/prisma";

async function createAdminAuto() {
    try {
        await connectDB();
        
        // Credenciales por defecto
        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        
        // Verificar si el usuario ya existe
        const existingUser = await prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            // Si el usuario existe pero NO es admin, actualizar el rol
            if (existingUser.role !== 'ADMIN') {
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { role: 'ADMIN' }
                });
                logger.info(`Admin user role updated: ${username}`);
                console.log(`✅ Admin user role updated to ADMIN: ${username}`);
                console.log(`   Username: ${username}`);
                console.log(`   Password: ${password}`);
                console.log(`   Role: ADMIN (actualizado)`);
            } else {
                logger.info(`Admin user already exists with ADMIN role: ${username}`);
                console.log(`✅ Admin user already exists: ${username}`);
                console.log(`   Username: ${username}`);
                console.log(`   Password: ${password}`);
                console.log(`   Role: ADMIN`);
            }
            await prisma.$disconnect();
            process.exit(0);
        }
        
        // Crear el usuario admin
        const user = await AuthService.register(username, password, 'admin');
        logger.info(`Admin user created successfully: ${username}`);
        console.log(`✅ Admin user created successfully!`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`   Role: ADMIN`);
        console.log(`\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión`);
        
    } catch (error: any) {
        logger.error('Failed to create admin user:', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        process.exit(0);
    }
}

createAdminAuto();

