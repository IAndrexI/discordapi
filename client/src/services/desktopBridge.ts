export type DesktopRuntimeKind = 'tauri' | 'electron' | 'web';

export interface DesktopCaptureSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon?: string | null;
}

export interface ThemeFileDialogResult {
  path: string;
  name: string;
  content: string;
  error?: string;
}

interface ElectronBridgeApi {
  isElectron?: boolean;
  platform?: string;
  minimize?: () => void;
  maximize?: () => void;
  close?: () => void;
  isMaximized?: () => Promise<boolean>;
  onMaximizeChange?: (callback: (isMax: boolean) => void) => () => void;
  openThemeFileDialog?: () => Promise<ThemeFileDialogResult | null>;
  getDesktopSources?: () => Promise<DesktopCaptureSource[]>;
  selectCaptureSource?: (sourceId: string) => Promise<boolean> | void;
  setOverlayMode?: (enabled: boolean, interactive: boolean) => Promise<boolean> | void;
  onToggleOverlay?: (callback: () => void) => () => void;
  onToggleMute?: (callback: () => void) => () => void;
  onToggleDeafen?: (callback: () => void) => () => void;
  onJoinVoice?: (callback: (roomName: string) => void) => () => void;
  setTrayBadge?: (count: number) => void;
  setAppIcon?: (dataUrl: string) => void;
  relaunchApp?: () => void;
  clearCacheAndReload?: () => void;
  setZoomFactor?: (factor: number) => void;
  getZoomFactor?: () => Promise<number>;
  onZoomChanged?: (callback: (factor: number) => void) => () => void;
  resetWindowBounds?: () => void;
}

interface TauriEventPayload<T> {
  event: string;
  id: number;
  payload: T;
}

interface TauriInternalsApi {
  invoke: <T = unknown>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
  transformCallback?: <T = unknown>(callback?: (response: T) => void, once?: boolean) => number;
  unregisterCallback?: (id: number) => void;
}

function getElectronApi(): ElectronBridgeApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { electronAPI?: ElectronBridgeApi }).electronAPI;
}

function getTauriInternals(): TauriInternalsApi | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as { __TAURI_INTERNALS__?: TauriInternalsApi }).__TAURI_INTERNALS__;
}

function listenTauriEvent<T = unknown>(
  eventName: string,
  callback: (payload: T) => void
): () => void {
  const tauri = getTauriInternals();
  if (!tauri) return () => {};

  let disposed = false;
  let eventId: number | null = null;
  let callbackId: number | null = null;

  const domHandler = (evt: Event) => {
    const customEvt = evt as CustomEvent<T>;
    callback(customEvt.detail);
  };
  window.addEventListener(eventName, domHandler);

  if (typeof tauri.transformCallback === 'function' && typeof tauri.invoke === 'function') {
    callbackId = tauri.transformCallback<TauriEventPayload<T>>((msg) => {
      if (!disposed) {
        callback(msg.payload);
      }
    });

    tauri
      .invoke<number>('plugin:event|listen', {
        event: eventName,
        target: { kind: 'Any' },
        handler: callbackId,
      })
      .then((id) => {
        if (disposed) {
          tauri.invoke('plugin:event|unlisten', { event: eventName, eventId: id }).catch(() => {});
        } else {
          eventId = id;
        }
      })
      .catch(() => {
        // Fallback relies on CustomEvent listener if plugin:event|listen is unavailable
      });
  }

  return () => {
    disposed = true;
    window.removeEventListener(eventName, domHandler);
    if (eventId !== null) {
      tauri.invoke('plugin:event|unlisten', { event: eventName, eventId }).catch(() => {});
    }
    if (callbackId !== null && typeof tauri.unregisterCallback === 'function') {
      try {
        tauri.unregisterCallback(callbackId);
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

function openWebCssFilePicker(): Promise<ThemeFileDialogResult | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.css,text/css';
    input.style.display = 'none';

    let settled = false;
    const finish = (result: ThemeFileDialogResult | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(result);
    };

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const content = await file.text();
        finish({
          path: file.name,
          name: file.name,
          content,
        });
      } catch (err) {
        finish({
          path: file.name,
          name: file.name,
          content: '',
          error: String(err),
        });
      }
    });

    input.addEventListener('cancel', () => finish(null));

    const onWindowFocus = () => {
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) {
          window.removeEventListener('focus', onWindowFocus);
          finish(null);
        }
      }, 350);
    };
    window.addEventListener('focus', onWindowFocus, { once: true });

    document.body.appendChild(input);
    input.click();
  });
}

export class DesktopBridgeService {
  public getRuntimeKind(): DesktopRuntimeKind {
    if (getTauriInternals()) return 'tauri';
    const electron = getElectronApi();
    if (electron && (electron.isElectron || typeof electron.minimize === 'function')) {
      return 'electron';
    }
    return 'web';
  }

  public isDesktopApp(): boolean {
    return this.getRuntimeKind() !== 'web';
  }

