# @daltonr/pathwrite-svelte

Svelte 5 adapter for `@daltonr/pathwrite-core` — runes-based reactive state with an optional `<PathShell>` UI component.

## Installation

```bash
npm install @daltonr/pathwrite-core @daltonr/pathwrite-svelte
```

Peer dependencies: Svelte 5+.

> Uses Svelte 5 runes (`$state`, `$derived`, `$props`) and snippets (`{#snippet}`, `{@render}`). Not compatible with Svelte 4.

## Quick start

```svelte
<!-- JobApplicationFlow.svelte -->
<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import "@daltonr/pathwrite-svelte/styles.css";
  import { applicationPath } from "./application-path";
  import DetailsStep from "./DetailsStep.svelte";
  import CoverNoteStep from "./CoverNoteStep.svelte";

  function handleComplete(data) {
    console.log("Submitted:", data);
  }
</script>

<PathShell
  path={applicationPath}
  initialData={{ name: "", email: "", coverNote: "" }}
  oncomplete={handleComplete}
>
  {#snippet details()}
    <DetailsStep />
  {/snippet}

  <!-- Step ID is "cover-note"; PathShell resolves the camelCase snippet automatically -->
  {#snippet coverNote()}
    <CoverNoteStep />
  {/snippet}
</PathShell>
```

```svelte
<!-- DetailsStep.svelte — step component uses usePathContext -->
<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";

  const ctx = usePathContext();
</script>

{#if ctx.snapshot}
  <input
    value={ctx.snapshot.data.name ?? ""}
    oninput={(e) => ctx.setData("name", e.currentTarget.value)}
    placeholder="Name"
  />
  <button onclick={ctx.next}>Next</button>
{/if}
```

## usePath

`usePath<TData>(options?)` creates an isolated path engine instance with runes-based reactive state. The engine is unsubscribed automatically when the component is destroyed.

> Do not destructure `snapshot` — it is a reactive getter backed by `$state`. Destructuring captures the value once and loses reactivity. Access it as `path.snapshot` throughout the template.

| Return value | Type | Description |
|---|---|---|
| `snapshot` | `PathSnapshot \| null` | Reactive getter. `null` when no path is active or when `completionBehaviour: "dismiss"` is used. With the default `"stayOnFinal"`, a non-null snapshot with `status === "completed"` is returned after the path finishes. |
| `start(definition, data?)` | `Promise<void>` | Start or restart a path. |
| `restart()` | `Promise<void>` | Tear down any active path (without firing hooks) and restart the root path with the `initialData` from the original `start()`. Takes no arguments; rejects if nothing has been started. |
| `next()` | `Promise<void>` | Advance one step. Completes on the last step. |
| `previous()` | `Promise<void>` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `Promise<void>` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `Promise<void>` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `Promise<void>` | Update a single data field. Type-safe when `TData` is specified. |
| `resetStep()` | `Promise<void>` | Restore the current step's data to what it was when the step was entered. Emits `stateChanged` with cause `"resetStep"`; no hooks run. |
| `retry()` | `Promise<void>` | Re-run the operation that set `snapshot.error`. Increments `retryCount` on repeated failure. No-op when there is no pending error. |
| `suspend()` | `Promise<void>` | Pause the path with intent to return. Emits `suspended`; all state and data are preserved. |
| `startSubPath(definition, data?, meta?)` | `Promise<void>` | Push a sub-path. `meta` is returned to `onSubPathComplete`/`onSubPathCancel`. |
| `validate()` | `void` | Set `snapshot.hasValidated` without navigating. Triggers all inline field errors simultaneously. Used to validate all tabs in a nested shell at once. |

**Options:**

| Option | Type | Description |
|---|---|---|
| `engine` | `PathEngine` | Externally-managed engine (e.g. from `restoreOrStart()`). `usePath` subscribes to it; the caller owns the lifecycle. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

## PathShell props

Step content is supplied as Svelte 5 snippets whose names match each step's `id`. For hyphenated step IDs (e.g. `"cover-letter"`), pass the snippet as the camelCase prop (`coverLetter={...}`) — PathShell resolves it automatically. A `console.warn` fires in development if no snippet is found under either the exact ID or the camelCase form.

