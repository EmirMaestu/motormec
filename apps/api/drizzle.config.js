import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";
// Load .env without pulling in the full runtime env validation (the CLI only
// needs DATABASE_URL, and `generate` does not connect at all).
const envFile = resolve(process.cwd(), ".env");
if (existsSync(envFile)) {
    try {
        process.loadEnvFile(envFile);
    }
    catch {
        /* ignore */
    }
}
export default defineConfig({
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL ??
            "postgres://motormec:motormec@localhost:5433/motormec",
    },
    casing: "snake_case",
    verbose: true,
    strict: true,
});
//# sourceMappingURL=drizzle.config.js.map