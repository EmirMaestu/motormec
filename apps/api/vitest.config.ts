import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://motormec:motormec@localhost:5433/motormec_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/globalSetup.ts"],
    fileParallelism: false, // tests share one Postgres DB
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      SESSION_SECRET: "test-session-secret-at-least-32-characters-long",
      SECRETS_KEY:
        "0000000000000000000000000000000000000000000000000000000000000000",
      COOKIE_SECURE: "false",
      WHATSAPP_APP_SECRET: "test-app-secret",
      WHATSAPP_VERIFY_TOKEN: "test-verify-token",
      MEDIA_ROOT: "./media-test",
    },
  },
});
