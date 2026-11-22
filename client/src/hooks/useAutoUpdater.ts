import { useCallback, useEffect, useRef, useState } from 'react';
import pkg from '../../package.json';

interface VersionPayload {
  version: string;
  buildTime: number;
  updatedAt?: string;
}

export interface ManualUpdateCheckResult {
  status: 'up-to-date' | 'update-available' | 'error';
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
}

const UPDATER_PREF_KEY = 'protutech_auto_updater_enabled';
const UPDATER_PREF_EVENT = 'protutech:updater-pref-changed';

export const CURRENT_APP_VERSION: string = pkg.version || '1.0.8';

export function isAutoUpdaterEnabled(): boolean {
  try {
    const val = localStorage.getItem(UPDATER_PREF_KEY);
    return val !== 'false';
  } catch {
    return true;
  }
}

export function setAutoUpdaterEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(UPDATER_PREF_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(UPDATER_PREF_EVENT, { detail: enabled }));
  } catch {
    // Ignore storage errors
  }
}

async function fetchLatestVersionPayload(): Promise<VersionPayload | null> {
  const endpoints = [
    `/version.json?_nocache=${Date.now()}`,
    `https://chat.protutech.vip/version.json?_nocache=${Date.now()}`,
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (!res.ok) continue;
      const data = (await res.json()) as VersionPayload;
      if (data && data.version) return data;
    } catch {
      // Try next endpoint
    }
  }
  return null;
}

export function useAutoUpdater() {
  const [autoUpdaterEnabled, setEnabledState] = useState<boolean>(() => isAutoUpdaterEnabled());
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const initialBuildTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const onPrefChange = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      const next = typeof detail === 'boolean' ? detail : isAutoUpdaterEnabled();
      setEnabledState(next);
      if (!next) {
        setUpdateAvailable(false);
      }
    };
    window.addEventListener(UPDATER_PREF_EVENT, onPrefChange);
    return () => window.removeEventListener(UPDATER_PREF_EVENT, onPrefChange);
  }, []);

  useEffect(() => {
    if (!autoUpdaterEnabled) return;

    let timer: number | null = null;
    let isDisposed = false;

    const checkVersion = async () => {
      const data = await fetchLatestVersionPayload();
      if (!data || !data.buildTime || isDisposed) return;

      if (initialBuildTimeRef.current === null) {
        initialBuildTimeRef.current = data.buildTime;
        return;
      }

      if (data.buildTime > initialBuildTimeRef.current && !isDisposed) {
        setUpdateAvailable(true);
        setNewVersion(data.version);
      }
    };

    void checkVersion();
    timer = window.setInterval(() => void checkVersion(), 15000);

    const onFocus = () => void checkVersion();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkVersion();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isDisposed = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoUpdaterEnabled]);

  const checkForUpdatesNow = useCallback(async (): Promise<ManualUpdateCheckResult> => {
    setChecking(true);
    try {
      const data = await fetchLatestVersionPayload();
      setLastCheckedAt(Date.now());
      if (!data) {
        return { status: 'error', currentVersion: CURRENT_APP_VERSION };
      }
      const isNewer =
        data.version !== CURRENT_APP_VERSION ||
        (initialBuildTimeRef.current !== null && data.buildTime > initialBuildTimeRef.current);
      if (isNewer) {
        setUpdateAvailable(true);
        setNewVersion(data.version);
        return {
          status: 'update-available',
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: data.version,
          downloadUrl: 'https://chat.protutech.vip/downloads/ProtutechChat-Setup.exe',
        };
      }
      return {
        status: 'up-to-date',
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: data.version,
      };
    } finally {
      setChecking(false);
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const restartAndApplyUpdate = useCallback(async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.downloadAndInstallUpdate) {
      const res = await window.electronAPI.downloadAndInstallUpdate(
        'https://chat.protutech.vip/downloads/ProtutechChat-Setup.exe'
      );
      if (res.ok) return;
    }
    if (typeof window !== 'undefined' && window.electronAPI?.relaunchApp) {
      window.electronAPI.relaunchApp();
    } else {
      if ('caches' in window) {
        void caches.keys().then(names => {
          names.forEach(name => void caches.delete(name));
        });
      }
      window.location.reload();
    }
  }, []);

  return {
    currentVersion: CURRENT_APP_VERSION,
    autoUpdaterEnabled,
    setAutoUpdaterEnabled,
    updateAvailable,
    newVersion,
    checking,
    lastCheckedAt,
    checkForUpdatesNow,
    dismissUpdate,
    restartAndApplyUpdate,
  };
}
