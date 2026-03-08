#!/bin/bash

# Script to test SSH deployment locally
# Usage: ./scripts/test-deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🧪 Testing SSH Deployment Locally${NC}"
echo ""

# Check if .env.deploy exists
if [ ! -f ".env.deploy" ]; then
  echo -e "${RED}❌ Error: .env.deploy file not found${NC}"
  echo "Create .env.deploy based on .env.deploy.example"
  exit 1
fi

# Load environment variables
source .env.deploy

# Validate required variables
REQUIRED_VARS=("SSH_PRIVATE_KEY_PATH" "SSH_HOST" "SSH_USER" "DEPLOY_PATH" "VERSION")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var}" ]; then
    echo -e "${RED}❌ Error: $var is not set in .env.deploy${NC}"
    exit 1
  fi
done

# Set default SSH port if not specified
SSH_PORT=${SSH_PORT:-22}

echo -e "${GREEN}✅ Environment variables loaded${NC}"
echo ""

# Simulate downloading artifacts (use actual build artifacts if they exist)
echo -e "${YELLOW}📦 Looking for build artifacts...${NC}"
ARTIFACTS_DIR="./test-artifacts"
mkdir -p "$ARTIFACTS_DIR"

# Check if we have any build artifacts
if [ -d "src-tauri/target" ]; then
  echo "Found Tauri build directory, copying artifacts..."

  # Find and copy artifacts
  find src-tauri/target -type f \( \
    -name "*.dmg" -o \
    -name "*.AppImage" -o \
    -name "*-setup.exe" -o \
    -name "*.msi" -o \
    -name "*.deb" \
  \) -exec cp {} "$ARTIFACTS_DIR/" \; 2>/dev/null || echo "No artifacts found in build directory"
else
  echo -e "${YELLOW}⚠️  No build artifacts found. Run 'pnpm tauri build' first or use dummy files.${NC}"
  # Create dummy files for testing
  touch "$ARTIFACTS_DIR/ai-assistant-app_${VERSION}_universal.dmg"
  touch "$ARTIFACTS_DIR/ai-assistant-app_${VERSION}_amd64.AppImage"
  touch "$ARTIFACTS_DIR/ai-assistant-app_${VERSION}_x64-setup.exe"
  echo "Created dummy artifacts for testing"
fi

echo ""
echo -e "${YELLOW}📤 Testing SSH connection...${NC}"
echo "Connecting to $SSH_USER@$SSH_HOST:$SSH_PORT"

# Test SSH connection
if ssh -i "$SSH_PRIVATE_KEY_PATH" -p "$SSH_PORT" -o ConnectTimeout=5 -o StrictHostKeyChecking=no "$SSH_USER@$SSH_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
  echo -e "${GREEN}✅ SSH connection successful${NC}"
else
  echo -e "${RED}❌ SSH connection failed${NC}"
  echo "Please check your SSH credentials in .env.deploy"
  echo ""
  echo "Debug info:"
  echo "  SSH_HOST: $SSH_HOST"
  echo "  SSH_PORT: $SSH_PORT"
  echo "  SSH_USER: $SSH_USER"
  echo "  SSH_PRIVATE_KEY_PATH: $SSH_PRIVATE_KEY_PATH"
  echo ""
  echo "Try manually: ssh -i $SSH_PRIVATE_KEY_PATH -p $SSH_PORT $SSH_USER@$SSH_HOST"
  exit 1
fi

echo ""
echo -e "${YELLOW}📁 Creating deployment directory structure...${NC}"

# Create deployment directory
ssh -i "$SSH_PRIVATE_KEY_PATH" -p "$SSH_PORT" "$SSH_USER@$SSH_HOST" "mkdir -p $DEPLOY_PATH/releases/v$VERSION"
echo -e "${GREEN}✅ Created directory: $DEPLOY_PATH/releases/v$VERSION${NC}"

echo ""
echo -e "${YELLOW}📤 Uploading artifacts...${NC}"

# Upload artifacts
UPLOADED_COUNT=0
for file in "$ARTIFACTS_DIR"/*; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "Uploading $filename..."
    scp -i "$SSH_PRIVATE_KEY_PATH" -P "$SSH_PORT" "$file" "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/releases/v$VERSION/"
    ((UPLOADED_COUNT++))
  fi
done

echo -e "${GREEN}✅ Uploaded $UPLOADED_COUNT file(s)${NC}"

echo ""
echo -e "${YELLOW}📄 Generating download page...${NC}"

# Generate index.html
cat > /tmp/index.html << EOF
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ai-assistant-app - Download</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 2.5em;
        }
        .version {
            color: #667eea;
            font-size: 1.2em;
            margin-bottom: 30px;
            font-weight: 600;
        }
        .download-section {
            margin: 30px 0;
        }
        .platform-title {
            color: #555;
            font-size: 1.1em;
            margin-bottom: 15px;
            font-weight: 600;
        }
        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
            margin: 5px;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>ai-assistant-app</h1>
        <div class="version">Wersja: v$VERSION</div>

        <div class="download-section">
            <div class="platform-title">macOS</div>
            <a href="./releases/v$VERSION/ai-assistant-app_${VERSION}_universal.dmg" class="btn">Pobierz dla macOS</a>
        </div>

        <div class="download-section">
            <div class="platform-title">Windows</div>
            <a href="./releases/v$VERSION/ai-assistant-app_${VERSION}_x64-setup.exe" class="btn">Pobierz dla Windows</a>
        </div>

        <div class="download-section">
            <div class="platform-title">Linux</div>
            <a href="./releases/v$VERSION/ai-assistant-app_${VERSION}_amd64.AppImage" class="btn">Pobierz dla Linux</a>
        </div>
    </div>
</body>
</html>
EOF

# Upload index.html
scp -i "$SSH_PRIVATE_KEY_PATH" -P "$SSH_PORT" /tmp/index.html "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/index.html"
echo -e "${GREEN}✅ Uploaded download page${NC}"

# Generate manifest.json
cat > /tmp/manifest.json << EOF
{
  "version": "$VERSION",
  "releaseDate": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "downloads": {
    "macos": "./releases/v$VERSION/ai-assistant-app_${VERSION}_universal.dmg",
    "windows": "./releases/v$VERSION/ai-assistant-app_${VERSION}_x64-setup.exe",
    "linux": "./releases/v$VERSION/ai-assistant-app_${VERSION}_amd64.AppImage"
  }
}
EOF

scp -i "$SSH_PRIVATE_KEY_PATH" -P "$SSH_PORT" /tmp/manifest.json "$SSH_USER@$SSH_HOST:$DEPLOY_PATH/manifest.json"
echo -e "${GREEN}✅ Uploaded manifest.json${NC}"

echo ""
echo -e "${GREEN}🎉 Deployment test completed successfully!${NC}"
echo ""
echo "Files deployed to: $SSH_USER@$SSH_HOST:$DEPLOY_PATH"
echo "Download page: ${BASE_URL}/index.html"
echo ""

# Cleanup
rm -rf "$ARTIFACTS_DIR"
rm /tmp/index.html /tmp/manifest.json

echo -e "${YELLOW}💡 To verify the deployment, run:${NC}"
echo "ssh -i $SSH_PRIVATE_KEY_PATH -p $SSH_PORT $SSH_USER@$SSH_HOST 'ls -la $DEPLOY_PATH/releases/v$VERSION/'"
