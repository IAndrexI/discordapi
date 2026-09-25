const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onMaximizeChange: (callback) => {
    const handler = (_, val) => callback(val);
    ipcRenderer.on('window-maximize-changed', handler);
    return () => ipcRenderer.removeListener('window-maximize-changed', handler);
  },
  onToggleMute: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('native-toggle-mute', handler);
    return () => ipcRenderer.removeListener('native-toggle-mute', handler);
  },
  onToggleDeafen: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('native-toggle-deafen', handler);
    return () => ipcRenderer.removeListener('native-toggle-deafen', handler);
  },
  onJoinVoice: (callback) => {
    const handler = (_, roomName) => callback(roomName);
    ipcRenderer.on('native-join-voice', handler);
    return () => ipcRenderer.removeListener('native-join-voice', handler);
  },
  openThemeFileDialog: () => ipcRenderer.invoke('open-theme-dialog'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  setTrayBadge: (count) => ipcRenderer.send('set-badge', count),
});
