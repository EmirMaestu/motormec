# =============================================================
# Motormec API — Dockerfile (multi-stage)
# Stage 1: build TypeScript → dist/
# Stage 2: run with only production deps (imagen mínima)
# =============================================================

# ── Stage 1: builder ─────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependencias (incluyendo devDependencies para compilar)
COPY package*.json ./
RUN npm install

# Copia fuentes y compila
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: runner ──────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Solo dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copia el JS compilado desde el stage anterior
COPY --from=builder /app/dist ./dist

# Usuario no-root (seguridad)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "dist/app.js"]
