import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Use relative asset paths so the same `dist/` works for both the web
  // deploy AND for Electron's file:// loader. The Electron client and the
  // web client load the *exact same bundle*; this config flag is the only
  // place the two share a constraint.
  base: "./",
  server: { port: 5173, open: false },
  build: { sourcemap: true },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.test.js"],
  },
});
