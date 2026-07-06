/**
 * PM2 — VPS 전용 (aligo-proxy)
 *
 * cd server/aligo-proxy && npm ci
 * pm2 start ecosystem.config.js
 * pm2 save && pm2 startup
 */
const path = require("path");

module.exports = {
  apps: [
    {
      name: "aligo-proxy",
      cwd: __dirname,
      script: "index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      max_restarts: 15,
      min_uptime: "10s",
      restart_delay: 2000,
      env: {
        NODE_ENV: "production",
        PORT: "4000",
      },
    },
  ],
};
