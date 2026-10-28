import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": new URL(
        "src/server/testing/server-only.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    // Full-score Document/SVG regressions need a bounded memory footprint.
    // Keep the normal test command consistent with the validated serial run.
    maxWorkers: 1,
    environment: "jsdom",
    exclude: ["node_modules/**", "src/server/**/*.integration.test.ts"],
    setupFiles: "./vitest.setup.ts",
  },
});
