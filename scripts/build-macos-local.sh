#!/bin/bash

# Script to build macOS app locally and optionally deploy to server
# This saves CI/CD runner costs while maintaining deployment consistency
set -e

# Load deployment configuration from .env.deploy if it exists
if [ -f ".env.deploy" ]; then
  echo "Loading deployment configuration from .env.deploy..."
  set -a  # automatically export all variables
  source .env.deploy
  set +a
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

VERSION=""
DEPLOY=false
UPDATE_MANIFEST=true
SKIP_BUILD=false

# Function to show help
show_help() {
  cat << EOF
🍎 macOS Local Build Script

Build the macOS application locally to save CI/CD runner costs.
Optionally deploy to server in the same location as CI/CD builds.

Usage:
  pnpm build:macos [options]

Options:
  --version <ver>         Version number (required for deploy, format: X.Y.Z)
  --deploy                Upload build to server after building
  --no-manifest           Don't update update-manifest.json (useful for partial releases)
  --skip-build            Skip build, only deploy existing artifacts
  --help                  Show this help message

Examples:
  # Just build locally (files in src-tauri/target/.../bundle/dmg/)
  pnpm build:macos

  # Build and deploy to server
  pnpm build:macos --version 0.9.18 --deploy

  # Build without updating auto-update manifest (plan to release other platforms via CI/CD later)
  pnpm build:macos --version 0.9.18 --deploy --no-manifest

  # Only deploy already built artifacts
  pnpm build:macos --version 0.9.18 --deploy --skip-build

Workflow Examples:

  📦 Scenario 1: Local macOS build, CI/CD for Windows/Linux
    1. pnpm build:macos --version 0.9.18 --deploy --no-manifest
    2. pnpm release 0.9.18 --windows --linux

  📦 Scenario 2: Test build locally before full release
    1. pnpm build:macos                    # Test build
    2. pnpm release 0.9.18 --all           # Full CI/CD release

  📦 Scenario 3: Emergency macOS-only hotfix
    1. pnpm build:macos --version 0.9.18 --deploy

Environment Variables (required for --deploy):
  SSH_PRIVATE_KEY_PATH    Path to SSH private key (default: ~/.ssh/id_rsa)
  SSH_HOST               Server hostname
  SSH_USER               SSH username
  SSH_PORT               SSH port (default: 22)
  DEPLOY_PATH            Server deployment path
  BASE_URL               Base URL for downloads (for update manifest)

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
      ;;
    --deploy)
      DEPLOY=true
      shift
      ;;
    --no-manifest)
      UPDATE_MANIFEST=false
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --help|-h)
      show_help
      exit 0
      ;;
    *)
      echo -e "${RED}❌ Error: Unknown option: $1${NC}"
      echo ""
      show_help
      exit 1
      ;;
  esac
done

# Validate version format if deploying
if [ "$DEPLOY" = true ]; then
  if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Error: --version is required when using --deploy${NC}"
    echo ""
    show_help
    exit 1
  fi

  if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Error: Invalid version format${NC}"
    echo "Version must follow semantic versioning (e.g., 0.9.18, 1.2.3)"
    exit 1
  fi
fi

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
  echo -e "${RED}❌ Error: This script must be run on macOS${NC}"
  exit 1
fi

echo -e "${BLUE}🍎 zakip voice — macOS Local Build${NC}"
echo ""

