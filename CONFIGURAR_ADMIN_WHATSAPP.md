# 📱 Configurar Número de Administrador en WhatsApp

## 🎯 ¿Para qué sirve?

Cuando configuras tu número de teléfono como "Agente Humano" en la configuración del bot, el sistema automáticamente:

✅ **Te envía información importante** cuando te conectas:
- URL pública de Ngrok (si está disponible)
- URL local del panel
- Credenciales de administrador
- Información del sistema

✅ **Actualiza la información** cuando reinicias el servidor (la URL de ngrok cambia)

✅ **Comando `/info`** para obtener información actualizada en cualquier momento

## 🔧 Cómo Configurar

### Paso 1: Acceder al Panel de Administración

1. Abre http://localhost:3000/admin
2. Inicia sesión con tus credenciales
3. Ve a la sección **"Configuración"** (Settings)

### Paso 2: Configurar tu Número

1. En la sección **"Configuración del Bot"**, busca:
   - **Teléfono de Agente Humano** (`humanAgentPhone`)
   - **Notificar Agente** (`notifyAgentOnAttention`)

2. Ingresa tu número de WhatsApp en formato internacional:
   ```
   Ejemplo: 521234567890
   ```
   - Sin el símbolo `+`
   - Sin espacios ni guiones
   - Incluye el código de país (52 para México)

3. Activa **"Notificar Agente"** si quieres recibir notificaciones cuando alguien solicite atención humana

4. Guarda los cambios

### Paso 3: Conectar tu WhatsApp

1. Asegúrate de que el bot esté conectado (QR escaneado)
2. Envía cualquier mensaje desde tu número configurado al bot
3. **Automáticamente recibirás** un mensaje con toda la información

## 📨 Qué Información Recibirás

Cuando te conectes, recibirás un mensaje como este:

```
🌐 Información del Sistema MullBot

📊 URLs de Acceso:
🌍 Pública (Ngrok): https://xxxx-xx-xx-xx-xx.ngrok-free.app/admin
🏠 Local: http://localhost:3000/admin

🔐 Credenciales de Administrador:
👤 Usuario: admin
🔑 Contraseña: admin123

⚠️ IMPORTANTE:
• La URL de Ngrok cambia cada vez que reinicias el servidor
• Cambia la contraseña después del primer login
• Guarda esta información de forma segura

💡 Comandos Útiles:
• /help - Ver ayuda del bot
• /estadisticas - Ver estadísticas

🔄 Para actualizar esta información, envía: /info
```

## 🔄 Actualizar Información

### Opción 1: Comando /info

Simplemente envía `/info` al bot desde tu número configurado y recibirás la información actualizada.

### Opción 2: Reiniciar Servidor

Cada vez que reinicies el servidor, si envías un mensaje al bot, recibirás automáticamente la información actualizada (si pasaron más de 24 horas desde el último envío).

## ⚙️ Configuración Avanzada

### Cambiar el Número del Admin

1. Ve al panel de administración
2. Configuración → Bot Config
3. Actualiza el campo `humanAgentPhone`
4. Guarda

### Desactivar Notificaciones Automáticas

Si no quieres recibir la información automáticamente:

1. Deja el campo `humanAgentPhone` vacío, O
2. Simplemente no envíes mensajes al bot desde tu número

Siempre puedes usar `/info` cuando necesites la información.

## 🐛 Solución de Problemas

### No recibo el mensaje de información

1. **Verifica que tu número esté correctamente configurado:**
   - Formato: solo números, código de país incluido
   - Ejemplo correcto: `521234567890`
   - Ejemplo incorrecto: `+52 123 456 7890`

2. **Verifica que el bot esté conectado:**
   - Revisa los logs: `docker compose logs app`
   - Debe mostrar "Client is ready!"

3. **Verifica que hayas enviado un mensaje:**
   - El bot solo envía la información cuando recibes/envías un mensaje

### La URL de Ngrok no aparece

1. **Verifica que ngrok esté corriendo:**
   ```bash
   docker compose ps ngrok
   ```

2. **Verifica el dashboard de ngrok:**
   - Abre http://localhost:4040
   - Debe mostrar la URL pública

3. **Si ngrok no está disponible**, el mensaje mostrará "⚠️ Ngrok no disponible"

### El comando /info no funciona

1. Verifica que tu número esté configurado como `humanAgentPhone`
2. Verifica que estés enviando exactamente `/info` (sin espacios)
3. Revisa los logs del bot para ver errores

## 📝 Notas Importantes

- ⚠️ El número debe estar en formato internacional sin `+`
- ⚠️ La información se envía automáticamente solo la primera vez (o cada 24 horas)
- ⚠️ Usa `/info` para obtener información actualizada en cualquier momento
- ✅ La URL de Ngrok se actualiza automáticamente cuando cambia
