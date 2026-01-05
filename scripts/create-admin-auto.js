// Script compilado manualmente para crear admin automáticamente
const { connectDB } = require("../configs/db.config");
const logger = require("../configs/logger.config").default;
const { AuthService } = require("../crm/utils/auth.util");
const { UserModel } = require("../crm/models/user.model");

async function createAdminAuto() {
    try {
        await connectDB();
        
        // Credenciales por defecto
        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        
        // Verificar si el usuario ya existe
        const existingUser = await UserModel.findOne({ username });
        if (existingUser) {
            logger.info(`Admin user already exists: ${username}`);
            console.log(`✅ Admin user already exists: ${username}`);
            console.log(`   Username: ${username}`);
            console.log(`   Password: ${password}`);
            process.exit(0);
            return;
        }
        
        // Crear el usuario admin
        const user = await AuthService.register(username, password, 'admin');
        logger.info(`Admin user created successfully: ${username}`);
        console.log(`✅ Admin user created successfully!`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`   Role: admin`);
        console.log(`\n⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión`);
        
    } catch (error) {
        logger.error('Failed to create admin user:', error);
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

createAdminAuto();
