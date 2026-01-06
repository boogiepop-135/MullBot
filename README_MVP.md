# 🚀 MullBot - MVP Local Setup

## ✅ Estado del Proyecto

El proyecto está **100% funcional** y listo para ejecutarse en local con Docker.

## 🎯 Inicio Rápido (3 pasos)

### 1. Verificar que tienes Docker instalado

```bash
docker --version
docker compose version
```

### 2. Levantar los servicios

```bash
cd /home/levieduardo/Documentos/MullBot
docker compose up -d --build
```

### 3. Acceder a la aplicación

- **Panel de Administración:** http://localhost:3000/admin
- **Login:** http://localhost:3000/admin/login
- **Credenciales:** 
  - Usuario: `admin`
  - Contraseña: `admin123`

## 📋 Servicios Incluidos

| Servicio | Puerto | Estado | Descripción |
|----------|--------|--------|-------------|
| **MullBot App** | 3000 | ✅ | Aplicación principal |
| **MongoDB** | 27017 | ✅ | Base de datos |
| **Ngrok** | 4040 | ✅ | Túnel público HTTPS |

## 🔐 Credenciales por Defecto

### Usuario Administrador
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- ⚠️ **IMPORTANTE:** Cambia la contraseña después del primer login

### MongoDB
- **Usuario:** `root`
- **Contraseña:** `example`
- **Base de datos:** `mullbot`

## 🌐 URLs de Acceso

### Local
- **Panel Admin:** http://localhost:3000/admin
- **Login:** http://localhost:3000/admin/login
- **API:** http://localhost:3000/crm/

### Ngrok (Público)
- **Dashboard:** http://localhost:4040
- **URL Pública:** Revisa el dashboard de ngrok para obtener la URL HTTPS

## 📝 Variables de Entorno

Las variables están configuradas en `docker-compose.yml`. Si necesitas personalizarlas, crea un archivo `.env`:

```env
GEMINI_API_KEY=tu_api_key
JWT_SECRET=tu_jwt_secret
NGROK_AUTHTOKEN=tu_ngrok_token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## 🛠️ Comandos Útiles

### Ver logs
```bash
# Logs de la aplicación
docker compose logs -f app

# Logs de MongoDB
docker compose logs -f mongo

# Logs de Ngrok
docker compose logs -f ngrok

# Todos los logs
docker compose logs -f
```

### Gestión de servicios
```bash
# Ver estado
docker compose ps

# Detener servicios
docker compose down

# Reiniciar servicios
docker compose restart

# Reconstruir y reiniciar
docker compose up -d --build
```

### Acceder a contenedores
```bash
# Shell en la app
docker compose exec app sh

# Shell en MongoDB
docker compose exec mongo mongosh -u root -p example
```

## 🔍 Verificación de Estado

### Verificar que todo funciona

```bash
# 1. Verificar servicios
docker compose ps

# 2. Verificar logs
docker compose logs app --tail 20

# 3. Verificar acceso web
curl http://localhost:3000/admin/login

# 4. Verificar MongoDB
docker compose exec mongo mongosh -u root -p example --eval "db.adminCommand('ping')"
```

## 📱 Configuración de WhatsApp

1. La aplicación mostrará un código QR en los logs
2. Escanea el código con WhatsApp desde tu teléfono
3. Una vez autenticado, el bot estará listo para recibir mensajes

Para ver el QR code:
```bash
docker compose logs app | grep -A 20 "QR Code"
```

## 🐛 Solución de Problemas

### Los servicios no inician
```bash
# Verificar logs de error
docker compose logs

# Reconstruir sin cache
docker compose build --no-cache
docker compose up -d
```

### Error de conexión a MongoDB
```bash
# Verificar que MongoDB esté saludable
docker compose ps mongo

# Reiniciar MongoDB
docker compose restart mongo
```

### Puerto 3000 ocupado
```bash
# Ver qué está usando el puerto
lsof -i :3000

# Cambiar el puerto en docker-compose.yml
# Edita: ports: - "3001:3000" (cambia 3000 por 3001)
```

### Ngrok no funciona
```bash
# Verificar token
docker compose logs ngrok

# Verificar configuración
cat ngrok.yml
```

## 📚 Documentación Adicional

- **SETUP_DOCKER.md** - Guía detallada de Docker
- **SETUP_NGROK.md** - Configuración de Ngrok
- **CREDENCIALES.md** - Información de credenciales
- **README.md** - Documentación completa del proyecto

## ✅ Checklist MVP

- [x] Docker y Docker Compose configurados
- [x] MongoDB incluido y funcionando
- [x] Usuario admin creado automáticamente
- [x] Ngrok configurado para acceso público
- [x] Aplicación corriendo en puerto 3000
- [x] Panel de administración accesible
- [x] Documentación completa
- [x] Scripts de inicio automático

## 🎉 ¡Listo para Usar!

El proyecto está completamente funcional y listo para desarrollo local. Todos los servicios están configurados y funcionando correctamente.

Para empezar, simplemente ejecuta:
```bash
docker compose up -d
```

Y accede a http://localhost:3000/admin
