const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stationForm', {
  openSample: () => ipcRenderer.invoke('study:sample'),
  openSource: () => ipcRenderer.invoke('study:source'),
  openSettings: () => ipcRenderer.invoke('study:settings'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (station, levels, selected, report) => ipcRenderer.invoke('project:save', station, levels, selected, report),
  confirmDiscard: () => ipcRenderer.invoke('project:discard'),
  run: (station, levels) => ipcRenderer.invoke('study:run', station, levels),
  exportStudy: (kind, station, levels, selected, report) => ipcRenderer.invoke('study:export', kind, station, levels, selected, report),
});
