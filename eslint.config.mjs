import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  ...next,
  globalIgnores([".next/**", "node_modules/**", "src/generated/**", "playwright-report/**", "test-results/**", "storage/**", ".e2e-storage/**"]),
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    // Tenant isolation guard: UI/route code must go through src/lib/data/* (which requires workspaceId).
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/lib/prisma", "@/generated/prisma/*"], message: "Use src/lib/data/* so every query is scoped by workspaceId." }] }],
    },
  },
]);
