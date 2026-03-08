#!/bin/bash
# Post-build script to inject custom AppRun into Tauri AppImage
# This fixes Wayland/WebKitGTK compatibility issues on Fedora 40+
#
# Usage:
#   ./scripts/fix-appimage-linux.sh
#
# This script should be run after 'pnpm tauri build' or as part of CI/CD pipeline

set -e

echo "🔧 Applying Wayland compatibility fixes to AppImage..."

# Find the AppDir created by Tauri
APPDIR=$(find src-tauri/target/release/bundle/appimage -maxdepth 1 -type d -name "*.AppDir" 2>/dev/null | head -1)

if [ -z "$APPDIR" ] || [ ! -d "$APPDIR" ]; then
  echo "⚠️  Warning: AppDir not found at src-tauri/target/release/bundle/appimage/"
  echo "   This script should run after Tauri build completes."
  echo "   If building locally, run this manually after 'pnpm tauri build'"
  exit 0
fi

echo "📦 Found AppDir: $APPDIR"

# Backup original AppRun
if [ -f "$APPDIR/AppRun" ]; then
  cp "$APPDIR/AppRun" "$APPDIR/AppRun.backup"
  echo "💾 Backed up original AppRun to AppRun.backup"
fi

# Copy our custom AppRun
if [ ! -f "scripts/appimage-apprun.sh" ]; then
  echo "❌ Error: scripts/appimage-apprun.sh not found"
  exit 1
fi

cp scripts/appimage-apprun.sh "$APPDIR/AppRun"
chmod +x "$APPDIR/AppRun"

echo "✅ Custom AppRun injected successfully!"
echo "   Environment variables set:"
echo "   - WEBKIT_DISABLE_COMPOSITING_MODE=1"
echo ""
echo "   Your AppImage will now work on Fedora/Wayland systems"
echo "   The fix addresses the 'EGL_BAD_PARAMETER' error"
