#!/usr/bin/env bash
# Daily backup for Momec: Postgres dump + media (fotos y logos). Keeps 14 días.
# Reads DATABASE_URL + MEDIA_ROOT from the API .env so config lives in one place.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/motormec/apps/api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/motormec/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# shellcheck disable=SC1090
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
MEDIA_ROOT="$(grep -E '^MEDIA_ROOT=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/motormec-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$OUT"
echo "Backup DB: $OUT"

# Media (fotos de órdenes + logos de talleres). Sin esto, una falla de disco
# pierde todas las imágenes aunque la DB esté a salvo.
if [ -n "${MEDIA_ROOT:-}" ] && [ -d "$MEDIA_ROOT" ]; then
  MOUT="$BACKUP_DIR/motormec-media-$STAMP.tar.gz"
  tar -czf "$MOUT" -C "$MEDIA_ROOT" . && echo "Backup media: $MOUT"
fi

# Prune old backups (DB + media).
find "$BACKUP_DIR" -name 'motormec-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'motormec-media-*.tar.gz' -mtime "+$RETENTION_DAYS" -delete

# ⚠️ Copia OFF-SITE: estos backups viven en el mismo VPS. Si el server se pierde,
# se pierden con él. Configurar un rsync/rclone a almacenamiento externo (S3/R2,
# otro host) — ver SECURITY.md.
