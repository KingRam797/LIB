import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Integration tests share one database; run files sequentially.
    fileParallelism: false,
  },
});
