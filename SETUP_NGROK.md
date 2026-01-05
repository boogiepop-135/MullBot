# 🌐 Configuración de Ngrok

## 📋 Requisitos

Para usar ngrok necesitas:

1. **Cuenta de Ngrok** (gratuita): https://dashboard.ngrok.com/signup
2. **Auth Token**: Obtén tu token en https://dashboard.ngrok.com/get-started/your-authtoken

## 🔧 Configuración

### Paso 1: Obtener tu Auth Token de Ngrok

1. Ve a https://dashboard.ngrok.com/get-started/your-authtoken
2. Copia tu authtoken

### Paso 2: Agregar el token al archivo `.env`

Agrega esta línea a tu archivo `.env`:

```env
NGROK_AUTHTOKEN=tu_auth_token_aqui
```

### Paso 3: Reiniciar los servicios

```bash
docker compose down
docker compose up -d --build
```

## 🌍 Acceso

Una vez que ngrok esté corriendo:

- **Dashboard de Ngrok:** http://localhost:4040
- **URL Pública:** Aparecerá en el dashboard de ngrok (ejemplo: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`)

## 📝 Notas

- La URL pública de ngrok cambia cada vez que reinicias el servicio (a menos que uses un plan de pago)
- El dashboard de ngrok muestra todas las peticiones HTTP que pasan por el túnel
- La URL pública se puede usar para acceder a tu aplicación desde cualquier lugar

## 🔒 Seguridad

⚠️ **Importante:** La URL pública de ngrok es accesible desde internet. Asegúrate de:
- Cambiar las contraseñas por defecto
- Usar HTTPS (ngrok lo habilita por defecto)
- No exponer información sensible sin autenticación adecuada
