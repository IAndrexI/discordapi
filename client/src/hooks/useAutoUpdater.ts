import { useEffect, useRef, useState } from 'react';

interface VersionPayload {
  version: string;
  buildTime: number;
  updatedAt: string;
}

export function useAutoUpdater() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const initialBuildTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    let isDisposed = false;

    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?_nocache=${Date.now()}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
          },
        });
        if (!res.ok) return;
        const data: VersionPayload = await res.json();
        if (!data || !data.buildTime) return;

        if (initialBuildTimeRef.current === null) {
          initialBuildTimeRef.current = data.buildTime;
          console.log(`[AutoUpdater] Initialized on build ${data.version} (${data.buildTime})`);
          return;
        }

        if (data.buildTime > initialBuildTimeRef.current && !isDisposed) {
          console.log(`[AutoUpdater] Newer build detected: ${data.buildTime} > ${initialBuildTimeRef.current}`);
          setUpdateAvailable(true);
          setNewVersion(data.version);

          // Auto-reload after brief countdown to ensure seamless freshness
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      } catch {
        // Offline or transient network issue
      }
    };

    // Initial check
    checkVersion();

    // Poll every 10 seconds for real-time responsiveness
    timer = window.setInterval(checkVersion, 10000);

    const onFocus = () => checkVersion();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkVersion();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      isDisposed = true;
      if (timer) clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return { updateAvailable, newVersion };
}
