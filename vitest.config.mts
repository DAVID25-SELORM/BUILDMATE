import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, ".")
    }
  },
  test: {
    environment: "node",
    exclude: ["e2e/**", "node_modules/**", ".next/**"]
  }
});
