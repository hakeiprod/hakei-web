import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      "server-only": new URL(
        "src/server/testing/server-only.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["src/server/**/*.integration.test.ts"],
    fileParallelism: false,
  },
});
