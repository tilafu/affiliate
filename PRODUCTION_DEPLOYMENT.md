# Production Configuration for Affiliate System
# This file contains production deployment configurations

## Environment Variables
# Copy these to your production environment

# Database Configuration
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=affiliate_db
DB_USER=your-db-user
DB_PASSWORD=your-secure-db-password

# JWT Configuration
JWT_SECRET=your-very-secure-jwt-secret-here

# Server Ports
PORT=3000
ADMIN_PORT=3001

# Production Environment
NODE_ENV=production

## Production Deployment Options

### Option 1: PM2 (Recommended for VPS/Dedicated Servers)
# Install PM2 globally: npm install -g pm2
# Create ecosystem.config.js for PM2 configuration
# Start both servers with PM2

### Option 2: Docker Deployment
# Use docker-compose.yml for containerized deployment
# Includes nginx reverse proxy configuration

### Option 3: Separate Server Instances
# Deploy client and admin to different servers for maximum security
# Use nginx to proxy requests

## Security Considerations for Production

1. **Admin Panel Security:**
   - Admin panel should be on a separate subdomain (admin.yourdomain.com)
   - Use HTTPS/SSL certificates for both client and admin
   - Implement IP whitelisting for admin access
   - Use strong JWT secrets and short expiration times

2. **Network Security:**
   - Admin server can be on a different port or internal network
   - Use nginx reverse proxy to handle SSL termination
   - Rate limiting for both client and admin endpoints

3. **Database Security:**
   - Separate database users for client and admin operations
   - Admin user should have elevated privileges
   - Regular database backups

## Recommended Production Architecture

```
[Internet] 
    ↓
[Load Balancer/Cloudflare]
    ↓
[Nginx Reverse Proxy]
    ↓
[Client Server :3000] ← Users access this
    ↓
[Admin Server :3001] ← Admins access via admin.domain.com
    ↓
[PostgreSQL Database]
```

## Production Commands

# Start both servers in production
npm run start:both

# Start with PM2 (after setting up ecosystem.config.js)
pm2 start ecosystem.config.js

# Monitor with PM2
pm2 logs
pm2 monit
