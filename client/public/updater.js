// Protutech Browser Freshness & Live Auto-Update Sentinel
(function() {
  'use strict';

  // 1. Unregister legacy service workers and clear cache storage
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for (let r of registrations) {
        r.unregister();
      }
    });
  }
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
      }
    });
  }

  // 2. Continuous server version tracking
  let currentServerBuild = null;
  let updateBannerActive = false;

  async function checkLatestVersion() {
    try {
      const res = await fetch('/version.json?_nocache=' + Date.now(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.buildTime) return;

      if (currentServerBuild === null) {
        currentServerBuild = data.buildTime;
        console.log('[Protutech] Fresh session active. Build: ' + data.version + ' (' + data.buildTime + ')');
        return;
      }

      if (data.buildTime > currentServerBuild) {
        console.log('[Protutech] Newer build detected on server: ' + data.buildTime + ' > ' + currentServerBuild);
        triggerSeamlessReload(data);
      }
    } catch (err) {
      // Network hiccup or offline; retry on next tick
    }
  }

  function triggerSeamlessReload(data) {
    if (updateBannerActive) return;
    updateBannerActive = true;

    const banner = document.createElement('div');
    banner.id = 'protutech-update-banner';
    banner.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 999999',
      'background: #0d1636',
      'border: 1px solid #38bdf8',
      'box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85)',
      'padding: 14px 20px',
      'border-radius: 12px',
      'display: flex',
      'align-items: center',
      'gap: 16px',
      'color: #ffffff',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      'font-size: 13px',
      'animation: protutechFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    ].join('; ');

    banner.innerHTML = [
      '<div style="display:flex; align-items:center; gap:10px;">',
      '  <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#10b981; box-shadow:0 0 8px #10b981;"></span>',
      '  <span><strong>Protutech Updated</strong> &bull; Version ' + (data && data.version ? data.version : 'latest') + ' is live. Reloading...</span>',
      '</div>',
      '<button type="button" id="protutech-reload-btn" style="background:#1d4ed8; color:#ffffff; border:none; border-radius:6px; padding:6px 14px; font-size:12px; font-weight:600; cursor:pointer;">Refresh Now</button>'
    ].join('');

    document.body.appendChild(banner);

    const btn = document.getElementById('protutech-reload-btn');
    if (btn) {
      btn.addEventListener('click', function() {
        window.location.reload(true);
      });
    }

    // Auto-refresh after 2 seconds
    setTimeout(function() {
      window.location.reload(true);
    }, 2000);
  }

  // Initial check on page load
  checkLatestVersion();

  // Background polling every 15 seconds
  setInterval(checkLatestVersion, 15000);

  // Instant re-validation when tab regains focus or visibility
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      checkLatestVersion();
    }
  });
  window.addEventListener('focus', checkLatestVersion);
})();
