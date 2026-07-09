# notifywrite — headless notification engine for TypeScript

> notifywrite is a headless, framework-agnostic notification (toast) engine. `NotificationEngine` is a plain zero-dependency TypeScript class that manages a queue of notifications — adding, updating, dismissing, clearing, auto-dismiss timers with pause/resume, bounded stacks, and dismiss reasons. Framework adapters for React, Vue, Angular, Svelte, SolidJS, and React Native subscribe to the engine and expose its state through each framework's own reactivity. A `/remote` subpath lets a server drive notifications over SSE, WebSocket, or polling. No UI components ship with the library.

- npm: `@daltonr/notifywrite` (core) + one adapter package per framework
- Repo: https://github.com/richardadalton/notifywrite
- License: MIT. Zero runtime dependencies in the core. Runs in browsers, Node.js, test runners, and React Native.

## Install

```bash
# Core only (framework-agnostic / Node)
npm install @daltonr/notifywrite

# With an adapter
npm install @daltonr/notifywrite @daltonr/notifywrite-react          # React
npm install @daltonr/notifywrite @daltonr/notifywrite-vue           # Vue 3
npm install @daltonr/notifywrite @daltonr/notifywrite-angular       # Angular
npm install @daltonr/notifywrite @daltonr/notifywrite-svelte        # Svelte 5
npm install @daltonr/notifywrite @daltonr/notifywrite-solid         # SolidJS
npm install @daltonr/notifywrite @daltonr/notifywrite-react-native  # React Native
```

## Core types (exact, from source)

```ts
export type NotificationType = 'info' | 'success' | 'error' | 'warning'

export interface Notification {
  readonly id: string        // engine-generated, sequential ("1", "2", ...)
  readonly message: string
  readonly type: NotificationType   // defaults to 'info'
  readonly createdAt: number        // Date.now() at add time
}

export interface NotificationSnapshot {
  readonly notifications: readonly Notification[]
}

export interface AddOptions {
  type?: NotificationType    // default 'info'
  duration?: number          // ms; > 0 schedules auto-dismiss, omit for sticky
}

export interface UpdatePatch {
  message?: string
  type?: NotificationType
  // duration replaces any existing auto-dismiss timer: > 0 schedules a fresh
  // timer for the full duration (clearing a paused one), <= 0 cancels it.
  duration?: number
}

export type NotificationOrder = 'oldest-first' | 'newest-first'
export type DismissReason = 'user' | 'timeout' | 'clear' | 'overflow'

export interface EngineOptions {
  // Where add() places new notifications in the snapshot. Toast UIs usually
  // want 'newest-first'; the default 'oldest-first' preserves insertion order.
  order?: NotificationOrder
  // Maximum live notifications. When add() would exceed it, the oldest are
  // dismissed with reason 'overflow'. Values < 1 mean no limit.
  max?: number
}
```

## NotificationEngine API

```ts
import { NotificationEngine } from '@daltonr/notifywrite'
const engine = new NotificationEngine({ order: 'newest-first', max: 5 }) // options optional
```

| Method | Signature | Behaviour |
|---|---|---|
| `add` | `(message: string, options?: AddOptions) => string` | Adds a notification, returns its id. `duration > 0` schedules auto-dismiss. If `max` is exceeded, oldest entries are dropped with reason `'overflow'`. |
| `update` | `(id: string, patch: UpdatePatch) => boolean` | Patches message/type in place, preserving `id` and `createdAt`. `patch.duration` reschedules (`> 0`) or cancels (`<= 0`) the timer. Returns `false` (no emit) when the id is not live. |
| `dismiss` | `(id: string) => void` | Removes the notification (reason `'user'`) and clears its timer. |
| `clear` | `() => void` | Removes everything (reason `'clear'` per notification); no-op when already empty. |
| `pause` | `(id: string) => void` | Freezes the auto-dismiss timer, keeping the remaining time (pause-on-hover). No-op without an active timer. |
| `resume` | `(id: string) => void` | Restarts a paused timer with whatever time was left. No-op unless paused. |
| `remaining` | `(id: string) => number \| undefined` | Milliseconds until auto-dismiss: frozen value while paused, live countdown otherwise, `undefined` when the notification has no timer. |
| `snapshot` | `() => NotificationSnapshot` | Referentially stable: repeated calls return the same object until the list changes — safe as `getSnapshot` for React's `useSyncExternalStore`. |
| `subscribe` | `(listener: () => void) => () => void` | Fires on every change; returns an unsubscribe function. |
| `onDismiss` | `(listener: (n: Notification, reason: DismissReason) => void) => () => void` | Fires whenever a notification leaves the list, with why: `'user'`, `'timeout'`, `'clear'`, or `'overflow'`. The hook for exit animations and analytics. Returns an unsubscribe function. |

