import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/app/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Honor the assigned PORT (preview/CI) and fall back to 5173 for local dev.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": { target: "http://localhost:3001", changeOrigin: true },
      "/webhooks": { target: "http://localhost:3001", changeOrigin: true },
    },
  },
});
