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
  onToggleOverlay: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('native-toggle-overlay', handler);
    return () => ipcRenderer.removeListener('native-toggle-overlay', handler);
  },
  onJoinVoice: (callback) => {
    const handler = (_, roomName) => callback(roomName);
    ipcRenderer.on('native-join-voice', handler);
    return () => ipcRenderer.removeListener('native-join-voice', handler);
  },
  openThemeFileDialog: () => ipcRenderer.invoke('open-theme-dialog'),
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  selectCaptureSource: (sourceId) => ipcRenderer.invoke('select-capture-source', sourceId),
  setOverlayMode: (enabled, interactive = true) =>
    ipcRenderer.invoke('set-overlay-mode', { enabled, interactive }),
  setTrayBadge: (count) => ipcRenderer.send('set-badge', count),
  setAppIcon: (dataUrl) => ipcRenderer.send('set-app-icon', dataUrl),
  relaunchApp: () => ipcRenderer.send('relaunch-app'),
  clearCacheAndReload: () => ipcRenderer.send('clear-cache-and-reload'),
  setZoomFactor: (factor) => ipcRenderer.send('set-zoom-factor', factor),
  getZoomFactor: () => ipcRenderer.invoke('get-zoom-factor'),
  onZoomChanged: (callback) => {
    const handler = (_, factor) => callback(factor);
    ipcRenderer.on('zoom-changed', handler);
    return () => ipcRenderer.removeListener('zoom-changed', handler);
  },
  resetWindowBounds: () => ipcRenderer.send('reset-window-bounds'),
  selfHostedServerUrl: 'http://127.0.0.1:4175',
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  openDiscordCall: (url) => ipcRenderer.invoke('open-discord-call', url),
  openDiscordLogin: () => ipcRenderer.invoke('open-discord-login'),
  openSharedBrowser: (url) => ipcRenderer.invoke('open-shared-browser', url),
  getDesktopPrefs: () => ipcRenderer.invoke('get-desktop-prefs'),
  setDesktopPrefs: (updates) => ipcRenderer.invoke('set-desktop-prefs', updates),
});
