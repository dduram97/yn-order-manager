/**
 * PM2 — VPS production only
 *
 *   yn-order-manager  → next start :3000
 *   aligo-proxy       → server/aligo-proxy :4000
 *
 * ⚠️ pm2 start npm -- run dev 금지
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs", "pm2");
fs.mkdirSync(LOG_DIR, { recursive: true });

module.exports = {
  apps: [
    {
      name: "yn-order-manager",
      cwd: ROOT,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      max_restarts: 15,
      min_uptime: "10s",
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        AUTH_COOKIE_SECURE: "false",
      },
      error_file: path.join(LOG_DIR, "next-error.log"),
      out_file: path.join(LOG_DIR, "next-out.log"),
      merge_logs: true,
      time: true,
    },
    {
      name: "aligo-proxy",
      cwd: path.join(ROOT, "server/aligo-proxy"),
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
      error_file: path.join(LOG_DIR, "proxy-error.log"),
      out_file: path.join(LOG_DIR, "proxy-out.log"),
      merge_logs: true,
      time: true,
    },
  ],
};