| Prop | Type | Default | Description |
|---|---|---|---|
| `path` | `PathDefinition` | — | Path to run. Mutually exclusive with `engine`. |
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). Mutually exclusive with `path`. May be provided after mount (e.g. once an async `restoreOrStart()` resolves): the shell adopts it, re-subscribing and re-seeding from the new engine. Set `autoStart` to `false` if the shell should not start its own path in the meantime. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. Overridden by the stored snapshot when `restoreKey` is set. |
| `autoStart` | `boolean` | `true` | Start on mount. Ignored when `engine` is provided. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `validationDisplay` | `"summary" \| "inline" \| "both"` | `"summary"` | Where `fieldErrors` are rendered. Use `"inline"` so step components render their own errors. |
| `progressLayout` | `"merged" \| "split" \| "rootOnly" \| "activeOnly"` | `"merged"` | How the root and sub-path progress bars are arranged while a sub-path is active. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step paths. |
| `hideFooter` | `boolean` | `false` | Hide the footer (navigation buttons). The error panel is still shown on async failure. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `loadingLabel` | `string` | `undefined` | Label for the Next/Complete button while an async operation is in progress. When unset, the button keeps its label and shows a CSS spinner. |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `validateWhen` | `boolean` | `false` | When `true` (including already at mount), calls `validate()` on the engine so all steps show inline errors at once. Bind to the outer snapshot's `hasAttemptedNext` when this shell is nested inside a step of an outer shell. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. The stored value also carries the inner engine's serialized state, so a remount restores in place: no `onEnter` / `onLeave` re-run, attempted / visited state kept. |
| `services` | `unknown` | `null` | Arbitrary services object available to step components via `usePathContext<TData, TServices>().services`. |
| `oncomplete` | `(data: PathData) => void` | — | Called when the path finishes naturally. |
| `oncancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onevent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `header` | `Snippet<[PathSnapshot]>` | — | Replaces the default progress header. A custom header is shown even for single-step paths, and hidden under `hideProgress` or `layout="tabs"`. |
| `footer` | `Snippet<[PathSnapshot, PathShellActions]>` | — | Replaces the default navigation footer. `actions` contains `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`, `retry`, `suspend`. |
| `completion` | `Snippet<[PathSnapshot<any>]>` | — | Custom snippet rendered when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`). Receives the completed snapshot. If omitted, a default "All done." panel is shown. |

The component instance also exposes `restart()` for `bind:this` refs, which restarts the path with its original `initialData` without remounting.

> **Note:** Svelte requires event/callback props to be lowercase. Unlike React/Vue/Angular, passing `onComplete`, `onCancel`, or `onEvent` (camelCase) will be silently ignored. PathShell emits a `console.warn` in development if it detects one of these common mistakes.

You can also replace the built-in header and footer with custom snippets:

```svelte
<PathShell path={myPath}>
  {#snippet header(snap)}
    <p>Step {snap.stepIndex + 1} of {snap.stepCount}</p>
  {/snippet}

  {#snippet details()}<DetailsStep />{/snippet}

  {#snippet footer(snap, actions)}
    <button onclick={actions.previous} disabled={snap.isFirstStep}>Back</button>
    <button onclick={actions.next} disabled={!snap.canMoveNext}>
      {snap.isLastStep ? "Submit" : "Continue"}
    </button>
  {/snippet}
</PathShell>
```

## usePathContext

`usePathContext<TData>()` is the preferred way for step components rendered inside `<PathShell>` to access the path engine. `<PathShell>` calls `setContext()` internally with a private `Symbol` key; `usePathContext()` calls the matching `getContext()` and returns `snapshot` (typed `PathSnapshot | null` — narrow with `{#if ctx.snapshot}`), the navigation actions (`next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `resetStep`, `restart`, `retry`, `suspend`) and `services`; it does not expose `start`, `startSubPath` or `validate`. It throws a clear error if called outside a `<PathShell>` — do not use Svelte's raw `getContext()` directly, as the key is a private `Symbol` and will silently return `undefined`. The context is the full `usePath()` return type (`PathContext` extends `UsePathReturn`), so `start`, `startSubPath` and `validate` are available to step components too — for example to launch a sub-path from a button inside a step.

```svelte
<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";

  const ctx = usePathContext<ApplicationData>();
</script>

{#if ctx.snapshot}
  <input
    value={ctx.snapshot.data.name ?? ""}
    oninput={(e) => ctx.setData("name", e.currentTarget.value)}
  />
{/if}
```

## Other exports

| Export | Description |
|---|---|
| `bindData(getSnapshot, setData, key)` | Two-way binding helper for inputs. Returns an object with a reactive `value` getter (reads `getSnapshot()?.data[key]`) and a `set(value)` method that calls `setData(key, value)`. Example: `const name = bindData(() => path.snapshot, path.setData, "name")`, then `<input value={name.value} oninput={(e) => name.set(e.currentTarget.value)} />`. |
| `stepIdToCamelCase(id)` | Converts a hyphenated step ID to camelCase (`"cover-letter"` → `"coverLetter"`) — the conversion `<PathShell>` uses to resolve snippets for hyphenated step IDs. |
| `setPathContext(ctx)` | Sets the `PathContext` that `usePathContext()` reads, under the adapter's private `Symbol` key. Used internally by `<PathShell>`; only needed when building your own shell component. |
| `getPathContextOrNull()` | Reads the nearest ancestor `PathContext`, or `undefined` when there is none. Used internally by `<PathShell>` to reach the outer shell for `restoreKey`; call it before `setPathContext()` so it reads the parent rather than self. |
| `formatFieldKey`, `errorPhaseMessage` | Re-exported from `@daltonr/pathwrite-core` for building custom summaries and error panels. |

`PathEngine` is re-exported as a **type only**. To construct an engine, import the class from `@daltonr/pathwrite-core`.

## Further reading

- [Svelte getting started guide](../../docs/getting-started/frameworks/svelte.md)
- [Navigation & guards](../../docs/developer-guide/04-navigation.md)
- [Full documentation](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
