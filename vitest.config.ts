import { fileURLToPath, URL } from "url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@daltonr/pathwrite-core": fileURLToPath(new URL("packages/core/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-angular/shell": fileURLToPath(new URL("packages/angular-adapter/src/shell.ts", import.meta.url)),
      "@daltonr/pathwrite-angular": fileURLToPath(new URL("packages/angular-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-react": fileURLToPath(new URL("packages/react-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-vue": fileURLToPath(new URL("packages/vue-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-svelte": fileURLToPath(new URL("packages/svelte-adapter/src/index.ts", import.meta.url))
    }
  }
});
