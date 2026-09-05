# Snapshot Distributor Architecture

Architecture notes for supporting long-running, multi-device, multi-user workflows in Pathwrite.

---

## The Core Question: Shared Instance or Per-Person?

Before choosing an architecture, identify which scenario applies:

**Scenario A — Each person has their own workflow instance**
e.g. each fills in their own application form, resuming across their devices.

**Scenario B — Multiple people collaborate on the same workflow instance**
e.g. a multi-step approval chain, or a form that different team members fill in different sections of.

---

## Scenario A: Per-Person, Resume Across Devices

**Client-side engine + HttpStore** works today with no changes to Pathwrite:

```
Browser / Phone / iPad
  PathEngine (in-memory)
  HttpStore → PUT/GET /api/state/user:123:workflow-id
                     ↕
               Your REST API
               (stores SerializedPathState in DB)
```

- Each device restores with `restoreOrStart` on load
- Saves on `"onNext"` strategy (after each step)
- Any device can pick up where another left off
- No concurrency conflict — one person, one active session at a time

`SerializedPathState` is a plain JSON blob, so any backend (Postgres, Redis, DynamoDB) works as the store.

---

## Scenario B: Multiple People on the Same Instance

### Option 1 — Server-Side Engine (Full Authority)

Move the engine to the server entirely:

```
Browser / Phone / iPad                 Node.js Server
  Thin UI layer only         ←──────  PathEngine (single authority)
  renders PathSnapshot        ──────→ next() / prev() / updateData()
  (no local engine)           WebSocket / SSE / REST
```

- Server runs one `PathEngine` instance per workflow
- Clients send commands (`next`, `prev`, `updateData`, `goToStep`)
- Server pushes snapshot updates to all connected clients
- Single source of truth — no conflicts

**Gap:** Pathwrite doesn't ship a server runtime or WebSocket layer. The client adapters also currently assume a local engine.

---

### Option 2 — Snapshot Distributor (Recommended for Most Cases)

A middle ground: clients each run a full `PathEngine` locally, but a lightweight server holds the latest snapshot and broadcasts changes to all subscribers. The server has **no PathEngine knowledge** — it is purely a snapshot store + pub/sub relay.

```
Client A (PathEngine)                    Server
  persistence observer  ──── PUT ────→  snapshot store
                                             │
                                           broadcast
                                             │
Client B (PathEngine)  ←── push ──────  (WebSocket / SSE)
  receives snapshot
  recreates engine from state
```

#### Server responsibilities (trivial — no Pathwrite knowledge required)

1. Accept `PUT /state/:key` → store snapshot + broadcast to all subscribers for that key
2. Accept `GET /state/:key` → return latest snapshot
3. Push snapshot updates to all WebSocket/SSE subscribers on change

Any framework works (Express + `ws`, Fastify + SSE, etc.).

#### What already exists in Pathwrite

- `HttpStore` handles the **upload** side unchanged — no modifications needed
- `restoreOrStart` handles the initial load/restore pattern
- `PathEngine.fromState()` creates a new engine from a serialized snapshot

---

## What Pathwrite Needs to Support the Snapshot Distributor Pattern

### 1. `engine.importState(state, { suppressSave: true })`

Hot-swap engine state on a live engine without triggering the persistence observer.

Currently `PathEngine.fromState()` creates a new engine, which requires re-wiring all observers. Without suppression, a naive implementation creates a **save loop**:

```
receive snapshot → fromState() → new engine → persistence fires
  → PUT to server → broadcast → receive snapshot → ...
```

### 2. A `SnapshotReceiver` utility

Wraps an engine, subscribes to a WebSocket/SSE feed, and applies incoming snapshots safely:

- **Hold incoming snapshots** while the local engine is mid-transition
  (`status !== "idle"` — e.g. `"validating"`, `"leaving"`)
- **Apply the snapshot** once the engine returns to `"idle"`
- **Ignore snapshots** that originated from this client (avoid redundant re-applies)

---

## What the Snapshot Distributor Does Not Solve

**Concurrent edits — last write wins.**

If two people advance the workflow at the same time, the server stores whichever `PUT` arrives last. The snapshot distributor keeps everyone aware of the latest state but does not prevent two clients from acting on the same step simultaneously.

To address this, add a `version` (or `updatedAt`) field to `SerializedPathState` and have the server reject stale writes (HTTP 409 Conflict). The client can then handle the conflict — typically by reloading the latest snapshot and informing the user.

---

## Architecture Decision Matrix

| Situation | Recommended Architecture |
|---|---|
| Resume my own workflow on any device | Client engine + HttpStore (works today) |
| Hand off between people (serial, not simultaneous) | Client engine + HttpStore + DB-level "claimed by" lock |
| Awareness of latest state, occasional overlap acceptable | **Snapshot Distributor** |
| True simultaneous collaboration, conflicts unacceptable | Server-side engine + WebSocket command layer |

---

## Summary

The Snapshot Distributor is a pragmatic and genuinely useful pattern for the common case of long-running, sequential-handoff workflows. It reuses existing Pathwrite primitives cleanly and keeps the server trivially simple.

The two additions needed in Pathwrite to make this a first-class pattern:

1. **`engine.importState()`** — hot-swap state without triggering persistence
2. **`SnapshotReceiver`** — safe client-side subscriber that applies incoming snapshots when the engine is idle

The server itself requires no Pathwrite knowledge and can be implemented in any Node.js framework in under 100 lines.
