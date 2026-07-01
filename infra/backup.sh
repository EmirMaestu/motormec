#!/usr/bin/env bash
# Daily Postgres backup for MotorMec. Keeps the last 14 dumps.
# Reads DATABASE_URL from the API .env so credentials live in one place.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/motormec/apps/api/.env}"
BACKUP_DIR="${BACKUP_DIR:-/opt/motormec/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

# shellcheck disable=SC1090
DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not found in $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/motormec-$STAMP.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip -9 > "$OUT"
echo "Backup written: $OUT"

# Prune old backups.
find "$BACKUP_DIR" -name 'motormec-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
