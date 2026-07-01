#!/usr/bin/env bash
#
# Momec — instalador para VPS Ubuntu/Debian que YA tiene otro proyecto.
# Es aditivo y defensivo: detecta antes de instalar, crea su propia base y
# usuario, elige un puerto libre para la API y NO toca el reverse proxy ni la
# base del proyecto existente. Pide confirmación antes de cambiar algo.
#
# Uso (como root):
#   export MOMEC_DOMAIN=app.tudominio.com
#   export ANTHROPIC_API_KEY=sk-ant-...
#   export WHATSAPP_APP_SECRET=...            # de tu app de Meta
#   export WHATSAPP_VERIFY_TOKEN=momec_xxx    # el que elijas (lo usás en Meta)
#   # opcionales (si no, se generan):
#   #   export SESSION_SECRET=...  SECRETS_KEY=...(64 hex)
#   bash vps-setup.sh
#
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/EmirMaestu/motormec.git}"
APP_DIR="${APP_DIR:-/opt/motormec}"
WEB_ROOT="${WEB_ROOT:-/var/www/motormec}"
MEDIA_DIR="${MEDIA_DIR:-/var/www/motormec-media}"
SVC_USER="${SVC_USER:-motormec}"
PGDB="${PGDB:-momec}"
PGUSER="${PGUSER:-momec}"

