# Chapter 2: Adapters and PathShell

Chapter 1 introduced the three-layer model: definition, engine, snapshot. This chapter explains how adapters bridge that engine to your framework, how to use `PathShell` as a ready-made UI shell, and how to write your own adapter if you are working in a framework that does not yet have one.

---

## What an adapter does

An adapter is a thin wrapper that connects a `PathEngine` to a framework's reactive system. The entire job of every adapter can be expressed in about ten lines of pseudocode:

```
function usePath(options):
  engine = options.engine ?? new PathEngine()

  reactiveSnapshot = framework.createReactiveSlot(engine.snapshot())

  unsubscribe = engine.subscribe(event => {
    if event is stateChanged or resumed  → reactiveSnapshot.set(event.snapshot)
    if event is completed or cancelled   → reactiveSnapshot.set(null)
  })

  framework.onCleanup(() => unsubscribe())

  return { snapshot: reactiveSnapshot, start, next, previous, ... }
```

That is the entire implementation. The "reactive slot" is different in each framework — a `shallowRef` in Vue, a `$state` rune in Svelte, a `createSignal` in Solid — but the pattern is identical. All action methods (`start`, `next`, `previous`, `setData`, and so on) delegate directly to `PathEngine` without any transformation.

| Adapter | Reactive primitive | Cleanup hook |
|---|---|---|
| `@daltonr/pathwrite-react` | `useSyncExternalStore` | `useEffect` return |
| `@daltonr/pathwrite-vue` | `shallowRef` | `onScopeDispose` |
| `@daltonr/pathwrite-angular` | `BehaviorSubject` + Signal | `ngOnDestroy` |
| `@daltonr/pathwrite-svelte` | `$state` rune | `onDestroy` |
| `@daltonr/pathwrite-solid` | `createSignal` | `onCleanup` |
| `@daltonr/pathwrite-react-native` | `useSyncExternalStore` | `useEffect` return |

The implication of this design is important: the adapters do not add behavior. They do not change when state updates, they do not filter events, and they do not own the engine lifecycle when you pass an external engine. If something is not working, check the engine first — the adapter is almost never the source of a bug.

---

## usePath — the framework composable

Each adapter exports a `usePath` function (or `PathFacade` in Angular). In the simplest case you call it with no arguments and it creates and owns a `PathEngine` internally:

```tsx
// React
const { snapshot, start, next, previous, setData } = usePath();

// Vue
const { snapshot, start, next, previous, setData } = usePath();

// Svelte (inside <script lang="ts">)
const { snapshot, start, next, previous, setData } = usePath();

// Solid
const { snapshot, start, next, previous, setData } = usePath();
```

The `snapshot` value is the framework's reactive equivalent of `PathSnapshot | null`. It is `null` when no path is active and a full `PathSnapshot` object when one is running.

### usePath options

`usePath` accepts an optional options object with two properties:

```typescript
usePath({
  engine?: PathEngine,     // provide an externally-managed engine
  onEvent?: (event: PathEvent) => void,   // subscribe to every engine event
})
```

**`engine`** — When you provide an external engine (for example, one created by `createPersistedEngine()` from the store package), `usePath` subscribes to it instead of creating its own. The snapshot is seeded immediately from the engine's current state, so a restored engine appears populated from the first render. The caller owns the engine's lifecycle — `usePath` will not call `start()` or `cancel()` on it automatically.

**`onEvent`** — Called for every engine event: `stateChanged`, `completed`, `cancelled`, `resumed`, `suspended`. Useful for analytics, side-effects, or driving other parts of your application in response to path lifecycle changes. The callback identity can change between renders without causing a re-subscribe — adapters keep it current via a ref internally.

### The action methods

All action methods on the return value delegate directly to `PathEngine`. They all return promises (`Promise<void>`), because the engine processes each action asynchronously to support async guards and hooks. In React, the promise resolves after the engine has emitted its resulting event and React has re-rendered; in Svelte and Solid you can `await` them in event handlers.

