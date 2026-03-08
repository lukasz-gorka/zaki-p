# Deployment Guide

This document explains how to set up automatic deployment for zakip voice.

## Overview

The deployment process uses GitHub Actions to:
1. Build the application for macOS, Windows, and Linux
2. Create a GitHub Release with downloadable binaries
3. (Optional) Deploy binaries to your own server via SSH

## Required Secrets

### Build Secrets (Required)

These secrets are **required** for the build to succeed:

| Secret Name | Description |
|------------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | Private key for signing auto-update bundles |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for the signing key |

**How to add:** Go to your repository → Settings → Secrets and variables → Actions → Repository secrets → New repository secret

### Deployment Secrets (Optional)

These secrets are only needed if you want to deploy to your own server via SSH:

| Secret Name | Description | Example |
|------------|-------------|---------|
| `SSH_PRIVATE_KEY` | SSH private key for server access | Contents of your private key file |
| `SSH_HOST` | SSH server hostname or IP | `example.com` or `192.168.1.1` |
| `SSH_USER` | SSH username | `deploy` or `root` |
| `SSH_PORT` | SSH port | `22` |
| `DEPLOY_PATH` | Server path for deployment | `/var/www/downloads` |
| `BASE_URL` | Base URL for downloads (optional) | `https://downloads.example.com` |

**Note:** If any SSH secret is missing, the deployment step will be automatically skipped. The build and GitHub Release will still succeed.

### Optional — macOS Notarization

| Secret Name | Description |
|------------|-------------|
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect |
| `APPLE_API_KEY` | Key ID |
| `APPLE_API_KEY_CONTENT` | Contents of the .p8 key file |

### Optional — Windows Code Signing

| Secret Name | Description |
|------------|-------------|
| `WINDOWS_CERTIFICATE` | PFX certificate in base64 |
| `WINDOWS_CERTIFICATE_PASSWORD` | Password for the PFX |

## Setting Up SSH Deployment

### 1. Generate SSH Key (if you don't have one)

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```

### 2. Add Public Key to Server

Copy the public key to your server:

```bash
ssh-copy-id -i ~/.ssh/github_deploy_key.pub user@your-server.com
```

Or manually add it to `~/.ssh/authorized_keys` on your server.

### 3. Test SSH Connection Locally

Before adding secrets to GitHub, test the deployment locally:

```bash
# Copy and configure .env.deploy
cp .env.deploy.example .env.deploy
nano .env.deploy

# Run test script
./scripts/test-deploy.sh
```

### 4. Add SSH Private Key to GitHub Secrets

Copy the **entire** private key including the header and footer:

```bash
cat ~/.ssh/github_deploy_key
```

The key should look like this:
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
...
YdZqi0Zhd3+ZAAAAFGFzc2lzdGFudC1hcHAtZ2l0aHViAQIDBAUG
-----END OPENSSH PRIVATE KEY-----
```

Add this entire content to GitHub Secrets as `SSH_PRIVATE_KEY`.

### 5. Add Other Secrets

Add the remaining secrets:
- `SSH_HOST`: Your server hostname
- `SSH_USER`: Your SSH username
- `DEPLOY_PATH`: Server directory path
- `BASE_URL`: (Optional) Your download page URL

## Triggering a Release

### Method 1: Using the Release Script (Recommended)

```bash
pnpm release 0.9.7
```

This will:
1. Update version in `package.json` and `tauri.conf.json`
2. Create a commit
3. Create platform-specific git tags
4. Push to GitHub (triggering the workflows)

### Method 2: Manual Workflow Trigger

Go to Actions → Build macOS/Windows/Linux → Run workflow → Enter version number

## Monitoring Deployment

After pushing tags, monitor the deployment:

1. Go to your repository → Actions
2. Click on the running workflow
3. Check the logs for each job:
   - `build-*`: Builds for the platform
   - `deploy`: (Optional) Deploys to your server

## Troubleshooting

### SSH Connection Fails

1. Test SSH locally first using `./scripts/test-deploy.sh`
2. Verify the private key is complete (includes BEGIN and END lines)
3. Check that the public key is on the server
4. Verify `SSH_HOST` and `SSH_USER` are correct

### Deploy Job Skipped

This is normal if SSH secrets are not configured. The build and GitHub Release will still succeed.

### No Artifacts Found

This can happen if:
- The build failed (check build logs)
- File paths in workflow don't match actual build output
- Check `tauri.conf.json` has correct targets

## Security Notes

- Never commit secrets to the repository
- Use `.env.deploy` for local testing (it's in `.gitignore`)
- GitHub Secrets are encrypted and only accessible during workflow execution
- Consider using a dedicated deploy user with limited permissions
- Regularly rotate SSH keys

## Support

For issues with:
- **GitHub Actions**: Check workflow logs in Actions tab
- **SSH Deployment**: Test locally with `./scripts/test-deploy.sh`
- **Build Issues**: Check Tauri build logs
