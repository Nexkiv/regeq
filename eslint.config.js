import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

// typescript-eslint turns off no-undef for .ts files (TypeScript checks names), so no
// per-folder globals are needed. The Node test run is what keeps the engine DOM-free.
export default defineConfig(
  { ignores: ["dist"] },
  js.configs.recommended,
  tseslint.configs.recommended,
);
