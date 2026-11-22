#!/usr/bin/env bash
# ==============================================================================
# Protutech Proxmox LXC One-Click Update & Deployment Script
# Automatically pulls the latest code, builds the client, updates the guide
# website and downloads, ensures dynamic versioning, and reloads Caddy & services.
# ==============================================================================

set -e

echo "=========================================================="
echo "🚀 Updating Protutech Proxmox Server & Guide Website..."
echo "=========================================================="

TARGET_DIR="/opt/discordapi"
if [ ! -d "$TARGET_DIR" ]; then
  TARGET_DIR="/opt/mautrix-discord"
fi
if [ ! -d "$TARGET_DIR" ]; then
  TARGET_DIR="$(pwd)"
fi

cd "$TARGET_DIR"

echo "📥 Fetching latest commits from GitHub (origin/main)..."
git fetch origin main
git reset --hard origin/main

CURRENT_VERSION="1.0.7"
if [ -f "version.json" ]; then
  CURRENT_VERSION=$(grep -o '"version": "[^"]*' version.json | cut -d'"' -f4 || echo "1.0.7")
fi
echo "📦 Detected Protutech Version: v${CURRENT_VERSION}"

# 1. Update system service configs
if [ -f "auto_setup_service.py" ] && [ -d "/opt/discord-auto-setup" ]; then
  echo "⚙️ Syncing auto_setup_service.py..."
  cp -f auto_setup_service.py /opt/discord-auto-setup/auto_setup_service.py
fi

if [ -f "Caddyfile" ] && [ -d "/etc/caddy" ]; then
  echo "🌐 Syncing Caddyfile to /etc/caddy/Caddyfile..."
  cp -f Caddyfile /etc/caddy/Caddyfile
fi

# 2. Deploy Guide Website (/var/www/discord-guide)
echo "📄 Deploying Guide Website & Assets to /var/www/discord-guide..."
mkdir -p /var/www/discord-guide
mkdir -p /var/www/discord-guide/downloads

cp -f index.html /var/www/discord-guide/index.html
[ -f icon.png ] && cp -f icon.png /var/www/discord-guide/icon.png
[ -f version.json ] && cp -f version.json /var/www/discord-guide/version.json

if [ -d "downloads" ]; then
  echo "💾 Syncing downloadable desktop app binaries..."
  cp -rf downloads/* /var/www/discord-guide/downloads/ 2>/dev/null || true
fi

# Fetch latest .exe binaries from GitHub Releases if not present in git
for BIN in ProtutechChat-Setup.exe ProtutechChat-Portable.exe; do
  if [ ! -f "/var/www/discord-guide/downloads/${BIN}" ] || [ "${FORCE_DOWNLOAD_BINS:-0}" = "1" ]; then
    echo "⬇️ Syncing ${BIN} from GitHub Releases..."
    curl -fsSL -L "https://github.com/IAndrexI/discordapi/releases/latest/download/${BIN}" -o "/var/www/discord-guide/downloads/${BIN}.tmp" 2>/dev/null && mv "/var/www/discord-guide/downloads/${BIN}.tmp" "/var/www/discord-guide/downloads/${BIN}" || rm -f "/var/www/discord-guide/downloads/${BIN}.tmp"
  fi
done

# 3. Build & Deploy Web Client (/var/www/discord-client)
if [ -d "$TARGET_DIR/client" ] && command -v npm >/dev/null 2>&1; then
  echo "🔨 Building web client with npm..."
  cd "$TARGET_DIR/client"
  npm install --no-audit --no-fund
  npm run build
  
  echo "📦 Deploying client to /var/www/discord-client..."
  mkdir -p /var/www/discord-client
  cp -rf dist/* /var/www/discord-client/
  
  # Ensure version.json is also accessible under /var/www/discord-client
  [ -f "$TARGET_DIR/version.json" ] && cp -f "$TARGET_DIR/version.json" /var/www/discord-client/version.json
  
  cd "$TARGET_DIR"
fi

# 4. Reload and Restart Services
echo "🔄 Reloading Caddy and restarting background services..."
systemctl reload caddy 2>/dev/null || systemctl restart caddy 2>/dev/null || true
systemctl restart protutech-backend 2>/dev/null || true
systemctl restart discord-auto-setup 2>/dev/null || systemctl restart discordapi 2>/dev/null || true
if systemctl is-active --quiet mautrix-discord 2>/dev/null; then
  systemctl restart mautrix-discord 2>/dev/null || true
fi

echo "=========================================================="
echo "✅ Protutech Proxmox Website & Services Successfully Updated!"
echo "🌐 Website & Downloads: https://chat.protutech.vip"
echo "💬 Web App:            https://chat.protutech.vip/chat"
echo "📌 Live Version:       v${CURRENT_VERSION}"
echo "=========================================================="
