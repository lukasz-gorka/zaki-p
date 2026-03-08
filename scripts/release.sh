#!/bin/bash

# Script to create a new release with platform-specific tagging
# Supports building individual platforms for existing versions
set -e

VERSION=$1
BUILD_MACOS=false
BUILD_WINDOWS=false
BUILD_LINUX=false

# Function to get current version from package.json
get_current_version() {
  if command -v node &> /dev/null; then
    node -p "require('./package.json').version" 2>/dev/null || echo "unknown"
  else
    echo "unknown"
  fi
}

# Function to check if tag exists
tag_exists() {
  git tag -l "$1" | grep -q "^$1$"
}

# Function to show help
show_help() {
  CURRENT_VERSION=$(get_current_version)

  cat << EOF
Release Script for zakip voice

Current version: v$CURRENT_VERSION

Usage:
  pnpm release <version> [platforms...]

Arguments:
  <version>     Version number (required, format: X.Y.Z)

Platform Options (optional):
  --macos       Build for macOS only
  --windows     Build for Windows only
  --linux       Build for Linux only
  --all         Build for all platforms (default if no platform specified)

Tagging Strategy:
  Each platform creates its own tag: v0.9.41-macos, v0.9.41-windows, v0.9.41-linux
  This allows building platforms independently, even for existing versions.

  Example: You can release v0.9.41 for macOS today, and add Windows later:
    pnpm release 0.9.41 --macos      # Creates v0.9.41-macos
    pnpm release 0.9.41 --windows    # Creates v0.9.41-windows (later)

Examples:
  pnpm release 0.9.21                    # Build all platforms
  pnpm release 0.9.21 --macos            # Build macOS only
  pnpm release 0.9.21 --macos --linux    # Build macOS and Linux
  pnpm release 0.9.21 --windows          # Build Windows only (even if macOS already released)

How it works:
  1. Updates version in package.json, tauri.conf.json, and Cargo.toml
  2. Creates git commit (if version changed)
  3. Creates platform-specific tags (v0.9.41-macos, v0.9.41-windows, etc.)
  4. Pushes to remote
  5. Triggers independent GitHub Actions workflows for each selected platform
  6. Each platform updates only its section in update-manifest.json

Requirements:
  - GitHub CLI (gh) must be installed and authenticated
  - Run 'gh auth login' if not already authenticated

EOF
}

if [ -z "$VERSION" ]; then
  show_help
  exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  echo ""
  echo "Install it with:"
  echo "  macOS:   brew install gh"
  echo "  Linux:   sudo apt install gh"
  echo "  Windows: winget install GitHub.cli"
  echo ""
  echo "Then authenticate with: gh auth login"
  exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
  echo "Error: GitHub CLI is not authenticated"
  echo "Run: gh auth login"
  exit 1
fi

# Check if version follows semantic versioning
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Invalid version format"
  echo "Version must follow semantic versioning (e.g., 0.9.21, 1.2.3)"
  echo ""
  show_help
  exit 1
fi

# Parse platform flags
shift
if [ $# -eq 0 ]; then
  # No flags provided, build all platforms
  BUILD_MACOS=true
  BUILD_WINDOWS=true
  BUILD_LINUX=true
else
  while [ $# -gt 0 ]; do
    case "$1" in
      --macos)
        BUILD_MACOS=true
        ;;
      --windows)
        BUILD_WINDOWS=true
        ;;
      --linux)
        BUILD_LINUX=true
        ;;
      --all)
        BUILD_MACOS=true
        BUILD_WINDOWS=true
        BUILD_LINUX=true
        ;;
      *)
        echo "Error: Unknown option: $1"
        echo ""
        show_help
        exit 1
        ;;
    esac
    shift
  done
fi

# Validate at least one platform is selected
if [ "$BUILD_MACOS" = false ] && [ "$BUILD_WINDOWS" = false ] && [ "$BUILD_LINUX" = false ]; then
  echo "Error: No platform selected"
  echo "Please specify at least one platform: --macos, --windows, or --linux"
  echo ""
  show_help
  exit 1
fi

# Determine which tags will be created
TAGS_TO_CREATE=()
TAGS_EXIST=()

if [ "$BUILD_MACOS" = true ]; then
  TAG="v${VERSION}-macos"
  if tag_exists "$TAG"; then
    TAGS_EXIST+=("$TAG")
  else
    TAGS_TO_CREATE+=("$TAG")
  fi
fi

if [ "$BUILD_WINDOWS" = true ]; then
  TAG="v${VERSION}-windows"
  if tag_exists "$TAG"; then
    TAGS_EXIST+=("$TAG")
  else
    TAGS_TO_CREATE+=("$TAG")
  fi
fi

if [ "$BUILD_LINUX" = true ]; then
  TAG="v${VERSION}-linux"
  if tag_exists "$TAG"; then
    TAGS_EXIST+=("$TAG")
  else
    TAGS_TO_CREATE+=("$TAG")
  fi
fi

