const fs = require('fs');
const path = require('path');

const distElectronDir = path.resolve(__dirname, '..', 'dist-electron');
const downloadsDir = path.resolve(__dirname, '..', '..', 'downloads');

console.log('🔄 Syncing built executables to website downloads directory...');
console.log('From:', distElectronDir);
console.log('To:  ', downloadsDir);

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

if (!fs.existsSync(distElectronDir)) {
  console.warn('⚠️ dist-electron directory does not exist yet. Run electron build first.');
  process.exit(0);
}

const files = fs.readdirSync(distElectronDir);
let syncedCount = 0;

for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (['.exe', '.appx', '.appimage', '.deb', '.gz', '.zip'].includes(ext)) {
    const srcFile = path.join(distElectronDir, file);
    const destFile = path.join(downloadsDir, file);
    try {
      fs.copyFileSync(srcFile, destFile);
      const stat = fs.statSync(destFile);
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      console.log(`✅ Synced: ${file} (${mb} MB) -> ${destFile}`);
      syncedCount++;
    } catch (err) {
      console.error(`❌ Failed to sync ${file}:`, err.message);
    }
  }
}

// Write version manifest into downloads directory for client auto-updater & website
const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8'));
const versionManifest = {
  version: packageJson.version,
  updatedAt: new Date().toISOString(),
  downloads: {
    setupExe: '/downloads/ProtutechChat-Setup.exe',
    portableExe: '/downloads/ProtutechChat-Portable.exe',
    storeAppx: '/downloads/ProtutechChat-Store.appx',
    linuxAppImage: '/downloads/ProtutechChat.AppImage',
    linuxDeb: '/downloads/ProtutechChat.deb',
  },
  microsoftStoreUrl: 'https://apps.microsoft.com/detail/ProtutechChat',
};

fs.writeFileSync(path.join(downloadsDir, 'version.json'), JSON.stringify(versionManifest, null, 2));
console.log('✅ Generated downloads/version.json manifest.');
console.log(`🎉 Total binaries synced: ${syncedCount}`);
