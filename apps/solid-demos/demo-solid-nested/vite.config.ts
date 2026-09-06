import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// No alias for @daltonr/pathwrite-solid. The package's "solid" export condition
// hands vite-plugin-solid its source to compile, which is exactly what happens
// in a consumer's project, so this demo exercises the published resolution path.
export default defineConfig({
  base: "./",
  plugins: [solid()],
});
