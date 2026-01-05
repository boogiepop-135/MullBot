# 🔐 Credenciales de Acceso - MullBot

## 👤 Usuario Administrador

**Por defecto se crea un usuario admin con las siguientes credenciales:**

- **Usuario:** `admin`
- **Contraseña:** `admin123`

⚠️ **IMPORTANTE:** Cambia la contraseña después del primer inicio de sesión por seguridad.

## 🔧 Personalizar Credenciales

Puedes personalizar las credenciales agregando estas variables a tu archivo `.env`:

```env
ADMIN_USERNAME=tu_usuario
ADMIN_PASSWORD=tu_contraseña_segura
```

## 🌐 Acceso a la Aplicación

### Local
- **Panel de Administración:** http://localhost:3000/admin
- **Login:** http://localhost:3000/admin/login

### Ngrok (Túnel Público)
Una vez que ngrok esté corriendo, obtén la URL pública en:
- **Dashboard de Ngrok:** http://localhost:4040
- La URL pública aparecerá en los logs de ngrok

## 📝 Notas

- El usuario admin se crea automáticamente al iniciar el contenedor
- Si el usuario ya existe, no se sobrescribe
- Las credenciales se pueden cambiar desde el panel de administración
