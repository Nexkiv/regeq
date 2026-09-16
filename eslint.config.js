import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist", "coverage"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  // The engine is pure: it gets no environment globals at all.
  {
    files: ["src/*.ts"],
    ignores: ["src/worker.ts"],
    languageOptions: { globals: globals.browser },
  },
  { files: ["src/worker.ts"], languageOptions: { globals: globals.worker } },
  { files: ["*.config.{js,ts}", "test/**"], languageOptions: { globals: globals.node } },
);
