import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { pool } from "../src/db/client.js";

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); await pool.end(); });

describe("rate limit config", () => {
  it("health endpoint responds (rate limit disabled under test)", async () => {
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect([200, 503]).toContain(res.statusCode);
  });
});
