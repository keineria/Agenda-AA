/**
 * PM2: mantiene la agenda viva y la levanta al reiniciar el VPS.
 * Lee las variables del archivo .env de esta carpeta.
 */
const fs = require("node:fs");
const path = require("node:path");

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].replace(/^["']|["']$/g, "");
    if (v !== "") env[m[1]] = v;
  }
  return env;
}

module.exports = {
  apps: [
    {
      name: "agenda-aa",
      cwd: path.join(__dirname, ".next/standalone"),
      script: "server.js",
      env: {
        // Por defecto los datos quedan en <repo>/data, fuera de .next (que se borra al compilar).
        DATABASE_PATH: path.join(__dirname, "data/agenda.db"),
        UPLOAD_DIR: path.join(__dirname, "data/uploads"),
        ...loadEnv(path.join(__dirname, ".env")),
        NODE_ENV: "production",
        PORT: "3000",
        HOSTNAME: "127.0.0.1",
      },
      // Una sola instancia: SQLite, el cron interno y el límite de intentos viven en este proceso.
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      time: true,
    },
  ],
};
