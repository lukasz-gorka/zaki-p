#!/bin/bash
# AppRun wrapper for AI Assistant
# Fixes Wayland/WebKitGTK compatibility issues on Fedora/Linux
#
# This script is injected into the AppImage to set environment variables
# that fix the "Could not create default EGL display: EGL_BAD_PARAMETER" error
# which occurs on Fedora 40+ with Wayland.

HERE="$(dirname "$(readlink -f "${0}")")"

# Primary fix: Disable WebKit compositing mode
# This forces WebKit to use a simpler, more compatible rendering path
# that avoids problematic EGL/Wayland interactions
export WEBKIT_DISABLE_COMPOSITING_MODE=1

# Optional: Force X11 backend as fallback
# Uncomment if users still experience issues after the above fix
# This makes the app use XWayland instead of native Wayland
# export GDK_BACKEND=x11

# Optional: NVIDIA-specific fix for white/blank screens
# Uncomment if users with NVIDIA GPUs report rendering issues
# export WEBKIT_DISABLE_DMABUF_RENDERER=1

# Launch AI Assistant
# Find the main binary (supports both "AI assistant" and "ai-assistant" names)
BINARY="${HERE}/usr/bin/AI assistant"
if [ ! -f "$BINARY" ]; then
  BINARY="${HERE}/usr/bin/ai-assistant"
fi

if [ ! -f "$BINARY" ]; then
  echo "Error: Could not find AI Assistant binary in ${HERE}/usr/bin/"
  exit 1
fi

exec "$BINARY" "$@"
