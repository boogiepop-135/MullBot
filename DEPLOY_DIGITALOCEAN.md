# 🚀 Deploy en Digital Ocean

## 📋 Checklist Pre-Deploy

### 1. Limpiar Proyecto Local
```bash
./cleanup.sh
```

### 2. Verificar Archivos Críticos
Asegúrate de tener:
- ✅ `.env` con todas las variables necesarias
- ✅ `ngrok.yml` configurado (si usas ngrok)
- ✅ `docker-compose.yml` actualizado

### 3. Construir Imagen Localmente (Opcional)
```bash
docker build -t mullbot:latest .
```

## 🐳 Opciones de Deploy

### Opción 1: Docker en Droplet (Recomendado)

#### 1. Crear Droplet en Digital Ocean
- **Imagen**: Ubuntu 22.04 LTS
- **Plan**: Al menos 2GB RAM (recomendado 4GB para Chromium)
- **Región**: La más cercana a tus usuarios

#### 2. Conectar al Droplet
```bash
ssh root@tu_droplet_ip
```

#### 3. Instalar Docker
```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose
apt install docker-compose -y

# Verificar instalación
docker --version
docker compose version
```

#### 4. Clonar Repositorio
```bash
# Instalar git si no está
apt install git -y

# Clonar tu repositorio
git clone https://github.com/tu-usuario/MullBot.git
cd MullBot
```

#### 5. Configurar Variables de Entorno
```bash
# Crear archivo .env
nano .env

# Agregar todas las variables necesarias:
GEMINI_API_KEY=tu_key
JWT_SECRET=tu_secret
MONGODB_URI=mongodb://...
NGROK_AUTHTOKEN=tu_token
ADMIN_USERNAME=admin
ADMIN_PASSWORD=tu_password_seguro
```

#### 6. Levantar Servicios
```bash
# Construir y levantar
docker compose up -d --build

# Ver logs
docker compose logs -f
```

#### 7. Configurar Firewall
```bash
# Permitir puertos necesarios
ufw allow 22/tcp    # SSH
ufw allow 3000/tcp  # App
ufw allow 4040/tcp  # Ngrok dashboard (opcional)
ufw enable
```

### Opción 2: Digital Ocean App Platform

#### 1. Preparar Repositorio
- Asegúrate de que el código esté en GitHub/GitLab
- El `Dockerfile` debe estar en la raíz

#### 2. Crear App en Digital Ocean
1. Ve a App Platform
2. Selecciona "GitHub" como fuente
3. Selecciona tu repositorio
4. Digital Ocean detectará el Dockerfile automáticamente

#### 3. Configurar Variables de Entorno
En la configuración de la app, agrega:
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `MONGODB_URI` (o usa la base de datos de DO)
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `NGROK_API_HOST=ngrok` (si usas ngrok)

#### 4. Configurar Base de Datos
- Opción A: Usar MongoDB de Digital Ocean (recomendado)
- Opción B: Usar MongoDB Atlas (gratis)
- Opción C: Contenedor MongoDB en el mismo droplet

## 🔧 Configuración Recomendada

### MongoDB en Digital Ocean
```yaml
# En docker-compose.yml, usa la base de datos de DO
MONGODB_URI: mongodb://usuario:password@host:27017/mullbot?authSource=admin
```

### Ngrok (Opcional)
Si necesitas ngrok, puedes:
1. Usar el servicio de ngrok en el droplet
2. O configurar un dominio en Digital Ocean

### Dominio Personalizado
1. Configura DNS en Digital Ocean
2. Apunta a tu droplet IP
3. Configura Nginx como reverse proxy (opcional)

## 📊 Monitoreo

### Ver Logs
```bash
# Logs de la app
docker compose logs -f app

# Logs de todos los servicios
docker compose logs -f
```

### Ver Estado
```bash
# Estado de contenedores
docker compose ps

# Uso de recursos
docker stats
```

## 🔒 Seguridad

### 1. Cambiar Contraseñas por Defecto
```bash
# Cambiar contraseña de admin
# Usa el panel de administración o:
docker compose exec app node dist/scripts/create-admin-auto.js
```

### 2. Configurar Firewall
```bash
# Solo permitir puertos necesarios
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable
```

### 3. Actualizar Sistema Regularmente
```bash
apt update && apt upgrade -y
```

## 💰 Optimización de Costos

### Reducir Tamaño de Droplet
- Usa el plan más pequeño que funcione (2GB RAM mínimo)
- Monitorea el uso de recursos

### Optimizar Imagen Docker
- Ya está optimizado con multi-stage build
- Considera usar Docker layer caching

### Base de Datos
- Usa MongoDB Atlas (tier gratuito disponible)
- O usa la base de datos de Digital Ocean

## 🐛 Troubleshooting

### Error: Out of Memory
```bash
# Aumentar swap
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

### Error: Puerto en Uso
```bash
# Ver qué está usando el puerto
lsof -i :3000
# Matar proceso si es necesario
kill -9 PID
```

### Error: Docker Build Falla
```bash
# Limpiar y reconstruir
docker compose down
docker system prune -a
docker compose up -d --build
```

## 📝 Notas Finales

- **Espacio en disco**: La imagen Docker es ~3.2GB, asegúrate de tener al menos 10GB libres
- **RAM**: Chromium necesita al menos 2GB RAM
- **Backup**: Configura backups regulares de MongoDB
- **Updates**: Mantén el sistema actualizado

## ✅ Checklist Post-Deploy

- [ ] Servicios corriendo (`docker compose ps`)
- [ ] App accesible (http://tu_ip:3000/admin)
- [ ] MongoDB conectado
- [ ] WhatsApp QR escaneado
- [ ] Admin configurado
- [ ] Firewall configurado
- [ ] Backups configurados