```typescript
start(path, initialData)     // start or restart a path
startSubPath(path, initialData, meta)  // push a sub-path
next()                       // advance one step (or complete on the last step)
previous()                   // go back one step
cancel()                     // cancel the active path
goToStep(stepId)             // jump directly to a step (bypasses guards)
goToStepChecked(stepId)      // jump directly, checking guards first
setData(key, value)          // update a data field
resetStep()                  // reset current step data to step-entry state
restart()                    // cancel and restart with the same definition/data
retry()                      // re-run the operation that set snapshot.error
suspend()                    // pause with intent to return
validate()                   // trigger inline validation without navigating
```

---

## PathShell — the default UI shell

Every adapter ships an optional `PathShell` component. It is a ready-made UI that renders a progress indicator, the current step's content, validation messages, and a navigation footer. You do not have to use it — but it saves significant boilerplate for the common case.

### The steps map

The core `PathShell` prop is `steps`: a record mapping step IDs to content. The shell renders `steps[snapshot.stepId]` for the current step.

```tsx
// React
<PathShell
  path={myPath}
  steps={{
    "details": <DetailsStep />,
    "review":  <ReviewStep />,
    "confirm": <ConfirmStep />,
  }}
/>
```

In frameworks with function-based rendering (Solid), steps are render functions:

```tsx
// Solid
<PathShell
  path={myPath}
  steps={{
    "details": (snap) => <DetailsStep />,
    "review":  (snap) => <ReviewStep />,
  }}
/>
```

In Vue, each step value is a component reference. In Svelte, the shell uses a `{#snippet}` map or a slot-based API — see the framework-specific getting-started guide for the exact syntax.

### Core props

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | required | The path definition to drive. |
| `steps` | `Record<string, ...>` | required | Step content keyed by step ID. |
| `initialData` | `PathData` | `{}` | Initial data object passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. Set to `false` to show the empty state and let the user trigger start explicitly. |
| `engine` | `PathEngine` | — | An externally-managed engine. When provided, `PathShell` skips its own `start()` call. Use with persistence. |

### Event props

| Prop | Type | Description |
|---|---|---|
| `onComplete` | `(data) => void` | Called when the path reaches its last step and `next()` succeeds. Receives the final data object. |
| `onCancel` | `(data) => void` | Called when the path is cancelled. Receives the data at time of cancellation. |
| `onEvent` | `(event) => void` | Called for every engine event. Forwarded to `usePath` internally. |

### Label props

The navigation buttons have sensible defaults. Override them all individually:

| Prop | Default |
|---|---|
| `backLabel` | `"Previous"` |
| `nextLabel` | `"Next"` |
| `completeLabel` | `"Complete"` |
| `cancelLabel` | `"Cancel"` |
| `loadingLabel` | `undefined` (spinner only) |

`loadingLabel` is shown on the Next/Complete button while an async operation is in progress. If omitted, the button keeps its normal label and gains a CSS loading spinner class.

### Layout and visibility props

| Prop | Type | Default | Description |
|---|---|---|---|
| `hideCancel` | `boolean` | `false` | Hide the Cancel button entirely. |
| `hideProgress` | `boolean` | `false` | Hide the progress header. Also hidden automatically for single-step paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer (navigation buttons). The async error panel is still shown regardless. |
| `footerLayout` | `"auto" \| "wizard" \| "form"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back button. `"auto"`: uses form for single-step paths, wizard otherwise. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | Controls how root and sub-path progress bars are arranged when a sub-path is active. See Chapter 6 (Sub-paths). |

### Validation props

| Prop | Type | Default | Description |
|---|---|---|---|
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | `"summary"`: shell renders a labeled error list below the step body after Next is clicked. `"inline"`: suppress the summary — handle errors inside your step component instead. `"both"`: render both. |
| `validateWhen` | `boolean` | `false` | When `true`, calls `validate()` on the engine so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell — bind to the outer `snapshot.hasAttemptedNext`. |

### Services prop

| Prop | Type | Description |
|---|---|---|
| `services` | `object` | An object passed through context to all step components. Access it via `usePathContext<TData, TServices>()`. Intended for the same services object passed to the path factory. |

---

## Customising PathShell

### Replacing the header

The `renderHeader` prop replaces the entire progress area with your own component:

```tsx
<PathShell
  path={myPath}
  steps={mySteps}
  renderHeader={(snapshot) => (
    <MyProgressBar
      current={snapshot.stepIndex}
      total={snapshot.stepCount}
      label={snapshot.steps[snapshot.stepIndex]?.title}
    />
  )}
