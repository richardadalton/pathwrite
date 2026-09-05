// ESLint flat config. Scope: the publishable packages' TypeScript (source and
// tests). Demo apps and framework templates are formatted by Prettier but not
// linted here — framework-specific lint (Svelte / Vue / Angular templates) is
// a separate concern.
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.angular/**",
      "**/.svelte-kit/**",
      "apps/**",
      "scripts/**",
      "**/*.svelte",
      "**/*.vue",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // The adapters pass PathDefinition<any> through deliberately (a later
      // 0.14 pass makes PathEngine generic); flag, don't fail.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Empty catch blocks with a comment are used for "best effort" storage calls.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  }
);
