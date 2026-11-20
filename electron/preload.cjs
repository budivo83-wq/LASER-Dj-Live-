'use strict';

// Deliberately minimal. No Node, filesystem, serial, or arbitrary IPC access
// is exposed to the renderer. USB/ILDA output has NOT been implemented.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('laserDesktop', Object.freeze({
  desktop: true,
  version: '1.2.2',
  hardwareOutputEnabled: false,
  spout: Object.freeze({
    listSources: () => ipcRenderer.invoke('spout:list'),
    start: sender => ipcRenderer.invoke('spout:start', sender),
    stop: () => ipcRenderer.invoke('spout:stop'),
    onFrame: listener => {
      if (typeof listener !== 'function') return () => {};
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on('spout:frame', handler);
      return () => ipcRenderer.removeListener('spout:frame', handler);
    },
    onStatus: listener => {
      if (typeof listener !== 'function') return () => {};
      const handler = (_event, payload) => listener(payload);
      ipcRenderer.on('spout:status', handler);
      return () => ipcRenderer.removeListener('spout:status', handler);
    },
  }),
}));
