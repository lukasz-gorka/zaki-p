# Server Configuration Examples

This directory contains example web server configurations for hosting the AI Assistant download page.

## Quick Setup Guide

### 1. Prepare Server Directory

```bash
# Create deployment directory
sudo mkdir -p /var/www/ai-assistant-downloads

# Set proper ownership (replace 'deploy' with your SSH user)
sudo chown -R deploy:deploy /var/www/ai-assistant-downloads

# Set proper permissions
chmod 755 /var/www/ai-assistant-downloads
```

### 2. Choose Your Web Server

#### Option A: Nginx (Recommended)

```bash
# Copy configuration
sudo cp nginx.conf /etc/nginx/sites-available/ai-assistant-downloads

# Edit the configuration
sudo nano /etc/nginx/sites-available/ai-assistant-downloads
# Update: server_name, root path

# Enable the site
sudo ln -s /etc/nginx/sites-available/ai-assistant-downloads /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Option B: Apache

```bash
# Copy configuration
sudo cp apache.conf /etc/apache2/sites-available/ai-assistant-downloads.conf

# Edit the configuration
sudo nano /etc/apache2/sites-available/ai-assistant-downloads.conf
# Update: ServerName, DocumentRoot

# Enable required modules
sudo a2enmod ssl headers deflate

# Enable the site
sudo a2ensite ai-assistant-downloads

# Test configuration
sudo apache2ctl configtest

# Reload Apache
sudo systemctl reload apache2
```

### 3. Setup SSL (Recommended)

Using Let's Encrypt:

```bash
# Install Certbot
sudo apt update
sudo apt install certbot

# For Nginx
sudo apt install python3-certbot-nginx
sudo certbot --nginx -d downloads.example.com

# For Apache
sudo apt install python3-certbot-apache
sudo certbot --apache -d downloads.example.com
```

After SSL setup, uncomment SSL-related lines in your configuration.

### 4. Configure GitHub Secrets

In your GitHub repository, add these secrets (Settings → Secrets → Actions):

| Secret | Value |
|--------|-------|
| `SSH_PRIVATE_KEY` | Your SSH private key content |
| `SSH_HOST` | `downloads.example.com` or IP address |
| `SSH_USER` | `deploy` (or your SSH username) |
| `DEPLOY_PATH` | `/var/www/ai-assistant-downloads` |

### 5. Test Deployment

Create your first release:

```bash
# In your local repository
pnpm release 0.0.1
```

Wait for GitHub Actions to complete, then visit:
- `https://downloads.example.com/` - Download page
- `https://downloads.example.com/latest.txt` - Latest version
- `https://downloads.example.com/manifest.json` - Version manifest

## Directory Structure

After deployment, your server will have:

```
/var/www/ai-assistant-downloads/
├── index.html                      # Download page
├── latest.txt                      # Latest version
├── version.json                    # Version number
├── manifest.json                   # Full manifest
└── releases/
    ├── v0.0.1/
    │   ├── ai-assistant-app_0.0.1_universal.dmg
    │   ├── ai-assistant-app_0.0.1_x64-setup.exe
    │   └── ai-assistant_0.0.1_amd64.AppImage
    └── v0.0.2/
        └── ...
```

## Security Considerations

1. **SSH Key Security**
   - Use a dedicated SSH key for deployments
   - Limit key permissions to only the deployment directory
   - Consider using SSH key with passphrase

2. **File Permissions**
   ```bash
   # Set restrictive permissions
   sudo chmod 755 /var/www/ai-assistant-downloads
   sudo chmod 644 /var/www/ai-assistant-downloads/index.html
   sudo chmod 644 /var/www/ai-assistant-downloads/*.{txt,json}
   ```

3. **Firewall**
   ```bash
   # Allow HTTP/HTTPS only
   sudo ufw allow 'Nginx Full'  # or 'Apache Full'
   sudo ufw allow OpenSSH
   sudo ufw enable
   ```

4. **User Restrictions**
   ```bash
   # Create dedicated deployment user (optional)
   sudo adduser --disabled-password deploy
   sudo usermod -s /bin/bash deploy

   # Add SSH key for deployment user
   sudo -u deploy mkdir -p /home/deploy/.ssh
   sudo -u deploy chmod 700 /home/deploy/.ssh
   # Add public key to /home/deploy/.ssh/authorized_keys
   ```

## Troubleshooting

### Permission Denied

```bash
# Check directory permissions
ls -la /var/www/

# Fix ownership
sudo chown -R deploy:deploy /var/www/ai-assistant-downloads

# Fix permissions
sudo chmod 755 /var/www/ai-assistant-downloads
```

### 404 Not Found

```bash
# Check if files exist
ls -la /var/www/ai-assistant-downloads/

# Check web server error logs
# Nginx:
sudo tail -f /var/log/nginx/ai-assistant-downloads-error.log

# Apache:
sudo tail -f /var/log/apache2/ai-assistant-downloads-error.log
```

### SSL Issues

```bash
# Renew Let's Encrypt certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

## Advanced Configuration

### Custom Domain

If using a subdomain, add DNS record:

```
Type: A
Name: downloads
Value: YOUR_SERVER_IP
TTL: 3600
```

### CDN Integration

For better performance, you can put CloudFlare or another CDN in front:

1. Point your domain to CloudFlare
2. Configure CloudFlare to proxy traffic
3. Set cache rules for `/releases/*` (1 year)
4. Set no-cache for `/*.json` and `/*.txt`

### Bandwidth Monitoring

```bash
# Install vnstat
sudo apt install vnstat

# Monitor bandwidth
vnstat -d  # Daily stats
vnstat -m  # Monthly stats
```

## Support

For more information, see:
- [Main Deployment Documentation](../../docs/DEPLOYMENT.md)
- [GitHub Actions Workflows](../../.github/workflows/)
- [Release Scripts](../../scripts/)
