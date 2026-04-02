module.exports = {
  apps: [{
    name: 'exam-shiting',
    script: 'server.js',
    env: {
      NODE_ENV: 'production',
      PORT: 35002,
    },
    restart_delay: 3000,
    max_restarts: 10,
  }],
};
