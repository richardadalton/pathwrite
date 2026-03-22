# Multi-Tenant & Multi-User Pathwrite — Working Document

**Status:** Exploration / Pre-development  
**Date:** March 22, 2026

---

## The Core Insight

Pathwrite's engine has zero DOM dependencies and runs in plain Node.js. This means it can run
on a server, behind an Express API (or similar), completely decoupled from any UI. The engine
becomes a **flow orchestration service** — not unlike a workflow engine — but with a fraction
of the complexity for the wizard/sequential-flow use case.

Any client that can make an HTTP request can drive it: a React web app, a Swift iOS app, a
Kotlin Android app. They all consume the same endpoints and render whatever state comes back.

---

## Architecture: Server-Side Engine

The server is stateless between requests. On every API call it:

1. Calls `restoreOrStart()` for the user's key
2. Applies the requested action (next / previous / update data)
3. Saves back to the store
4. Returns the new state snapshot to the client

```
Client (Web / iOS / Android)
        ↕  HTTP
Express API
        ↕
restoreOrStart() → PathEngine → save snapshot
```

### Proposed API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/flow/:key` | Get current state |
| `POST` | `/flow/:key/next` | Advance to next step |
| `POST` | `/flow/:key/previous` | Go back |
| `PATCH` | `/flow/:key/data` | Update step data |

### Key Advantage

All business logic — guards, validation, conditional skipping — executes server-side.
Clients are genuinely thin. A mobile app cannot bypass a guard by manipulating local state,
because there is no local state to manipulate.

---

## The 1:1 Model (Single User Per Flow)

The default model is one user, one keyed snapshot:

```
user:123:onboarding   →  { currentStep, data, history, progress }
user:456:onboarding   →  { currentStep, data, history, progress }
```

Each user's engine instance is fully independent. Simultaneous users are not a problem as
long as the store handles concurrent writes (i.e. no two requests for the same key overlap).

---

## The Multi-User Problem

When multiple users need to interact with the **same** flow instance, the snapshot's two
concerns come into conflict:

| Concern | Description |
|---------|-------------|
| **Flow Data** | The payload being worked on — the mortgage application, the order, the form |
| **Navigation State** | Current step, step history, progress — where *someone* is in the flow |

For a single user, these naturally belong together. For multi-user, they may not.

---

## Multi-User Patterns

### 1. Sequential Handoff
The most practical pattern. One active driver at a time.

- User A fills steps 1–4
- The flow blocks, waiting for a different role
- User B (reviewer / approver) picks it up from their own UI at step 5
- Same shared snapshot, keyed by the flow instance not the user
- No concurrency conflict — only one person drives at a time

**Key:** the snapshot is keyed by the **flow instance** (`application:mortgage:789`)
rather than the user.

**Real-world fit:** expense approvals, co-signed applications, document review chains,
loan origination, multi-party contracts.

### 2. Role-Gated Steps
An extension of sequential handoff. Certain steps can only be acted upon by a
specific user role. The engine's `canMoveNext` guard checks the current user's role
before allowing navigation.

```ts
canMoveNext: ({ data, context }) =>
  context.userRole === 'manager' && data.reviewComplete
```

### 3. One Driver, Many Observers
One user controls the flow. Others watch in real time via WebSockets or SSE.
The engine state is the source of truth. The server pushes state snapshots to
all connected clients on every change.

No concurrency problem — only the driver can write; observers only read.

### 4. Parallel Gate
The flow cannot advance until *N* users have each taken action on the current step.
Not natively supported by Pathwrite, but a `canMoveNext` guard can check a separate
"approvals" record in the database before returning `true`.

**Real-world fit:** multi-signatory contracts, committee approvals, peer review.

---

## The Data / Position Split

For scenarios where multiple users need to navigate independently through the same
underlying data, the snapshot needs to be decomposed:

```
flow:mortgage:789:data              ← one shared record
flow:mortgage:789:user:123:position ← User 123's step/history
flow:mortgage:789:user:456:position ← User 456's step/history
```

Each user's engine loads the shared data but tracks its own position independently.

**This is not how Pathwrite currently works** — the snapshot is monolithic today.
This would be a meaningful architectural extension.