# Build phase
if [ "$SKIP_BUILD" = false ]; then
  echo -e "${GREEN}📦 Building macOS application...${NC}"
  echo ""

  # Update version if specified
  if [ -n "$VERSION" ]; then
    echo -e "${BLUE}📝 Updating version to $VERSION...${NC}"
    node scripts/set-version.js $VERSION
  fi

  # Install dependencies
  echo -e "${BLUE}📥 Installing dependencies...${NC}"
  pnpm install

  # Build Tauri app for macOS ARM64 (Apple Silicon)
  echo -e "${BLUE}🔨 Building Tauri app (ARM64)...${NC}"
  echo ""

  # Check Tauri signing key for auto-update functionality
  # Uses same env vars as GitHub Actions: TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD
  if [ -n "$TAURI_SIGNING_PRIVATE_KEY" ]; then
    echo -e "${GREEN}✅ TAURI_SIGNING_PRIVATE_KEY is set - .app.tar.gz and signatures will be generated${NC}"
    # Also export for Tauri signer CLI (uses TAURI_PRIVATE_KEY)
    export TAURI_PRIVATE_KEY="$TAURI_SIGNING_PRIVATE_KEY"
    export TAURI_PRIVATE_KEY_PASSWORD="${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}"
  else
    echo -e "${RED}❌ TAURI_SIGNING_PRIVATE_KEY is NOT set!${NC}"
    echo -e "${YELLOW}   Auto-update will NOT work without a signing key!${NC}"
    echo -e "${YELLOW}   Add to .env.deploy:${NC}"
    echo -e "${YELLOW}   TAURI_SIGNING_PRIVATE_KEY='your-key-content-here'${NC}"
    echo -e "${YELLOW}   TAURI_SIGNING_PRIVATE_KEY_PASSWORD='your-password'${NC}"
    echo ""
  fi

  # Clean old signatures to force regeneration
  echo -e "${BLUE}🧹 Cleaning old signature files...${NC}"
  find src-tauri/target -name "*.sig" -delete 2>/dev/null || true
  find src-tauri/target -name "*.app.tar.gz" -delete 2>/dev/null || true
  echo -e "${GREEN}✅ Old files cleaned${NC}"
  echo ""

  pnpm tauri build --target aarch64-apple-darwin

  echo ""
  echo -e "${GREEN}✅ Build completed!${NC}"

  # Ad-hoc codesign the .app bundle so Gatekeeper shows "unverified developer"
  # instead of "damaged" when downloaded from the internet
  APP_BUNDLE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/macos -name "*.app" -type d 2>/dev/null | head -n 1)
  if [ -n "$APP_BUNDLE" ] && [ -d "$APP_BUNDLE" ]; then
    echo -e "${BLUE}🔏 Ad-hoc signing .app bundle for Gatekeeper compatibility...${NC}"
    codesign --force --deep --sign - "$APP_BUNDLE"
    echo -e "${GREEN}✅ App bundle signed (ad-hoc)${NC}"

    # Rebuild DMG with the signed app
    echo -e "${BLUE}📦 Rebuilding DMG with signed app...${NC}"
    OLD_DMG=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/dmg -name "*.dmg" -not -name "*.sig" 2>/dev/null | head -n 1)
    if [ -n "$OLD_DMG" ]; then
      DMG_FILENAME=$(basename "$OLD_DMG")
      DMG_DIR=$(dirname "$OLD_DMG")
      rm -f "$OLD_DMG"
      # Create new DMG with signed app
      hdiutil create -volname "zakip-voice" -srcfolder "$APP_BUNDLE" -ov -format UDZO "$OLD_DMG"
      echo -e "${GREEN}✅ DMG rebuilt with signed app${NC}"
    fi

    # ALWAYS rebuild .app.tar.gz with signed app and without macOS metadata
    echo -e "${BLUE}📦 Rebuilding .app.tar.gz with signed app (no metadata)...${NC}"
    APP_DIR=$(dirname "$APP_BUNDLE")
    APP_NAME=$(basename "$APP_BUNDLE")
    OLD_TARGZ=$(find "$APP_DIR" -name "*.app.tar.gz" -not -name "*.sig" 2>/dev/null | head -n 1)
    if [ -n "$OLD_TARGZ" ]; then
      rm -f "$OLD_TARGZ" "${OLD_TARGZ}.sig"
    fi
    UPDATER_FILE="${APP_DIR}/${APP_NAME}.tar.gz"
    (cd "$APP_DIR" && COPYFILE_DISABLE=1 tar -czf "${APP_NAME}.tar.gz" "$APP_NAME")
    echo -e "${GREEN}✅ .app.tar.gz rebuilt with signed app (no metadata)${NC}"
  fi

  # Find the built files
  # DMG is for manual downloads
  DMG_FILE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/dmg -name "*.dmg" -not -name "*.sig" 2>/dev/null | head -n 1)

  # .app.tar.gz is for Tauri auto-updater (required format)
  UPDATER_FILE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/macos -name "*.app.tar.gz" -not -name "*.sig" 2>/dev/null | head -n 1)
  UPDATER_SIG_FILE="${UPDATER_FILE}.sig"

  if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}❌ Error: Could not find built .dmg file${NC}"
    exit 1
  fi

  echo ""
  echo -e "${GREEN}📦 Built files:${NC}"
  echo -e "  ${BLUE}DMG (manual download):${NC} $DMG_FILE"

  if [ -n "$UPDATER_FILE" ] && [ -f "$UPDATER_FILE" ]; then
    echo -e "  ${BLUE}Updater bundle:${NC} $UPDATER_FILE"

    # Sign the archive if not already signed
    if [ -f "$UPDATER_SIG_FILE" ] && [ -s "$UPDATER_SIG_FILE" ]; then
      echo -e "  ${BLUE}Updater signature:${NC} $UPDATER_SIG_FILE"
      echo -e "  ${GREEN}✅ Auto-update files ready!${NC}"
    else
      echo -e "  ${YELLOW}⚠️  No signature file found or empty - signing now...${NC}"
      if [ -n "$TAURI_SIGNING_PRIVATE_KEY" ]; then
        echo -e "  ${BLUE}Signing with TAURI_SIGNING_PRIVATE_KEY...${NC}"
        if pnpm tauri signer sign -k "$TAURI_SIGNING_PRIVATE_KEY" -p "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" "$UPDATER_FILE"; then
          UPDATER_SIG_FILE="${UPDATER_FILE}.sig"
          if [ -f "$UPDATER_SIG_FILE" ] && [ -s "$UPDATER_SIG_FILE" ]; then
            echo -e "  ${GREEN}✅ Signed successfully!${NC}"
          else
            echo -e "  ${RED}❌ Signing command succeeded but .sig file is missing or empty!${NC}"
          fi
        else
          echo -e "  ${RED}❌ Signing failed! Check TAURI_SIGNING_PRIVATE_KEY_PASSWORD.${NC}"
        fi
      else
        echo -e "  ${RED}❌ Cannot sign - TAURI_SIGNING_PRIVATE_KEY not set${NC}"
      fi
    fi
  else
    # Fallback: Create .app.tar.gz manually if somehow missing
    APP_BUNDLE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/macos -name "*.app" -type d 2>/dev/null | head -n 1)
    if [ -n "$APP_BUNDLE" ] && [ -d "$APP_BUNDLE" ]; then
      echo -e "  ${YELLOW}⚠️  No .app.tar.gz found (fallback) - creating manually...${NC}"
      APP_DIR=$(dirname "$APP_BUNDLE")
      APP_NAME=$(basename "$APP_BUNDLE")
      UPDATER_FILE="${APP_DIR}/${APP_NAME}.tar.gz"
      (cd "$APP_DIR" && COPYFILE_DISABLE=1 tar -czf "${APP_NAME}.tar.gz" "$APP_NAME")
      echo -e "  ${BLUE}Created:${NC} $UPDATER_FILE"

      # Sign the created archive
      if [ -n "$TAURI_SIGNING_PRIVATE_KEY" ]; then
        echo -e "  ${BLUE}Signing with TAURI_SIGNING_PRIVATE_KEY...${NC}"
        if pnpm tauri signer sign -k "$TAURI_SIGNING_PRIVATE_KEY" -p "${TAURI_SIGNING_PRIVATE_KEY_PASSWORD:-}" "$UPDATER_FILE"; then
          UPDATER_SIG_FILE="${UPDATER_FILE}.sig"
          if [ -f "$UPDATER_SIG_FILE" ] && [ -s "$UPDATER_SIG_FILE" ]; then
            echo -e "  ${GREEN}✅ Created and signed!${NC}"
          else
            echo -e "  ${RED}❌ Signing command succeeded but .sig file is missing or empty!${NC}"
          fi
        else
          echo -e "  ${RED}❌ Signing failed! Check TAURI_SIGNING_PRIVATE_KEY_PASSWORD.${NC}"
        fi
      else
        echo -e "  ${RED}❌ Cannot sign - TAURI_SIGNING_PRIVATE_KEY not set${NC}"
      fi
    else
      echo -e "  ${RED}❌ No .app bundle found - cannot create updater files${NC}"
    fi
  fi

  # Get file size
  FILE_SIZE=$(du -h "$DMG_FILE" | cut -f1)
  echo -e "  ${BLUE}Size:${NC} $FILE_SIZE"
