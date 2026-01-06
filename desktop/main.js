const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow;
let isDev = process.argv.includes('--dev');

// URL del servidor (por defecto localhost:3000)
const SERVER_URL = process.env.MULLBOT_SERVER_URL || 'http://localhost:3000';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    },
    titleBarStyle: 'default',
    show: false,
    backgroundColor: '#f0fdf4'
  });

  // Cargar la aplicación web
  const startUrl = isDev 
    ? 'http://localhost:3000/admin' 
    : `${SERVER_URL}/admin`;

  mainWindow.loadURL(startUrl);

  // Mostrar ventana cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Abrir DevTools en modo desarrollo
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Manejar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Error loading:', errorCode, errorDescription);
    
    // Si el servidor no está disponible, mostrar página de error
    if (errorCode === -106 || errorCode === -105) {
      mainWindow.loadFile(path.join(__dirname, 'error.html'));
    }
  });

  // Verificar conexión al servidor
  checkServerConnection();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Verificar conexión al servidor
async function checkServerConnection() {
  try {
    const response = await axios.get(`${SERVER_URL}/admin/login`, { timeout: 3000 });
    console.log('✅ Servidor conectado');
  } catch (error) {
    console.error('❌ Servidor no disponible:', error.message);
    // Mostrar notificación
    if (mainWindow) {
      mainWindow.webContents.send('server-status', { connected: false, url: SERVER_URL });
    }
  }
}

// Crear menú de la aplicación
function createMenu() {
  const template = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Configurar Servidor',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Configurar Servidor',
              message: 'Para cambiar la URL del servidor, establece la variable de entorno:',
              detail: 'MULLBOT_SERVER_URL=http://tu-servidor:3000'
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar Recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de Desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom Normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla Completa' }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de MullBot',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de MullBot',
              message: 'MullBot CRM Desktop',
              detail: 'Versión 1.0.0\n\nAgente de ventas inteligente para WhatsApp\nDesarrollado por Müllblue'
            });
          }
        }
      ]
    }
  ];

  // En macOS, agregar menú de la app
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: 'Acerca de' },
        { type: 'separator' },
        { role: 'services', label: 'Servicios' },
        { type: 'separator' },
        { role: 'hide', label: 'Ocultar' },
        { role: 'hideOthers', label: 'Ocultar Otros' },
        { role: 'unhide', label: 'Mostrar Todo' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle('check-server', async () => {
  try {
    const response = await axios.get(`${SERVER_URL}/admin/login`, { timeout: 3000 });
    return { connected: true, url: SERVER_URL };
  } catch (error) {
    return { connected: false, url: SERVER_URL, error: error.message };
  }
});

ipcMain.handle('get-server-url', () => {
  return SERVER_URL;
});

// Eventos de la aplicación
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Manejar enlaces externos
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    // Abrir enlaces externos en el navegador predeterminado
    require('electron').shell.openExternal(navigationUrl);
  });
});
