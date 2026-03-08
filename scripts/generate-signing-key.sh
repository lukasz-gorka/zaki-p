#!/bin/bash
# Script to generate Tauri signing key with empty password

set -e

KEY_PATH="$HOME/.tauri/com.assistant.dev.key"

echo "Generating Tauri signing key..."
echo "When prompted for password, just press Enter twice (for empty password)"
echo ""

cd "$(dirname "$0")/.."
pnpm tauri signer generate -w "$KEY_PATH"

echo ""
echo "✅ Key generated at: $KEY_PATH"
echo ""
echo "Public key content:"
cat "$KEY_PATH.pub"
echo ""
echo "Copy the public key above to tauri.conf.json under plugins.updater.pubkey"
