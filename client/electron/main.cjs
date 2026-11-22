const {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  dialog,
  Menu,
  Tray,
  globalShortcut,
  screen,
} = require('electron');
const path = require('path');
const fs = require('fs');
const { startStandaloneServer } = require('./selfHostedServer.cjs');

const SELF_HOSTED_PORT = 4175;
const ZOOM_FACTORS = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0];

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
let saveBoundsTimer = null;

function getBoundsFilePath() {
  return path.join(app.getPath('userData'), 'window-bounds.json');
}

function clampZoomFactor(factor) {
  const num = Number(factor);
  if (!Number.isFinite(num)) return 1.0;
  return Math.round(Math.max(0.5, Math.min(2.0, num)) * 100) / 100;
}

function applyZoomFactor(factor) {
  const clamped = clampZoomFactor(factor);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(clamped);
    mainWindow.webContents.send('zoom-changed', clamped);
  }
  return clamped;
}

function getDefaultBounds() {
  const primary = screen.getPrimaryDisplay();
  const workArea = primary.workArea || { x: 0, y: 0, width: 1280, height: 800 };
  const maxWidth = Math.max(320, workArea.width);
  const maxHeight = Math.max(240, workArea.height);
  const targetWidth = Math.min(1280, Math.max(320, workArea.width - 40));
  const targetHeight = Math.min(780, Math.max(240, workArea.height - 40));
  const width = Math.min(maxWidth, Math.max(Math.min(760, maxWidth), targetWidth));
  const height = Math.min(maxHeight, Math.max(Math.min(480, maxHeight), targetHeight));
  const x = Math.round(workArea.x + Math.max(0, (workArea.width - width) / 2));
  const y = Math.round(workArea.y + Math.max(0, (workArea.height - height) / 2));
  return { x, y, width, height };
}

function clampBoundsToWorkArea(bounds, workArea) {
  const minW = Math.min(760, workArea.width);
  const minH = Math.min(480, workArea.height);
  const width = Math.round(Math.max(minW, Math.min(workArea.width, bounds.width)));
  const height = Math.round(Math.max(minH, Math.min(workArea.height, bounds.height)));
  const maxX = workArea.x + Math.max(0, workArea.width - width);
  const maxY = workArea.y + Math.max(0, workArea.height - height);
  const x = Math.round(Math.max(workArea.x, Math.min(maxX, bounds.x)));
  const y = Math.round(Math.max(workArea.y, Math.min(maxY, bounds.y)));
  return { x, y, width, height };
}

function resolveInitialBounds() {
  try {
    const boundsPath = getBoundsFilePath();
    if (!fs.existsSync(boundsPath)) {
      return getDefaultBounds();
    }
    const raw = fs.readFileSync(boundsPath, 'utf8');
    const saved = JSON.parse(raw);
    if (
      !saved ||
      !Number.isFinite(saved.x) ||
      !Number.isFinite(saved.y) ||
      !Number.isFinite(saved.width) ||
      !Number.isFinite(saved.height) ||
      saved.width <= 0 ||
      saved.height <= 0
    ) {
      return getDefaultBounds();
    }

    const displays = screen.getAllDisplays();
    let bestDisplay = null;
    let bestArea = 0;

    for (const display of displays) {
      const wa = display.workArea;
      if (!wa) continue;
      const overlapW = Math.min(saved.x + saved.width, wa.x + wa.width) - Math.max(saved.x, wa.x);
      const overlapH = Math.min(saved.y + saved.height, wa.y + wa.height) - Math.max(saved.y, wa.y);
      if (overlapW >= 120 && overlapH >= 120) {
        const area = overlapW * overlapH;
        if (area > bestArea) {
          bestArea = area;
          bestDisplay = display;
        }
      }
    }

    if (!bestDisplay || !bestDisplay.workArea) {
      return getDefaultBounds();
    }

    return clampBoundsToWorkArea(saved, bestDisplay.workArea);
  } catch {
    return getDefaultBounds();
  }
}

function saveWindowBoundsNow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized() || mainWindow.isMinimized()) return;
  try {
    const bounds = mainWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const targetWorkArea = display?.workArea || screen.getPrimaryDisplay().workArea;
    const clamped = clampBoundsToWorkArea(bounds, targetWorkArea);
    fs.writeFileSync(getBoundsFilePath(), JSON.stringify(clamped, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist window bounds:', err);
  }
}

function scheduleSaveBounds() {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
  }
  saveBoundsTimer = setTimeout(() => {
    saveBoundsTimer = null;
    saveWindowBoundsNow();
  }, 250);
}

function resetWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }
  const defaults = getDefaultBounds();
  mainWindow.setBounds(defaults);
  mainWindow.show();
  mainWindow.focus();
  try {
    fs.writeFileSync(getBoundsFilePath(), JSON.stringify(defaults, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to reset window bounds:', err);
  }
}

function sortSourcesScreenFirst(sources) {
  return [...sources].sort((a, b) => {
    const aScreen = String(a.id || '').startsWith('screen:');
    const bScreen = String(b.id || '').startsWith('screen:');
    if (aScreen && !bScreen) return -1;
    if (!aScreen && bScreen) return 1;
    return 0;
  });
}

function getDesktopPrefsPath() {
  return path.join(app.getPath('userData'), 'desktop-prefs.json');
}

function loadDesktopPrefs() {
  try {
    const raw = fs.readFileSync(getDesktopPrefsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    return {
      openAtLogin: Boolean(parsed.openAtLogin),
      startMinimized: Boolean(parsed.startMinimized),
      closeBehavior: parsed.closeBehavior === 'exit' ? 'exit' : 'minimize',
    };
  } catch {
    return { openAtLogin: false, startMinimized: false, closeBehavior: 'minimize' };
  }
}

function saveDesktopPrefs(next) {
  const merged = {
    ...loadDesktopPrefs(),
    ...next,
    closeBehavior: next.closeBehavior === 'exit' ? 'exit' : (next.closeBehavior === 'minimize' ? 'minimize' : loadDesktopPrefs().closeBehavior),
  };
  try {
    fs.writeFileSync(getDesktopPrefsPath(), JSON.stringify(merged, null, 2), 'utf8');
  } catch {
    // Ignore write failure
  }
  try {
    app.setLoginItemSettings({
      openAtLogin: Boolean(merged.openAtLogin),
      args: merged.startMinimized ? ['--minimized'] : [],
    });
  } catch {
    // Ignore on unsupported platforms
  }
  return merged;
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  const initialBounds = resolveInitialBounds();

  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: 760,
    minHeight: 480,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#1e1f22',
    icon: iconPath,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      backgroundThrottling: false,
      webviewTag: true,
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
        const sorted = sortSourcesScreenFirst(sources);
        if (sorted.length > 0) {
          const selected = pendingCaptureSourceId
            ? sorted.find((s) => s.id === pendingCaptureSourceId) || sorted[0]
            : sorted[0];
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

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const hasPrimaryMod = Boolean(input.control || input.meta) && !input.alt;
    if (!hasPrimaryMod) return;

    const isZoomIn =
      input.key === '=' ||
      input.key === '+' ||
      input.code === 'Equal' ||
      input.code === 'NumpadAdd';
    const isZoomOut =
      input.key === '-' ||
      input.key === '_' ||
      input.code === 'Minus' ||
      input.code === 'NumpadSubtract';
    const isZoomReset = input.key === '0' || input.code === 'Numpad0';

    if (!isZoomIn && !isZoomOut && !isZoomReset) return;

    event.preventDefault();
    const current = clampZoomFactor(mainWindow.webContents.getZoomFactor());
    let next = 1.0;

    if (isZoomIn) {
      next =
        ZOOM_FACTORS.find((step) => step > current + 0.005) ??
        ZOOM_FACTORS[ZOOM_FACTORS.length - 1];
    } else if (isZoomOut) {
      next = ZOOM_FACTORS[0];
      for (let i = ZOOM_FACTORS.length - 1; i >= 0; i -= 1) {
        if (ZOOM_FACTORS[i] < current - 0.005) {
          next = ZOOM_FACTORS[i];
          break;
        }
      }
    } else {
      next = 1.0;
    }

    applyZoomFactor(next);
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

  mainWindow.on('move', scheduleSaveBounds);
  mainWindow.on('resize', scheduleSaveBounds);

  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximize-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-maximize-changed', false);
    scheduleSaveBounds();
  });

  // Respect user's closeBehavior preference ('minimize' to tray vs 'exit' app)
  mainWindow.on('close', (event) => {
    saveWindowBoundsNow();
    const prefs = loadDesktopPrefs();
    if (!isQuitting && prefs.closeBehavior !== 'exit') {
      event.preventDefault();
      mainWindow.hide();
      if (tray && process.platform === 'win32' && typeof tray.displayBalloon === 'function') {
        tray.displayBalloon({
          iconType: 'info',
          title: 'Protutech',
          content: 'Running in the background. Double-click tray icon to restore.',
        });
      }
    } else {
      isQuitting = true;
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
    {
      label: 'Center / Reset Window Position',
      click: () => {
        resetWindowBounds();
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

ipcMain.on('reset-window-bounds', () => {
  resetWindowBounds();
});

ipcMain.on('set-zoom-factor', (_, factor) => {
  applyZoomFactor(factor);
});

ipcMain.handle('get-zoom-factor', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return 1.0;
  return clampZoomFactor(mainWindow.webContents.getZoomFactor());
});

// Native Desktop Screen Capture Source Enumeration & Selection
ipcMain.handle('get-desktop-sources', async () => {
  let sources = [];
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
  } catch {
    sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 },
    });
  }

  const sorted = sortSourcesScreenFirst(sources);
  return sorted.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail && !s.thumbnail.isEmpty() ? s.thumbnail.toDataURL() : '',
    appIcon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : null,
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

let discordCallWindow = null;
ipcMain.handle('open-discord-call', (_, targetUrl) => {
  try {
    const parsed = new URL(String(targetUrl || 'https://discord.com/channels/@me'));
    if (parsed.protocol !== 'https:' || (parsed.hostname !== 'discord.com' && !parsed.hostname.endsWith('.discord.com'))) {
      return { ok: false, error: 'Only discord.com URLs are permitted.' };
    }
    if (discordCallWindow && !discordCallWindow.isDestroyed()) {
      discordCallWindow.loadURL(parsed.toString());
      discordCallWindow.focus();
      return { ok: true };
    }
    discordCallWindow = new BrowserWindow({
      width: 1120,
      height: 760,
      title: 'Protutech — Discord Call Companion',
      icon: path.join(__dirname, 'icon.png'),
      backgroundColor: '#080c16',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    discordCallWindow.webContents.session.setPermissionRequestHandler((_, permission, callback) => {
      if (['media', 'mediaKeySystem', 'display-capture', 'fullscreen', 'notifications'].includes(permission)) {
        callback(true);
      } else {
        callback(false);
      }
    });
    discordCallWindow.on('closed', () => {
      discordCallWindow = null;
    });
    discordCallWindow.loadURL(parsed.toString());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to open Discord call window.' };
  }
});

// Desktop Startup & Close Behavior Preferences
ipcMain.handle('get-desktop-prefs', () => {
  return loadDesktopPrefs();
});

ipcMain.handle('set-desktop-prefs', (_, updates) => {
  return saveDesktopPrefs(updates || {});
});

// Built-in Discord Sign-In Window (captures session token cleanly after user signs in)
let discordLoginWindow = null;
ipcMain.handle('open-discord-login', () => {
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (payload) => {
      if (resolved) return;
      resolved = true;
      resolve(payload);
    };

    try {
      if (discordLoginWindow && !discordLoginWindow.isDestroyed()) {
        discordLoginWindow.focus();
        return;
      }

      discordLoginWindow = new BrowserWindow({
        width: 980,
        height: 740,
        title: 'Sign in to Discord — Protutech',
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#1e1f22',
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          partition: 'persist:discord-login',
        },
      });

      const loginSession = discordLoginWindow.webContents.session;
      const filter = { urls: ['https://discord.com/api/*'] };
      loginSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
        const auth = details.requestHeaders?.Authorization || details.requestHeaders?.authorization;
        if (
          auth &&
          typeof auth === 'string' &&
          auth.length > 25 &&
          !auth.startsWith('Basic ') &&
          !auth.startsWith('Bearer ')
        ) {
          finish({ ok: true, token: auth.trim() });
          if (discordLoginWindow && !discordLoginWindow.isDestroyed()) {
            discordLoginWindow.close();
          }
        }
        callback({ requestHeaders: details.requestHeaders });
      });

      discordLoginWindow.on('closed', () => {
        discordLoginWindow = null;
        finish({ ok: false, cancelled: true });
      });

      discordLoginWindow.loadURL('https://discord.com/login');
    } catch (err) {
      finish({ ok: false, error: err?.message || 'Failed to open Discord sign-in window.' });
    }
  });
});

// Real Chromium Shared Browser Host Window
let sharedBrowserWindow = null;
ipcMain.handle('open-shared-browser', (_, targetUrl) => {
  try {
    const raw = String(targetUrl || 'https://www.youtube.com');
    const urlStr = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    if (sharedBrowserWindow && !sharedBrowserWindow.isDestroyed()) {
      sharedBrowserWindow.loadURL(urlStr);
      sharedBrowserWindow.focus();
      return { ok: true };
    }
    sharedBrowserWindow = new BrowserWindow({
      width: 1200,
      height: 780,
      title: 'Protutech — Shared Chromium Browser',
      icon: path.join(__dirname, 'icon.png'),
      backgroundColor: '#0b0e14',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        partition: 'persist:shared-browser',
      },
    });
    sharedBrowserWindow.on('closed', () => {
      sharedBrowserWindow = null;
    });
    sharedBrowserWindow.loadURL(urlStr);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'Failed to launch Chromium browser.' };
  }
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
  saveWindowBoundsNow();
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
