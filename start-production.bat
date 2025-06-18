@echo off
echo 🚀 Starting Affiliate System Production Deployment...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18+ first.
    pause
    exit /b 1
)

REM Check if PM2 is installed
pm2 --version >nul 2>&1
if errorlevel 1 (
    echo 📦 Installing PM2 globally...
    npm install -g pm2
)

REM Create logs directory
if not exist logs mkdir logs

REM Install dependencies
echo 📦 Installing dependencies...
cd server
npm install --only=production
cd ..

REM Check environment variables
if not exist .env (
    echo ⚠️  No .env file found. Copying from template...
    copy .env.production .env
    echo ⚠️  Please edit .env file with your production values before running again.
    pause
    exit /b 1
)

REM Start with PM2
echo 🚀 Starting application with PM2...
pm2 start ecosystem.config.js --env production

REM Show status
pm2 list

echo.
echo ✅ Affiliate System is now running in production!
echo.
echo 📊 Monitor with: pm2 monit
echo 📝 View logs with: pm2 logs
echo 🔄 Restart with: pm2 restart all
echo 🛑 Stop with: pm2 stop all
echo.
echo 🌐 Client Server: http://localhost:3000
echo 🔧 Admin Panel: http://localhost:3001
echo.
echo Remember to:
echo - Set up SSL certificates for HTTPS
echo - Configure nginx reverse proxy if needed
echo - Set up domain DNS
echo - Configure firewall rules
echo.
pause
