import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: [
      {
        find: "@daltonr/pathwrite-solid/styles.css",
        replacement: fileURLToPath(new URL("../../../packages/shell.css", import.meta.url)),
      },
      {
        find: "@daltonr/pathwrite-solid",
        replacement: fileURLToPath(new URL("../../../packages/solid-adapter/src/index.tsx", import.meta.url)),
      },
    ],
  },
});
