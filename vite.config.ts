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
            // React core — loaded on every page
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('react-router')) {
              return 'vendor-react';
            }
            // UI primitives — Radix, icons, styling utilities
            if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) {
              return 'vendor-ui';
            }
            // Data fetching
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Monaco editor — large, only used in API Testing + Salesforce
            if (id.includes('monaco')) {
              return 'vendor-monaco';
            }
            // Charts — only used in Performance + Dashboard
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            // State management + HTTP + utilities
            if (id.includes('zustand') || id.includes('axios') || id.includes('date-fns') || id.includes('immer') || id.includes('uuid')) {
              return 'vendor-misc';
            }
          }
        },
      },
    },
  },
}));
