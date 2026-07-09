# Multi-User Sync — Feature Specification

Real-time synchronisation of workflow *data* across multiple clients. One canonical data object lives on the server; clients send diffs up and receive diffs down over a WebSocket channel. Navigation state (which step each user is on) is entirely local. Engines run locally; the server has no Pathwrite knowledge.

---

## Core Distinction: Shared vs Per-User State

A multi-user workflow has two distinct kinds of state that must never be conflated.

| Field | Scope | Why |
|---|---|---|
| `data` | **Shared** | The workflow's content — form values, decisions, approval results. All users work on the same document. |
| `currentStepIndex` | Per-user | Each user navigates independently. An approver may be on step 3 while the coordinator reviews step 7. |
| `visitedStepIds` | Per-user | Tracks which steps *this* user has seen. |
| `pathStack` | Per-user | This user's sub-path navigation stack. |
| `_status` | Per-user | Local engine execution state. |
| `stepEntryData` | Per-user | Snapshot of data when *this* user entered their current step. |
| `stepEnteredAt` | Per-user | When *this* user entered their current step. |

Only `data` is synced. Everything else stays local to the user's engine.

---

## Guiding Principles

- **Server stores data only.** The server holds `{ version, data }` — not a full `SerializedPathState`. No engine, no step logic, no navigation state.
- **Clients own navigation.** Every client runs a full `PathEngine` locally and navigates independently. Where a user is in the workflow is their own business.
- **Diffs, not snapshots, over the wire.** Only changed data keys are transmitted. Computed at the observer layer.
- **Settled state only.** Transient engine statuses (`validating`, `leaving`, `entering`) are local. Diffs are only sent when the engine reaches `idle` or `completed`.
- **Last-write-wins at the key level.** True collisions (two users changing the same data key simultaneously) are rare by design — parallel approvers write to separate sections of `data`. Detected via versioning; handled gracefully.

---

## Architecture Overview

```
Client A (User: Approver)            Server                  Client B (User: Coordinator)
─────────────────────────            ──────────────────       ───────────────────────────
PathEngine                           { version, data }        PathEngine
  currentStepIndex: 2    (local)                               currentStepIndex: 6  (local)
  data.approvals.approverA           ◀── synced ──▶           data.approvals.approverA
    │                                                              │
    │  setData("approvals.approverA", {...})                       │
    │  engine reaches idle                                         │
    ▼                                                              │
CollabObserver                                                       │
  diff: { data: { "approvals.approverA": {...} } }                 │
    │                                                              │
    │──── WS: diff (baseVersion: 4) ────▶ apply diff              │
    │                                     version: 5              │
    │◀─── WS: ack (resultVersion: 5) ─────│                       │
    │                                     │──── WS: diff ────────▶│
    │                                                         CollabApplicator
    │                                                           engine.importData(...)
    │                                                           UI re-renders with
    │                                                           new approval data;
    │                                                           user stays on step 6
```

---

## Data Types

### `SharedWorkflowState`

What the server stores per workflow key:

```ts
interface SharedWorkflowState {
  version: number;
  data: PathData;
}
```

### `DataDiff`

The unit transmitted over the wire. Contains only changed data keys.

```ts
interface DataDiff {
  /** Version of the shared data this diff was computed from. */
  baseVersion: number;

  /** Client-generated ID. Recipients ignore diffs with their own originId. */
  originId: string;

  /** The engine cause that produced this change (for diagnostics/logging). */
  cause: StateChangeCause;

  /** Changed data keys and their new values. */
  data?: Record<string, unknown>;

  /** Data keys that were deleted. */
  deletedDataKeys?: string[];
}
```

**Diff computation:**
- Compare `engine.exportState().data` against the previous settled data snapshot.
- Include only keys whose values differ (shallow equality).
- Detect and list deleted keys.
- If nothing in `data` changed (e.g. the user only navigated), no diff is sent.

---

## WebSocket Protocol

All messages are JSON.

### Client → Server

```ts
// Begin receiving diffs for a key. Server replies with current shared data.
{ type: "subscribe"; key: string; clientId: string }

// Unsubscribe from a key.
{ type: "unsubscribe"; key: string; clientId: string }

// Push a data diff.
{ type: "diff"; key: string; clientId: string; diff: DataDiff }
```

