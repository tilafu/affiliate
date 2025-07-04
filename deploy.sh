#!/bin/bash

# Production Deployment Script for Affiliate App
# Run this script on your Ubuntu 24.04 server

set -e  # Exit on any error

echo "🚀 Starting deployment of Affiliate App..."

# Configuration
APP_NAME="affiliate-app"
DOCKER_IMAGE="your-dockerhub-username/affiliate-app"
BACKUP_DIR="/var/backups/affiliate-app"
LOG_FILE="/var/log/affiliate-deploy.log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    log "❌ Error occurred during deployment. Rolling back..."
    docker-compose down || true
    docker-compose up -d || true
    exit 1
}

trap handle_error ERR

log "📋 Pre-deployment checks..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    log "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose >/dev/null 2>&1; then
    log "❌ docker-compose is not installed. Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# Create backup directory
sudo mkdir -p "$BACKUP_DIR"

log "💾 Creating database backup..."
# Backup database if container is running
if docker ps | grep -q affiliate-db; then
    docker exec affiliate-db pg_dump -U affiliate_user affiliate_db > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
    log "✅ Database backup created"
fi

log "🔄 Pulling latest changes..."
git pull origin main

log "🐳 Building and deploying containers..."

# Stop services gracefully
docker-compose down --timeout 30

# Pull latest images
docker-compose pull

# Build and start services
docker-compose up -d --build

log "⏳ Waiting for services to be ready..."
sleep 30

# Health check
log "🔍 Performing health checks..."
for i in {1..10}; do
    if curl -f http://localhost:3000/health >/dev/null 2>&1; then
        log "✅ Application health check passed"
        break
    fi
    
    if [ $i -eq 10 ]; then
        log "❌ Application health check failed after 10 attempts"
        handle_error
    fi
    
    log "⏳ Health check attempt $i/10 failed, retrying in 10 seconds..."
    sleep 10
done

# Check database connectivity
log "🔍 Checking database connectivity..."
if docker exec affiliate-app node -e "
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});
pool.connect().then(() => {
    console.log('Database connection successful');
    process.exit(0);
}).catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
});
"; then
    log "✅ Database connectivity check passed"
else
    log "❌ Database connectivity check failed"
    handle_error
fi

# Clean up old Docker images
log "🧹 Cleaning up old Docker images..."
docker image prune -f

# Display running containers
log "📊 Current running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Show disk usage
log "💾 Current disk usage:"
df -h /

log "🎉 Deployment completed successfully!"
log "📍 Application is available at:"
log "   - Main App: http://localhost:3000"
log "   - Admin Panel: http://localhost:3001"
log "   - Database: localhost:5432"

echo ""
echo "🔗 Quick commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Restart app:      docker-compose restart affiliate-app"
echo "  Stop all:         docker-compose down"
echo "  Database backup:  docker exec affiliate-db pg_dump -U affiliate_user affiliate_db > backup.sql"
