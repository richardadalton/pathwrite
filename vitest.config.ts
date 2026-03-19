import { fileURLToPath, URL } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@pathwrite/core": fileURLToPath(new URL("packages/core/src/index.ts", import.meta.url)),
      "@pathwrite/angular-adapter": fileURLToPath(new URL("packages/angular-adapter/src/index.ts", import.meta.url))
    }
  }
});
