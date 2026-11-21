const fs = require('fs');
const path = require('path');

const clientPackageJsonPath = path.resolve(__dirname, '..', 'package.json');
const clientPublicVersionPath = path.resolve(__dirname, '..', 'public', 'version.json');
const rootVersionPath = path.resolve(__dirname, '..', '..', 'version.json');
const downloadsVersionPath = path.resolve(__dirname, '..', '..', 'downloads', 'version.json');

const args = process.argv.slice(2);
const type = args[0] || 'patch'; // 'patch', 'minor', 'major', or specific version like '1.0.2'
const changelogMsg = args[1] || 'Incremental update with optimizations and store compatibility.';

if (!fs.existsSync(clientPackageJsonPath)) {
  console.error('❌ Could not find client package.json at:', clientPackageJsonPath);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(clientPackageJsonPath, 'utf8'));
const currentVersion = pkg.version || '1.0.0';

let nextVersion = '';

if (/^\d+\.\d+\.\d+$/.test(type)) {
  nextVersion = type;
} else {
  const parts = currentVersion.split('.').map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);

  if (type === 'major') {
    parts[0] += 1;
    parts[1] = 0;
    parts[2] = 0;
  } else if (type === 'minor') {
    parts[1] += 1;
    parts[2] = 0;
  } else {
    // Default: patch
    parts[2] += 1;
  }
  nextVersion = parts.join('.');
}

const nowIso = new Date().toISOString();
const nowEpoch = Date.now();

console.log(`📦 Bumping version: ${currentVersion} -> ${nextVersion}`);

// 1. Update client/package.json
pkg.version = nextVersion;
fs.writeFileSync(clientPackageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${clientPackageJsonPath}`);

// 2. Update client/public/version.json
const clientVersionPayload = {
  version: nextVersion,
  updatedAt: nowIso,
  buildTime: nowEpoch,
  changelog: changelogMsg,
};
fs.writeFileSync(clientPublicVersionPath, JSON.stringify(clientVersionPayload, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${clientPublicVersionPath}`);

// 3. Update root version.json
fs.writeFileSync(rootVersionPath, JSON.stringify(clientVersionPayload, null, 2) + '\n', 'utf8');
console.log(`✅ Updated ${rootVersionPath}`);

// 4. Update downloads/version.json if directory exists
if (fs.existsSync(path.dirname(downloadsVersionPath))) {
  let downloadsPayload = {};
  if (fs.existsSync(downloadsVersionPath)) {
    try {
      downloadsPayload = JSON.parse(fs.readFileSync(downloadsVersionPath, 'utf8'));
    } catch {
      downloadsPayload = {};
    }
  }
  downloadsPayload.version = nextVersion;
  downloadsPayload.updatedAt = nowIso;
  downloadsPayload.downloads = downloadsPayload.downloads || {
    setupExe: '/downloads/ProtutechChat-Setup.exe',
    portableExe: '/downloads/ProtutechChat-Portable.exe',
    storeAppx: '/downloads/ProtutechChat-Store.appx',
    linuxAppImage: '/downloads/ProtutechChat.AppImage',
    linuxDeb: '/downloads/ProtutechChat.deb',
  };
  downloadsPayload.microsoftStoreUrl = 'https://apps.microsoft.com/detail/ProtutechChat';

  fs.writeFileSync(downloadsVersionPath, JSON.stringify(downloadsPayload, null, 2) + '\n', 'utf8');
  console.log(`✅ Updated ${downloadsVersionPath}`);
}

console.log(`🎉 Version successfully updated to ${nextVersion}!`);
