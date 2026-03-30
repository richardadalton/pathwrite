import { fileURLToPath, URL } from "url";
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [
    svelte({ hot: false }),
    // Scoped to solid-adapter only so the babel-preset-solid JSX transform
    // doesn't interfere with React/Svelte test files elsewhere in the suite.
    solid({ include: ["**/packages/solid-adapter/**"] }),
  ],
  test: {
    // Explicitly pin to Node so vite-plugin-solid doesn't promote jsdom globally.
    // Individual test files that need a DOM override this with // @vitest-environment jsdom.
    environment: "node",
    include: [
      "packages/**/test/**/*.test.ts",
      "packages/**/test/**/*.test.tsx",
      "apps/shared-workflows/**/test/**/*.test.ts",
    ]
  },
  resolve: {
    alias: {
      "@daltonr/pathwrite-demo-workflow-job-application": fileURLToPath(new URL("apps/shared-workflows/demo-workflow-job-application/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-core": fileURLToPath(new URL("packages/core/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-angular/shell": fileURLToPath(new URL("packages/angular-adapter/src/shell.ts", import.meta.url)),
      "@daltonr/pathwrite-angular": fileURLToPath(new URL("packages/angular-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-react": fileURLToPath(new URL("packages/react-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-react-native": fileURLToPath(new URL("packages/react-native-adapter/src/index.tsx", import.meta.url)),
      "@daltonr/pathwrite-vue": fileURLToPath(new URL("packages/vue-adapter/src/index.ts", import.meta.url)),
      "@daltonr/pathwrite-svelte": fileURLToPath(new URL("packages/svelte-adapter/src/index.svelte.ts", import.meta.url)),
      "@daltonr/pathwrite-solid": fileURLToPath(new URL("packages/solid-adapter/src/index.tsx", import.meta.url)),
      "react-native": fileURLToPath(new URL("packages/react-native-adapter/test/__mocks__/react-native.ts", import.meta.url)),
      "@daltonr/pathwrite-services": fileURLToPath(new URL("packages/pathwrite-services/src/index.ts", import.meta.url))
    }
  }
});
