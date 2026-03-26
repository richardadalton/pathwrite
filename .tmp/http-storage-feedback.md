# Feedback — HTTP Storage API Demo

_March 2026 · `apps/vue-demos/demo-vue-storage` with Express API backend_

---

## What we built

Extended the existing localStorage demo to support **switchable storage backends**:
- **LocalStorageStore** — browser-local persistence (already implemented)
- **ApiStore** — server-backed REST API persistence (new)
- **Storage mode toggle** in the UI to switch between backends at runtime
- **Express API server** (`server.mjs`) with in-memory snapshot storage and CORS support

---

## Architecture decisions

### `ApiStore` as a separate class (not in `@daltonr/pathwrite-store-http`)

**Decision:** We created `ApiStore.ts` in the demo's `src/` folder rather than adding it to the `packages/store-http` package.

**Rationale:**
1. **`HttpStore` already exists** in `packages/store-http` — it's the production-ready REST persistence adapter. Adding a second one would be confusing.
2. **`HttpStore` doesn't include `list()` or `clear()`** by design — not all REST APIs can enumerate keys efficiently. The `PathStore` interface deliberately doesn't require those methods.
3. **The demo needs `list()`** to populate the session picker. So `ApiStore` extends the base `PathStore` contract with `list()` and `clear()` methods specific to the demo's Express server.
4. **Separation of concerns:** The demo's `ApiStore` is tied to the demo's Express server contract (the `/api/state` endpoints). Production users with different REST APIs would implement their own adapter or use the standard `HttpStore` and manage enumeration separately.

**Alternative we rejected:** Adding `list()` to `HttpStore` in the package. This would have forced every REST backend to support enumeration, which breaks the "HTTP persistence is stateless and minimal" design goal.

---

### Express server with in-memory storage

**Decision:** The server uses a `Map` to store snapshots in process memory (not a database).

**Rationale:**
1. **Zero setup** — no Postgres, MongoDB, or Redis to install. `npm install && npm run server` just works.
2. **Demonstrates the HTTP contract clearly** — the endpoints are simple CRUD operations. Adding a database would obscure the API design.
3. **Sufficient for the demo** — the goal is to show client-side `httpPersistence` working with a REST backend, not to build a production server.

