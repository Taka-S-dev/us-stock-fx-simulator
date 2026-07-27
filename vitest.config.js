import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.js"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // ロジック層（model / utils）はテストで担保する。
      // View / Controller は DOM とライブラリへの配線が主なので対象外にしている。
      include: ["public/model/**/*.js", "public/utils/**/*.js"],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
