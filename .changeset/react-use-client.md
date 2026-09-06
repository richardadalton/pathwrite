---
"@daltonr/pathwrite-react": patch
---

**`@daltonr/pathwrite-react` can now be imported from a Next.js App Router application.** Its entry point carries the `"use client"` directive. Every export needs client-only React — hooks, context, refs — and under the App Router components are Server Components by default, so importing any of it previously failed the build with an error naming React's internals rather than this package. That reads like the application's mistake, and the workaround was for each consumer to hand-write a re-export file carrying the directive.

This changes nothing about server rendering. Client Components are still server-rendered to HTML and then hydrated, which is what the existing `react-dom/server` tests exercise: `usePath` renders with a null snapshot, `PathShell` renders its empty state, `PathProvider` renders its fallback. The directive marks which side of the RSC boundary the module sits on, not where it may run.

Server-side code that wants the engine itself should import it from `@daltonr/pathwrite-core`, which is framework-free and has no client boundary. The `PathEngine` re-export from this package is a client-side convenience and sits behind the directive. The README has a new section covering this.

The artifact verification now asserts that the directive survives into the published `dist/index.js`. It is a bare string literal that nothing type-checks and no source-importing test can see, and a build step that hoists or strips the prologue would remove it silently, so its absence would only surface in someone else's Next.js build.
