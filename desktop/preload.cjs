const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stationForm', {
  openSample: () => ipcRenderer.invoke('study:sample'),
  openSource: () => ipcRenderer.invoke('study:source'),
  openSettings: () => ipcRenderer.invoke('study:settings'),
  openProject: () => ipcRenderer.invoke('project:open'),
  saveProject: (station, levels, selected, report, building, road, link) =>
    ipcRenderer.invoke('project:save', station, levels, selected, report, building, road, link),
  confirmDiscard: () => ipcRenderer.invoke('project:discard'),
  run: (station, levels, building, road, link) => ipcRenderer.invoke('study:run', station, levels, building, road, link),
  exportStudy: (kind, station, levels, selected, report, building, road, link) =>
    ipcRenderer.invoke('study:export', kind, station, levels, selected, report, building, road, link),
});
