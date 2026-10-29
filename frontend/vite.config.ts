import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base: the built site works from any static host or sub-path (routes use the URL hash).
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
