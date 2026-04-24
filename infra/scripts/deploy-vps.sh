#!/bin/bash
# =============================================================
# MOTORMEC — Deploy al VPS
# Sube los archivos de infra/ al VPS y levanta los contenedores
# Uso: bash scripts/deploy-vps.sh <usuario@ip-del-vps>
# Ejemplo: bash scripts/deploy-vps.sh root@192.168.1.100
# =============================================================

set -e

VPS="${1:?Uso: $0 usuario@ip-del-vps}"
REMOTE_DIR="/opt/motormec"

echo "========================================"
echo " MOTORMEC — Deploy a VPS: $VPS"
echo "========================================"

# 1. Crear directorio en el VPS
echo "📁 Creando estructura en el VPS..."
ssh "$VPS" "mkdir -p ${REMOTE_DIR}/{nginx,scripts,db,backups}"

# 2. Copiar archivos de infra (excluye backups y .env)
echo "📤 Subiendo archivos..."
rsync -avz --progress \
  --exclude='backups/' \
  --exclude='.env*' \
  --exclude='*.log' \
  . "${VPS}:${REMOTE_DIR}/"

echo "✅ Archivos subidos."

# 3. Dar permisos a los scripts
ssh "$VPS" "chmod +x ${REMOTE_DIR}/scripts/*.sh"

# 4. Instrucciones post-deploy
echo ""
echo "========================================"
echo "📋 PRÓXIMOS PASOS EN EL VPS:"
echo ""
echo "  1. Conectate: ssh $VPS"
echo "  2. Ve al directorio: cd ${REMOTE_DIR}"
echo "  3. Copia el .env: cp .env.example .env.beta"
echo "  4. Edita las variables: nano .env.beta"
echo "  5. Levanta los servicios:"
echo "     docker compose --env-file .env.beta up -d"
echo "  6. Verifica que todo está corriendo:"
echo "     docker compose ps"
echo "  7. Inicia la DB con datos base:"
echo "     bash scripts/init-beta.sh"
echo "========================================"