---

## Real-Time Sync Between Clients

### The Problem
`onEveryChange` saves to the server frequently — this is the right piece for User B's side.
But User A's browser has no mechanism to *receive* those changes. The observer pattern
today is outbound only: engine → observer → store.

### What's Needed

```
User B types  →  onEveryChange fires  →  saves to server
                                               ↓
                                    server pushes via WebSocket / SSE
                                               ↓
                               User A receives snapshot  →  engine.sync()
```

User A needs:
- A WebSocket / SSE connection subscribed to the flow key
- A way to feed incoming snapshots back into their local engine instance
- Something like `engine.sync(snapshot)` — which does not exist today

---

## Observers vs. Channels

### Current Observer Pattern
Observers are **outbound only**. They receive state change notifications from the engine
and act on them (save to HTTP, log, analytics). The flow is strictly:

```
Engine → stateChanged → Observer reacts
```

### The Gap
For real-time inbound sync, an observer would need to push state *back into* the engine.
This is not supported today, and doing it via a workaround risks infinite loops:

```
engine fires → observer saves → server pushes → observer calls engine.update() → engine fires → ...
```

### Proposed: Channels

A **Channel** is a first-class bidirectional concept:

- Implements the outbound side (like an observer today)
- Has a formal inbound path to push external state into the engine
- Knows to suppress its own outbound save when the update originated externally (loop prevention)

#### Progressive Duck-Typed Interface

```ts
// One-way channel — identical to a simple observer
{ onStateChange: (snapshot) => saveToDb(snapshot) }

// Two-way channel — adds inbound capability
{
  onStateChange: (snapshot) => ws.send(snapshot),
  connect: (engine) => {
    ws.onmessage = (msg) => engine.sync(msg.data)
  }
}
```

The engine calls `onStateChange` if present, calls `connect(engine)` if present.
Observers become channels that happen to only implement one side.

#### Function Shorthand
Plain functions should still be accepted in the `channels` array so the simplest
cases stay as simple as they are today:

```ts
channels: [
  (snapshot) => console.log(snapshot)   // still works
]
```

#### Naming
Renaming `observers` → `channels` unifies the concept. Simpler use cases write
trivially simple channels. Complex use cases write richer ones. No separate mental
model — just progressive complexity on the same abstraction.

---

## Open Questions

- Should the data / position split be a first-class concept in the engine, or left to
  the application layer to model?
- What does `engine.sync(snapshot)` actually do — does it replace state wholesale, or
  merge? What happens to local unsaved changes?
- Should channels have a `dispose()` lifecycle method for cleanup (closing WebSocket
  connections, unsubscribing from SSE)?
- Optimistic locking: should the snapshot carry a version number, and should the store
  reject stale writes with a `409 Conflict`?
- For the sequential handoff pattern, how is "who can act on this step" expressed —
  metadata on the step definition, or entirely in the guard?

---

## Potential New Packages

| Package | Description |
|---------|-------------|
| `@daltonr/pathwrite-server` | Express middleware / router for serving a path engine over HTTP |
| `@daltonr/pathwrite-sync` | WebSocket / SSE channel implementation for real-time multi-client sync |
| `@daltonr/pathwrite-store-db` | Store adapter for a relational or document database |

---

## Summary of What Exists vs. What's Needed

| Capability | Status |
|------------|--------|
| Headless core runs in Node.js | ✅ Works today |
| Restore engine from HTTP store on each request | ✅ Works today |
| Multiple independent users, each with own snapshot | ✅ Works today |
| Sequential handoff (shared flow key, one driver) | ✅ Works today — convention only |
| Role-gated steps via `canMoveNext` guard | ✅ Works today — app-level |
| Parallel gate (N approvers) | ⚠️ Possible today via guard + external DB check |
| Real-time push to connected clients | ❌ Not supported — needs `engine.sync()` + Channel |
| Data / position split for independent multi-user navigation | ❌ Not supported — snapshot is monolithic |
| Bidirectional Channels abstraction | ❌ Not built — observers are outbound only |
| Optimistic locking in store | ❌ Not built |