/>
```

The render prop receives the full `PathSnapshot`, so you have access to every property — step titles, the `progress` float (0–1), step statuses, etc.

### Replacing the footer

The `renderFooter` prop replaces the entire navigation footer. It receives both the snapshot and an `actions` object with all navigation methods:

```tsx
<PathShell
  path={myPath}
  steps={mySteps}
  renderFooter={(snapshot, actions) => (
    <div class="my-footer">
      {!snapshot.isFirstStep && (
        <button onClick={actions.previous}>← Back</button>
      )}
      <button
        onClick={actions.next}
        disabled={snapshot.status !== "idle"}
      >
        {snapshot.isLastStep ? "Submit" : "Continue →"}
      </button>
    </div>
  )}
/>
```

`PathShellActions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`.

### Inline validation

When you want to render field errors inside your step components rather than in a shell-level summary, set `validationDisplay="inline"` and read `snapshot.fieldErrors` directly:

```tsx
// Shell suppresses its own summary
<PathShell path={myPath} steps={mySteps} validationDisplay="inline" />

// Step component reads errors from context
function EmailStep() {
  const { snapshot, setData } = usePathContext<MyData>();
  const error = snapshot.fieldErrors["email"];
  return (
    <div>
      <input
        value={snapshot.data.email}
        onChange={e => setData("email", e.target.value)}
        aria-invalid={!!error}
      />
      {error && <span class="error">{error}</span>}
    </div>
  );
}
```

### Styling

`PathShell` renders a predictable class hierarchy that you can target with CSS. Import the default stylesheet and override what you need:

```css
@import "@daltonr/pathwrite-react/index.css";

/* Override the active step indicator colour */
.pw-shell__step--active .pw-shell__step-dot {
  background: var(--brand-color);
}

/* Override the progress bar fill */
.pw-shell__track-fill {
  background: var(--brand-color);
}

