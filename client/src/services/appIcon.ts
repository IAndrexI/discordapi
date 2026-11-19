// Protutech App Icon Management Service

export interface AppIconPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  url: string;
  previewGradient: string;
}

// Crisp embedded SVG icons converted to data URIs so they load anywhere instantly without network
const CYBERPUNK_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a051b"/>
      <stop offset="100%" stop-color="#19073b"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f0ff"/>
      <stop offset="100%" stop-color="#ff0077"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <rect x="24" y="24" width="464" height="464" rx="104" fill="none" stroke="url(#neon)" stroke-width="12" opacity="0.8"/>
  <path d="M160 120 h120 c60 0 100 40 100 95 c0 55 -40 95 -100 95 h-60 v100 h-60 Z M220 180 v70 h60 c30 0 45 -15 45 -35 c0 -20 -15 -35 -45 -35 Z" fill="url(#neon)"/>
  <circle cx="360" cy="380" r="16" fill="#00f0ff"/>
  <circle cx="390" cy="340" r="10" fill="#ff0077"/>
</svg>`)}`;

const EMERALD_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#03160e"/>
      <stop offset="100%" stop-color="#062b1b"/>
    </linearGradient>
    <linearGradient id="em" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#34d399"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <path d="M256 48 L416 112 v144 c0 112 -72 208 -160 232 c-88 -24 -160 -120 -160 -232 V112 Z" fill="none" stroke="url(#em)" stroke-width="16"/>
  <path d="M190 160 h90 c40 0 70 25 70 65 c0 40 -30 65 -70 65 h-40 v80 h-50 Z M240 210 v40 h40 c15 0 25 -8 25 -20 c0 -12 -10 -20 -25 -20 Z" fill="url(#em)"/>
</svg>`)}`;

const OBSIDIAN_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="100%" stop-color="#121824"/>
    </linearGradient>
    <linearGradient id="silver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <rect x="20" y="20" width="472" height="472" rx="108" fill="none" stroke="url(#silver)" stroke-width="8" opacity="0.4"/>
  <path d="M170 140 h110 c55 0 90 35 90 85 c0 50 -35 85 -90 85 h-55 v80 h-55 Z M225 190 v60 h55 c25 0 35 -12 35 -30 c0 -18 -10 -30 -35 -30 Z" fill="url(#silver)"/>
</svg>`)}`;

const SOLAR_ICON = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e0c03"/>
      <stop offset="100%" stop-color="#3d1806"/>
    </linearGradient>
    <linearGradient id="flame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="128" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="url(#flame)" stroke-width="14" opacity="0.7"/>
  <path d="M170 140 h110 c55 0 90 35 90 85 c0 50 -35 85 -90 85 h-55 v80 h-55 Z M225 190 v60 h55 c25 0 35 -12 35 -30 c0 -18 -10 -30 -35 -30 Z" fill="url(#flame)"/>
</svg>`)}`;

export const APP_ICON_PRESETS: AppIconPreset[] = [
  {
    id: 'default',
    name: 'Protutech Mountain Cloud',
    tag: 'Official',
    description: 'The official Protutech cloud emblem with mountain peak and circuit paths.',
    url: '/protutech_logo.png',
    previewGradient: 'from-sky-900 to-indigo-950',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    tag: 'Synthwave',
    description: 'Electric cyan and neon magenta badge with dark grid styling.',
    url: CYBERPUNK_ICON,
    previewGradient: 'from-fuchsia-950 to-cyan-950',
  },
  {
    id: 'emerald',
    name: 'Emerald Matrix',
    tag: 'Tactical',
    description: 'Terminal green shield badge engineered for night missions.',
    url: EMERALD_ICON,
    previewGradient: 'from-emerald-950 to-teal-950',
  },
  {
    id: 'obsidian',
    name: 'Obsidian Midnight',
    tag: 'Stealth',
    description: 'Minimalist silver brushed steel on deep AMOLED black.',
    url: OBSIDIAN_ICON,
    previewGradient: 'from-neutral-950 to-slate-900',
  },
  {
    id: 'solar',
    name: 'Solar Flare',
    tag: 'Gold',
    description: 'Radiant ember and gold insignia with sun halo ring.',
    url: SOLAR_ICON,
    previewGradient: 'from-amber-950 to-orange-950',
  },
];

class AppIconService {
  private currentIcon: string;
  private listeners: Set<(iconUrl: string) => void> = new Set();

  constructor() {
    this.currentIcon = localStorage.getItem('protutech_app_icon') || '/protutech_logo.png';
  }

  public getIcon(): string {
    return this.currentIcon;
  }

  public setIcon(iconUrl: string): void {
    this.currentIcon = iconUrl;
    localStorage.setItem('protutech_app_icon', iconUrl);

    // 1. Update HTML favicon
    if (typeof document !== 'undefined') {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    }

    // 2. Notify Electron if native desktop
    if (typeof window !== 'undefined' && window.electronAPI?.setAppIcon) {
      window.electronAPI.setAppIcon(iconUrl);
    }

    // 3. Notify subscribers
    this.listeners.forEach(cb => cb(iconUrl));
  }

  public subscribe(cb: (iconUrl: string) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentIcon);
    return () => this.listeners.delete(cb);
  }
}

export const appIconService = new AppIconService();
