import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages serves the site from https://nexkiv.github.io/regeq/
  base: "/regeq/",
  worker: { format: "es" },
  test: { include: ["test/**/*.test.ts"] },
});