  public minimize(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      getTauriInternals()?.invoke('minimize_window').catch(() => {});
    } else if (kind === 'electron') {
      getElectronApi()?.minimize?.();
    }
  }

  public maximize(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      getTauriInternals()?.invoke('maximize_window').catch(() => {});
    } else if (kind === 'electron') {
      getElectronApi()?.maximize?.();
    }
  }

  public close(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      getTauriInternals()?.invoke('close_window').catch(() => {});
    } else if (kind === 'electron') {
      getElectronApi()?.close?.();
    }
  }

  public async isMaximized(): Promise<boolean> {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      try {
        return Boolean(await getTauriInternals()?.invoke<boolean>('is_maximized'));
      } catch {
        return false;
      }
    }
    if (kind === 'electron') {
      try {
        return Boolean(await getElectronApi()?.isMaximized?.());
      } catch {
        return false;
      }
    }
    return typeof document !== 'undefined' ? Boolean(document.fullscreenElement) : false;
  }

  public onMaximizeChange(cb: (maximized: boolean) => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      const unsubExplicit = listenTauriEvent<boolean>('window-maximize-changed', (val) => {
        cb(Boolean(val));
      });
      const unsubResize = listenTauriEvent('tauri://resize', () => {
        this.isMaximized().then(cb).catch(() => {});
      });
      return () => {
        unsubExplicit();
        unsubResize();
      };
    }

    if (kind === 'electron') {
      return getElectronApi()?.onMaximizeChange?.(cb) ?? (() => {});
    }

    return () => {};
  }

  public async getDesktopSources(): Promise<DesktopCaptureSource[]> {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      try {
        return (await getElectronApi()?.getDesktopSources?.()) ?? [];
      } catch {
        return [];
      }
    }
    if (kind === 'tauri') {
      try {
        return (await getTauriInternals()?.invoke<DesktopCaptureSource[]>('get_desktop_sources')) ?? [];
      } catch {
        return [];
      }
    }
    return [];
  }

  public async selectCaptureSource(sourceId: string): Promise<boolean> {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      try {
        const res = await getElectronApi()?.selectCaptureSource?.(sourceId);
        return res !== false;
      } catch {
        return false;
      }
    }
    if (kind === 'tauri') {
      try {
        return Boolean(await getTauriInternals()?.invoke<boolean>('select_capture_source', { sourceId }));
      } catch {
        return false;
      }
    }
    return false;
  }

  public async setOverlayMode(enabled: boolean, interactive: boolean = true): Promise<boolean> {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      try {
        return Boolean(
          await getTauriInternals()?.invoke<boolean>('set_overlay_mode', {
            enabled,
            interactive,
          })
        );
      } catch {
        return false;
      }
    }
    if (kind === 'electron') {
      try {
        const res = await getElectronApi()?.setOverlayMode?.(enabled, interactive);
        return res !== false;
      } catch {
        return false;
      }
    }
    return false;
  }

  public onToggleOverlay(cb: () => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      return listenTauriEvent('native-toggle-overlay', () => cb());
    }
    if (kind === 'electron') {
      return getElectronApi()?.onToggleOverlay?.(cb) ?? (() => {});
    }
    return () => {};
  }

  public onToggleMute(cb: () => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      return listenTauriEvent('native-toggle-mute', () => cb());
    }
    if (kind === 'electron') {
      return getElectronApi()?.onToggleMute?.(cb) ?? (() => {});
    }
    return () => {};
  }

  public onToggleDeafen(cb: () => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      return listenTauriEvent('native-toggle-deafen', () => cb());
    }
    if (kind === 'electron') {
      return getElectronApi()?.onToggleDeafen?.(cb) ?? (() => {});
    }
    return () => {};
  }

  public onJoinVoice(cb: (roomName: string) => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      return listenTauriEvent<string>('native-join-voice', (roomName) => {
        cb(typeof roomName === 'string' && roomName ? roomName : 'livekit_lounge');
      });
    }
    if (kind === 'electron') {
      return getElectronApi()?.onJoinVoice?.(cb) ?? (() => {});
    }
    return () => {};
  }

  public async openThemeFileDialog(): Promise<ThemeFileDialogResult | null> {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      try {
        return (await getElectronApi()?.openThemeFileDialog?.()) ?? null;
      } catch (err) {
        return { path: '', name: '', content: '', error: String(err) };
      }
    }
    if (kind === 'tauri') {
      try {
        const res = await getTauriInternals()?.invoke<ThemeFileDialogResult | null>('open_theme_file_dialog');
        if (res) return res;
      } catch {
        // Fall through to web input dialog if native dialog command fails
      }
    }
    return openWebCssFilePicker();
  }

  public setTrayBadge(count: number): void {
    const safeCount = Math.max(0, Math.floor(count));
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      getTauriInternals()?.invoke('set_tray_badge', { count: safeCount }).catch(() => {});
    } else if (kind === 'electron') {
      getElectronApi()?.setTrayBadge?.(safeCount);
    }

    if (typeof document !== 'undefined') {
      const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = safeCount > 0 ? `(${safeCount}) ${baseTitle}` : baseTitle;
    }
  }

  public setAppIcon(dataUrl: string): void {
    if (!dataUrl) return;
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      getElectronApi()?.setAppIcon?.(dataUrl);
    }
    if (typeof document !== 'undefined') {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = dataUrl;
    }
  }

  public relaunchApp(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'tauri') {
      getTauriInternals()?.invoke('relaunch_app').catch(() => {
        if (typeof window !== 'undefined') window.location.reload();
      });
      return;
    }
    if (kind === 'electron' && getElectronApi()?.relaunchApp) {
      getElectronApi()?.relaunchApp?.();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  public clearCacheAndReload(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'electron' && getElectronApi()?.clearCacheAndReload) {
      getElectronApi()?.clearCacheAndReload?.();
      return;
    }
    if (typeof window !== 'undefined') {
      if (typeof caches !== 'undefined') {
        caches
          .keys()
          .then((names) => Promise.all(names.map((name) => caches.delete(name))))
          .finally(() => window.location.reload());
      } else {
        window.location.reload();
      }
    }
  }

  public setZoomFactor(factor: number): void {
    const raw = Number(factor);
    const clamped = Math.max(0.5, Math.min(2.0, Number.isFinite(raw) ? raw : 1.0));
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      getElectronApi()?.setZoomFactor?.(clamped);
    } else if (kind === 'tauri') {
      getTauriInternals()?.invoke('set_zoom_factor', { factor: clamped }).catch(() => {});
    }
  }

  public async getZoomFactor(): Promise<number> {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      try {
        const val = await getElectronApi()?.getZoomFactor?.();
        return typeof val === 'number' && Number.isFinite(val) ? val : 1.0;
      } catch {
        return 1.0;
      }
    }
    if (kind === 'tauri') {
      try {
        const val = await getTauriInternals()?.invoke<number>('get_zoom_factor');
        return typeof val === 'number' && Number.isFinite(val) ? val : 1.0;
      } catch {
        return 1.0;
      }
    }
    return 1.0;
  }

  public onZoomChanged(cb: (factor: number) => void): () => void {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      return getElectronApi()?.onZoomChanged?.(cb) ?? (() => {});
    }
    if (kind === 'tauri') {
      return listenTauriEvent<number>('zoom-changed', (factor) => {
        if (typeof factor === 'number' && Number.isFinite(factor)) {
          cb(factor);
        }
      });
    }
    return () => {};
  }

  public resetWindowBounds(): void {
    const kind = this.getRuntimeKind();
    if (kind === 'electron') {
      getElectronApi()?.resetWindowBounds?.();
    } else if (kind === 'tauri') {
      getTauriInternals()?.invoke('reset_window_bounds').catch(() => {});
    }
  }
}

