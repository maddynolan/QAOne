import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use absolute paths for web (Vercel) so nested routes like /admin/licenses work.
  // For Electron desktop, we build separately with VITE_BASE=./ to support file:// protocol.
  base: process.env.VITE_BASE || '/',
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react({
      babel: {
        // Increase compact limit to suppress warning for large files
        compact: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