### Server → Client

```ts
// Sent immediately after a successful subscribe.
{ type: "snapshot"; key: string; data: PathData; version: number }

// A diff from another client, successfully applied by the server.
{ type: "diff"; key: string; diff: DataDiff; resultVersion: number }

// Sent to the originating client when their diff was applied successfully.
{ type: "ack"; key: string; resultVersion: number }

// Sent to the originating client when their baseVersion was stale.
{ type: "conflict"; key: string; serverData: PathData; serverVersion: number }
```

### Connection Lifecycle

1. **Connect** — client sends `subscribe`. Server replies with `snapshot` (current `data` + version). Client calls `engine.importData(data, { suppressSync: true })`. User's navigation position is unaffected.
2. **Normal operation** — client sends data diffs when `data` changes; receives data diffs from others and merges them into the local engine.
3. **Disconnect / reconnect** — on reconnect, client re-sends `subscribe`. Server sends current `snapshot`. Client reconciles via `importData`. User's navigation position is unaffected.
4. **New user joining mid-workflow** — receives current `data` via `snapshot`. Starts a fresh local engine with that `data` as `initialData`. The workflow's guards and `shouldSkip` logic routes the user to the appropriate step based on their role and the current data state.

---

## Server Contract

The server is implemented by the user. Pathwrite provides the protocol spec and a reference implementation (Express + `ws`). No Pathwrite package dependency required.

### Required behaviours

**On `subscribe`:**
1. If key has no stored state: initialise `{ version: 0, data: {} }`.
2. Send `{ type: "snapshot", key, data, version }` to the subscribing client.
3. Add the client to the subscriber set for this key.

**On `diff`:**
1. Look up stored state for the key.
2. If `diff.baseVersion !== storedVersion`: send `{ type: "conflict", key, serverData, serverVersion }` to the sender. Stop.
3. Apply the diff to stored `data` (see below).
4. Increment `version`.
5. Send `{ type: "ack", key, resultVersion }` to the sender.
6. Broadcast `{ type: "diff", key, diff, resultVersion }` to all other subscribers.

**On `unsubscribe` / disconnect:** remove client from subscriber set.

### Applying a diff (server-side)

Pure JSON — no Pathwrite knowledge required:

```js
function applyDiff(storedData, diff) {
  const next = { ...storedData, ...diff.data };
  for (const key of diff.deletedDataKeys ?? []) delete next[key];
  return next;
}
```

---

## Pathwrite Engine Changes

### New `StateChangeCause`: `"startSubPath"`

Added to the `StateChangeCause` union. Emitted when `startSubPath()` is called — both when it succeeds (sub-path pushed) and when it is blocked by `canStartSubPath`. Allows the shell to surface `snapshot.blockingError` on a blocked attempt, consistent with how a blocked `next()` behaves.

### New `PathStep` guard: `canStartSubPath`

```ts
export interface PathStep<TData extends PathData = PathData> {
  // ...existing fields...
  canStartSubPath?: (ctx: PathStepContext<TData>) => GuardResult | Promise<GuardResult>;
}
```

Evaluated inside `startSubPath()` before the sub-path is pushed onto the stack, following the same pattern as `canMoveNext` before `next()`. If the guard returns `{ allowed: false }`, the sub-path is not started, `snapshot.blockingError` is set to the `reason` (if provided), and `stateChanged` is emitted with cause `"startSubPath"` so the UI can react.

The guard is on the **parent step** — consistent with the principle that guards live on the step you are acting from, not the destination.

**Usage — restricting sub-path launch to assigned approvers:**

```ts
{
  id: "approval-step",
  canStartSubPath: ({ data }) => {
    if (!data.assignedApprovers.includes(currentUser.id)) {
      return { allowed: false, reason: "You are not assigned as an approver for this step." };
    }
    return true;
  },
  onSubPathComplete: (subPathId, subPathData, ctx) => ({
    approvals: { ...ctx.data.approvals, [currentUser.id]: subPathData }
  })
}
```

`currentUser` is captured by closure from application code — the engine remains user-agnostic.

---

### New `StateChangeCause`: `"syncData"`

Added to the `StateChangeCause` union. Signals that a data change was applied from an incoming sync event. The `CollabObserver` skips producing a diff for events with this cause, preventing echo loops.

