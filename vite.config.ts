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
  build: {
    // Monaco editor chunk is expected to be large (~2MB)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            // Monaco editor — large (~2MB), pure JS, no React dependency at init.
            // Only used in API Testing + Salesforce, safe to isolate.
            if (id.includes('monaco')) {
              return 'vendor-monaco';
            }
            // Everything else (React, Radix, recharts, tanstack, zustand, etc.)
            // stays in one vendor chunk. Many libraries call React.forwardRef at
            // module init time, so splitting them from React causes runtime errors.
            return 'vendor';
          }
        },
      },
    },
  },
}));
