#!/usr/bin/env bash
#
# Momec — bootstrap/actualización idempotente en el VPS.
# Buildea API + SPA + landing, aplica migraciones, reinicia el servicio.
# Pensado para correr como el usuario `motormec` desde /opt/motormec.
#
#   sudo -u motormec bash infra/bootstrap.sh
#
# Variables (con defaults):
#   APP_DIR   = /opt/motormec
#   WEB_ROOT  = /var/www/motormec
#
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/motormec}"
WEB_ROOT="${WEB_ROOT:-/var/www/motormec}"

log() { printf "\n\033[1;32m▸ %s\033[0m\n" "$1"; }

cd "$APP_DIR"

log "Instalando dependencias"
npm install

log "Build + migraciones (API)"
cd "$APP_DIR/apps/api"
npm run build
npm run db:migrate

log "Preflight de producción"
npm run preflight

log "Build SPA + publicación"
cd "$APP_DIR/apps/web"
npm run build
# /var/www es de root: se copia con sudo (motormec no tiene permiso de escritura).
sudo mkdir -p "$WEB_ROOT/app"
sudo cp -r dist/* "$WEB_ROOT/app/"

log "Publicando landing"
sudo mkdir -p "$WEB_ROOT/landing"
sudo cp -r "$APP_DIR/landing/"* "$WEB_ROOT/landing/"

log "Reiniciando servicio"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart motormec-api
  sleep 1
  # El puerto sale del PORT del .env (este VPS usa 3002; default 3001).
  API_PORT=$(grep -E '^PORT=' "$APP_DIR/apps/api/.env" 2>/dev/null | head -1 | cut -d= -f2- || true)
  curl -fsS "http://127.0.0.1:${API_PORT:-3001}/api/health" && echo
fi

log "Listo. Verificá https://<tu-dominio>/app/ y /app/admin"
