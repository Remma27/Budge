import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/app/actions/**/*.ts", "src/app/(auth)/reset-actions.ts", "src/lib/recurring.ts", "src/lib/exchange-rates.ts"],
      exclude: ["**/*.d.ts"],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 100 },
    },
  },
});
