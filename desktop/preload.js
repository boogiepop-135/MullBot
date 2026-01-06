const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer
contextBridge.exposeInMainWorld('electronAPI', {
  checkServer: () => ipcRenderer.invoke('check-server'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  onServerStatus: (callback) => {
    ipcRenderer.on('server-status', (event, data) => callback(data));
  }
});
