import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "../../db/pool";
import { JWTPayload } from "../../plugins/auth";
import { env } from "../../config/env";

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export default async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/login ─────────────────────────────────────
  app.post("/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Email o password inválidos" });
    }

    const { email, password } = body.data;

    // Buscar usuario + tenant en un solo join
    const [user] = await query<any>(`
      SELECT u.id, u.email, u.password_hash, u.name, u.role, u.is_active,
             t.id AS tenant_id, t.slug AS tenant_slug, t.is_active AS tenant_active
      FROM users u
      JOIN tenants t ON t.id = u.tenant_id
      WHERE u.email = $1
      LIMIT 1
    `, [email]);

    if (!user)               return reply.code(401).send({ error: "Credenciales incorrectas" });
    if (!user.is_active)     return reply.code(403).send({ error: "Usuario desactivado" });
    if (!user.tenant_active) return reply.code(403).send({ error: "Taller desactivado" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return reply.code(401).send({ error: "Credenciales incorrectas" });

    // Actualizar last_login_at
    await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

    const payload: JWTPayload = {
      sub:        user.id,
      tenantId:   user.tenant_id,
      tenantSlug: user.tenant_slug,
      role:       user.role,
      name:       user.name,
    };

    const accessToken  = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const refreshToken = (app.jwt.sign as any)({ sub: user.id }, { expiresIn: "30d" });

    // Guardar refresh token (hash) en DB
    const tokenHash = await bcrypt.hash(refreshToken, 8);
    await query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [user.id, tokenHash]);

    return reply.send({
      accessToken,
      refreshToken,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        role:       user.role,
        tenantId:   user.tenant_id,
        tenantSlug: user.tenant_slug,
      },
    });
  });

  // ── POST /auth/refresh ───────────────────────────────────
  app.post("/refresh", async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) return reply.code(400).send({ error: "refreshToken requerido" });

    // Verificar firma JWT
    let decoded: { sub: string };
    try {
      decoded = app.jwt.verify(refreshToken) as { sub: string };
    } catch {
      return reply.code(401).send({ error: "Refresh token inválido" });
    }

    // Buscar tokens activos del usuario y verificar uno a uno (bcrypt)
    const tokens = await query<any>(
      "SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()",
      [decoded.sub]
    );

    let validToken: any = null;
    for (const t of tokens) {
      if (await bcrypt.compare(refreshToken, t.token_hash)) {
        validToken = t;
        break;
      }
    }

    if (!validToken) return reply.code(401).send({ error: "Refresh token revocado o expirado" });

    // Revocar el token usado (rotación)
    await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [validToken.id]);

    // Obtener datos frescos del usuario
    const [user] = await query<any>(`
      SELECT u.id, u.name, u.email, u.role, u.is_active,
             t.id AS tenant_id, t.slug AS tenant_slug
      FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1
    `, [decoded.sub]);

    if (!user || !user.is_active) return reply.code(403).send({ error: "Usuario inactivo" });

    const payload: JWTPayload = {
      sub: user.id, tenantId: user.tenant_id, tenantSlug: user.tenant_slug,
      role: user.role, name: user.name,
    };

    const newAccessToken  = app.jwt.sign(payload, { expiresIn: env.JWT_EXPIRES_IN });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const newRefreshToken = (app.jwt.sign as any)({ sub: user.id }, { expiresIn: "30d" });
    const newHash = await bcrypt.hash(newRefreshToken, 8);

    await query(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, NOW() + INTERVAL '30 days')
    `, [user.id, newHash]);

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  });

  // ── POST /auth/logout ────────────────────────────────────
  app.post("/logout", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (refreshToken) {
      const tokens = await query<any>(
        "SELECT id, token_hash FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL",
        [request.user.sub]
      );
      for (const t of tokens) {
        if (await bcrypt.compare(refreshToken, t.token_hash)) {
          await query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [t.id]);
          break;
        }
      }
    }
    return reply.send({ ok: true });
  });

  // ── GET /auth/me ─────────────────────────────────────────
  app.get("/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const [user] = await query<any>(`
      SELECT u.id, u.name, u.email, u.role, u.phone, u.avatar_url,
             t.id AS tenant_id, t.slug AS tenant_slug, t.name AS tenant_name, t.plan
      FROM users u JOIN tenants t ON t.id = u.tenant_id
      WHERE u.id = $1
    `, [request.user.sub]);
    return reply.send(user);
  });
}
