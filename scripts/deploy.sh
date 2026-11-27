#!/usr/bin/env bash
# Compila y reinicia la agenda en el VPS. Ejecutar desde la carpeta del repositorio:
#   bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Falta el archivo .env (copia .env.example y complétalo)." >&2
  exit 1
fi

# next build lee .env por su cuenta (NEXT_PUBLIC_BASE_PATH se fija aquí).

git pull --ff-only
npm ci
npm run build

# El modo standalone no incluye public/ ni .next/static: se copian junto al servidor.
rm -rf .next/standalone/public .next/standalone/.next/static
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
echo "Listo: $(date)"
