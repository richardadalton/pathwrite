# Pathwrite — Vue Demo: Storage

This demo shows using `@daltonr/pathwrite-store-http` with **both** `LocalStorageStore` and `HttpStore` (via a custom `ApiStore`) in a Vue wizard.

It demonstrates:

- Building a list of team members and collecting per-member profile data via a sub-wizard.
- Persisting every change (debounced at 500ms) using `httpPersistence`.
- Restoring the engine from a snapshot with `restoreOrStart` so the user resumes where they left off.
- Supporting multiple in-progress sessions: each session is saved under its own key and can be resumed or deleted from a session picker.
- **Switchable storage backend**: toggle between localStorage (browser-local) and API (server-backed) without restarting the app.

Quick start
-----------

**Option 1: localStorage only** (no server required)

From the repository root:

```bash
cd /Users/richarddalton/WebstormProjects/pathwrite
npm run demo:vue:storage
```

The dev server will start at http://localhost:5173. Open it in your browser — localStorage mode is active by default.

**Option 2: Run with API server** (supports localStorage ↔ API toggle)

You need two terminals:

Terminal 1 — Start the Express API server:

```bash
cd /Users/richarddalton/WebstormProjects/pathwrite/apps/vue-demos/demo-vue-storage
npm install    # install express, cors, concurrently if needed
npm run server
```

The API will start at http://localhost:3001.

Terminal 2 — Start the Vue dev server:

```bash
cd /Users/richarddalton/WebstormProjects/pathwrite/apps/vue-demos/demo-vue-storage
npm start
```

Open http://localhost:5173, then click the **🌐 API (port 3001)** toggle button to switch to API storage.

**Option 3: Run both concurrently** (convenience script)

```bash
cd /Users/richarddalton/WebstormProjects/pathwrite/apps/vue-demos/demo-vue-storage
npm install
npm run dev
```

This runs both the server and the Vite dev server in one terminal using `concurrently`.

Notes
-----

- **localStorage mode**: Each session is stored in the browser's localStorage with the prefix `pathwrite-demo:`. Keys look like `pathwrite-demo:session:163...`. Data is private to your browser and survives page reloads.
- **API mode**: Each session is stored in the Express server's in-memory map. Data is shared across tabs/browsers pointing at the same server, but is lost when the server restarts.
- The demo uses `httpPersistence` with `strategy: "onEveryChange"` and `debounceMs: 500` to save frequently but avoid excessive writes.
- On completion the observer deletes the snapshot automatically so completed sessions don't reappear in the session picker.
- The storage mode toggle is disabled when a wizard is active (you can only switch from the session picker screen).

API endpoints
-------------

The Express server (`server.mjs`) exposes:

- `GET /api/state` — List all snapshot keys: `{ keys: string[] }`
- `GET /api/state/:key` — Load a snapshot (returns `SerializedPathState` or 404)
- `PUT /api/state/:key` — Save a snapshot (body is `SerializedPathState`)
- `DELETE /api/state/:key` — Delete a snapshot

All endpoints support CORS for local development.

Developer tips
--------------

- If you are editing the `store-http` package while working on the demo, rebuild `packages/store-http` so the demo's runtime picks up the compiled `dist` files:

```bash
cd /Users/richarddalton/WebstormProjects/pathwrite
npm run build -w packages/store-http
```

- When wiring an externally-managed `PathEngine` instance into Vue components, use `shallowRef` rather than `ref` to avoid Vue proxying the class instance and losing its class shape:

```ts
const engine = shallowRef<PathEngine | null>(null);
```

- If the demo's dev server suggests an alternate port (e.g. 5174) because the default is in use, use the printed URL in your browser.

- To develop with API storage, run the server in one terminal (`npm run server`) and Vite in another (`npm start`), or use `npm run dev` to run both concurrently.

What to look for when testing
-----------------------------

1. **localStorage mode**: Start a new onboarding session, add members, and fill in profiles. Reload the page — the session should restore to the same place.
2. **localStorage mode**: Start two separate sessions and verify both appear in the session picker; resume either independently.
3. **API mode**: Click the **🌐 API** toggle. If the server is not running, you should see an error banner.
4. **API mode**: Start a session, add data, then open the same URL in a private/incognito window. Both tabs should see the same session list (shared server-side storage).
5. **Switching modes**: Toggle between localStorage and API. Sessions are independent — localStorage snapshots don't appear when API mode is active, and vice versa.
6. Complete a session and confirm it is removed from the session list (the snapshot is deleted on completion).
7. Delete a session from the picker and confirm it is removed immediately.

Contact / Changes
-----------------

If you'd like the demo to write snapshots to a server rather than localStorage, switch to `HttpStore` and provide a `baseUrl` for your API. If you'd like I can add a README note with example `HttpStore` usage or wire up an optional server adapter.


