import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import eslintPluginUnicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/prisma",
    "src/generated/zod",
  ]),
  eslintPluginUnicorn.configs.recommended,
  prettier,
  {
    rules: {
      "unicorn/no-null": "off",
      "unicorn/require-module-specifiers": "off",
      "unicorn/no-array-callback-reference": "off",
      "no-useless-rename": ["error"],
      "no-void": ["error"],
      "no-self-compare": ["error"],
    },
  },
]);

export default eslintConfig;
