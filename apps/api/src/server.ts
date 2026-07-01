import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./db/client.js";

async function main(): Promise<void> {
  const app = await buildApp();

  const close = async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", close);
  process.on("SIGTERM", close);

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", err);
  process.exit(1);
});
