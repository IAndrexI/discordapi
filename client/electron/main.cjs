const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, Menu, Tray, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const { startStandaloneServer } = require('./selfHostedServer.cjs');

const SELF_HOSTED_PORT = 4175;

// Microsoft Store & Windows taskbar identity
app.setAppUserModelId('vip.protutech.chat');

// Optimize Chromium audio/video flags for ultra-low latency WebRTC LiveKit & Screen Capture
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-features', 'WebRTCPCM16kAudio,WebRTC-H264WithOpenH264FFmpeg');
app.commandLine.appendSwitch('force-webrtc-ip-handling-policy', 'default_public_interface_only');
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('auto-select-desktop-capture-source', 'Entire screen');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let pendingCaptureSourceId = null;
let localServer = null;
let activeServerDataDir = path.join(__dirname, '../server-data');

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 780,
    minWidth: 940,
    minHeight: 520,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#090d16',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
    },
  });

  const distIndex = path.join(__dirname, '../dist/index.html');
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (fs.existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('https://chat.protutech.vip/chat/');
  }

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'screen', 'notifications', 'mediaKeySystem'];
    callback(allowed.includes(permission));
  });

  mainWindow.webContents.session.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources.length > 0) {
          const selected = pendingCaptureSourceId
            ? sources.find((s) => s.id === pendingCaptureSourceId) || sources[0]
            : sources[0];
          pendingCaptureSourceId = null;
          const wantsAudio = request && request.audioRequested !== false;
          callback({ video: selected, audio: wantsAudio ? 'loopback' : undefined });
        } else {
          pendingCaptureSourceId = null;
          callback({});
        }
      })
      .catch(() => {
        pendingCaptureSourceId = null;
        callback({});
      });
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Fallback in case ready-to-show is delayed by cached resources
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1000);

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximize-changed', false);
  });

  // Minimize to tray on close
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
        tray.displayBalloon({
          iconType: 'info',
          title: 'Protutech',
          content: 'Running in the background. Double-click tray icon to restore.',
        });
      }
    }
  });

  // Global Shortcuts for native desktop feel
  const registerShortcut = (accelerator, channel) => {
    try {
      globalShortcut.register(accelerator, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(channel);
        }
      });
    } catch (err) {
      console.error(`Error registering global shortcut ${accelerator}:`, err);
    }
  };

  registerShortcut('CommandOrControl+Shift+M', 'native-toggle-mute');
  registerShortcut('CommandOrControl+Shift+D', 'native-toggle-deafen');
  registerShortcut('Alt+Shift+O', 'native-toggle-overlay');
  registerShortcut('CommandOrControl+Shift+O', 'native-toggle-overlay');
}

function createTray() {
  const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Protutech');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Protutech',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Join Voice Lounge (<30ms)',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('native-join-voice', 'livekit_lounge');
        }
      },
    },
    {
      label: 'Toggle Mute (Ctrl+Shift+M)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('native-toggle-mute');
        }
      },
    },
    {
      label: 'Toggle Deafen (Ctrl+Shift+D)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('native-toggle-deafen');
        }
      },
    },
    {
      label: 'Toggle In-Game Overlay (Alt+Shift+O)',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('native-toggle-overlay');
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// Window controls IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Native Desktop Screen Capture Source Enumeration & Selection
ipcMain.handle('get-desktop-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true,
  });

  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
    appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
  }));
});

ipcMain.handle('select-capture-source', (_, sourceId) => {
  pendingCaptureSourceId = sourceId || null;
  return true;
});

// Optional In-Game Overlay window mode
ipcMain.handle('set-overlay-mode', (_, payload) => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const enabled = Boolean(payload && payload.enabled);
  const interactive =
    payload && payload.interactive !== undefined ? Boolean(payload.interactive) : true;

  if (enabled) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  } else {
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setIgnoreMouseEvents(false);
  }
  return true;
});

// Custom Theme File Dialog
ipcMain.handle('open-theme-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Custom CSS Theme',
    filters: [{ name: 'CSS Stylesheets (*.css)', extensions: ['css'] }],
    properties: ['openFile'],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  const filePath = filePaths[0];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { path: filePath, name: path.basename(filePath), content };
  } catch (err) {
    return { error: String(err) };
  }
});

ipcMain.on('set-badge', (_, count) => {
  if (app.setBadgeCount) {
    app.setBadgeCount(count);
  }
});

ipcMain.on('set-app-icon', (_, iconDataUrl) => {
  try {
    const { nativeImage } = require('electron');
    if (!iconDataUrl) return;
    const img = nativeImage.createFromDataURL(iconDataUrl);
    if (!img.isEmpty()) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setIcon(img);
      }
      if (tray) {
        tray.setImage(img);
      }
    }
  } catch (err) {
    console.error('Failed to set app icon dynamically:', err);
  }
});

ipcMain.handle('get-server-info', () => {
  return {
    port: SELF_HOSTED_PORT,
    url: `http://127.0.0.1:${SELF_HOSTED_PORT}`,
    dataDir: activeServerDataDir,
  };
});

// Discord-style App Relaunch & In-Place Update Handler
ipcMain.on('relaunch-app', () => {
  app.relaunch();
  app.exit(0);
});

ipcMain.on('clear-cache-and-reload', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.session.clearCache().then(() => {
      mainWindow.reload();
    });
  }
});

app.whenReady().then(() => {
  activeServerDataDir = app.isPackaged
    ? path.join(app.getPath('userData'), 'server-data')
    : path.join(__dirname, '../server-data');
  localServer = startStandaloneServer(SELF_HOSTED_PORT, activeServerDataDir);

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (localServer) {
    try {
      localServer.close();
    } catch {
      // Ignore close error
    }
    localServer = null;
  }
});
