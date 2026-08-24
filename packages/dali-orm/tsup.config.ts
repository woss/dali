import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/**/*.ts",
    "!src/**/__tests__/**",
    "!**/*.test.ts",
    "!**/*.spec.ts",
    "!**/*.d.ts",
  ],
  format: ["esm"],
  target: "es2022",
  experimentalDts: true,
  outExtension: () => ({ js: ".mjs" }),
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["tsx", "@surrealdb/node", "obug", "surrealdb", "valibot"],
});
