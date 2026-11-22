const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stationForm', {
  openSample: () => ipcRenderer.invoke('study:sample'),
  openSource: () => ipcRenderer.invoke('study:source'),
  openSettings: () => ipcRenderer.invoke('study:settings'),
  run: (station, levels) => ipcRenderer.invoke('study:run', station, levels),
});
