module.exports = {
  apps: [
    {
      name: 'sc-music-api',
      script: 'build/index.js',
      args: 'serve',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '500M',
    },
  ],
};
