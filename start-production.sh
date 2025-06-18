#!/bin/bash

# Production Startup Script for Affiliate System
# This script handles production deployment

set -e

echo "🚀 Starting Affiliate System Production Deployment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if PM2 is installed
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2 globally..."
    npm install -g pm2
fi

# Create logs directory
mkdir -p logs

# Install dependencies
echo "📦 Installing dependencies..."
cd server
npm install --only=production
cd ..

# Check environment variables
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Copying from template..."
    cp .env.production .env
    echo "⚠️  Please edit .env file with your production values before running again."
    exit 1
fi

# Database setup (optional - run migrations)
echo "🗄️  Setting up database..."
cd server
# Uncomment the next line if you have migrations
# node -e "require('./migrations/run-migrations.js')"
cd ..

# Start with PM2
echo "🚀 Starting application with PM2..."
pm2 start ecosystem.config.js --env production

# Show status
pm2 list

echo "✅ Affiliate System is now running in production!"
echo ""
echo "📊 Monitor with: pm2 monit"
echo "📝 View logs with: pm2 logs"
echo "🔄 Restart with: pm2 restart all"
echo "🛑 Stop with: pm2 stop all"
echo ""
echo "🌐 Client Server: http://localhost:3000"
echo "🔧 Admin Panel: http://localhost:3001"
echo ""
echo "Remember to:"
echo "- Set up SSL certificates for HTTPS"
echo "- Configure nginx reverse proxy"
echo "- Set up domain DNS"
echo "- Configure firewall rules"
