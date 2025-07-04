#!/bin/bash

# Ubuntu 24.04 Server Setup Script for Affiliate App
# Run this script on a fresh Ubuntu 24.04 server

set -e

echo "🛠️  Setting up Ubuntu 24.04 server for Affiliate App deployment..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install essential packages
echo "📦 Installing essential packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    unzip \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    ufw \
    htop \
    nano \
    tree

# Install Docker
echo "🐳 Installing Docker..."
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add current user to docker group
sudo usermod -aG docker $USER

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Install Node.js (for local development/debugging)
echo "📦 Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager, optional)
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw --force enable

# Create application directory
echo "📁 Creating application directory..."
sudo mkdir -p /opt/affiliate-app
sudo chown $USER:$USER /opt/affiliate-app

# Create logs directory
sudo mkdir -p /var/log/affiliate-app
sudo chown $USER:$USER /var/log/affiliate-app

# Create backup directory
sudo mkdir -p /var/backups/affiliate-app
sudo chown $USER:$USER /var/backups/affiliate-app

# Configure log rotation
echo "📝 Setting up log rotation..."
sudo tee /etc/logrotate.d/affiliate-app > /dev/null <<EOF
/var/log/affiliate-app/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 $USER $USER
}
EOF

# Install Nginx (optional, for reverse proxy)
echo "🌐 Installing Nginx..."
sudo apt install -y nginx

# Configure basic Nginx
sudo tee /etc/nginx/sites-available/affiliate-app > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /admin {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/affiliate-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# Setup automatic security updates
echo "🔒 Setting up automatic security updates..."
sudo apt install -y unattended-upgrades
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades

# Create monitoring script
echo "📊 Creating monitoring script..."
tee /home/$USER/monitor-app.sh > /dev/null <<EOF
#!/bin/bash

# Simple monitoring script
echo "=== Affiliate App Status ==="
echo "Date: \$(date)"
echo ""

echo "Docker containers:"
docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"
echo ""

echo "Disk usage:"
df -h / /var
echo ""

echo "Memory usage:"
free -h
echo ""

echo "Application logs (last 10 lines):"
docker logs affiliate-app --tail 10
EOF

chmod +x /home/$USER/monitor-app.sh

# Setup daily backup cron job
echo "⏰ Setting up daily backup cron job..."
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/affiliate-app/scripts/backup.sh") | crontab -

# Create backup script
mkdir -p /opt/affiliate-app/scripts
tee /opt/affiliate-app/scripts/backup.sh > /dev/null <<EOF
#!/bin/bash

BACKUP_DIR="/var/backups/affiliate-app"
DATE=\$(date +%Y%m%d_%H%M%S)

# Create database backup
if docker ps | grep -q affiliate-db; then
    docker exec affiliate-db pg_dump -U affiliate_user affiliate_db > "\$BACKUP_DIR/db_backup_\$DATE.sql"
    gzip "\$BACKUP_DIR/db_backup_\$DATE.sql"
fi

# Remove backups older than 30 days
find \$BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: \$DATE"
EOF

chmod +x /opt/affiliate-app/scripts/backup.sh

echo ""
echo "✅ Ubuntu 24.04 setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Reboot the server: sudo reboot"
echo "2. Clone your repository: git clone <your-repo-url> /opt/affiliate-app"
echo "3. Configure environment: cp .env.example .env.production"
echo "4. Run deployment: cd /opt/affiliate-app && ./deploy.sh"
echo ""
echo "🔗 Useful commands:"
echo "  Monitor app:      ./monitor-app.sh"
echo "  View Docker logs: docker-compose logs -f"
echo "  Backup database:  /opt/affiliate-app/scripts/backup.sh"
echo "  Check firewall:   sudo ufw status"
echo ""
echo "⚠️  Remember to:"
echo "  - Configure your domain name in Nginx"
echo "  - Setup SSL certificates (Let's Encrypt recommended)"
echo "  - Update the .env.production file with your secrets"
echo "  - Configure GitHub Actions secrets for deployment"
