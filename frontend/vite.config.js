import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on 5173 — matches the origin FalconEye's Cors middleware
// is configured to allow (see server/src/main.cpp).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
