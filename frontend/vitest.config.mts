import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { pool: "threads", maxWorkers: 1, environment: "jsdom", setupFiles: ["./tests/setup.ts"], include: ["tests/**/*.test.tsx"] },
});
