import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const srcPath = fileURLToPath(new URL("./src", import.meta.url));
const appPort = Number(process.env.VITE_DEV_PORT ?? 5173);
const middlewarePort = Number(process.env.MIDDLEWARE_DEV_PORT ?? 3001);

export default defineConfig({
  plugins: [react()],
  server: {
    port: appPort,
    proxy: {
      "/api": {
        target: `http://localhost:${middlewarePort}`,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": srcPath,
    },
  },
});
