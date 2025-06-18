module.exports = {
  apps: [
    {
      name: 'affiliate-client',
      script: './server/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/client-error.log',
      out_file: './logs/client-out.log',
      log_file: './logs/client-combined.log',
      time: true
    },
    {
      name: 'affiliate-admin',
      script: './server/adminServer.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        ADMIN_PORT: 3001
      },
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      log_file: './logs/admin-combined.log',
      time: true
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server-ip',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/affiliate-system.git',
      path: '/var/www/affiliate-system',
      'pre-deploy-local': '',
      'post-deploy': 'cd server && npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
