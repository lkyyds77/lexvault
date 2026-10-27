const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('kb', {
  bootstrap: () => ipcRenderer.invoke('bootstrap'),
  saveSettings: (value) => ipcRenderer.invoke('save-settings', value),
  testConnection: (value) => ipcRenderer.invoke('test-connection', value),
  pickFiles: (categoryId) => ipcRenderer.invoke('pick-files', categoryId),
  pickFolder: (categoryId) => ipcRenderer.invoke('pick-folder', categoryId),
  addCategory: (value) => ipcRenderer.invoke('add-category', value),
  renameCategory: (id, name) => ipcRenderer.invoke('rename-category', id, name),
  deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),
  moveDocument: (documentId, categoryId) => ipcRenderer.invoke('move-document', documentId, categoryId),
  deleteDocument: (id) => ipcRenderer.invoke('delete-document', id),
  openDocument: (path) => ipcRenderer.invoke('open-document', path),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  ask: (question) => ipcRenderer.invoke('ask', question)
});
