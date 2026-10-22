import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { execSync } from "child_process";

// Wersja aplikacji do zgłoszeń testerów: APP_VERSION z otoczenia albo krótki sha z gita (gdy jest)
function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(appVersion()),
  },
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      // Wstawki interaktywne skopiowane ze studia importują '@helloekg/shared' (scripts/sync-wstawki.sh)
      "@helloekg/shared": path.resolve(import.meta.dirname, "client", "src", "wstawki-shared.ts"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/recharts")) return "recharts";
        },
      },
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