**Trade-offs:**
- Data is lost when the server restarts (but that's fine for a demo).
- No authentication or multi-user isolation (the demo assumes a single developer testing locally).
- Not horizontally scalable (but again, this is a localhost dev demo).

**Production recommendation:** Real applications would replace the `Map` with a database adapter and add authentication middleware. The REST contract (`GET/PUT/DELETE /state/:key`) would stay the same.

---

### Computed store with reactive mode switching

**Decision:** The `store` is a Vue `computed` that returns either `LocalStorageStore` or `ApiStore` based on `storageMode.value`.

**Rationale:**
1. **No engine restart required** — switching storage modes only requires reloading the session list, not recreating the `PathEngine`.
2. **Type-safe** — both stores implement `PathStore`, so `store.value.load(key)` works identically for both.
3. **Clean toggle UI** — the toggle buttons call `switchStorageMode()`, which tests the API connection (for API mode) and reloads the session list.

**Challenge we hit:** The observer factory (`makeObservers`) creates the persistence observer with a reference to `store.value` **at the time the observer is created**. This means:
- If you start a session in localStorage mode, the observer captures `LocalStorageStore`.
- If you then switch to API mode in another tab, the active session continues to save to localStorage (because the observer was already wired).

**Mitigation:** We disable the storage toggle when a wizard is active (`view !== 'sessions'`). You can only switch modes from the session picker screen, ensuring no sessions are mid-flight.

**Better solution (not implemented):** Make the observer's store reference reactive so it re-binds on mode changes. This would require refactoring `httpPersistence` to accept a getter function instead of a store instance. That's a deeper change and not necessary for the demo.

---

### API connection test before switching modes

**Decision:** When the user clicks "API (port 3001)", we call `await store.list()` to test connectivity before actually switching modes.

**Rationale:**
1. **Fail fast with clear feedback** — if the server isn't running, show an error banner immediately rather than letting sessions fail to load silently.
2. **Better UX** — the error banner says "Run `npm run server` in a separate terminal" with the exact command to fix it.

**Implementation detail:** The test uses a temporary `ApiStore` instance to avoid mutating the computed `store` until the test passes. If the test fails, `apiConnectionError.value = true` and the banner appears.

---

## What went smoothly

### `PathStore` interface is backend-agnostic

The fact that we could drop in `ApiStore` alongside `LocalStorageStore` with zero changes to `httpPersistence`, `restoreOrStart`, or the wizard logic validates the `PathStore` abstraction. The three-method contract (`save / load / delete`) is exactly right.

### `httpPersistence` + `restoreOrStart` composed cleanly

Switching from localStorage to API required zero changes to the persistence logic. The observer factory pattern (`makeObservers(key)`) meant we just swapped the store instance and everything else flowed through.

### Express + CORS setup was trivial

The Express server is 50 lines. CORS is one line (`app.use(cors())`). The endpoints are straightforward REST: `PUT` saves, `GET` loads, `DELETE` deletes, `GET /state` lists. This simplicity is a feature — it demonstrates that any backend can implement the contract.

### Concurrently script for dev workflow

Using `concurrently` to run both the server and Vite in one `npm run dev` command is a nice DX improvement. Developers don't need to open two terminals.

---

## Issues encountered (and what they revealed)

### 1. TypeScript syntax in `.mjs` server file

**What happened:** I initially wrote `const snapshots = new Map<string, any>();` in `server.mjs` (TypeScript generic syntax). Node crashed with "SyntaxError: Missing initializer in const declaration" because `.mjs` files are JavaScript, not TypeScript.

**Fix:** Changed to `const snapshots = new Map();` (plain JS).

**Observation:** This is an easy mistake when switching contexts between the Vue app (TypeScript via `vue-tsc`) and the Node server (plain JS via `.mjs`). Using `.mts` + a build step would catch this at compile time, but adds complexity for a simple demo server.

---

### 2. `PathStore` import in `ApiStore.ts`

**What happened:** I tried to import `PathStore` from `@daltonr/pathwrite-vue`, but the vue adapter doesn't re-export it. TypeScript error: `has no exported member named 'PathStore'`.

**Fix:** Import from `@daltonr/pathwrite-core` where `PathStore` is defined. `SerializedPathState` can come from the vue adapter (which does re-export it).

**Observation:** The core/adapter export boundaries are correct — `PathStore` is a core interface, not a framework-specific one. The vue adapter exports its own symbols (`PathShell`, `usePathContext`) plus re-exported core types (`PathData`, `SerializedPathState`). Importing `PathStore` from core makes that distinction explicit.

---

### 3. Storage mode toggle disabled in wizard view

**What happened:** We initially allowed switching storage modes at any time. This caused a subtle bug: if you started a session in localStorage mode, then switched to API mode, the session's `httpPersistence` observer was still wired to the `LocalStorageStore` instance it captured at creation time. Changes would save to the wrong backend.

**Fix:** Disable the toggle buttons when `view !== 'sessions'`. You can only switch modes from the session picker screen before starting a session.

**Observation:** This is a fundamental limitation of the observer factory pattern — observers are created with a store reference, and that reference doesn't change reactively. The "proper" fix would be to make the observer accept a getter (`() => store.value`) instead of a direct store instance, but that would require changing the `httpPersistence` API. For a demo, disabling the toggle during active sessions is sufficient.

---

### 4. API error banner UX

**What happened:** When testing without the server running, the session list would just show "Loading…" forever and then display an empty list. No clear feedback about *why* it failed.

**Fix:** Added `apiConnectionError` state that's set when the mode switch fails. The error banner shows the exact command to fix it: `npm run server`.

**Observation:** This is good defensive UX. The toggle button tests connectivity before switching, and the banner appears immediately with actionable guidance. This pattern (test → fail fast → clear error message) is worth replicating in other demos.

---

## Design observations

### `list()` and `clear()` are store-specific, not universal

The `PathStore` interface deliberately omits `list()` and `clear()` because not all backends can enumerate keys efficiently:
- **LocalStorageStore**: `list()` iterates the storage backend's keys — fast and cheap.
- **ApiStore**: `list()` calls `GET /api/state` — the server has to maintain an index.
- **HttpStore (production)**: Might talk to a stateless REST API that doesn't support enumeration at all. The client would need a separate "list sessions" endpoint or manage session IDs out-of-band.

**Conclusion:** `list()` and `clear()` belong on specific store implementations, not on the `PathStore` interface. Consumers who need session listing use stores that provide it (`LocalStorageStore`, demo `ApiStore`) and cast or access the extra methods explicitly.

---

### Express server is intentionally minimal

The server is **not** a reusable package. It's a 50-line demo artifact that:
1. Shows the HTTP contract (`GET/PUT/DELETE /state/:key`, `GET /state` for listing).
2. Works out of the box with zero config (`npm run server`).
3. Can be used as a reference when building a real backend.

**What's missing (intentionally):**
- Authentication / authorization (no `userId` scoping).
- Database persistence (in-memory `Map` resets on restart).
- Input validation (assumes well-formed `SerializedPathState`).
- Rate limiting, logging, monitoring.
- Production-grade error handling.

**Production migration path:** Copy `server.mjs` as a template, replace the `Map` with your database layer, add auth middleware, deploy. The REST contract stays the same.

---

### Storage mode toggle placement

The toggle lives in the page header (above the session list). **Why there?**
1. **Visibility** — users see it immediately when the app loads.
2. **Context** — it's above the session list, so it's clear which sessions you're viewing (localStorage sessions vs API sessions are separate namespaces).
3. **Disabled state** — when a wizard is active, the toggle grays out with a tooltip (in the implementation, we used the `:disabled` attribute bound to `view !== 'sessions'`).

**Alternative we considered:** A settings modal or a URL query param (`?storage=api`). We rejected both because the toggle is core to the demo's value prop ("see localStorage and API side-by-side") and should be prominent.

---

## Testing observations

### localStorage → API mode switch

1. Start in localStorage mode, create a session, add data.
2. Switch to API mode (toggle button).
3. The session list refreshes and shows empty (because API storage is a separate namespace).
4. Create a new session in API mode, add data.
5. Switch back to localStorage mode.
6. The original session reappears (localStorage is still intact).

**Result:** ✓ Both backends coexist independently. No cross-contamination.

---

### API mode with server stopped

1. Start in localStorage mode.
2. Stop the server (`kill` the `npm run dev` process or Ctrl+C the server terminal).
3. Click "API (port 3001)" toggle.
4. Error banner appears: "Cannot connect to API server at http://localhost:3001. Run `npm run server` in a separate terminal."
5. Start the server (`npm run server` in a new terminal).
6. Click "API (port 3001)" again.
7. Toggle succeeds, session list loads (empty), error banner disappears.

**Result:** ✓ Connection test works. Error messaging is clear and actionable.

---

### Shared storage across tabs (API mode)

1. Open the demo in two browser tabs (both at http://localhost:5174).
2. Switch both tabs to API mode.
3. In tab 1: create a session, add a team member.
4. In tab 2: refresh the session list (or reload the page).
5. The session from tab 1 appears in tab 2's session list.
6. In tab 2: resume the session, add another team member.
7. In tab 1: refresh the session list.
8. The session now shows 2 members (updated by tab 2).

**Result:** ✓ API storage is shared across tabs. This demonstrates the difference between localStorage (per-origin, per-tab isolation) and server-backed storage (shared).

---

## Suggested follow-ups

| Priority | Item |
|----------|------|
| High | Add a note to the demo README: "ApiStore is demo-specific; production apps should use HttpStore or implement a custom adapter." |
| High | Document the REST contract (`GET/PUT/DELETE /state/:key`) in the `packages/store-http` README as a reference for backend implementers. |
| Medium | Add a "Copy `server.mjs` as a starting point" callout to the demo README for users who want to build their own backend. |
| Medium | Consider adding a `--storage=api` CLI flag or URL query param for automated testing (e.g. Playwright tests that need to start in API mode). |
| Low | Add TypeScript types (`.d.ts`) for the Express server endpoints so frontend devs can import the contract. |
| Low | Make `httpPersistence` accept a getter function (`() => store`) instead of a direct store reference, enabling reactive store swapping without disabling the toggle during active sessions. |

---

## Metrics

- **Lines of server code:** 50 (including comments and imports)
- **New files:** 2 (`server.mjs`, `ApiStore.ts`)
- **Dependencies added:** 3 (`express`, `cors`, `concurrently`)
- **TypeScript errors encountered:** 1 (fixed in 1 edit)
- **JavaScript syntax errors:** 1 (fixed in 1 edit)
- **Time to implement:** ~45 minutes (server + UI toggle + README updates)
- **Time to test:** ~10 minutes (manual testing of both modes + multi-tab test)

---

## Conclusion

The HTTP storage demo successfully demonstrates that:
1. The `PathStore` interface is truly backend-agnostic — swapping localStorage for a REST API required zero changes to the core persistence logic.
2. The `httpPersistence` observer pattern composes cleanly with different store implementations.
3. Building a minimal Express backend that implements the REST contract is straightforward (50 lines).
4. Storage mode switching at runtime is a powerful demo feature that makes the abstraction tangible.

The main limitation (toggle disabled during active sessions) is a consequence of the observer factory pattern capturing the store reference at creation time. This is acceptable for a demo but suggests a future enhancement to make observers reactive to store changes.

Overall, the HTTP storage addition reinforces the library's core design: **persistence is a pluggable concern, and the engine doesn't care where snapshots go**.

