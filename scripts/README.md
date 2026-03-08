# Deployment Scripts

This directory contains scripts to help with versioning and releasing the application.

## Available Scripts

### `build-macos-local.sh`

Build macOS application locally to save CI/CD runner costs. Optionally deploy to the same server location as CI/CD builds.

**Usage:**
```bash
# Just build locally
pnpm build:macos

# Build and deploy to server
pnpm build:macos --version 0.9.18 --deploy

# Build macOS locally, deploy, then release Windows/Linux via CI/CD
pnpm build:macos --version 0.9.18 --deploy --no-manifest
pnpm release 0.9.18 --windows --linux

# Deploy existing build without rebuilding
pnpm build:macos --version 0.9.18 --deploy --skip-build
```

**What it does:**
- Builds universal macOS binary (Intel + Apple Silicon)
- Optionally uploads to server in same directory structure as CI/CD
- Can update auto-update manifests or skip them for partial releases
- Maintains consistency with CI/CD deployments

**Setup (for --deploy):**
Add to your `~/.zshrc` or `~/.bashrc`:
```bash
export SSH_HOST="your-server.com"
export SSH_USER="deploy"
export DEPLOY_PATH="/var/www/downloads"
export BASE_URL="https://downloads.example.com"
```

See [DEPLOYMENT.md](../DEPLOYMENT.md#local-macos-builds-cost-optimization) for complete guide.

### `set-version.js`

Updates version numbers in `package.json` and `src-tauri/tauri.conf.json`.

**Usage:**
```bash
node scripts/set-version.js 0.0.1
# or via npm script:
pnpm version 0.0.1
```

**What it does:**
- Validates version format (semantic versioning)
- Updates `package.json` version
- Updates `src-tauri/tauri.conf.json` version
- Provides next steps for committing and tagging

### `release.sh`

Complete release automation script that handles version bump, commit, tag, and push.

**Usage:**
```bash
./scripts/release.sh 0.0.1
# or via npm script:
pnpm release 0.0.1
```

**What it does:**
1. Validates version format
2. Checks for uncommitted changes (with prompt to continue)
3. Updates version in both config files
4. Stages the changes
5. Creates a commit with message: `chore: bump version to X.X.X`
6. Creates a git tag: `vX.X.X`
7. Prompts to push to remote
8. If confirmed, pushes commit and tags

**Interactive prompts:**
- Warns if working directory has uncommitted changes
- Asks for confirmation before pushing to remote

## Version Format

All scripts require semantic versioning format: `MAJOR.MINOR.PATCH`

Valid examples:
- `0.0.1`
- `1.0.0`
- `2.3.4`

Invalid examples:
- `v0.0.1` (don't include 'v' prefix)
- `1.0` (missing patch version)
- `1.0.0-beta` (pre-release not supported in these scripts)

## Quick Release Workflow

The fastest way to create a release:

```bash
# One command to do it all
pnpm release 0.0.1
```

This will:
1. Update versions
2. Commit changes
3. Create tag
4. Push everything to trigger CI/CD

## Manual Workflow

If you prefer more control:

```bash
# 1. Update version
pnpm version 0.0.1

# 2. Review changes
git diff

# 3. Commit
git add package.json src-tauri/tauri.conf.json
git commit -m "chore: bump version to 0.0.1"

# 4. Tag
git tag v0.0.1

# 5. Push
git push && git push --tags
```

## CI/CD Integration

When you push a version tag (e.g., `v0.0.1`), GitHub Actions will:
1. Build the app for all platforms (macOS, Windows, Linux)
2. Create a GitHub Release
3. Upload builds to your server via SSH
4. Generate a download page

See [../DEPLOYMENT.md](../DEPLOYMENT.md) for complete CI/CD documentation.
