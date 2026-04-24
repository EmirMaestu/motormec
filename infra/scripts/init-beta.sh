#!/bin/bash
# =============================================================
# MOTORMEC — Inicialización del ambiente Beta
# Crea el tenant de prueba y el primer usuario admin
# Uso: bash scripts/init-beta.sh
# Requiere: docker compose arriba y .env.beta cargado
# =============================================================

set -e

source .env.beta 2>/dev/null || true

PGCONN="postgresql://motormec:${POSTGRES_PASSWORD}@localhost:5433/motormec_beta"

echo "========================================"
echo " MOTORMEC Beta — Inicialización"
echo "========================================"

# 1. Esperar a que PostgreSQL esté listo
echo "⏳ Esperando a PostgreSQL..."
until docker exec motormec_pg_beta pg_isready -U motormec -d motormec_beta > /dev/null 2>&1; do
  sleep 2
done
echo "✅ PostgreSQL listo."

# 2. Crear tenant de prueba
echo ""
echo "🏗  Creando tenant de prueba..."
TENANT_ID=$(docker exec motormec_pg_beta psql -U motormec -d motormec_beta -t -c "
  INSERT INTO tenants (slug, name, plan)
  VALUES ('taller-beta', 'Taller Beta - Pruebas', 'pro')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
  RETURNING id;
" | tr -d '[:space:]')

echo "   Tenant ID: $TENANT_ID"

# 3. Actualizar BETA_TENANT_ID en .env.beta
if grep -q "SE_GENERA_CON_init-beta.sh" .env.beta; then
  sed -i "s|BETA_TENANT_ID=.*|BETA_TENANT_ID=${TENANT_ID}|" .env.beta
  echo "   .env.beta actualizado con BETA_TENANT_ID."
fi

# 4. Crear usuario admin de prueba
echo ""
echo "👤 Creando usuario admin de prueba..."
echo "   Email: admin@motormec-beta.local"
echo "   ⚠️  Password temporal: MotormecBeta2024! (cámbialo después)"

# Hash bcrypt del password temporal (cost 12)
# En producción esto lo hace la API — aquí usamos openssl como workaround
PASS_HASH=$(docker exec motormec_pg_beta psql -U motormec -d motormec_beta -t -c "
  SELECT crypt('MotormecBeta2024!', gen_salt('bf', 12));
" | tr -d '[:space:]')

docker exec motormec_pg_beta psql -U motormec -d motormec_beta -c "
  INSERT INTO users (tenant_id, email, password_hash, name, role)
  VALUES (
    '${TENANT_ID}',
    'admin@motormec-beta.local',
    '${PASS_HASH}',
    'Admin Beta',
    'owner'
  )
  ON CONFLICT (tenant_id, email) DO NOTHING;
" > /dev/null

echo "   Usuario admin creado."

# 5. Crear config básica del taller
docker exec motormec_pg_beta psql -U motormec -d motormec_beta -c "
  INSERT INTO app_config (tenant_id, company_name, company_description)
  VALUES ('${TENANT_ID}', 'Taller Beta', 'Ambiente de pruebas Motormec')
  ON CONFLICT (tenant_id) DO NOTHING;
" > /dev/null

echo ""
echo "========================================"
echo "✅ Inicialización completada"
echo ""
echo "   BETA_TENANT_ID = ${TENANT_ID}"
echo "   URL Beta:       https://${BETA_DOMAIN:-beta.tudominio.com}"
echo "   Admin:          admin@motormec-beta.local"
echo "   Password:       MotormecBeta2024!"
echo ""
echo "   ⚠️  Cambia el password después del primer login"
echo "========================================"
