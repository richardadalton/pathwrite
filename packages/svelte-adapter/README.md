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
| `restart(definition, data?)` | `Promise<void>` | Tear down any active path and start fresh. |
| `next()` | `Promise<void>` | Advance one step. Completes on the last step. |
| `previous()` | `Promise<void>` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `Promise<void>` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `Promise<void>` | Jump to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `Promise<void>` | Update a single data field. Type-safe when `TData` is specified. |
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
| `engine` | `PathEngine` | — | Externally-managed engine (e.g. from `restoreOrStart()`). Mutually exclusive with `path`. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start on mount. Ignored when `engine` is provided. |
| `layout` | `"wizard" \| "form" \| "auto" \| "tabs"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"tabs"`: No progress header or footer — for tabbed interfaces. `"auto"` picks `"form"` for single-step paths. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step paths. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `validateWhen` | `boolean` | `false` | When it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when this shell is nested inside a step of an outer shell. |
| `restoreKey` | `string` | — | When set, the shell automatically saves its full state (data + active step) into the nearest outer `PathShell`'s data under this key on every change, and restores from it on remount. No-op on a top-level shell. |
| `services` | `unknown` | `null` | Arbitrary services object available to step components via `usePathContext<TData, TServices>().services`. |
| `oncomplete` | `(data: PathData) => void` | — | Called when the path finishes naturally. |
| `oncancel` | `(data: PathData) => void` | — | Called when the path is cancelled. |
| `onevent` | `(event: PathEvent) => void` | — | Called for every engine event. |
| `completion` | `Snippet<[PathSnapshot<any>]>` | — | Custom snippet rendered when `snapshot.status === "completed"` (`completionBehaviour: "stayOnFinal"`). Receives the completed snapshot. If omitted, a default "All done." panel is shown. |

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

`usePathContext<TData>()` is the preferred way for step components rendered inside `<PathShell>` to access the path engine. `<PathShell>` calls `setContext()` internally with a private `Symbol` key; `usePathContext()` calls the matching `getContext()` and returns the same interface as `usePath`. It throws a clear error if called outside a `<PathShell>` — do not use Svelte's raw `getContext()` directly, as the key is a private `Symbol` and will silently return `undefined`.

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

## Further reading

- [Svelte getting started guide](../../docs/getting-started/frameworks/svelte.md)
- [Navigation & guards](../../docs/guides/navigation.md)
- [Full documentation](../../docs/README.md)

---

© 2026 Devjoy Ltd. MIT License.
