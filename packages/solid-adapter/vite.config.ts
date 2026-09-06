import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

// Solid's JSX cannot be compiled by tsc. There is no runtime `jsx()` factory to
// import: `solid-js/jsx-runtime` is types only, and JSX must be transformed by
// babel-preset-solid into fine-grained DOM (or string) operations. Building this
// package with tsc produced a dist that threw on import for every consumer.
//
// Two runtime builds are emitted, because a Solid component compiled for the
// DOM calls client-only APIs at module scope and throws under a server runtime:
//
//   vite build              -> dist/index.js   (generate: "dom")
//   vite build --mode ssr   -> dist/server.js  (generate: "ssr")
//
// Both are hydratable so the pair can be used together. Consumers running their
// own Solid toolchain never touch either: the "solid" export condition hands
// them src/index.tsx to compile for their own target.
export default defineConfig(({ mode }) => {
  const ssr = mode === "ssr";
  return {
    plugins: [solid({ solid: { generate: ssr ? "ssr" : "dom", hydratable: true } })],
    build: {
      target: "es2022",
      minify: false,
      // The dom pass runs first and owns cleaning the directory; the ssr pass
      // must not wipe it, and tsc writes the declarations afterwards.
      emptyOutDir: !ssr,
      sourcemap: true,
      lib: {
        entry: fileURLToPath(new URL("src/index.tsx", import.meta.url)),
        formats: ["es"],
        fileName: () => (ssr ? "server.js" : "index.js"),
      },
      rollupOptions: {
        // Everything the consumer supplies stays external, so their graph holds
        // exactly one copy of solid-js and one of the engine.
        external: [
          "solid-js",
          "solid-js/web",
          "solid-js/store",
          "solid-js/jsx-runtime",
          "@daltonr/pathwrite-core",
        ],
      },
    },
  };
});
