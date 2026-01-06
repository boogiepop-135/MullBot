# 🖥️ MullBot Desktop Application

Aplicación de escritorio para MullBot CRM construida con Electron.

## 🚀 Características

- ✅ Interfaz nativa de escritorio
- ✅ Acceso directo al panel de administración
- ✅ Reconexión automática al servidor
- ✅ Notificaciones de estado del servidor
- ✅ Empaquetado para Windows, Linux y macOS

## 📋 Requisitos

- Node.js 20+
- Servidor MullBot corriendo (Docker o local)

## 🛠️ Instalación

```bash
cd desktop
npm install
```

## ▶️ Ejecutar en Desarrollo

```bash
# Asegúrate de que el servidor esté corriendo primero
cd ../  # Volver a la raíz del proyecto
docker compose up -d

# En otra terminal, ejecutar la app de escritorio
cd desktop
npm run dev
```

## 📦 Construir Aplicación

### Para Linux
```bash
npm run build:linux
```

### Para Windows
```bash
npm run build:win
```

### Para macOS
```bash
npm run build:mac
```

### Para todas las plataformas
```bash
npm run build
```

Los archivos empaquetados se generarán en `desktop/dist/`

## ⚙️ Configuración

### Cambiar URL del Servidor

Por defecto, la app se conecta a `http://localhost:3000`. Para cambiar esto:

**Opción 1: Variable de entorno**
```bash
MULLBOT_SERVER_URL=http://tu-servidor:3000 npm start
```

**Opción 2: Modificar main.js**
Edita la línea:
```javascript
const SERVER_URL = process.env.MULLBOT_SERVER_URL || 'http://localhost:3000';
```

## 📁 Estructura

```
desktop/
├── main.js          # Proceso principal de Electron
├── preload.js       # Script de precarga (bridge seguro)
├── error.html       # Página de error cuando el servidor no está disponible
├── package.json     # Configuración y dependencias
├── assets/          # Iconos y recursos
└── dist/            # Archivos empaquetados (generados)
```

## 🎨 Personalización

### Cambiar Icono

Reemplaza los archivos en `desktop/assets/`:
- `icon.png` - Linux
- `icon.ico` - Windows
- `icon.icns` - macOS

### Cambiar Nombre de la App

Edita `package.json`:
```json
{
  "name": "mullbot-desktop",
  "productName": "MullBot CRM"
}
```

## 🔧 Desarrollo

### Modo Desarrollo con DevTools

```bash
npm run dev
```

Esto abre la aplicación con las herramientas de desarrollo habilitadas.

### Debugging

Los logs del proceso principal aparecen en la terminal donde ejecutas la app.

## 📱 Distribución

Después de construir, encontrarás:

- **Linux**: `.AppImage` y `.deb` en `dist/`
- **Windows**: `.exe` (NSIS installer) y `.exe` (portable) en `dist/`
- **macOS**: `.dmg` y `.zip` en `dist/`

## 🐛 Solución de Problemas

### La app no se conecta al servidor

1. Verifica que el servidor esté corriendo:
   ```bash
   docker compose ps
   ```

2. Verifica que el puerto 3000 esté accesible:
   ```bash
   curl http://localhost:3000/admin/login
   ```

3. Cambia la URL del servidor si es necesario (ver sección Configuración)

### La app se ve en blanco

1. Abre DevTools (F12 o Cmd+Option+I)
2. Revisa la consola para errores
3. Verifica que el servidor esté respondiendo correctamente

## 📝 Notas

- La aplicación es básicamente un navegador que carga el panel web
- Requiere que el servidor backend esté corriendo
- Para una app completamente standalone, necesitarías empaquetar también el servidor (más complejo)

## 🚀 Próximos Pasos

Posibles mejoras:
- [ ] Empaquetar el servidor junto con la app (app completamente standalone)
- [ ] Notificaciones del sistema
- [ ] Auto-actualización
- [ ] Tray icon con menú contextual
- [ ] Atajos de teclado personalizados