Semantics worth knowing:

- Every mutation produces a **new notifications array** (immutable snapshots); adapters rely on reference equality.
- Timers are engine-owned `setTimeout`s, cleared automatically on dismiss/clear — no leak-prone cleanup in components.
- Multiple engines can run side by side (e.g. a global toast stack and a per-panel one); it's just a class.

### Core usage example

```ts
import { NotificationEngine } from '@daltonr/notifywrite'

const engine = new NotificationEngine({ order: 'newest-first', max: 5 })

const id = engine.add('Uploading…')                       // sticky, type 'info'
engine.update(id, { message: 'Upload complete', type: 'success', duration: 4000 })

engine.pause(id)    // e.g. onMouseEnter
engine.resume(id)   // e.g. onMouseLeave
engine.remaining(id) // ms left, or undefined

const unsubscribe = engine.subscribe(() => render(engine.snapshot()))
const offDismiss = engine.onDismiss((n, reason) => analytics.track('toast_gone', { reason }))

engine.dismiss(id)
engine.clear()
```

## Framework adapters

Every adapter returns the same actions — `add`, `update`, `dismiss`, `pause`, `resume`, `clear` — plus `notifications`. Each also offers a direct `useNotifications(engine)` for use without context. What differs is how the engine is provided and the reactive shape of `notifications`:

| Framework | Package | Provide | Consume from context | `notifications` is | Read as |
|---|---|---|---|---|---|
| React | `@daltonr/notifywrite-react` | `<NotificationProvider engine={engine}>` | `useNotificationsContext()` | plain array | `notifications` |
| React Native | `@daltonr/notifywrite-react-native` | same API as React | `useNotificationsContext()` | plain array | `notifications` |
| Vue 3 | `@daltonr/notifywrite-vue` | `provideNotifications(engine)` | `injectNotifications()` | readonly `computed` ref | `notifications.value` (auto-unwrapped in templates) |
| Angular | `@daltonr/notifywrite-angular` | `provideNotifications(engine)` in bootstrap providers | `injectNotifications()` | `Signal<readonly Notification[]>` | `notifications()` |
| Svelte | `@daltonr/notifywrite-svelte` | `provideNotifications(engine)` | `useNotificationsContext()` | `Readable` store | `$notifications` in markup, `get(notifications)` in scripts |
| SolidJS | `@daltonr/notifywrite-solid` | `<NotificationProvider engine={engine}>` | `useNotificationsContext()` | signal accessor | `notifications()` |

Adapter implementation notes:

