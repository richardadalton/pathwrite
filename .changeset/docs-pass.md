---
"@daltonr/pathwrite-svelte": patch
---

Documentation only, no code changes.

**The Svelte getting-started guide documented the pre-0.14 step model.** It taught step content as loose snippets named after each step ID, which has been a type error since 0.14.0 moved the Svelte shell to a `steps` record of components. A reader following the guide got "No content for step" and a `svelte-check` failure. All five examples are rewritten, `header` and `footer` stay as snippets because they still are, and the camelCase section is rewritten: hyphenated step IDs are now ordinary object keys and need no workaround, with the camelCase form kept as an accepted alternative rather than a requirement. `02-adapters.md` said the Svelte shell used "a `{#snippet}` map or a slot-based API"; it takes the same `steps` record as React, Vue and Solid.

**Ten data-type examples could not compile.** They declared their data as `interface SignupData { ... }` and passed it as `PathDefinition<SignupData>`, which fails with "Type 'SignupData' does not satisfy the constraint 'PathData'". They are now `type` aliases, which satisfy the constraint without gaining the string index signature that `interface … extends PathData` would add — the form this project's own 0.14.0 notes recommend. Affected: `01-engine.md`, `03-defining-paths.md`, `06-sub-paths.md`, `12-beyond-wizards.md`, and the React Native and Solid getting-started guides. All ten were verified by extracting them and compiling against the real engine types.

**`core-api.md` described the wrong HTTP request.** It listed `POST /baseUrl/:key` for `HttpStore`; the code sends `PUT` and the default path is `/baseUrl/state/:key`, so a backend built from the reference returned 404 on every save. Corrected, and the overridable URL options are now mentioned.