### `engine.importData(data, options?)`

Merges incoming shared data into the active path's data without running lifecycle hooks or affecting navigation state. Emits `stateChanged` with cause `"syncData"` so the UI re-renders with updated data while the user stays on their current step.

```ts
public importData(
  data: Partial<PathData>,
  options?: {
    /** Suppress the stateChanged emission. Used on initial connect. */
    suppressSync?: boolean;
    /** Keys to delete from current data. */
    deletedKeys?: string[];
  }
): void
```

- Merges `data` into `activePath.data` via `Object.assign`.
- Removes any `deletedKeys` from `activePath.data`.
- Does NOT update `currentStepIndex`, `visitedStepIds`, `pathStack`, or any other navigation field.
- Does NOT call `onEnter` or any lifecycle hooks.
- Does NOT trigger the persistence observer (incoming data came from the server).
- Updates `stepEntryData` to merge the same changes (see *`isDirty` fix* below).
- Emits `stateChanged` with cause `"syncData"` unless `suppressSync` is true.

### New `PathDefinition` guard: `canRestart`

```ts
export interface PathDefinition<TData extends PathData = PathData> {
  // ...existing fields...
  canRestart?: (ctx: PathStepContext<TData>) => GuardResult | Promise<GuardResult>;
}
```

Evaluated inside `restart()` before the engine resets. If the guard returns `{ allowed: false }`, the restart is blocked, `snapshot.blockingError` is set, and `stateChanged` is emitted with cause `"restart"` (already in the union).

This guard is critical in multi-user workflows. `restart()` resets `data` to `initialData` and that diff is broadcast to all connected clients, wiping shared state. The guard should restrict restart to authorised roles only.

```ts
{
  id: "my-workflow",
  canRestart: () => {
    return currentUser.hasPermission("restart-workflow")
      ? true
      : { allowed: false, reason: "You do not have permission to restart this workflow." };
  },
  // ...
}
```

### New `PathStep` guard: `canCancel`

```ts
export interface PathStep<TData extends PathData = PathData> {
  // ...existing fields...
  canCancel?: (ctx: PathStepContext<TData>) => GuardResult | Promise<GuardResult>;
}
```

Evaluated inside `cancel()` when the active path is a sub-path (i.e. the stack has more than one entry). If the guard returns `{ allowed: false }`, the cancellation is blocked, `snapshot.blockingError` is set, and `stateChanged` is emitted with cause `"cancel"` (already in the union).

This guard is on the **parent step** that launched the sub-path — consistent with `canStartSubPath`. It protects against `onSubPathCancel` writing unintended outcomes into shared `data` when a user navigates back from the first step of a sub-path they should not have been able to exit freely.

Not evaluated when cancelling a top-level path (no parent step to attach the guard to).

### `isDirty` fix after `importData`

`isDirty` compares `activePath.data` against `activePath.stepEntryData` — the snapshot taken when the user entered their current step. Without correction, an incoming sync diff that changes `data` would cause `isDirty` to become `true` spuriously, as if the local user had made changes.

`importData` must apply the same merged changes to `stepEntryData` so that remote changes do not count as local edits. Only changes the user makes themselves via `setData` should move `data` away from `stepEntryData`.

### Known limitation: `shouldSkip` not re-evaluated after `importData`

`shouldSkip` is only evaluated during navigation (next, previous, goToStep). If an incoming diff changes data such that the user's current step now satisfies `shouldSkip`, the engine will not automatically navigate away — the user remains on the step until their next navigation action, at which point `shouldSkip` is evaluated normally.

This is a known limitation of the v1 implementation. Automatic re-evaluation of `shouldSkip` on sync would require the engine to trigger navigation, which risks disrupting in-progress user input. The recommended mitigation is to design `shouldSkip` conditions to be user-role-based (determined at step entry) rather than data-value-based in shared workflows.

---

## New Package: `@daltonr/pathwrite-collab`

A small, framework-agnostic package shipping three exports.

### `CollabChannel`

Manages the WebSocket connection, reconnection, and message routing.