# Check if any tags already exist
if [ ${#TAGS_EXIST[@]} -gt 0 ]; then
  echo "Warning: The following tags already exist:"
  for tag in "${TAGS_EXIST[@]}"; do
    echo "  - $tag"
  done
  echo ""
  echo "You can:"
  echo "  1. Delete existing tags and re-release"
  echo "  2. Skip platforms that already have tags"
  echo "  3. Cancel this release"
  echo ""
  read -p "Do you want to delete existing tags and continue? (y/N) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for tag in "${TAGS_EXIST[@]}"; do
      echo "Deleting tag $tag..."
      git tag -d "$tag" 2>/dev/null || true
      git push origin --delete "$tag" 2>/dev/null || true
      TAGS_TO_CREATE+=("$tag")
    done
  else
    # Remove platforms with existing tags
    if [ "$BUILD_MACOS" = true ] && tag_exists "v${VERSION}-macos"; then
      BUILD_MACOS=false
      echo "Skipping macOS (tag exists)"
    fi
    if [ "$BUILD_WINDOWS" = true ] && tag_exists "v${VERSION}-windows"; then
      BUILD_WINDOWS=false
      echo "Skipping Windows (tag exists)"
    fi
    if [ "$BUILD_LINUX" = true ] && tag_exists "v${VERSION}-linux"; then
      BUILD_LINUX=false
      echo "Skipping Linux (tag exists)"
    fi

    # Check if anything left to build
    if [ "$BUILD_MACOS" = false ] && [ "$BUILD_WINDOWS" = false ] && [ "$BUILD_LINUX" = false ]; then
      echo ""
      echo "No platforms left to build. Exiting."
      exit 0
    fi
  fi
fi

# Show what will be built
echo ""
echo "Creating release v$VERSION"
echo ""
echo "Platforms to build:"
[ "$BUILD_MACOS" = true ] && echo "  + macOS     -> tag: v${VERSION}-macos"
[ "$BUILD_WINDOWS" = true ] && echo "  + Windows   -> tag: v${VERSION}-windows"
[ "$BUILD_LINUX" = true ] && echo "  + Linux     -> tag: v${VERSION}-linux"
echo ""

# Get current version
CURRENT_VERSION=$(get_current_version)
VERSION_CHANGED=false

if [ "$CURRENT_VERSION" != "$VERSION" ]; then
  VERSION_CHANGED=true
  echo "Version will be updated: $CURRENT_VERSION -> $VERSION"
else
  echo "Version unchanged: $VERSION (adding platforms to existing version)"
fi
echo ""

# Check if working directory is clean (only if version is changing)
if [ "$VERSION_CHANGED" = true ] && [ -n "$(git status --porcelain)" ]; then
  echo "Warning: You have uncommitted changes"
  read -p "Do you want to continue? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Update version files (only if version changed)
if [ "$VERSION_CHANGED" = true ]; then
  echo "Updating version files..."
  node scripts/set-version.js $VERSION

  # Stage changes
  echo "Staging changes..."
  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml

  # Commit changes
  echo "Committing changes..."
  git commit -m "chore: bump version to $VERSION"
fi

# Create platform-specific tags
echo "Creating tags..."
if [ "$BUILD_MACOS" = true ]; then
  git tag -a "v${VERSION}-macos" -m "Release v${VERSION} for macOS"
  echo "  Created: v${VERSION}-macos"
fi

if [ "$BUILD_WINDOWS" = true ]; then
  git tag -a "v${VERSION}-windows" -m "Release v${VERSION} for Windows"
  echo "  Created: v${VERSION}-windows"
fi

if [ "$BUILD_LINUX" = true ]; then
  git tag -a "v${VERSION}-linux" -m "Release v${VERSION} for Linux"
  echo "  Created: v${VERSION}-linux"
fi

# Show what will be pushed
echo ""
echo "Release prepared successfully!"
echo ""
echo "The following will be pushed:"
[ "$VERSION_CHANGED" = true ] && echo "  - Commit: chore: bump version to $VERSION"
[ "$BUILD_MACOS" = true ] && echo "  - Tag: v${VERSION}-macos"
[ "$BUILD_WINDOWS" = true ] && echo "  - Tag: v${VERSION}-windows"
[ "$BUILD_LINUX" = true ] && echo "  - Tag: v${VERSION}-linux"
echo ""
echo "Ready to push and trigger builds..."
read -p "Continue? (y/N) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "Release not pushed. To undo, run:"
  [ "$BUILD_MACOS" = true ] && echo "   git tag -d v${VERSION}-macos"
  [ "$BUILD_WINDOWS" = true ] && echo "   git tag -d v${VERSION}-windows"
  [ "$BUILD_LINUX" = true ] && echo "   git tag -d v${VERSION}-linux"
  [ "$VERSION_CHANGED" = true ] && echo "   git reset --soft HEAD~1"
  exit 0
fi

# Push to remote
echo ""
echo "Pushing to remote..."
git push
git push --tags

echo ""
echo "Release v$VERSION pushed successfully!"
echo ""

# Trigger GitHub Actions workflows
echo "Triggering GitHub Actions workflows..."
echo ""

if [ "$BUILD_MACOS" = true ]; then
  echo "  > Triggering macOS build..."
  gh workflow run build-macos.yml -f version=$VERSION
fi

if [ "$BUILD_WINDOWS" = true ]; then
  echo "  > Triggering Windows build..."
  gh workflow run build-windows.yml -f version=$VERSION
fi

if [ "$BUILD_LINUX" = true ]; then
  echo "  > Triggering Linux build..."
  gh workflow run build-linux.yml -f version=$VERSION
fi

echo ""
echo "All workflows triggered!"
echo ""
echo "Monitor builds:"
echo "   Web: https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//' | sed 's/.git$//')/actions"
echo "   CLI: gh run watch"
echo ""
echo "Tips:"
echo "   - Each platform builds independently - if one fails, others continue"
echo "   - Builds will be deployed to your server automatically"
echo "   - Each platform updates only its section in update-manifest.json"
echo "   - You can add more platforms later with: pnpm release $VERSION --<platform>"
echo ""
