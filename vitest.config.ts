import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
    },
  },
});
