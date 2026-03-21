# Persistence Architecture

Persistence in pathwrite is implemented as a **`PathObserver`** — a plain function that the engine calls on every event. The engine doesn't know or care what the observer does; it just emits. The observer reacts.

---

## How it works

```
PathEngine → emits PathEvent → PathObserver (httpPersistence) → HttpStore.save()
```

`httpPersistence()` is a factory that returns a `PathObserver`. It closes over its own debounce timer and pending-save state. Pass it to `PathEngine` via the `observers` option and it runs for the engine's lifetime:

```typescript
import { PathEngine } from "@daltonr/pathwrite-core";
import { HttpStore, httpPersistence } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });

const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding", strategy: "onNext" }),
  ],
});

await engine.start(myPath, initialData);
```

Observers are wired **before** the first event fires, so persistence sees every event from the very first `stateChanged` emitted by `start()`.

---

## The convenience factory

For the common load-or-start pattern, `createPersistedEngine()` does it in one call:

```typescript
import { HttpStore, createPersistedEngine } from "@daltonr/pathwrite-store-http";

const store = new HttpStore({ baseUrl: "/api/wizard" });

const { engine, restored } = await createPersistedEngine({
  store,
  key: "user:123:onboarding",
  path: onboardingWizard,
  initialData: { name: "", email: "" },
  strategy: "onNext",
});

// engine is a plain PathEngine — pass to any adapter
const { snapshot, next } = usePath({ engine });
```

Internally it: calls `store.load(key)`, then either `PathEngine.fromState(saved, defs, { observers })` or `new PathEngine({ observers })` + `engine.start(...)`.

---

## Persistence strategies

| Strategy | Saves when | Best for |
|---|---|---|
| `"onNext"` *(default)* | `next()` completes navigation | Text-heavy forms |
| `"onEveryChange"` | Any settled `stateChanged` or `resumed` | Checkbox/dropdown forms, crash protection |
| `"onSubPathComplete"` | Sub-path finishes, parent resumes | Nested sub-flow wizards |
| `"onComplete"` | Path completes | Audit trail / record-keeping |
| `"manual"` | Never | Full control |

See `PERSISTENCE_STRATEGY_GUIDE.md` for detailed examples.

---

## Composing observers

Multiple observers are independent. Each receives the same events in registration order:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key: "user:123:onboarding" }),
    (event) => console.log(`[wizard] ${event.type}`),
    analyticsObserver,
    auditLogObserver,
  ],
});
```

---

## Building your own observer

`ObserverStrategy` and `matchesStrategy` live in **`@daltonr/pathwrite-core`** so any observer — MongoDB, a logger, analytics — shares the same "when do I fire?" logic without reimplementing it:

```typescript
import {
  type ObserverStrategy,
  matchesStrategy,
  type PathObserver,
} from "@daltonr/pathwrite-core";

function mongoObserver(collection: MongoCollection, strategy: ObserverStrategy): PathObserver {
  return (event, engine) => {
    if (matchesStrategy(strategy, event)) {
      const state = engine.exportState();
      if (state) collection.replaceOne({ _id: state.pathId }, state, { upsert: true });
    }
  };
}
```

`httpPersistence` in `@daltonr/pathwrite-store-http` is a consumer of the same `matchesStrategy` helper — no special treatment, just the pattern above wired to a REST transport.

---

## What is saved

`engine.exportState()` serialises the **full current state** on every save:

```typescript
{
  version: 1,
  pathId: string,
  currentStepIndex: number,
  data: PathData,           // all wizard data fields
  visitedStepIds: string[],
  pathStack: [...],         // sub-path stack
  _isNavigating: boolean,
}
```

Restoration via `PathEngine.fromState(saved, pathDefinitions, { observers })` reconstructs a fully working engine at the saved step with the saved data. The framework adapter seeds its snapshot immediately from `engine.snapshot()` — no flash of empty state.

---

## Completion cleanup

When the path completes, the observer automatically calls `store.delete(key)` to remove the saved state — so a returning user starts fresh rather than restoring a completed wizard. The `"onComplete"` strategy is the exception: it saves a final record and does not delete it.