/* Override button shapes */
.pw-shell__btn--next {
  border-radius: 24px;
  padding: 0.75rem 2rem;
}
```

Key class names:

| Class | Element |
|---|---|
| `.pw-shell` | Root container |
| `.pw-shell__header` | Progress indicator |
| `.pw-shell__steps` | Step dot row |
| `.pw-shell__step--pending` / `--active` / `--completed` | Individual step states |
| `.pw-shell__step-dot` | Numbered circle |
| `.pw-shell__step-label` | Step title |
| `.pw-shell__track` | Progress track bar |
| `.pw-shell__track-fill` | Track fill (width driven by `snapshot.progress`) |
| `.pw-shell__body` | Step content area |
| `.pw-shell__validation` | Validation error list |
| `.pw-shell__footer` | Navigation footer |
| `.pw-shell__footer-left` / `--right` | Footer halves |
| `.pw-shell__btn--back` / `--next` / `--cancel` | Navigation buttons |
| `.pw-shell__btn--loading` | Added to Next button during async operations |
| `.pw-shell__error` | Async error panel |
| `.pw-shell__empty` | Pre-start empty state |

---

## usePathContext — accessing the path from step components

When a step component needs access to the path — to read data, call `setData`, or read `fieldErrors` — it calls `usePathContext()`. This hook reads from the context provided by the enclosing `PathShell` (or `PathProvider` in React).

```tsx
// React / Solid
function DetailsStep() {
  const { snapshot, setData } = usePathContext<HiringData>();
  return (
    <input
      value={snapshot.data.name}
      onChange={e => setData("name", e.target.value)}
    />
  );
}
```

`usePathContext` accepts two type parameters:

- `TData` — narrows `snapshot.data` to your data type
- `TServices` — types the `services` value

```tsx
function OfficeStep() {
  const { snapshot, setData, services } = usePathContext<HiringData, HiringServices>();
  // services is typed as HiringServices
  const offices = services.listOffices();
  ...
}
```

`usePathContext` throws at runtime if called outside of a `PathShell` or `PathProvider`. This is intentional — it is a programming error that should be caught during development, not silently produce a null value.

### When you do not want PathShell

If you want full control over rendering, use `usePath` directly and skip `PathShell` entirely. You get all the same reactive state and action methods; you just build the UI yourself:

```tsx
function MyWizard() {
  const { snapshot, start, next, previous, setData } = usePath<MyData>();

  useEffect(() => { start(myPath, { name: "" }); }, []);

  if (!snapshot) return <p>Loading...</p>;

  return (
    <div>
      <p>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}</p>
      {/* render your step content */}
      <button onClick={previous} disabled={snapshot.isFirstStep}>Back</button>
      <button onClick={next}>
        {snapshot.isLastStep ? "Submit" : "Next"}
      </button>
    </div>
  );
}
```

This is the right choice when:
- You are using a component library (shadcn, Ant Design, Radix) and do not want to override shell CSS
- The flow has unusual navigation (tabbed layout, sidebar, slide-over panel)
- You need tight control over animation and transition timing

---

## Writing your own adapter

If you are working in a framework without an official adapter — Qwik, Preact, Alpine, or a hypothetical future framework — you can write one in about 30 lines. The minimum viable adapter has three parts:

**1. Create or accept an engine**

```typescript
export function usePath<TData>(options?: { engine?: PathEngine; onEvent?: ... }) {
  const engine = options?.engine ?? new PathEngine();
  ...
}
```

**2. Sync the engine to a reactive slot**

The exact API differs per framework. The invariants are always the same:
- On `stateChanged` or `resumed`: write `event.snapshot` into the reactive slot
- On `completed` or `cancelled`: write `null` into the reactive slot
- Return an `unsubscribe` function and call it during component teardown

```typescript
// Pseudocode — replace with your framework's reactive API
const [snapshot, setSnapshot] = framework.createSignal(engine.snapshot());

const unsubscribe = engine.subscribe(event => {
  if (event.type === "stateChanged" || event.type === "resumed") {
    setSnapshot(event.snapshot);
  } else if (event.type === "completed" || event.type === "cancelled") {
    setSnapshot(null);
  }
  options?.onEvent?.(event);
});

framework.onCleanup(unsubscribe);
```

**3. Return the action surface**

All actions delegate directly to the engine. No transformation needed.

```typescript
return {
  snapshot,
  start:           (path, data) => engine.start(path, data),
  next:            ()           => engine.next(),
  previous:        ()           => engine.previous(),
  cancel:          ()           => engine.cancel(),
  goToStep:        (id)         => engine.goToStep(id),
  goToStepChecked: (id)         => engine.goToStepChecked(id),
  setData:         (key, value) => engine.setData(key, value),
  restart:         ()           => engine.restart(),
  retry:           ()           => engine.retry(),
  suspend:         ()           => engine.suspend(),
  validate:        ()           => engine.validate(),
};
```

That is a complete, functional adapter. If you want to publish it, look at the existing adapter package structures in `packages/` — each one has a `package.json` declaring `solid-js` (or `react`, `vue`, etc.) as a peer dependency and re-exporting the core types for consumer convenience.

### Testing your adapter

Write tests against the engine directly (not the adapter) for business logic. For adapter-specific behaviour — that the reactive slot updates when the engine fires, that the subscription is torn down on cleanup — follow the patterns in `packages/solid-adapter/test/use-path.test.ts`. The key ingredients:

1. Run tests in a reactive root (`createRoot` in Solid, a component wrapper in React/Vue/Svelte)
2. Verify that reading `snapshot` after engine actions returns the expected value
3. Verify that `unsubscribes` after the root is disposed — drive the engine externally and assert the snapshot no longer updates

---

Chapter 3 covers the full `PathDefinition` API — the complete set of step properties, validation hooks, lifecycle callbacks, and the `StepChoice` pattern.

© 2026 Devjoy Ltd. MIT License.
