# 🖥️ MullBot Desktop Application - Guía Completa

## 📖 ¿Qué es esto?

Esta es una aplicación de escritorio que empaqueta el panel web de MullBot en una aplicación nativa para Windows, Linux y macOS usando Electron.

## 🎯 Ventajas de la App de Escritorio

✅ **Experiencia nativa** - Se siente como una app real del sistema
✅ **Acceso rápido** - No necesitas abrir el navegador
✅ **Mejor integración** - Notificaciones del sistema, atajos de teclado
✅ **Instalación simple** - Un solo ejecutable para instalar
✅ **Offline-ready** - Puede mostrar mensajes de error cuando el servidor no está disponible

## 🚀 Inicio Rápido

### 1. Instalar dependencias

```bash
cd desktop
npm install
```

### 2. Asegurar que el servidor esté corriendo

```bash
# En la raíz del proyecto
docker compose up -d
```

### 3. Ejecutar la app

```bash
cd desktop
npm start
```

## 📦 Construir para Producción

### Linux (AppImage y .deb)

```bash
cd desktop
npm run build:linux
```

Archivos generados en `desktop/dist/`:
- `MullBot CRM-1.0.0.AppImage` - Ejecutable portable
- `MullBot CRM_1.0.0_amd64.deb` - Instalador Debian/Ubuntu

### Windows (.exe)

```bash
cd desktop
npm run build:win
```

Archivos generados:
- `MullBot CRM Setup 1.0.0.exe` - Instalador
- `MullBot CRM 1.0.0.exe` - Versión portable

### macOS (.dmg)

```bash
cd desktop
npm run build:mac
```

Archivos generados:
- `MullBot CRM-1.0.0.dmg` - Instalador
- `MullBot CRM-1.0.0-mac.zip` - Versión portable

## 🔧 Configuración Avanzada

### Conectar a un servidor remoto

```bash
# Usando variable de entorno
MULLBOT_SERVER_URL=http://192.168.1.100:3000 npm start

# O para producción
MULLBOT_SERVER_URL=https://tu-servidor.com npm start
```

### Modificar configuración de build

Edita `desktop/package.json` en la sección `build`:

```json
{
  "build": {
    "appId": "com.mullblue.mullbot",
    "productName": "MullBot CRM",
    // ... más opciones
  }
}
```

## 📱 Uso de la Aplicación

1. **Inicio**: La app se conecta automáticamente a `http://localhost:3000`
2. **Login**: Usa las mismas credenciales que el panel web (admin/admin123)
3. **Funcionalidad**: Todo funciona igual que en el navegador
4. **Reconexión**: Si el servidor se cae, la app intenta reconectar automáticamente

## 🎨 Personalización

### Cambiar Icono

1. Crea iconos en diferentes tamaños:
   - `icon.png` (512x512) para Linux
   - `icon.ico` (múltiples tamaños) para Windows
   - `icon.icns` para macOS

2. Colócalos en `desktop/assets/`

3. Reconstruye la app

### Cambiar Nombre y Versión

Edita `desktop/package.json`:
```json
{
  "name": "mullbot-desktop",
  "version": "1.0.0",
  "productName": "MullBot CRM"
}
```

## 🐛 Solución de Problemas

### Error: "Cannot connect to server"

**Solución:**
1. Verifica que Docker esté corriendo: `docker compose ps`
2. Verifica que el servidor responda: `curl http://localhost:3000/admin/login`
3. Espera unos segundos después de iniciar Docker
4. Recarga la app (Ctrl+R o Cmd+R)

### La app se ve en blanco

**Solución:**
1. Abre DevTools (F12)
2. Revisa la consola para errores
3. Verifica la URL del servidor en la configuración

### Build falla

**Solución:**
1. Asegúrate de tener todas las dependencias: `npm install`
2. Verifica que tengas espacio en disco
3. Revisa los logs de error en la terminal

## 🚀 Distribución

### Para Usuarios Finales

1. **Construye la app** para la plataforma objetivo
2. **Prueba el instalador** en una máquina limpia
3. **Distribuye** el archivo generado en `desktop/dist/`

### Opciones de Distribución

- **Directo**: Comparte el archivo .exe/.AppImage/.dmg
- **GitHub Releases**: Sube los archivos a releases de GitHub
- **Auto-updater**: Implementa actualizaciones automáticas (avanzado)

## 📝 Notas Importantes

⚠️ **La app requiere el servidor corriendo**
- La app de escritorio es un "wrapper" del panel web
- Necesita que el servidor backend esté activo
- Para una app completamente standalone, necesitarías empaquetar también Node.js y el servidor (más complejo)

✅ **Recomendación para producción**
- Distribuye la app junto con instrucciones para ejecutar Docker
- O considera empaquetar todo en un instalador que incluya Docker Desktop

## 🔮 Futuras Mejoras

- [ ] Empaquetar servidor junto con la app (app standalone)
- [ ] Notificaciones del sistema para nuevos mensajes
- [ ] Auto-actualización de la app
- [ ] Tray icon con menú contextual
- [ ] Atajos de teclado personalizados
- [ ] Modo offline con caché local

## 📚 Recursos

- [Documentación de Electron](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [README del Desktop](desktop/README.md)
