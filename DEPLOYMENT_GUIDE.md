# 🚀 Production Deployment Guide

This guide covers different ways to deploy the Affiliate System in production with both Client and Admin panels.

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Development vs Production](#development-vs-production)
3. [Deployment Options](#deployment-options)
4. [Security Considerations](#security-considerations)
5. [Monitoring & Maintenance](#monitoring--maintenance)

## 🚀 Quick Start

### Development (Both servers with hot reload)
```bash
npm run dev
```
- Client Server: http://localhost:3000
- Admin Panel: http://localhost:3001

### Production (PM2 Process Manager)
```bash
# Linux/Mac
./start-production.sh

# Windows
start-production.bat

# Or manually
npm run production
```

## 🔄 Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| **Process Manager** | nodemon | PM2 |
| **Servers** | Both on localhost | Both servers + nginx |
| **SSL** | Not required | Required (HTTPS) |
| **Domains** | localhost:3000/3001 | yourdomain.com, admin.yourdomain.com |
| **Monitoring** | Console logs | PM2 + Log files |
| **Auto-restart** | Manual restart | Automatic restart |

## 🏗️ Deployment Options

### Option 1: Single Server (Recommended for small-medium apps)
```bash
# Both client and admin on same server, different ports
npm run production
```
**Architecture:**
```
[Users] → yourdomain.com:3000 (Client)
[Admins] → admin.yourdomain.com:3001 (Admin)
```

### Option 2: Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up -d
```
**Includes:**
- PostgreSQL database
- Nginx reverse proxy
- Both client and admin servers
- SSL termination ready

### Option 3: Separate Servers (Maximum Security)
```bash
# Server 1 (Client only)
cd server && npm run start

# Server 2 (Admin only)
cd server && npm run start:admin
```

### Option 4: Cloud Deployment (AWS, DigitalOcean, etc.)
- Use PM2 with ecosystem.config.js
- Set up load balancers
- Use managed databases (RDS, etc.)

## 🔒 Security Considerations

### 1. Admin Panel Security
```bash
# Admin should be on separate subdomain
admin.yourdomain.com → Port 3001
```

### 2. SSL/HTTPS Setup
```bash
# Get SSL certificates (Let's Encrypt)
sudo certbot --nginx -d yourdomain.com -d admin.yourdomain.com
```

### 3. Environment Variables
```bash
# Never commit .env files
# Use strong JWT secrets (32+ characters)
JWT_SECRET=your-super-secure-secret-here
```

### 4. Database Security
```sql
-- Create separate database users
CREATE USER affiliate_client WITH PASSWORD 'secure_password';
CREATE USER affiliate_admin WITH PASSWORD 'admin_secure_password';

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON user_tables TO affiliate_client;
GRANT ALL PRIVILEGES ON admin_tables TO affiliate_admin;
```

### 5. Firewall Configuration
```bash
# Allow only necessary ports
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw enable
```

## 📊 Monitoring & Maintenance

### PM2 Commands
```bash
# View all processes
pm2 list

# Monitor in real-time
pm2 monit

# View logs
pm2 logs

# Restart all
pm2 restart all

# Stop all
pm2 stop all

# Save PM2 configuration
pm2 save
pm2 startup
```

### Health Checks
```bash
# Check if services are running
curl http://localhost:3000/api/health
curl http://localhost:3001/api/health
```

### Log Management
```bash
# Rotate logs
pm2 install pm2-logrotate

# Configure log rotation (keeps 10 files, max 10M each)
pm2 set pm2-logrotate:retain 10
pm2 set pm2-logrotate:max_size 10M
```

## 🌐 Domain Configuration

### DNS Settings
```
# A Records
yourdomain.com → Your Server IP
admin.yourdomain.com → Your Server IP (or different IP for separate server)

# CNAME (alternative)
www.yourdomain.com → yourdomain.com
```

### Nginx Configuration
The included `nginx.conf` provides:
- Reverse proxy for both servers
- Rate limiting
- SSL termination ready
- Static file caching
- Security headers

## 🐳 Docker Deployment

### Quick Docker Start
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Docker Services
- **postgres**: Database server
- **affiliate-app**: Both client and admin servers
- **nginx**: Reverse proxy with SSL ready

## 📁 Production File Structure
```
affiliate-final/
├── server/
│   ├── server.js          # Client server
│   ├── adminServer.js     # Admin server
│   └── package.json       # Server dependencies
├── public/                # Client static files
├── logs/                  # Production logs
├── ecosystem.config.js    # PM2 configuration
├── docker-compose.yml     # Docker configuration
├── nginx.conf            # Nginx configuration
├── .env.production       # Environment template
└── start-production.*    # Startup scripts
```

## 🔧 Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Kill process on port
   sudo lsof -ti:3000 | xargs kill -9
   sudo lsof -ti:3001 | xargs kill -9
   ```

2. **Database Connection Failed**
   ```bash
   # Check PostgreSQL service
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   ```

3. **PM2 Process Not Starting**
   ```bash
   # Check PM2 logs
   pm2 logs
   
   # Restart PM2
   pm2 kill
   pm2 resurrect
   ```

4. **SSL Certificate Issues**
   ```bash
   # Renew Let's Encrypt certificates
   sudo certbot renew --dry-run
   sudo certbot renew
   ```

## 📞 Support

For production deployment support:
1. Check the logs: `pm2 logs`
2. Monitor processes: `pm2 monit`  
3. Review configuration files
4. Check firewall and DNS settings

## 🎯 Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] SSL certificates installed
- [ ] Domain DNS configured
- [ ] Firewall rules set
- [ ] PM2 startup configured
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Monitoring setup complete
- [ ] Admin IP whitelist configured (optional)

This setup ensures your affiliate system runs reliably in production with both client and admin functionality properly separated and secured.
