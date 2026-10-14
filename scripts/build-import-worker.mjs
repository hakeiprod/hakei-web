import { build } from "esbuild";
await build({
  entryPoints: ["src/server/import-worker-entry.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/import-worker.mjs",
  banner: {
    js: 'import { createRequire } from "node:module";const require=createRequire(import.meta.url);',
  },
  logLevel: "warning",
});
