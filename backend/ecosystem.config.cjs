module.exports = {
  apps: [
    {
      name: 'let-them-cook',
      script: 'dist/server.js',
      cwd: '/home/pi/let-them-cook/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'file:../data/database.db',
        MEDIA_STORAGE_PATH: '../data/media',
      },
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
    },
  ],
};