```ts
class CollabChannel {
  constructor(url: string, key: string, options?: CollabChannelOptions)

  connect(): void
  disconnect(): void
  sendDiff(diff: DataDiff): void

  onDiff(handler: (diff: DataDiff, resultVersion: number) => void): () => void
  onSnapshot(handler: (data: PathData, version: number) => void): () => void
  onConflict(handler: (serverData: PathData, serverVersion: number) => void): () => void
  onConnectionChange(handler: (status: ConnectionStatus) => void): () => void

  readonly status: ConnectionStatus
  readonly currentVersion: number
}

interface CollabChannelOptions {
  autoReconnect?: boolean;       // default: true
  reconnectDelay?: number;       // base ms, exponential backoff applied. default: 1000
  headers?: Record<string, string>;  // e.g. auth token
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";
```

### `createCollabObserver`

Returns a `PathObserver` that computes data diffs and sends them via `CollabChannel`. Added to the engine's `observers` array at construction, alongside the persistence observer.

```ts
function createCollabObserver(
  channel: CollabChannel,
  options: { clientId: string }
): PathObserver
```

**Behaviour:**
- Ignores all events while `channel.status !== "connected"`.
- Ignores events with cause `"syncData"` (prevents echo).
- Only fires on settled states: `stateChanged` where `snapshot.status === "idle"` or `"completed"`, and `resumed` events.
- Holds the previous settled `data` snapshot in closure. Initialised from `engine.exportState().data` at construction.
- On each qualifying event: diffs current `data` against previous; if anything changed, sends a `DataDiff` via `channel.sendDiff()`.
- Updates the held previous data after sending.

### `createCollabApplicator`

Wires incoming data diffs and snapshots from `CollabChannel` to a `PathEngine`. Returns a cleanup function.

```ts
function createCollabApplicator(
  engine: PathEngine,
  channel: CollabChannel,
  options: {
    clientId: string;
    onConflict?: (serverData: PathData) => void;
  }
): () => void
```

**On `channel.onSnapshot`:**
Call `engine.importData(data, { suppressSync: true })`. Handles both initial connect and post-reconnect reconciliation. User's step position is unaffected.

**On `channel.onDiff`:**
- Skip if `diff.originId === clientId`.
- If `engine.snapshot()?.status === "idle"`: apply immediately via `engine.importData({ ...diff.data }, { deletedKeys: diff.deletedDataKeys })`.
- If engine is in a transient state: queue the diff. On the next `stateChanged` that reaches `idle`, dequeue and apply.
- Only one queued diff is kept — a newer incoming diff replaces a queued one (it supersedes it).

**On `channel.onConflict`:**
- Call `engine.importData(serverData)` — silently reconcile to server state.
- Call `options.onConflict?.(serverData)` — allows the host app to notify the user.

---

## PathShell Integration

All framework adapters gain a `sync` prop on `PathShell`.

```ts
// Same shape across React, Vue, Angular, Svelte, React Native
sync?: {
  channel: CollabChannel;
  clientId: string;
  onConflict?: (serverData: PathData) => void;
}
```

When `sync` is provided, `PathShell`:
1. Creates the `CollabApplicator` on mount; tears it down on unmount.
2. Attaches the `SyncObserver` to the engine.
3. Renders a connection status indicator.

### Connection Status Indicator

| Status | Default display |
|---|---|
| `connecting` | Subtle spinner |
| `connected` | Nothing (normal state) |
| `reconnecting` | "Reconnecting…" warning |
| `disconnected` | "Offline — changes will sync when reconnected" |

Suppressed or replaced via a render prop / slot.

---

## Custom UI Integration

```ts
// React example — same pattern in all adapters
const channel = useMemo(
  () => new CollabChannel("wss://yourserver/sync", workflowKey),
  [workflowKey]
);

const { engine } = await restoreOrStart({
  store,
  key: workflowKey,
  path: myPathDefinition,
  observers: [
    persistenceObserver,
    createCollabObserver(channel, { clientId: MY_CLIENT_ID }),
  ],
});

useEffect(() => {
  channel.connect();
  const cleanup = createCollabApplicator(engine, channel, {
    clientId: MY_CLIENT_ID,
    onConflict: () => toast("Another user made changes — your view has been updated."),
  });
  return () => { cleanup(); channel.disconnect(); };
}, [engine, channel]);
```

