/**
 * Preload script for embedded browser view
 * Enables IPC communication from the loaded page back to the main process
 */

const { ipcRenderer } = require('electron');

// Expose ipcRenderer for the recorder script
window.ipcRenderer = ipcRenderer;

// Also expose a simpler API
window.flowstralBridge = {
  sendAction: (action) => {
    ipcRenderer.sendToHost('flowstral-action', action);
  }
};