export const desktopBridge = new DesktopBridgeService();

export const isDesktopApp = (): boolean => desktopBridge.isDesktopApp();
export const getRuntimeKind = (): DesktopRuntimeKind => desktopBridge.getRuntimeKind();
export const minimize = (): void => desktopBridge.minimize();
export const maximize = (): void => desktopBridge.maximize();
export const close = (): void => desktopBridge.close();
export const isMaximized = (): Promise<boolean> => desktopBridge.isMaximized();
export const onMaximizeChange = (cb: (maximized: boolean) => void): (() => void) =>
  desktopBridge.onMaximizeChange(cb);
export const getDesktopSources = (): Promise<DesktopCaptureSource[]> => desktopBridge.getDesktopSources();
export const selectCaptureSource = (sourceId: string): Promise<boolean> =>
  desktopBridge.selectCaptureSource(sourceId);
export const setOverlayMode = (enabled: boolean, interactive: boolean = true): Promise<boolean> =>
  desktopBridge.setOverlayMode(enabled, interactive);
export const onToggleOverlay = (cb: () => void): (() => void) => desktopBridge.onToggleOverlay(cb);
export const onToggleMute = (cb: () => void): (() => void) => desktopBridge.onToggleMute(cb);
export const onToggleDeafen = (cb: () => void): (() => void) => desktopBridge.onToggleDeafen(cb);
export const onJoinVoice = (cb: (roomName: string) => void): (() => void) => desktopBridge.onJoinVoice(cb);
export const openThemeFileDialog = (): Promise<ThemeFileDialogResult | null> =>
  desktopBridge.openThemeFileDialog();
export const setTrayBadge = (count: number): void => desktopBridge.setTrayBadge(count);
export const setAppIcon = (dataUrl: string): void => desktopBridge.setAppIcon(dataUrl);
export const relaunchApp = (): void => desktopBridge.relaunchApp();
export const clearCacheAndReload = (): void => desktopBridge.clearCacheAndReload();
export const setZoomFactor = (factor: number): void => desktopBridge.setZoomFactor(factor);
export const getZoomFactor = (): Promise<number> => desktopBridge.getZoomFactor();
export const onZoomChanged = (cb: (factor: number) => void): (() => void) =>
  desktopBridge.onZoomChanged(cb);
export const resetWindowBounds = (): void => desktopBridge.resetWindowBounds();