`clientId` must be unique per browser tab / session: `crypto.randomUUID()` stored in `sessionStorage`.

---

## Parallel Approver Pattern

Each approver writes to their own section of `data` (e.g. `data.approvals.approverA`). Diffs are at the key level. Different approvers write to different keys — no collision is possible regardless of concurrency.

```
Approver A completes → diff: { "approvals.approverA": { approved: true, note: "..." } }
Approver B completes → diff: { "approvals.approverB": { approved: true, note: "..." } }
```

Both diffs apply cleanly. The parent workflow's advance guard simply reads `data.approvals` and checks all entries. The user with permission to advance calls `next()` when ready.

---

## Conflict Handling

### Detection

Two clients send diffs with the same `baseVersion`. The second to arrive is rejected with a `conflict` message containing the current server data.

### v1: Silent Reconciliation

On conflict, the client silently applies server data via `importData`. The user's navigation position is unaffected — they stay on their current step with the updated data. The `onConflict` callback surfaces a notification: *"Another user made a change at the same time. Your view has been updated."*

True data-key conflicts between parallel approvers are not possible by design. Conflicts at the version level (two clients writing simultaneously) are resolved by the server; the second client simply retries with the reconciled data if their change is still valid.

### Future: Conflict UI

Where a conflict involves overlapping keys, Pathwrite could surface both values and let the user choose. Out of scope for v1 but enabled by the `onConflict` callback receiving the server data.

---

## Implementation Sequence

Work proceeds in four phases. Each phase ends with a checkpoint — a verifiable state where everything built so far works correctly and existing tests still pass. Later phases depend on earlier ones; within a phase, items are mostly independent.

---

### Phase 1 — Core engine changes

All changes to `packages/core/src/index.ts`. No new packages yet.

**1.1 — Type additions (no behaviour change)**
- Add `"startSubPath"` and `"syncData"` to the `StateChangeCause` union
- Add `canStartSubPath` to the `PathStep` interface
- Add `canCancel` to the `PathStep` interface
- Add `canRestart` to the `PathDefinition` interface

> **Checkpoint 1A** — All existing tests pass. TypeScript compiles cleanly. No runtime behaviour has changed.

**1.2 — Guard: `canStartSubPath`**
- Evaluate the guard inside `startSubPath()` before pushing to the stack
- On block: set `_blockingError`, emit `stateChanged` with cause `"startSubPath"`, return without starting
- Write tests: guard absent (behaves as before), guard returns true, guard returns false with reason, async guard

> **Checkpoint 1B** — `canStartSubPath` tests pass. All existing tests still pass.

**1.3 — Guard: `canCancel`**
- Evaluate the guard inside `cancel()` when the stack depth is > 0 (sub-path only)
- On block: set `_blockingError`, emit `stateChanged` with cause `"cancel"`, return without cancelling
- Write tests: top-level cancel unaffected, sub-path cancel blocked, sub-path cancel allowed

> **Checkpoint 1C** — `canCancel` tests pass. All existing tests still pass.

**1.4 — Guard: `canRestart`**
- Evaluate the guard inside `restart()` before resetting
- On block: set `_blockingError`, emit `stateChanged` with cause `"restart"`, return without restarting
- Write tests: guard absent (behaves as before), guard blocks, guard allows

> **Checkpoint 1D** — `canRestart` tests pass. All existing tests still pass.

**1.5 — `engine.importData()`**
- Implement the method: merge data into `activePath.data`, apply deleted keys, update `stepEntryData` with the same changes, emit `stateChanged` with cause `"syncData"` unless suppressed
- Write tests: data merges correctly, deleted keys removed, navigation state untouched (`currentStepIndex` unchanged), `isDirty` remains false after import, `suppressSync` suppresses emission, no-op when engine is completed

> **Checkpoint 1E** — `importData` tests pass. All existing tests still pass. Phase 1 complete.

---

### Phase 2 — `@daltonr/pathwrite-collab` package

New package at `packages/collab`. No framework dependencies. Depends on Phase 1 being complete (`importData` and `"syncData"` cause must exist).

**2.1 — Package scaffold**
- Create `packages/collab/package.json`, `tsconfig.json`, extend `tsconfig.base.json`
- Add to root workspace and build order
- Export barrel: `CollabChannel`, `createCollabObserver`, `createCollabApplicator`