- **React / React Native**: built on `useSyncExternalStore` for tear-free reads (the engine's stable snapshot is used as `getSnapshot` directly). React Native adapter is API-identical to React. `useNotificationsContext()` throws if there is no `NotificationProvider` ancestor.
- **Vue**: state is a `shallowRef` updated on engine emissions, exposed as a readonly `computed`; cleanup via `onScopeDispose` (call inside a component `setup()` or an `effectScope`, or the subscription is never cleaned up). The engine is `markRaw`ed — don't wrap it in a reactive proxy.
- **Angular**: `provideNotifications(engine)` registers a `NOTIFICATION_ENGINE` injection token; `injectNotifications()` returns a `Signal` kept current via an internal RxJS bridge (`fromEngine(engine): Observable<readonly Notification[]>` is also exported). Cleanup via `DestroyRef`.
- **Svelte**: `readable` store that subscribes to the engine on first subscriber and tears down on last — no `onDestroy` needed.
- **Solid**: `createSignal` accessor updated on engine emissions, disposed via `onCleanup`.

### React example

```tsx
import { NotificationEngine } from '@daltonr/notifywrite'
import { NotificationProvider, useNotificationsContext } from '@daltonr/notifywrite-react'

const engine = new NotificationEngine({ order: 'newest-first' })

function Toasts() {
  const { notifications, dismiss, pause, resume } = useNotificationsContext()
  return (
    <div className="toast-stack">
      {notifications.map(n => (
        <div key={n.id} className={`toast toast-${n.type}`}
             onMouseEnter={() => pause(n.id)} onMouseLeave={() => resume(n.id)}>
          {n.message}
          <button onClick={() => dismiss(n.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

function App() {
  return (
    <NotificationProvider engine={engine}>
      <button onClick={() => engine.add('Saved!', { type: 'success', duration: 4000 })}>Save</button>
      <Toasts />
    </NotificationProvider>
  )
}
```

### Vue example

```vue
<script setup>
import { injectNotifications } from '@daltonr/notifywrite-vue'
// a parent component called provideNotifications(engine) in its setup
const { notifications, dismiss } = injectNotifications()
</script>

<template>
  <div v-for="n in notifications" :key="n.id" :class="`toast toast-${n.type}`">
    {{ n.message }} <button @click="dismiss(n.id)">×</button>
  </div>
</template>
```

### Svelte example

```svelte
<script>
  import { useNotificationsContext } from '@daltonr/notifywrite-svelte'
  // a parent component called provideNotifications(engine)
  const { notifications, dismiss } = useNotificationsContext()
</script>

{#each $notifications as n (n.id)}
  <div class="toast toast-{n.type}">{n.message}<button on:click={() => dismiss(n.id)}>×</button></div>
{/each}
```

## Server-driven notifications (`@daltonr/notifywrite/remote`)

The `remote` subpath bridges a back-end into the engine without the app caring how events travel. Still zero dependencies.

```ts
export type RemoteEvent =
  | { kind: 'add';     message: string; key?: string; options?: AddOptions }
  | { kind: 'update';  key: string; patch: UpdatePatch }
  | { kind: 'dismiss'; key: string }

// A transport: receives an emit callback, starts delivering events, returns a teardown.
export type NotificationSource = (emit: (event: RemoteEvent) => void) => () => void

export function connectSource(engine: NotificationEngine, source: NotificationSource): () => void
```

`key` is the **server's** stable identifier — engine ids are client-generated, so the server can't know them. `connectSource` maintains the key → engine-id mapping, which is what lets a server update or dismiss a toast it created earlier. Events referencing a key that is not live (never seen, or already dismissed by the user) are **silently dropped** — with a remote sender that is a normal race, not an error. Re-adding a live key remaps it to the new notification.

```ts
import { NotificationEngine } from '@daltonr/notifywrite'
import { connectSource, sseSource, webSocketSource, pollingSource } from '@daltonr/notifywrite/remote'

const engine = new NotificationEngine({ order: 'newest-first' })
const disconnect = connectSource(engine, sseSource('/api/notifications'))
```

Wire format is JSON, one `RemoteEvent` per message. A job lifecycle as the server would send it:

```jsonc
{ "kind": "add",     "key": "job-42", "message": "Export queued…" }
{ "kind": "update",  "key": "job-42", "patch": { "message": "Processing…" } }
{ "kind": "update",  "key": "job-42", "patch": { "message": "Export ready", "type": "success", "duration": 5000 } }
{ "kind": "dismiss", "key": "job-42" }
```

### Built-in transports

```ts
// Server-Sent Events. Reconnection handled natively by EventSource.
sseSource(url: string, options?: { parse?: (data: string) => RemoteEvent }): NotificationSource

// WebSocket. Pass a URL to let the source OWN the connection (reconnects after
// unexpected close; reconnectDelay ms, default 3000, 0 disables), or pass an
// existing socket to SHARE it — a shared socket is only listened to, never
// closed or reconnected.
webSocketSource(urlOrSocket: string | WebSocketLike,
                options?: { parse?: (data: string) => RemoteEvent; reconnectDelay?: number }): NotificationSource

// Polling, for servers without a streaming endpoint. The fetcher returns the
// batch of events since its last call (e.g. via a cursor). Fetch errors are
// swallowed and polling continues on the next tick.
pollingSource(fetcher: () => Promise<readonly RemoteEvent[]>, intervalMs: number): NotificationSource
```

Notes:

- `parse` defaults to `JSON.parse`; messages whose parse throws are ignored.
- `sseSource`/`webSocketSource` look up the global `EventSource`/`WebSocket` constructors (browsers and recent Node.js) and throw a descriptive error if missing; structural types (`EventSourceLike`, `WebSocketLike`) are exported so drop-in replacements (e.g. reconnecting-websocket) satisfy them.
- Custom transports are just functions: `connectSource(engine, emit => { const stop = myBus.on('notify', emit); return stop })`.
- Framework adapters need no changes — they observe engine emissions regardless of who caused them.

## Testing

The engine is a plain class with no DOM and no framework — assert without rendering:

```ts
import { NotificationEngine } from '@daltonr/notifywrite'

const engine = new NotificationEngine()
engine.add('hello', { type: 'success' })
expect(engine.snapshot().notifications).toHaveLength(1)
expect(engine.snapshot().notifications[0].type).toBe('success')
```

With fake timers, `duration`, `pause`, `resume`, and `remaining` are fully deterministic.

## Common recipes

- **Toast UI ordering**: construct with `{ order: 'newest-first' }` so the newest toast renders first without copying/reversing the array.
- **Pause on hover**: `onMouseEnter={() => pause(n.id)}`, `onMouseLeave={() => resume(n.id)}`.
- **Progress bar**: poll `remaining(id)` (e.g. via `requestAnimationFrame`) against the original duration.
- **Async action lifecycle**: `const id = add('Saving…')` then `update(id, { message: 'Saved', type: 'success', duration: 3000 })` on success or `update(id, { message: 'Failed', type: 'error' })` on error.
- **Bounded stack**: `new NotificationEngine({ max: 5 })`; listen for `onDismiss(..., reason === 'overflow')` if you need to react to drops.
- **Exit animations / analytics**: `onDismiss((n, reason) => ...)` — `reason` is `'user' | 'timeout' | 'clear' | 'overflow'`.
- **Multiple stacks**: create two engines; nothing is global.
- **Multi-framework app shells**: share one engine instance via module scope across independently rendered framework islands (e.g. a React shell and a Vue widget stay in sync).

## Package map

| Package | Contents |
|---|---|
| `@daltonr/notifywrite` | `NotificationEngine` + all core types; `@daltonr/notifywrite/remote` subpath with `connectSource`, `sseSource`, `webSocketSource`, `pollingSource`, `RemoteEvent`, `NotificationSource` |
| `@daltonr/notifywrite-react` | `NotificationProvider`, `useNotificationsContext()`, `useNotifications(engine)`, `NotificationContext` |
| `@daltonr/notifywrite-vue` | `provideNotifications(engine)`, `injectNotifications()`, `useNotifications(engine)` |
| `@daltonr/notifywrite-angular` | `provideNotifications(engine)`, `injectNotifications()`, `fromEngine(engine)`, `NOTIFICATION_ENGINE` token |
| `@daltonr/notifywrite-svelte` | `provideNotifications(engine)`, `useNotificationsContext()`, `useNotifications(engine)` |
| `@daltonr/notifywrite-solid` | `NotificationProvider`, `useNotificationsContext()`, `useNotifications(engine)` |
| `@daltonr/notifywrite-react-native` | Same API as the React adapter (`useSyncExternalStore` lives in `react` itself) |

Core type exports: `NotificationEngine`, `Notification`, `NotificationSnapshot`, `NotificationType`, `AddOptions`, `UpdatePatch`, `DismissReason`, `EngineOptions`, `NotificationOrder`.

Runnable demos for every adapter — plus a vanilla JS playground and an Express + React server-push demo (`npm run demo:server`) — live in the repo's `demos/` directory.
