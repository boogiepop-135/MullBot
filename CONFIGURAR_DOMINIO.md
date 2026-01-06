# 🌐 Configuración de Dominio Propio

Si tienes tu propio dominio y no necesitas usar Ngrok, sigue estos pasos:

## 📋 Configuración

### 1. Agregar variable de entorno PUBLIC_URL

En tu archivo `.env` o en las variables de entorno de Docker, agrega:

```env
PUBLIC_URL=https://tu-dominio.com
```

**Ejemplo:**
```env
PUBLIC_URL=https://mullbot.tudominio.com
```

### 2. Configurar en docker-compose.yml

Si usas `docker-compose.yml`, agrega la variable en el servicio `app`:

```yaml
services:
  app:
    environment:
      PUBLIC_URL: ${PUBLIC_URL:-}
      # ... otras variables
```

Ya está configurado por defecto, solo necesitas agregar `PUBLIC_URL` a tu archivo `.env`.

### 3. Configurar DNS y Proxy Reverso

#### Opción A: Nginx como Proxy Reverso (Recomendado)

1. Instala Nginx:
```bash
sudo apt update
sudo apt install nginx
```

2. Crea configuración para tu dominio:
```bash
sudo nano /etc/nginx/sites-available/mullbot
```

3. Agrega esta configuración:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

4. Habilita el sitio:
```bash
sudo ln -s /etc/nginx/sites-available/mullbot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

5. Configura SSL con Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

#### Opción B: Caddy (Más simple, SSL automático)

1. Instala Caddy:
```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

2. Crea archivo de configuración:
```bash
sudo nano /etc/caddy/Caddyfile
```

3. Agrega:
```
tu-dominio.com {
    reverse_proxy localhost:3001
}
```

4. Reinicia Caddy:
```bash
sudo systemctl restart caddy
```

### 4. Configurar DNS

En tu proveedor de DNS, agrega un registro A apuntando a la IP de tu servidor:

```
Tipo: A
Nombre: @ (o subdominio como mullbot)
Valor: IP_DE_TU_SERVIDOR
TTL: 3600
```

### 5. Reiniciar servicios

```bash
# Si usas docker-compose
docker compose down
docker compose up -d --build

# Verificar que esté funcionando
docker compose logs -f app
```

## ✅ Verificación

1. **Verificar que la app responde:**
   ```bash
   curl http://localhost:3001/admin/login
   ```

2. **Verificar que el proxy funciona:**
   ```bash
   curl https://tu-dominio.com/admin/login
   ```

3. **Verificar SSL:**
   Visita: https://www.ssllabs.com/ssltest/analyze.html?d=tu-dominio.com

## 📱 Notificaciones al Admin

Cuando configures `PUBLIC_URL`, el bot automáticamente enviará tu dominio propio al administrador en lugar de la URL de Ngrok cuando se conecte por WhatsApp.

El mensaje mostrará:
```
🌍 Pública: https://tu-dominio.com/admin
```

En lugar de:
```
🌍 Pública (Ngrok): https://xxxx.ngrok-free.app/admin
```

## 🔒 Seguridad

- ✅ Usa HTTPS (SSL/TLS) siempre
- ✅ Cambia las contraseñas por defecto
- ✅ Configura firewall (ufw) para permitir solo puertos necesarios
- ✅ Mantén el sistema actualizado

## 🚫 Desactivar Ngrok

El servicio de Ngrok ya está comentado en `docker-compose.yml` por defecto. Si no lo necesitas, simplemente no lo descomentes y no configures `NGROK_AUTHTOKEN`.

## 📚 Recursos

- [Nginx Reverse Proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Caddy Documentation](https://caddyserver.com/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
