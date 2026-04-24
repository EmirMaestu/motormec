import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";

// ── Payload del JWT ───────────────────────────────────────────
export interface JWTPayload {
  sub:        string;   // user UUID
  tenantId:   string;   // tenant UUID
  tenantSlug: string;
  role:       "owner" | "admin" | "mechanic" | "viewer";
  name:       string;
}

// Augmentar @fastify/jwt para tipar request.user correctamente
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JWTPayload;
    user:    JWTPayload;
  }
}

// ── Plugin: verifica JWT en cada request autenticado ─────────
async function authPlugin(app: FastifyInstance) {
  // Decorador: autenticar y cargar user en request
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "Token inválido o expirado" });
    }
  });

  // Decorador: verificar rol mínimo requerido
  app.decorate(
    "requireRole",
    (minRole: JWTPayload["role"]) =>
      async (request: FastifyRequest, reply: FastifyReply) => {
        try {
          await request.jwtVerify();
        } catch {
          return reply.code(401).send({ error: "No autenticado" });
        }

        const hierarchy: Record<JWTPayload["role"], number> = {
          viewer:   1,
          mechanic: 2,
          admin:    3,
          owner:    4,
        };

        if (hierarchy[request.user.role] < hierarchy[minRole]) {
          return reply.code(403).send({ error: "Sin permisos suficientes" });
        }
      }
  );
}

export default fp(authPlugin);

// ── Tipos para decoradores en FastifyInstance ─────────────────
declare module "fastify" {
  interface FastifyInstance {
    authenticate:  (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
    requireRole:   (role: JWTPayload["role"]) => (req: FastifyRequest, rep: FastifyReply) => Promise<void>;
  }
}
