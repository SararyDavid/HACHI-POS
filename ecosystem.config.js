module.exports = {
  apps: [
    {
      name: 'hachi-pos',
      script: 'server.js',
      cwd: './backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true
    }
  ]
};
