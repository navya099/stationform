const { contextBridge, ipcRenderer } = require('electron');

const payload = new Promise((resolve) => ipcRenderer.once('report:data', (_event, value) => resolve(value)));
contextBridge.exposeInMainWorld('reportInput', { read: () => payload });