c() { printf "\n\033[1;36m== %s\033[0m\n" "$1"; }
ok() { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[1;33m⚠\033[0m %s\n" "$1"; }
die() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; exit 1; }

[ "$(id -u)" = "0" ] || die "Corré como root (sudo bash vps-setup.sh)."
command -v apt-get >/dev/null || die "Este script asume Ubuntu/Debian (apt). Para otra distro, hacelo por DEPLOY.md."
: "${MOMEC_DOMAIN:?Falta MOMEC_DOMAIN (ej. app.tudominio.com)}"

# ---------------------------------------------------------------- recon -----
c "Recon (no cambia nada todavía)"
. /etc/os-release; ok "OS: $PRETTY_NAME"
HAVE_NODE=$(command -v node >/dev/null && node -v || echo "NO")
ok "Node: $HAVE_NODE"
HAVE_PG=$(command -v psql >/dev/null && echo "sí" || echo "NO")
ok "Postgres instalado: $HAVE_PG"
PROXY="ninguno"
systemctl is-active --quiet caddy 2>/dev/null && PROXY="caddy"
systemctl is-active --quiet nginx 2>/dev/null && PROXY="nginx"
ok "Reverse proxy activo: $PROXY"

# Puerto de API libre (3001, si no el siguiente).
API_PORT=3001
while ss -tlnp 2>/dev/null | grep -q ":${API_PORT} "; do API_PORT=$((API_PORT+1)); done
ok "Puerto para la API Momec: $API_PORT"

echo
c "Plan (lo que haría)"
cat <<EOF
  · Instalar (si faltan): node 22, postgres, git/curl.
  · Crear base '$PGDB' + usuario '$PGUSER' (no toca otras bases).
  · Crear usuario de sistema '$SVC_USER' y clonar el repo en $APP_DIR.
  · Escribir $APP_DIR/apps/api/.env (API en puerto $API_PORT, HOST 127.0.0.1).
  · Build + migraciones + publicar web en $WEB_ROOT.
  · systemd 'motormec-api' + vhost de $MOMEC_DOMAIN en tu proxy ($PROXY), aditivo.
  NO toca tu proyecto existente, ni su proxy, ni sus bases.
EOF

if [ "${MOMEC_DRYRUN:-0}" = "1" ]; then
  echo
  ok "DRY-RUN: no cambié nada. Volvé a correr SIN MOMEC_DRYRUN=1 para aplicar."
  exit 0
fi

echo
read -r -p "¿Continuar? [y/N] " GO; [ "${GO,,}" = "y" ] || die "Cancelado."

# ---------------------------------------------------------------- deps ------
c "Dependencias base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
# Prerrequisitos que un VPS mínimo puede no traer (curl para el instalador de Node).
apt-get install -y ca-certificates curl git openssl iproute2

if [ "$HAVE_NODE" = "NO" ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
  ok "Node instalado: $(node -v)"
else ok "Node ya estaba"; fi

if [ "$HAVE_PG" = "NO" ]; then
  apt-get install -y postgresql
  systemctl enable --now postgresql
  ok "Postgres instalado"
else ok "Postgres ya estaba (uso la instancia existente)"; fi

# ---------------------------------------------------------------- db --------
c "Base de datos '$PGDB'"
ENV_FILE="$APP_DIR/apps/api/.env"
PGPASS="$(openssl rand -hex 16)"
# Idempotente y re-run-safe. No toca otras bases.
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER'" | grep -q 1; then
  if [ -f "$ENV_FILE" ]; then
    warn "Rol '$PGUSER' y .env ya existían → no toco la contraseña."
    PGPASS=""
  else
    # Re-run sin .env: reseteo la contraseña para poder escribir un .env válido.
    sudo -u postgres psql -c "ALTER USER $PGUSER WITH PASSWORD '$PGPASS';"
    warn "Rol '$PGUSER' existía sin .env → reseteé su contraseña para reconfigurar."
  fi
else
  sudo -u postgres psql -c "CREATE USER $PGUSER WITH PASSWORD '$PGPASS';"
  ok "Rol '$PGUSER' creado"
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='$PGDB'" | grep -q 1 \
  && ok "Base '$PGDB' ya existía" \
  || { sudo -u postgres psql -c "CREATE DATABASE $PGDB OWNER $PGUSER;"; ok "Base '$PGDB' creada"; }

# Detectar el puerto REAL del cluster (Ubuntu puede asignar 5433+ si 5432 está tomado).
PG_PORT="$(sudo -u postgres psql -tAc 'SHOW port;' 2>/dev/null | tr -d '[:space:]')"
PG_PORT="${PG_PORT:-5432}"
ok "Postgres escuchando en puerto $PG_PORT"

# ---------------------------------------------------------------- user/code -
c "Usuario de sistema y código"
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$SVC_USER"
mkdir -p "$APP_DIR"; chown "$SVC_USER:$SVC_USER" "$APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  sudo -H -u "$SVC_USER" git -C "$APP_DIR" pull --ff-only
else
  sudo -H -u "$SVC_USER" git clone "$REPO_URL" "$APP_DIR"
fi
mkdir -p "$MEDIA_DIR"; chown "$SVC_USER:$SVC_USER" "$MEDIA_DIR"
ok "Código en $APP_DIR"

# ---------------------------------------------------------------- .env ------
c "Configuración (.env)"
ENV_FILE="$APP_DIR/apps/api/.env"
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -base64 48 | tr -d '\n')}"
SECRETS_KEY="${SECRETS_KEY:-$(openssl rand -hex 32)}"
if [ -f "$ENV_FILE" ]; then
  warn ".env ya existe → no lo sobreescribo. Revisá que tenga DATABASE_URL/ANTHROPIC_API_KEY."
else
  [ -n "$PGPASS" ] || die "El rol '$PGUSER' ya existía: seteá DATABASE_URL a mano en $ENV_FILE y re-corré."
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$API_PORT
HOST=127.0.0.1
DATABASE_URL=postgres://$PGUSER:$PGPASS@localhost:${PG_PORT:-5432}/$PGDB
SESSION_SECRET=$SESSION_SECRET
COOKIE_SECURE=true
SESSION_TTL_DAYS=30
SECRETS_KEY=$SECRETS_KEY
WHATSAPP_APP_SECRET=${WHATSAPP_APP_SECRET:-}
WHATSAPP_VERIFY_TOKEN=${WHATSAPP_VERIFY_TOKEN:-}
ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
CLAUDE_MODEL_PARSER=claude-haiku-4-5
CLAUDE_MODEL_AGENT=claude-opus-4-8
MEDIA_ROOT=$MEDIA_DIR
EOF
  chown "$SVC_USER:$SVC_USER" "$ENV_FILE"; chmod 600 "$ENV_FILE"
  ok ".env creado (puerto $API_PORT, cookies seguras)"
fi

# ---------------------------------------------------------------- build -----
c "Build + migraciones + publicación"
cd "$APP_DIR"
sudo -H -u "$SVC_USER" npm install
cd "$APP_DIR/apps/api"
sudo -H -u "$SVC_USER" npm run build
sudo -H -u "$SVC_USER" npm run db:migrate
sudo -H -u "$SVC_USER" env NODE_ENV=production npm run preflight || warn "Revisá las advertencias del preflight."
cd "$APP_DIR/apps/web"
sudo -H -u "$SVC_USER" npm run build
mkdir -p "$WEB_ROOT/app" "$WEB_ROOT/landing"
cp -r dist/* "$WEB_ROOT/app/"
cp -r "$APP_DIR/landing/"* "$WEB_ROOT/landing/"
ok "Web publicada en $WEB_ROOT"

# ---------------------------------------------------------------- systemd ---
c "Servicio systemd"
sed "s#/opt/motormec#$APP_DIR#g; s#User=motormec#User=$SVC_USER#; s#Group=motormec#Group=$SVC_USER#; s#/var/www/motormec-media#$MEDIA_DIR#g" \
  "$APP_DIR/infra/systemd/motormec-api.service" > /etc/systemd/system/motormec-api.service
systemctl daemon-reload
systemctl enable --now motormec-api
sleep 2
if curl -fsS "http://127.0.0.1:$API_PORT/api/health" >/dev/null; then ok "API viva en :$API_PORT"; else warn "La API no respondió aún; mirá: journalctl -u motormec-api -n 50"; fi

# ---------------------------------------------------------------- proxy -----
c "Reverse proxy ($PROXY) — dominio $MOMEC_DOMAIN"
if [ "${MOMEC_SKIP_PROXY:-0}" = "1" ]; then
  warn "MOMEC_SKIP_PROXY=1 → no toco el reverse proxy. Config lista en infra/caddy/momec.caddy /"
  warn "infra/nginx/momec.conf para aplicar a mano. API escuchando en 127.0.0.1:$API_PORT."
elif [ "$PROXY" = "nginx" ]; then
  sed "s/__DOMAIN__/$MOMEC_DOMAIN/g; s#127.0.0.1:3001#127.0.0.1:$API_PORT#g" \
    "$APP_DIR/infra/nginx/momec.conf" > /etc/nginx/sites-available/momec.conf
  ln -sf /etc/nginx/sites-available/momec.conf /etc/nginx/sites-enabled/momec.conf
  nginx -t && systemctl reload nginx && ok "vhost nginx agregado (no toqué tus otros sitios)"
  warn "TLS: sudo certbot --nginx -d $MOMEC_DOMAIN"
elif [ "$PROXY" = "caddy" ]; then
  sed "s/__DOMAIN__/$MOMEC_DOMAIN/g; s#127.0.0.1:3001#127.0.0.1:$API_PORT#g" \
    "$APP_DIR/infra/caddy/momec.caddy" > /etc/caddy/momec.caddy
  grep -q "import momec.caddy" /etc/caddy/Caddyfile 2>/dev/null || echo "import momec.caddy" >> /etc/caddy/Caddyfile
  systemctl reload caddy && ok "bloque Caddy agregado (TLS automático)"
else
  warn "No detecté nginx ni Caddy. Instalá uno y usá infra/nginx/momec.conf o infra/caddy/momec.caddy."
fi

# ---------------------------------------------------------------- fin -------
c "Listo — próximos pasos"
cat <<EOF
  1) TLS del subdominio (si es nginx): sudo certbot --nginx -d $MOMEC_DOMAIN
  2) Crear tu super-admin:
       cd $APP_DIR/apps/api && sudo -u $SVC_USER npm run seed:admin -- emir 'TU_PASS' "Emir"
  3) Entrá a  https://$MOMEC_DOMAIN/app/admin  → creá el taller del cliente y ligá su número.
  4) Webhook de Meta → https://$MOMEC_DOMAIN/webhooks/whatsapp
     Verify token = WHATSAPP_VERIFY_TOKEN de tu .env. Suscribí el evento "messages".
  Salud: curl -s https://$MOMEC_DOMAIN/api/health
EOF
