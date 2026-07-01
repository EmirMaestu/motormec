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
mkdir -p "$WEB_ROOT/app"
cp -r dist/* "$WEB_ROOT/app/"

log "Publicando landing"
mkdir -p "$WEB_ROOT/landing"
cp -r "$APP_DIR/landing/"* "$WEB_ROOT/landing/"

log "Reiniciando servicio"
if command -v systemctl >/dev/null 2>&1; then
  sudo systemctl restart motormec-api
  sleep 1
  curl -fsS http://127.0.0.1:3001/api/health && echo
fi

log "Listo. Verificá https://<tu-dominio>/app/ y /app/admin"
