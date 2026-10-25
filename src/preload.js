const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kb', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  saveSettings: (value) => ipcRenderer.invoke('save-settings', value),
  testConnection: (value) => ipcRenderer.invoke('test-connection', value),
  pickFiles: () => ipcRenderer.invoke('pick-files'),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  deleteDocument: (id) => ipcRenderer.invoke('delete-document', id),
  openDocument: (path) => ipcRenderer.invoke('open-document', path),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  ask: (question) => ipcRenderer.invoke('ask', question)
});