else
  echo -e "${YELLOW}⏭️  Skipping build (--skip-build flag)${NC}"

  # Find existing built files
  if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ Error: --version is required when using --skip-build${NC}"
    exit 1
  fi

  DMG_FILE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/dmg -name "*${VERSION}*.dmg" -not -name "*.sig" 2>/dev/null | head -n 1)
  UPDATER_FILE=$(find src-tauri/target/aarch64-apple-darwin/release/bundle/macos -name "*.app.tar.gz" -not -name "*.sig" 2>/dev/null | head -n 1)
  UPDATER_SIG_FILE="${UPDATER_FILE}.sig"

  if [ -z "$DMG_FILE" ] || [ ! -f "$DMG_FILE" ]; then
    echo -e "${RED}❌ Error: Could not find existing build for version $VERSION${NC}"
    echo "Expected file pattern: *${VERSION}*.dmg"
    echo "In directory: src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/"
    exit 1
  fi

  echo -e "${GREEN}Found existing build:${NC} $DMG_FILE"
  if [ -n "$UPDATER_FILE" ] && [ -f "$UPDATER_FILE" ]; then
    echo -e "${GREEN}Found updater bundle:${NC} $UPDATER_FILE"
  fi
fi

# Deploy phase
if [ "$DEPLOY" = true ]; then
  echo ""
  echo -e "${BLUE}🚀 Deploying to server...${NC}"

  # Check required environment variables
  SSH_KEY_PATH="${SSH_PRIVATE_KEY_PATH:-$HOME/.ssh/id_rsa}"
  SSH_HOST="${SSH_HOST:-}"
  SSH_USER="${SSH_USER:-}"
  SSH_PORT="${SSH_PORT:-22}"
  DEPLOY_PATH="${DEPLOY_PATH:-}"
  BASE_URL="${BASE_URL:-}"

  if [ -z "$SSH_HOST" ] || [ -z "$SSH_USER" ] || [ -z "$DEPLOY_PATH" ]; then
    echo -e "${RED}❌ Error: Missing required environment variables${NC}"
    echo "Required: SSH_HOST, SSH_USER, DEPLOY_PATH"
    echo ""
    echo "Option 1 - Create .env.deploy file in project root:"
    echo "  SSH_HOST='your-server.com'"
    echo "  SSH_USER='deploy'"
    echo "  DEPLOY_PATH='/var/www/downloads'"
    echo "  BASE_URL='https://downloads.example.com'"
    echo "  SSH_PRIVATE_KEY_PATH='~/.ssh/id_rsa'"
    echo ""
    echo "Option 2 - Set them in your shell profile (~/.zshrc or ~/.bashrc)"
    exit 1
  fi

  if [ ! -f "$SSH_KEY_PATH" ]; then
    echo -e "${RED}❌ Error: SSH key not found at $SSH_KEY_PATH${NC}"
    echo "Set SSH_PRIVATE_KEY_PATH environment variable to your key location"
    exit 1
  fi

  echo -e "${BLUE}Server:${NC} $SSH_USER@$SSH_HOST:$SSH_PORT"
  echo -e "${BLUE}Deploy path:${NC} $DEPLOY_PATH/releases/v$VERSION/"
  echo ""

  # Test SSH connection
  echo -e "${BLUE}🔍 Testing SSH connection...${NC}"
  if ! ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" -o ConnectTimeout=10 "$SSH_USER@$SSH_HOST" "echo 'SSH connection successful'" 2>&1; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    exit 1
  fi
  echo -e "${GREEN}✅ SSH connection successful${NC}"

  # Create directory structure
  echo -e "${BLUE}📁 Creating deployment directory...${NC}"
  ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "mkdir -p $DEPLOY_PATH/releases/v$VERSION"

  # Upload DMG file (for manual downloads)
  echo -e "${BLUE}📤 Uploading DMG file (manual download)...${NC}"
  DMG_FILENAME=$(basename "$DMG_FILE")
  scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$DMG_FILE" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/releases/v$VERSION/$DMG_FILENAME"

  # Upload .app.tar.gz and signature for auto-updater
  # Use versioned filename for compatibility with version extraction from URL
  VERSIONED_UPDATER_FILENAME="zakip-voice_${VERSION}_aarch64.app.tar.gz"
  VERSIONED_SIG_FILENAME="zakip-voice_${VERSION}_aarch64.app.tar.gz.sig"

  if [ -n "$UPDATER_FILE" ] && [ -f "$UPDATER_FILE" ]; then
    echo -e "${BLUE}📤 Uploading updater bundle as ${VERSIONED_UPDATER_FILENAME}...${NC}"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$UPDATER_FILE" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/releases/v$VERSION/$VERSIONED_UPDATER_FILENAME"

    if [ -f "$UPDATER_SIG_FILE" ]; then
      echo -e "${BLUE}📤 Uploading updater signature...${NC}"
      scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$UPDATER_SIG_FILE" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/releases/v$VERSION/$VERSIONED_SIG_FILENAME"
      echo -e "${GREEN}✅ Auto-update files uploaded!${NC}"
    else
      echo -e "${YELLOW}⚠️  No signature file - auto-update will fail!${NC}"
    fi
    # Use versioned filename for manifest
    UPDATER_FILENAME="$VERSIONED_UPDATER_FILENAME"
  else
    echo -e "${YELLOW}⚠️  No .app.tar.gz found - skipping updater bundle upload${NC}"
    echo -e "${YELLOW}   Auto-update will NOT work for this release!${NC}"
  fi

  echo -e "${GREEN}✅ Files uploaded successfully${NC}"

  # Update manifests
  if [ "$UPDATE_MANIFEST" = true ]; then
    echo ""
    echo -e "${BLUE}📝 Updating manifests (per-platform versioning)...${NC}"

    UPDATER_BASE_URL="${BASE_URL:-https://YOUR_DOMAIN_HERE}"

    # Read signature from .app.tar.gz.sig file (required for Tauri auto-updater)
    MACOS_SIG=""
    echo -e "${BLUE}🔍 Looking for signature file: ${UPDATER_SIG_FILE}${NC}"

    if [ -f "$UPDATER_SIG_FILE" ] && [ -s "$UPDATER_SIG_FILE" ]; then
      MACOS_SIG=$(cat "$UPDATER_SIG_FILE" | tr -d '\n')
      if [ -n "$MACOS_SIG" ]; then
        # Show first 50 chars of signature for debugging
        SIG_PREVIEW="${MACOS_SIG:0:50}..."
        echo -e "${GREEN}✅ Loaded signature (${#MACOS_SIG} chars): ${SIG_PREVIEW}${NC}"

        # Decode and show the trusted comment to verify it's for the right file
        TRUSTED_COMMENT=$(echo "$MACOS_SIG" | base64 -d 2>/dev/null | grep -a "trusted" | head -1 || echo "")
        if [ -n "$TRUSTED_COMMENT" ]; then
          echo -e "${BLUE}   Signature info: ${TRUSTED_COMMENT}${NC}"
        fi
      else
        echo -e "${RED}❌ Signature file exists but content is EMPTY after reading!${NC}"
      fi
    else
      echo -e "${RED}❌ No signature file found or file is empty at: ${UPDATER_SIG_FILE}${NC}"
      echo -e "${YELLOW}   Auto-update will FAIL without a valid signature!${NC}"
      echo -e "${YELLOW}   Check if TAURI_SIGNING_PRIVATE_KEY is set before build.${NC}"

      # Try to find any .sig file as fallback info
      echo -e "${BLUE}   Searching for any .sig files...${NC}"
      find src-tauri/target -name "*.sig" 2>/dev/null | head -5 || echo "   No .sig files found"
    fi

    # CRITICAL: Abort if no valid signature - auto-update will fail anyway
    if [ -z "$MACOS_SIG" ]; then
      echo -e "${RED}❌ ABORTING: Cannot deploy without a valid signature!${NC}"
      echo -e "${RED}   Auto-update would fail for users. Please fix signing first.${NC}"
      echo ""
      echo -e "${YELLOW}To fix this, add to .env.deploy:${NC}"
      echo -e "  TAURI_SIGNING_PRIVATE_KEY='your-key-content'"
      echo -e "  TAURI_SIGNING_PRIVATE_KEY_PASSWORD='your-password'"
      exit 1
    fi

    # Create temporary directory for manifest files
    TEMP_DIR=$(mktemp -d)

    # Download current manifests from server (if they exist)
    echo -e "${BLUE}📥 Downloading current manifests from server...${NC}"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/manifest.json" "$TEMP_DIR/current-manifest.json" 2>/dev/null || echo "{}" > "$TEMP_DIR/current-manifest.json"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/update-manifest.json" "$TEMP_DIR/current-update-manifest.json" 2>/dev/null || echo '{"platforms":{}}' > "$TEMP_DIR/current-update-manifest.json"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/versions.json" "$TEMP_DIR/current-versions.json" 2>/dev/null || echo '{}' > "$TEMP_DIR/current-versions.json"

    # Update platform-specific version tracking (versions.json)
    echo -e "${BLUE}📝 Updating versions.json...${NC}"
    jq --arg platform "macos" \
       --arg version "$VERSION" \
       '.[$platform] = $version' \
       "$TEMP_DIR/current-versions.json" > "$TEMP_DIR/versions.json"

    # Determine the highest version across all platforms for latest.txt
    # Note: We use the current VERSION as highest since we're deploying macOS
    # Semantic version comparison is complex in jq, so we just use the new version
    HIGHEST_VERSION="$VERSION"

    # Update latest.txt with highest version
    echo "v$HIGHEST_VERSION" > "$TEMP_DIR/latest.txt"
    echo "$HIGHEST_VERSION" > "$TEMP_DIR/version.json"

    # Merge macOS platform into manifest.json using jq (preserves other platforms)
    # manifest.json uses DMG for manual downloads
    echo -e "${BLUE}📝 Merging macOS build into manifests...${NC}"
    jq --arg version "$VERSION" \
       --arg releaseDate "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
       --arg path "./releases/v$VERSION/$DMG_FILENAME" \
       --arg highestVersion "$HIGHEST_VERSION" \
       '.version = $highestVersion | .releaseDate = $releaseDate | .downloads.macos = $path | .platformVersions.macos = $version' \
       "$TEMP_DIR/current-manifest.json" > "$TEMP_DIR/manifest.json"

    # Merge macOS platforms into update-manifest.json using jq (preserves other platforms)
    # IMPORTANT: update-manifest.json must use .app.tar.gz for Tauri auto-updater (NOT .dmg)
    cp "$TEMP_DIR/current-update-manifest.json" "$TEMP_DIR/temp-update-manifest.json"

    # Ensure platforms object exists
    jq 'if .platforms == null then .platforms = {} else . end' "$TEMP_DIR/temp-update-manifest.json" > "$TEMP_DIR/temp-fix.json"
    mv "$TEMP_DIR/temp-fix.json" "$TEMP_DIR/temp-update-manifest.json"

    # Determine the correct updater filename (.app.tar.gz for auto-update)
    if [ -n "$UPDATER_FILENAME" ]; then
      UPDATER_URL_FILENAME="$UPDATER_FILENAME"
      echo -e "${BLUE}📝 Using .app.tar.gz for update-manifest.json (correct format)${NC}"
    else
      # Fallback to DMG if no .app.tar.gz (but this will cause update to fail)
      UPDATER_URL_FILENAME="$DMG_FILENAME"
      echo -e "${YELLOW}⚠️  Using .dmg for update-manifest.json (auto-update will FAIL)${NC}"
    fi

    for ARCH in "darwin-universal" "darwin-aarch64" "darwin-x86_64"; do
      jq --arg pubDate "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         --arg key "$ARCH" \
         --arg url "${UPDATER_BASE_URL}/releases/v$VERSION/$UPDATER_URL_FILENAME" \
         --arg signature "$MACOS_SIG" \
         --arg platformVersion "$VERSION" \
         '.pub_date = $pubDate | .platforms[$key] = {url: $url, signature: $signature, version: $platformVersion}' \
         "$TEMP_DIR/temp-update-manifest.json" > "$TEMP_DIR/temp-update-manifest-next.json"
      mv "$TEMP_DIR/temp-update-manifest-next.json" "$TEMP_DIR/temp-update-manifest.json"
    done

    # Set the highest version as global version (for Tauri updater compatibility)
    jq --arg highestVersion "$HIGHEST_VERSION" \
       '.version = $highestVersion' \
       "$TEMP_DIR/temp-update-manifest.json" > "$TEMP_DIR/update-manifest.json"

    # Upload manifest files
    echo -e "${BLUE}📤 Uploading manifest files...${NC}"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$TEMP_DIR/latest.txt" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$TEMP_DIR/version.json" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$TEMP_DIR/versions.json" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$TEMP_DIR/manifest.json" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
    scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" "$TEMP_DIR/update-manifest.json" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"

    echo -e "${GREEN}✅ Manifests updated${NC}"
    echo ""
    echo -e "${BLUE}Platform versions:${NC}"
    cat "$TEMP_DIR/versions.json"
    echo ""
    echo -e "${BLUE}Highest version (shown in latest.txt):${NC} $HIGHEST_VERSION"

    # Cleanup
    rm -rf "$TEMP_DIR"

    # Upload download page if it doesn't exist
    echo -e "${BLUE}📄 Checking download page...${NC}"
    if ! ssh -i "$SSH_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "test -f $DEPLOY_PATH/index.html" 2>/dev/null; then
      echo -e "${BLUE}📤 Uploading download page...${NC}"
      scp -i "$SSH_KEY_PATH" -P "$SSH_PORT" public/index.html "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/"
      echo -e "${GREEN}✅ Download page uploaded${NC}"
    else
      echo -e "${YELLOW}ℹ️  Download page already exists (skipping upload)${NC}"
    fi

    if [ -z "$BASE_URL" ]; then
      echo -e "${YELLOW}⚠️  Warning: BASE_URL not set, using placeholder in update manifest${NC}"
    fi
  else
    echo -e "${YELLOW}⏭️  Skipping manifest update (--no-manifest flag)${NC}"
    echo -e "${YELLOW}💡 You can run full release later: pnpm release $VERSION --windows --linux${NC}"
  fi

  echo ""
  echo -e "${GREEN}✨ Deployment completed successfully!${NC}"

  if [ -n "$BASE_URL" ]; then
    echo ""
    echo -e "${BLUE}🌐 Download URL:${NC}"
    echo "   $BASE_URL/releases/v$VERSION/$DMG_FILENAME"
  fi
else
  echo ""
  echo -e "${BLUE}💡 Next steps:${NC}"
  echo ""
  echo "  Option 1 - Deploy this build to server:"
  echo "    pnpm build:macos --version $VERSION --deploy --skip-build"
  echo ""
  echo "  Option 2 - Create full release via CI/CD:"
  echo "    pnpm release $VERSION --all"
  echo ""
  echo "  Option 3 - Build other platforms via CI/CD:"
  echo "    pnpm release $VERSION --windows --linux"
fi

echo ""
