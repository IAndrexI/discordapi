import type { WebcamBackgroundConfig } from '../types';

const STORAGE_KEY_BG = 'protutech_webcam_background_v1';
const STORAGE_KEY_UPLOADS = 'protutech_webcam_user_uploads';
const STORAGE_KEY_DEVICE_ID = 'protutech_webcam_device_id_v1';
const STORAGE_KEY_MIRROR = 'protutech_webcam_mirror_v1';

export interface WebcamPreset {
  id: string;
  name: string;
  previewUrl: string;
  category: 'cyberpunk' | 'gaming' | 'ambient' | 'nature' | 'studio' | 'space';
}

function svgToDataUri(innerSvg: string): string {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" preserveAspectRatio="xMidYMid slice">${innerSvg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(doc)}`;
}

export const WEBCAM_PRESETS: WebcamPreset[] = [
  {
    id: 'discord_cozy_studio',
    name: 'Cozy Blurple Studio',
    category: 'studio',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#141624"/>
          <stop offset="55%" stop-color="#1e2238"/>
          <stop offset="100%" stop-color="#2b2140"/>
        </linearGradient>
        <radialGradient id="blurpleGlow" cx="22%" cy="30%" r="55%">
          <stop offset="0%" stop-color="#5865f2" stop-opacity="0.65"/>
          <stop offset="100%" stop-color="#5865f2" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="warmLamp" cx="85%" cy="28%" r="48%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="shelfWood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3c2f2f"/>
          <stop offset="100%" stop-color="#53403c"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bg)"/>
      <rect width="1280" height="720" fill="url(#blurpleGlow)"/>
      <rect width="1280" height="720" fill="url(#warmLamp)"/>
      <!-- Left acoustic hex wall -->
      <g fill="#23263d" stroke="#5865f2" stroke-opacity="0.35" stroke-width="2">
        <polygon points="110,95 160,66 210,95 210,153 160,182 110,153"/>
        <polygon points="216,155 266,126 316,155 316,213 266,242 216,213"/>
        <polygon points="110,215 160,186 210,215 210,273 160,302 110,273"/>
        <polygon points="4,155 54,126 104,155 104,213 54,242 4,213"/>
      </g>
      <!-- Left floating shelf + plant + Blurple neon icon -->
      <rect x="48" y="390" width="290" height="16" rx="4" fill="url(#shelfWood)"/>
      <rect x="48" y="406" width="290" height="5" fill="#5865f2" opacity="0.7"/>
      <rect x="86" y="330" width="54" height="60" rx="8" fill="#2e3348"/>
      <ellipse cx="113" cy="316" rx="34" ry="20" fill="#10b981" opacity="0.85"/>
      <ellipse cx="96" cy="304" rx="16" ry="24" fill="#34d399" opacity="0.85"/>
      <ellipse cx="130" cy="306" rx="16" ry="22" fill="#059669" opacity="0.85"/>
      <rect x="195" y="295" width="76" height="95" rx="14" fill="#181b2c" stroke="#5865f2" stroke-width="3"/>
      <circle cx="233" cy="342" r="22" fill="#5865f2" opacity="0.85"/>
      <path d="M220 342 L230 351 L248 332" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>
      <!-- Right studio lamp & vinyl shelves -->
      <rect x="945" y="130" width="280" height="14" rx="4" fill="url(#shelfWood)"/>
      <rect x="975" y="65" width="60" height="65" rx="6" fill="#312e81" stroke="#818cf8" stroke-width="2"/>
      <rect x="1055" y="55" width="68" height="75" rx="6" fill="#4c1d95" stroke="#c084fc" stroke-width="2"/>
      <circle cx="1175" cy="95" r="32" fill="#1f2937" stroke="#60a5fa" stroke-width="2"/>
      <circle cx="1175" cy="95" r="10" fill="#5865f2"/>
      <!-- Floor lamp on right -->
      <rect x="1120" y="260" width="8" height="460" fill="#27272a"/>
      <ellipse cx="1124" cy="255" rx="65" ry="38" fill="#fde68a" opacity="0.9"/>
      <ellipse cx="1124" cy="260" rx="115" ry="70" fill="#f59e0b" opacity="0.22"/>
      <!-- Subtle Blurple LED strip along baseboard -->
      <rect x="0" y="662" width="1280" height="58" fill="#10121c"/>
      <rect x="0" y="660" width="1280" height="4" fill="#5865f2" opacity="0.8"/>
    `),
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon Skyline',
    category: 'cyberpunk',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#050510"/>
          <stop offset="50%" stop-color="#13092b"/>
          <stop offset="100%" stop-color="#290b3d"/>
        </linearGradient>
        <radialGradient id="cyanHaze" cx="18%" cy="62%" r="48%">
          <stop offset="0%" stop-color="#00f5d4" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#00f5d4" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="pinkHaze" cx="84%" cy="54%" r="50%">
          <stop offset="0%" stop-color="#ff2a85" stop-opacity="0.5"/>
          <stop offset="100%" stop-color="#ff2a85" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#sky)"/>
      <rect width="1280" height="720" fill="url(#cyanHaze)"/>
      <rect width="1280" height="720" fill="url(#pinkHaze)"/>
      <!-- Distant skyline silhouettes -->
      <g fill="#0c0a1f">
        <rect x="0" y="210" width="130" height="510"/>
        <rect x="145" y="130" width="110" height="590"/>
        <rect x="270" y="290" width="95" height="430"/>
        <rect x="910" y="240" width="105" height="480"/>
        <rect x="1030" y="95" width="125" height="625"/>
        <rect x="1170" y="185" width="110" height="535"/>
      </g>
      <!-- Neon skyscraper windows & vertical signs (left) -->
      <rect x="165" y="155" width="70" height="16" fill="#00f5d4" opacity="0.9"/>
      <rect x="165" y="185" width="70" height="6" fill="#38bdf8" opacity="0.7"/>
      <rect x="30" y="255" width="54" height="230" rx="6" fill="#0f172a" stroke="#ff2a85" stroke-width="3"/>
      <line x1="57" y1="278" x2="57" y2="462" stroke="#ff2a85" stroke-width="6" stroke-dasharray="22 14"/>
      <rect x="285" y="325" width="58" height="140" rx="4" fill="#0f172a" stroke="#00f5d4" stroke-width="2.5"/>
      <circle cx="314" cy="365" r="14" fill="none" stroke="#00f5d4" stroke-width="3"/>
      <!-- Neon signs (right) -->
      <rect x="1052" y="120" width="80" height="18" fill="#ff2a85" opacity="0.9"/>
      <rect x="1052" y="150" width="50" height="8" fill="#a855f7"/>
      <rect x="935" y="275" width="52" height="190" rx="5" fill="#090d1e" stroke="#00f5d4" stroke-width="3"/>
      <line x1="961" y1="298" x2="961" y2="442" stroke="#00f5d4" stroke-width="5" stroke-dasharray="18 12"/>
      <rect x="1190" y="220" width="66" height="175" rx="6" fill="#160a2e" stroke="#f43f5e" stroke-width="3"/>
      <rect x="1206" y="245" width="34" height="34" fill="#ff2a85" opacity="0.85"/>
      <!-- Rain streaks -->
      <g stroke="#38bdf8" stroke-opacity="0.22" stroke-width="1.5">
        <line x1="95" y1="40" x2="75" y2="120"/>
        <line x1="250" y1="80" x2="230" y2="160"/>
        <line x1="990" y1="60" x2="970" y2="145"/>
        <line x1="1150" y1="30" x2="1130" y2="115"/>
      </g>
      <!-- Elevated monorail & wet street reflection -->
      <rect x="0" y="545" width="1280" height="12" fill="#080714"/>
      <line x1="0" y1="545" x2="1280" y2="545" stroke="#00f5d4" stroke-width="2" opacity="0.6"/>
      <rect x="0" y="610" width="1280" height="110" fill="#070512"/>
      <ellipse cx="180" cy="665" rx="140" ry="18" fill="#00f5d4" opacity="0.16"/>
      <ellipse cx="1100" cy="665" rx="160" ry="20" fill="#ff2a85" opacity="0.18"/>
    `),
  },
  {
    id: 'gaming_battlestation',
    name: 'RGB Battlestation',
    category: 'gaming',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b0d14"/>
          <stop offset="50%" stop-color="#131624"/>
          <stop offset="100%" stop-color="#0a0c12"/>
        </linearGradient>
        <linearGradient id="rgbLeft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#00f5d4"/>
          <stop offset="50%" stop-color="#5865f2"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <linearGradient id="rgbRight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ec4899"/>
          <stop offset="50%" stop-color="#8b5cf6"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#wall)"/>
      <!-- Ambient corner glows -->
      <circle cx="150" cy="240" r="240" fill="#06b6d4" opacity="0.15"/>
      <circle cx="1130" cy="260" r="260" fill="#ec4899" opacity="0.16"/>
      <!-- Left LED light bars + geometric nanoleaf tiles -->
      <rect x="44" y="70" width="14" height="520" rx="7" fill="url(#rgbLeft)"/>
      <g fill="#1b1f30" stroke-width="4">
        <polygon points="150,120 205,88 260,120 260,184 205,216 150,184" stroke="#06b6d4"/>
        <polygon points="212,222 267,190 322,222 322,286 267,318 212,286" stroke="#5865f2"/>
        <polygon points="94,222 149,190 204,222 204,286 149,318 94,286" stroke="#ec4899"/>
      </g>
      <!-- Left display shelf with collectibles -->
      <rect x="64" y="455" width="260" height="14" rx="4" fill="#1e2233"/>
      <rect x="64" y="469" width="260" height="3" fill="#06b6d4"/>
      <rect x="96" y="405" width="44" height="50" rx="6" fill="#312e81" stroke="#38bdf8" stroke-width="2"/>
      <rect x="165" y="390" width="60" height="65" rx="8" fill="#1e1b4b" stroke="#c084fc" stroke-width="2"/>
      <!-- Right RGB PC Tower & Nanoleaf -->
      <rect x="1222" y="70" width="14" height="520" rx="7" fill="url(#rgbRight)"/>
      <g fill="#1b1f30" stroke-width="4">
        <polygon points="990,110 1045,78 1100,110 1100,174 1045,206 990,174" stroke="#ec4899"/>
        <polygon points="1055,212 1110,180 1165,212 1165,276 1110,308 1055,276" stroke="#8b5cf6"/>
      </g>
      <!-- PC case on right desk -->
      <rect x="975" y="365" width="195" height="250" rx="12" fill="#11131d" stroke="#2e344b" stroke-width="3"/>
      <rect x="992" y="382" width="161" height="216" rx="8" fill="#090b12"/>
      <circle cx="1072" cy="438" r="32" fill="none" stroke="#06b6d4" stroke-width="5"/>
      <circle cx="1072" cy="438" r="14" fill="#5865f2" opacity="0.6"/>
      <circle cx="1072" cy="522" r="32" fill="none" stroke="#ec4899" stroke-width="5"/>
      <circle cx="1072" cy="522" r="14" fill="#a855f7" opacity="0.6"/>
      <!-- Desk surface -->
      <rect x="0" y="615" width="1280" height="105" fill="#10121c"/>
      <rect x="0" y="615" width="1280" height="4" fill="url(#rgbLeft)"/>
    `),
  },
  {
    id: 'synthwave_sunset',
    name: 'Synthwave 80s Sunset',
    category: 'cyberpunk',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="retroSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090218"/>
          <stop offset="48%" stop-color="#2b0a4e"/>
          <stop offset="72%" stop-color="#7c1662"/>
          <stop offset="100%" stop-color="#ff4d8d"/>
        </linearGradient>
        <linearGradient id="sunGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="50%" stop-color="#fb923c"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
        <clipPath id="sunClip">
          <rect x="440" y="130" width="400" height="230"/>
        </clipPath>
      </defs>
      <rect width="1280" height="470" fill="url(#retroSky)"/>
      <!-- Stars -->
      <g fill="#ffffff" opacity="0.75">
        <circle cx="110" cy="70" r="2"/><circle cx="240" cy="120" r="1.5"/>
        <circle cx="380" cy="55" r="2.2"/><circle cx="890" cy="85" r="2"/>
        <circle cx="1040" cy="50" r="1.8"/><circle cx="1180" cy="135" r="2.4"/>
        <circle cx="155" cy="190" r="1.5"/><circle cx="1120" cy="210" r="1.6"/>
      </g>
      <!-- Retro striped sun -->
      <g clip-path="url(#sunClip)">
        <circle cx="640" cy="310" r="165" fill="url(#sunGrad)"/>
        <rect x="440" y="295" width="400" height="10" fill="#2b0a4e"/>
        <rect x="440" y="320" width="400" height="14" fill="#460f57"/>
        <rect x="440" y="346" width="400" height="18" fill="#68145e"/>
      </g>
      <!-- Left & Right mountains framing center -->
      <polygon points="0,470 0,320 135,235 280,350 400,290 520,470" fill="#17062d"/>
      <polygon points="135,235 190,340 280,350" fill="#290a4d"/>
      <polygon points="760,470 890,285 1015,345 1145,220 1280,315 1280,470" fill="#17062d"/>
      <polygon points="1145,220 1070,345 1015,345" fill="#290a4d"/>
      <!-- Horizon & neon grid -->
      <rect x="0" y="470" width="1280" height="250" fill="#0c021f"/>
      <line x1="0" y1="470" x2="1280" y2="470" stroke="#00f5d4" stroke-width="3"/>
      <g stroke="#d946ef" stroke-width="2" opacity="0.65">
        <line x1="640" y1="470" x2="-160" y2="720"/>
        <line x1="640" y1="470" x2="90" y2="720"/>
        <line x1="640" y1="470" x2="310" y2="720"/>
        <line x1="640" y1="470" x2="510" y2="720"/>
        <line x1="640" y1="470" x2="770" y2="720"/>
        <line x1="640" y1="470" x2="970" y2="720"/>
        <line x1="640" y1="470" x2="1190" y2="720"/>
        <line x1="640" y1="470" x2="1440" y2="720"/>
        <line x1="0" y1="505" x2="1280" y2="505"/>
        <line x1="0" y1="550" x2="1280" y2="550"/>
        <line x1="0" y1="610" x2="1280" y2="610"/>
        <line x1="0" y1="680" x2="1280" y2="680"/>
      </g>
    `),
  },
  {
    id: 'aurora_borealis',
    name: 'Northern Lights Aurora',
    category: 'nature',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="nightSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#030712"/>
          <stop offset="65%" stop-color="#081c2e"/>
          <stop offset="100%" stop-color="#0f2942"/>
        </linearGradient>
        <linearGradient id="aurora1" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.7"/>
          <stop offset="50%" stop-color="#06b6d4" stop-opacity="0.6"/>
          <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.65"/>
        </linearGradient>
        <linearGradient id="aurora2" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#34d399" stop-opacity="0.45"/>
          <stop offset="55%" stop-color="#22d3ee" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#a855f7" stop-opacity="0.45"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#nightSky)"/>
      <!-- Starfield -->
      <g fill="#e2e8f0" opacity="0.8">
        <circle cx="90" cy="60" r="1.8"/><circle cx="215" cy="95" r="2.2"/>
        <circle cx="350" cy="48" r="1.5"/><circle cx="790" cy="62" r="2"/>
        <circle cx="940" cy="42" r="2.3"/><circle cx="1120" cy="88" r="1.8"/>
        <circle cx="1210" cy="145" r="1.5"/><circle cx="135" cy="180" r="1.5"/>
      </g>
      <!-- Sweeping Aurora Ribbons -->
      <path d="M-40,260 Q220,90 480,210 T1000,150 T1320,230 L1320,380 Q980,270 680,340 T200,320 L-40,390 Z" fill="url(#aurora1)" opacity="0.62"/>
      <path d="M-20,170 Q310,270 620,140 T1290,190 L1290,295 Q940,200 620,270 T-20,280 Z" fill="url(#aurora2)" opacity="0.58"/>
      <!-- Snowy peaks & pines -->
      <polygon points="0,560 180,355 340,490 510,390 660,560" fill="#0b1628"/>
      <polygon points="620,560 800,375 970,495 1135,340 1280,480 1280,560" fill="#0b1628"/>
      <polygon points="180,355 230,410 155,415" fill="#cbd5e1" opacity="0.35"/>
      <polygon points="1135,340 1185,395 1105,405" fill="#cbd5e1" opacity="0.35"/>
      <!-- Fjord lake reflection -->
      <rect x="0" y="560" width="1280" height="160" fill="#061221"/>
      <ellipse cx="260" cy="635" rx="220" ry="38" fill="#10b981" opacity="0.18"/>
      <ellipse cx="980" cy="645" rx="250" ry="42" fill="#06b6d4" opacity="0.18"/>
    `),
  },
  {
    id: 'studio_minimal_dark',
    name: 'Minimal Dark Office',
    category: 'studio',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="officeWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#17191f"/>
          <stop offset="100%" stop-color="#111318"/>
        </linearGradient>
        <radialGradient id="spotLeft" cx="15%" cy="15%" r="48%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="spotRight" cx="85%" cy="15%" r="48%">
          <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#f59e0b" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#officeWall)"/>
      <rect width="1280" height="720" fill="url(#spotLeft)"/>
      <rect width="1280" height="720" fill="url(#spotRight)"/>
      <!-- Architectural vertical wood slats on left & right -->
      <g fill="#2b211a" stroke="#18130f" stroke-width="2">
        <rect x="20" y="0" width="26" height="650"/><rect x="58" y="0" width="26" height="650"/>
        <rect x="96" y="0" width="26" height="650"/><rect x="134" y="0" width="26" height="650"/>
        <rect x="172" y="0" width="26" height="650"/><rect x="210" y="0" width="26" height="650"/>
        <rect x="1044" y="0" width="26" height="650"/><rect x="1082" y="0" width="26" height="650"/>
        <rect x="1120" y="0" width="26" height="650"/><rect x="1158" y="0" width="26" height="650"/>
        <rect x="1196" y="0" width="26" height="650"/><rect x="1234" y="0" width="26" height="650"/>
      </g>
      <!-- Linear warm LED sconces -->
      <rect x="248" y="85" width="4" height="510" rx="2" fill="#fbbf24" opacity="0.78"/>
      <rect x="1028" y="85" width="4" height="510" rx="2" fill="#fbbf24" opacity="0.78"/>
      <!-- Minimal framed prints -->
      <rect x="75" y="190" width="135" height="175" rx="4" fill="#14161b" stroke="#3f424d" stroke-width="4"/>
      <circle cx="142" cy="277" r="36" fill="none" stroke="#9ca3af" stroke-width="2"/>
      <rect x="1070" y="190" width="135" height="175" rx="4" fill="#14161b" stroke="#3f424d" stroke-width="4"/>
      <line x1="1102" y1="315" x2="1172" y2="235" stroke="#d97706" stroke-width="4"/>
      <!-- Credenza console -->
      <rect x="0" y="650" width="1280" height="70" fill="#0d0e12"/>
      <line x1="0" y1="650" x2="1280" y2="650" stroke="#2c303a" stroke-width="2"/>
    `),
  },
  {
    id: 'deep_space_nebula',
    name: 'Deep Space Nebula',
    category: 'space',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="cosmos" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#03030c"/>
          <stop offset="50%" stop-color="#0a0924"/>
          <stop offset="100%" stop-color="#130826"/>
        </linearGradient>
        <radialGradient id="neb1" cx="25%" cy="38%" r="52%">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.58"/>
          <stop offset="55%" stop-color="#3b82f6" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="neb2" cx="78%" cy="52%" r="50%">
          <stop offset="0%" stop-color="#ec4899" stop-opacity="0.5"/>
          <stop offset="50%" stop-color="#8b5cf6" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="planetGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#1e1b4b"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#cosmos)"/>
      <rect width="1280" height="720" fill="url(#neb1)"/>
      <rect width="1280" height="720" fill="url(#neb2)"/>
      <!-- Dense stars -->
      <g fill="#ffffff">
        <circle cx="70" cy="85" r="1.5" opacity="0.8"/><circle cx="165" cy="45" r="2.2" opacity="0.9"/>
        <circle cx="310" cy="145" r="1.4" opacity="0.7"/><circle cx="420" cy="60" r="1.8" opacity="0.8"/>
        <circle cx="860" cy="95" r="2" opacity="0.9"/><circle cx="970" cy="180" r="1.4" opacity="0.75"/>
        <circle cx="1115" cy="70" r="2.4" opacity="0.95"/><circle cx="1210" cy="215" r="1.6" opacity="0.8"/>
        <circle cx="115" cy="520" r="2" opacity="0.85"/><circle cx="265" cy="610" r="1.4" opacity="0.7"/>
        <circle cx="1010" cy="585" r="1.8" opacity="0.8"/><circle cx="1195" cy="510" r="2.1" opacity="0.9"/>
      </g>
      <!-- Ringed Planet (top-left) -->
      <circle cx="195" cy="215" r="78" fill="url(#planetGrad)"/>
      <ellipse cx="195" cy="215" rx="145" ry="26" transform="rotate(-18 195 215)" fill="none" stroke="#c4b5fd" stroke-width="6" opacity="0.75"/>
      <ellipse cx="195" cy="215" rx="165" ry="32" transform="rotate(-18 195 215)" fill="none" stroke="#38bdf8" stroke-width="2" opacity="0.5"/>
      <!-- Glowing cosmic moon & star cluster (right) -->
      <circle cx="1085" cy="310" r="46" fill="#0f172a" stroke="#f472b6" stroke-width="2" opacity="0.9"/>
      <circle cx="1073" cy="300" r="42" fill="#f472b6" opacity="0.18"/>
      <circle cx="955" cy="135" r="5" fill="#e0f2fe"/>
      <circle cx="955" cy="135" r="18" fill="#38bdf8" opacity="0.25"/>
    `),
  },
  {
    id: 'anime_cafe',
    name: 'Warm Lo-Fi Cafe',
    category: 'ambient',
    previewUrl: svgToDataUri(`
      <defs>
        <linearGradient id="cafeWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1e1512"/>
          <stop offset="100%" stop-color="#2c1d16"/>
        </linearGradient>
        <linearGradient id="windowSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a1a3a"/>
          <stop offset="100%" stop-color="#3f274c"/>
        </linearGradient>
        <radialGradient id="bulbGlow1" cx="19%" cy="22%" r="32%">
          <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="bulbGlow2" cx="82%" cy="25%" r="34%">
          <stop offset="0%" stop-color="#fb923c" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#fb923c" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#cafeWall)"/>
      <!-- Left evening rain window -->
      <rect x="48" y="95" width="310" height="430" rx="18" fill="url(#windowSky)" stroke="#4a3328" stroke-width="10"/>
      <line x1="203" y1="95" x2="203" y2="525" stroke="#4a3328" stroke-width="8"/>
      <line x1="48" y1="305" x2="358" y2="305" stroke="#4a3328" stroke-width="8"/>
      <!-- City bokeh outside window -->
      <circle cx="115" cy="400" r="24" fill="#fbbf24" opacity="0.45"/>
      <circle cx="165" cy="445" r="18" fill="#fb7185" opacity="0.45"/>
      <circle cx="270" cy="420" r="26" fill="#38bdf8" opacity="0.35"/>
      <circle cx="305" cy="465" r="16" fill="#f59e0b" opacity="0.5"/>
      <!-- Right wooden coffee bookshelf -->
      <rect x="920" y="130" width="315" height="440" rx="8" fill="#231712" stroke="#4a3328" stroke-width="6"/>
      <rect x="932" y="255" width="291" height="12" fill="#4a3328"/>
      <rect x="932" y="405" width="291" height="12" fill="#4a3328"/>
      <!-- Books & ceramic mugs -->
      <rect x="955" y="180" width="24" height="75" rx="3" fill="#b45309"/>
      <rect x="984" y="192" width="22" height="63" rx="3" fill="#0f766e"/>
      <rect x="1010" y="172" width="26" height="83" rx="3" fill="#be123c"/>
      <rect x="1125" y="210" width="44" height="45" rx="8" fill="#fde68a"/>
      <rect x="960" y="340" width="52" height="65" rx="8" fill="#78350f"/>
      <ellipse cx="986" cy="330" rx="32" ry="18" fill="#15803d"/>
      <!-- Warm Edison pendant lights -->
      <rect width="1280" height="720" fill="url(#bulbGlow1)"/>
      <rect width="1280" height="720" fill="url(#bulbGlow2)"/>
      <line x1="245" y1="0" x2="245" y2="145" stroke="#181210" stroke-width="4"/>
      <circle cx="245" cy="158" r="16" fill="#fde68a"/>
      <line x1="1045" y1="0" x2="1045" y2="165" stroke="#181210" stroke-width="4"/>
      <circle cx="1045" cy="178" r="16" fill="#fdba74"/>
      <!-- Wooden bar counter -->
      <rect x="0" y="615" width="1280" height="105" fill="#3a261c"/>
      <rect x="0" y="615" width="1280" height="8" fill="#593c2d"/>
    `),
  },
];

class WebcamBackgroundService {
  private currentConfig: WebcamBackgroundConfig = {
    type: 'none',
  };
  private listeners: Set<(config: WebcamBackgroundConfig) => void> = new Set();
  private customUploads: string[] = [];
  private cameraDeviceId = '';
  private mirrorPreview = true;

  constructor() {
    this.loadState();
  }

  private safeGetStorage(key: string): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSetStorage(key: string, value: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
    } catch {
      // Ignore quota / private mode storage errors
    }
  }

  private normalizeConfig(config: WebcamBackgroundConfig): WebcamBackgroundConfig {
    if (config.type === 'preset' && config.presetId) {
      const preset = WEBCAM_PRESETS.find((p) => p.id === config.presetId);
      if (preset) {
        return {
          type: 'preset',
          presetId: preset.id,
          customUrl: preset.previewUrl,
        };
      }
    }
    if (config.type === 'blur') {
      const amount =
        typeof config.blurAmount === 'number' && Number.isFinite(config.blurAmount)
          ? Math.max(6, Math.min(30, Math.round(config.blurAmount)))
          : 14;
      return {
        type: 'blur',
        blurAmount: amount,
      };
    }
    if (config.type === 'custom' && config.customUrl) {
      return {
        type: 'custom',
        customUrl: config.customUrl,
      };
    }
    return { type: 'none' };
  }

  private loadState() {
    try {
      const saved = this.safeGetStorage(STORAGE_KEY_BG);
      if (saved) {
        const parsed = JSON.parse(saved) as WebcamBackgroundConfig;
        this.currentConfig = this.normalizeConfig(parsed);
      }
      const savedUploads = this.safeGetStorage(STORAGE_KEY_UPLOADS);
      if (savedUploads) {
        const parsedUploads = JSON.parse(savedUploads);
        if (Array.isArray(parsedUploads)) {
          this.customUploads = parsedUploads.filter(
            (u): u is string => typeof u === 'string' && u.length > 0
          );
        }
      }
      const savedDeviceId = this.safeGetStorage(STORAGE_KEY_DEVICE_ID);
      if (savedDeviceId !== null) {
        this.cameraDeviceId = savedDeviceId;
      }
      const savedMirror = this.safeGetStorage(STORAGE_KEY_MIRROR);
      if (savedMirror !== null) {
        this.mirrorPreview = savedMirror !== 'false';
      }
    } catch {
      this.currentConfig = { type: 'none' };
    }
  }

  public subscribe(cb: (config: WebcamBackgroundConfig) => void): () => void {
    this.listeners.add(cb);
    cb(this.currentConfig);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.currentConfig));
  }

  public getConfig(): WebcamBackgroundConfig {
    return this.currentConfig;
  }

  public setConfig(config: WebcamBackgroundConfig) {
    const normalized = this.normalizeConfig(config);
    this.currentConfig = normalized;
    this.safeSetStorage(STORAGE_KEY_BG, JSON.stringify(normalized));
    this.notify();
  }

  public setBlur(amount = 12) {
    this.setConfig({
      type: 'blur',
      blurAmount: amount,
    });
  }

  public setPreset(presetId: string) {
    const preset = WEBCAM_PRESETS.find((p) => p.id === presetId);
    this.setConfig({
      type: 'preset',
      presetId,
      customUrl: preset?.previewUrl,
    });
  }

  public setCustomImage(urlOrBase64: string) {
    if (!urlOrBase64) return;
    if (!this.customUploads.includes(urlOrBase64)) {
      this.customUploads = [urlOrBase64, ...this.customUploads].slice(0, 8);
      this.safeSetStorage(STORAGE_KEY_UPLOADS, JSON.stringify(this.customUploads));
    }
    this.setConfig({
      type: 'custom',
      customUrl: urlOrBase64,
    });
  }

  public deleteCustomUpload(url: string) {
    this.customUploads = this.customUploads.filter((item) => item !== url);
    this.safeSetStorage(STORAGE_KEY_UPLOADS, JSON.stringify(this.customUploads));
    if (this.currentConfig.type === 'custom' && this.currentConfig.customUrl === url) {
      this.removeBackground();
    }
  }

  public removeBackground() {
    this.setConfig({ type: 'none' });
  }

  public getCustomUploads(): string[] {
    return [...this.customUploads];
  }

  public async listVideoDevices(): Promise<MediaDeviceInfo[]> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'videoinput');
    } catch {
      return [];
    }
  }

  public getCameraDeviceId(): string {
    return this.cameraDeviceId;
  }

  public setCameraDeviceId(deviceId: string): void {
    this.cameraDeviceId = deviceId;
    this.safeSetStorage(STORAGE_KEY_DEVICE_ID, deviceId);
  }

  public getMirrorPreview(): boolean {
    return this.mirrorPreview;
  }

  public setMirrorPreview(mirror: boolean): void {
    this.mirrorPreview = mirror;
    this.safeSetStorage(STORAGE_KEY_MIRROR, mirror ? 'true' : 'false');
  }

  public getPresetById(presetId?: string): WebcamPreset | undefined {
    if (!presetId) return undefined;
    return WEBCAM_PRESETS.find((p) => p.id === presetId);
  }

  public resolveBackgroundUrl(config: WebcamBackgroundConfig = this.currentConfig): string | undefined {
    if (config.type === 'custom') {
      return config.customUrl;
    }
    if (config.type === 'preset') {
      if (config.presetId) {
        const preset = this.getPresetById(config.presetId);
        if (preset) return preset.previewUrl;
      }
      return config.customUrl;
    }
    return undefined;
  }

  public getBackgroundDisplayName(config: WebcamBackgroundConfig = this.currentConfig): string {
    if (config.type === 'none') return 'None';
    if (config.type === 'blur') return `Blur (${config.blurAmount ?? 14}px)`;
    if (config.type === 'preset') {
      return this.getPresetById(config.presetId)?.name || 'Virtual Preset';
    }
    if (config.type === 'custom') return 'Custom Image';
    return 'None';
  }

  public async acquireCameraPreviewStream(deviceId?: string): Promise<MediaStream> {
    const targetDeviceId = deviceId !== undefined ? deviceId : this.cameraDeviceId;
    const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined;

    if (mediaDevices?.getUserMedia) {
      if (targetDeviceId && targetDeviceId !== 'default') {
        try {
          return await mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
            },
            audio: false,
          });
        } catch {
          // Fall through to generic webcam attempt
        }
      }

      try {
        return await mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
      } catch {
        // Fall back to synthetic 30fps studio webcam portrait stream
      }
    }

    return this.createSyntheticPortraitStream();
  }

  private createSyntheticPortraitStream(): MediaStream {
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');

    let phase = 0;
    let blinkTimer = 0;
    let timerId: number | null = null;
    let disposed = false;

    const particles = Array.from({ length: 18 }, (_, i) => ({
      x: ((i * 173) % 1160) + 60,
      y: ((i * 97) % 620) + 40,
      r: 2 + (i % 3),
      speed: 0.4 + (i % 5) * 0.18,
    }));

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
      }
    };

    const renderFrame = () => {
      if (disposed || !ctx) return;
      phase += 0.05;
      blinkTimer = (blinkTimer + 1) % 135;
      const isBlinking = blinkTimer > 128;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const breathY = Math.sin(phase) * 5;
      const swayX = Math.sin(phase * 0.55) * 6;

      // Studio room backdrop (visible when raw or blurred)
      const roomGrad = ctx.createLinearGradient(0, 0, w, h);
      roomGrad.addColorStop(0, '#131624');
      roomGrad.addColorStop(0.5, '#1b1f33');
      roomGrad.addColorStop(1, '#10121c');
      ctx.fillStyle = roomGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft depth rim lights on room walls
      const leftRim = ctx.createRadialGradient(180, 220, 20, 180, 220, 340);
      leftRim.addColorStop(0, 'rgba(88, 101, 242, 0.32)');
      leftRim.addColorStop(1, 'rgba(88, 101, 242, 0)');
      ctx.fillStyle = leftRim;
      ctx.fillRect(0, 0, w, h);

      const rightRim = ctx.createRadialGradient(w - 180, 240, 20, w - 180, 240, 320);
      rightRim.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
      rightRim.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = rightRim;
      ctx.fillRect(0, 0, w, h);

      // Subtle floating studio bokeh dust
      for (const p of particles) {
        const py = (p.y - phase * 18 * p.speed + h) % h;
        const px = p.x + Math.sin(phase + p.y) * 8;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(203, 213, 225, 0.18)';
        ctx.fill();
      }

      // Subject key-light halo behind head & shoulders
      const halo = ctx.createRadialGradient(cx + swayX, 340 + breathY, 40, cx + swayX, 340 + breathY, 270);
      halo.addColorStop(0, 'rgba(88, 101, 242, 0.28)');
      halo.addColorStop(1, 'rgba(88, 101, 242, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);

      // Portrait shoulders & hoodie torso
      ctx.save();
      ctx.translate(swayX, breathY);

      const torsoGrad = ctx.createLinearGradient(cx - 220, 440, cx + 220, h);
      torsoGrad.addColorStop(0, '#313854');
      torsoGrad.addColorStop(1, '#1e2235');
      ctx.beginPath();
      ctx.moveTo(cx - 230, h);
      ctx.quadraticCurveTo(cx - 210, 485, cx - 80, 455);
      ctx.lineTo(cx + 80, 455);
      ctx.quadraticCurveTo(cx + 210, 485, cx + 230, h);
      ctx.closePath();
      ctx.fillStyle = torsoGrad;
      ctx.fill();

      // Subtle rim highlight along shoulders
      ctx.strokeStyle = 'rgba(148, 156, 247, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Neck
      ctx.fillStyle = '#d9a78b';
      ctx.fillRect(cx - 32, 395, 64, 72);

      // Hoodie collar
      ctx.beginPath();
      ctx.ellipse(cx, 462, 72, 26, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#3b4266';
      ctx.fill();

      // Head & face lighting
      const faceGrad = ctx.createRadialGradient(cx - 18, 285, 16, cx, 310, 120);
      faceGrad.addColorStop(0, '#f3cbb4');
      faceGrad.addColorStop(1, '#cf997d');
      ctx.beginPath();
      ctx.ellipse(cx, 310, 86, 106, 0, 0, Math.PI * 2);
      ctx.fillStyle = faceGrad;
      ctx.fill();

      // Hair crown
      ctx.beginPath();
      ctx.arc(cx, 272, 92, Math.PI * 0.96, Math.PI * 2.04);
      ctx.quadraticCurveTo(cx + 46, 232, cx, 238);
      ctx.quadraticCurveTo(cx - 46, 232, cx - 90, 278);
      ctx.fillStyle = '#1f2336';
      ctx.fill();

      // Headset headband & earcups
      ctx.beginPath();
      ctx.arc(cx, 298, 98, Math.PI * 1.05, Math.PI * 1.95);
      ctx.strokeStyle = '#5865f2';
      ctx.lineWidth = 10;
      ctx.stroke();

      ctx.fillStyle = '#181a24';
      ctx.strokeStyle = '#5865f2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cx - 106, 274, 24, 68, 10);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.roundRect(cx + 82, 274, 24, 68, 10);
      ctx.fill();
      ctx.stroke();

      // Eyes (blinking smoothly)
      ctx.fillStyle = '#1e293b';
      if (isBlinking) {
        ctx.fillRect(cx - 42, 304, 22, 3);
        ctx.fillRect(cx + 20, 304, 22, 3);
      } else {
        ctx.beginPath();
        ctx.ellipse(cx - 31, 304, 8, 9, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 31, 304, 8, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx - 29, 301, 2.5, 0, Math.PI * 2);
        ctx.arc(cx + 33, 301, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Friendly subtle smile
      ctx.beginPath();
      ctx.arc(cx, 344, 22, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = '#8b5e4b';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.restore();
    };

    renderFrame();

    const stream =
      typeof canvas.captureStream === 'function'
        ? canvas.captureStream(30)
        : new MediaStream();

    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const originalStop = videoTrack.stop.bind(videoTrack);
      videoTrack.stop = () => {
        cleanup();
        originalStop();
      };
      videoTrack.addEventListener('ended', cleanup);
    }

    timerId = window.setInterval(() => {
      if (videoTrack && videoTrack.readyState === 'ended') {
        cleanup();
        return;
      }
      renderFrame();
    }, 1000 / 30);

    return stream;
  }

  public renderCompositeFrame(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    bgImage: HTMLImageElement | null,
    config: WebcamBackgroundConfig,
    width: number,
    height: number,
    mirror = false
  ): void {
    if (width <= 0 || height <= 0) return;
    ctx.clearRect(0, 0, width, height);

    const drawVideo = (applyMirror: boolean) => {
      ctx.save();
      if (applyMirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, width, height);
      ctx.restore();
    };

    if (config.type === 'none') {
      drawVideo(mirror);
      return;
    }

    if (config.type === 'blur') {
      const blurPx = config.blurAmount ?? 14;
      ctx.save();
      ctx.filter = `blur(${blurPx}px)`;
      if (mirror) {
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, -width * 0.05, -height * 0.05, width * 1.1, height * 1.1);
      ctx.restore();
    } else if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
      ctx.drawImage(bgImage, 0, 0, width, height);
    } else {
      ctx.fillStyle = '#111214';
      ctx.fillRect(0, 0, width, height);
    }

    // Center portrait elliptical blend mask
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(width / 2, height * 0.56, width * 0.28, height * 0.44, 0, 0, Math.PI * 2);
    ctx.clip();
    drawVideo(mirror);
    ctx.restore();
  }
}

export const webcamBackground = new WebcamBackgroundService();