> **Checkpoint 2A** — Package builds. Empty exports compile cleanly.

**2.2 — `CollabChannel`**
- Implement WebSocket connection, `subscribe`/`unsubscribe` messages, reconnect with exponential backoff
- Implement `sendDiff`, `onDiff`, `onSnapshot`, `onConflict`, `onConnectionChange`
- Write tests against a mock WebSocket server: connect, receive snapshot, send diff, receive diff, receive ack, receive conflict, disconnect + reconnect

> **Checkpoint 2B** — `CollabChannel` tests pass against mock server.

**2.3 — `createCollabObserver`**
- Implement: hold previous data snapshot, diff on settled `stateChanged`/`resumed` events, skip `"syncData"` cause, skip when channel not connected, send via `channel.sendDiff()`
- Write tests: diff sent on data change, no diff sent on navigation-only change, no diff sent on `"syncData"` cause, no diff sent when disconnected

> **Checkpoint 2C** — `createCollabObserver` tests pass.

**2.4 — `createCollabApplicator`**
- Implement: apply snapshot on connect/reconnect via `importData`, apply incoming diffs immediately when idle, queue when mid-transition, replace queued diff if a newer one arrives, handle conflict via `importData` + callback
- Write tests: immediate apply when idle, queued apply after transition completes, queued diff replaced by newer, conflict triggers `importData` and callback, own diffs ignored via `originId`

> **Checkpoint 2D** — `createCollabApplicator` tests pass. Full sync round-trip test: two engine instances connected via mock server, data change on one appears on the other. Phase 2 complete.

---

### Phase 3 — Adapter changes

Add the `sync` prop to `PathShell` in each framework adapter. All adapters are independent — can be done in parallel. Depends on Phase 2.

**3.1 — React adapter**
- Add `sync` prop to `PathShellProps`
- On mount: call `channel.connect()`, create `createCollabApplicator`
- Add `createCollabObserver` to engine observers
- Render connection status indicator
- Tear down on unmount
- Write tests / update existing PathShell tests

**3.2 — Vue adapter** — same as 3.1 for Vue

**3.3 — Angular adapter** — same as 3.1 for Angular

**3.4 — Svelte adapter** — same as 3.1 for Svelte

**3.5 — React Native adapter** — same as 3.1 for React Native

> **Checkpoint 3** — All adapter tests pass. Each `PathShell` accepts a `sync` prop without it affecting non-sync usage. Phase 3 complete.

---

### Phase 4 — Reference server implementation

A standalone example server in `apps/collab-server-reference` (or equivalent). Not a publishable package. Depends on Phase 2 (protocol definition).

**4.1 — Reference server**
- Express + `ws` implementation of the server contract
- In-memory snapshot store (keyed by workflow key)
- Handles `subscribe`, `unsubscribe`, `diff` messages
- Broadcasts diffs, sends acks and conflicts
- Clean disconnect handling

**4.2 — End-to-end demo**
- Demo app (or addition to an existing demo) showing two browser windows syncing through the reference server
- Demonstrates parallel approver pattern

> **Checkpoint 4** — Two clients running against the reference server sync data in real time. Navigation state is independent per client. Conflict handling can be demonstrated by forcing a concurrent write. Phase 4 complete — feature ship-ready.

---

### Summary

| Phase | Scope | Depends on |
|---|---|---|
| 1A–1E | Core engine guards + `importData` | — |
| 2A–2D | `@daltonr/pathwrite-collab` package | Phase 1 |
| 3.1–3.5 | `PathShell` sync prop (all adapters) | Phase 2 |
| 4.1–4.2 | Reference server + E2E demo | Phase 2 |

---

## Out of Scope (v1)

- **Server implementation.** Pathwrite ships the protocol spec and a reference implementation. Auth, persistence backend, and horizontal scaling are the application's responsibility.
- **Presence / cursors.** Knowing which users are connected and which step they are on is a separate concern.
- **Field-level conflict resolution UI.** Deferred; `onConflict` provides the hook.
- **Offline write queue.** Diffs produced while disconnected are dropped. On reconnect the client receives authoritative server data. Queuing is a future enhancement.
- **Server-side engine.** The fully server-authoritative architecture is a separate future offering.
