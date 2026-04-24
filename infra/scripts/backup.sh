#!/bin/sh
# =============================================================
# MOTORMEC — Backup automático de PostgreSQL
# Ejecutado por el contenedor 'backup' diariamente a las 3 AM
# Retiene los últimos 30 días. Comprime con gzip.
# =============================================================

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="motormec_beta_${DATE}.sql.gz"
RETENTION_DAYS=30

echo "=================================================="
echo "[$(date)] Iniciando backup: $FILENAME"

# Dump comprimido directamente
pg_dump \
  --host="$PGHOST" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -sh "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] Backup completado: ${FILENAME} (${SIZE})"

# Eliminar backups más viejos que RETENTION_DAYS
echo "[$(date)] Limpiando backups de más de ${RETENTION_DAYS} días..."
find "$BACKUP_DIR" -name "motormec_beta_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "[$(date)] Limpieza completa."

# Resumen del espacio usado
echo "[$(date)] Espacio en backups:"
du -sh "$BACKUP_DIR"
echo "=================================================="
