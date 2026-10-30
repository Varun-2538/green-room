import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Each DB test file boots its own PGlite (WASM Postgres); too many at once starve the CPU.
    maxWorkers: 4,
    testTimeout: 60_000,
    hookTimeout: 60_000,
    setupFiles: ["test/setup.ts"],
  },
});
