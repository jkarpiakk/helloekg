import { defineConfig } from "vitest/config";
import path from "path";

// Testy jednostkowe logiki (bez bazy i bez przeglądarki): tests/unit/**/*.test.ts
export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
});
