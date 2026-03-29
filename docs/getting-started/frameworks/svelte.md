# Getting Started — Svelte

Pathwrite's Svelte adapter uses Svelte 5 runes (`$state`, `$derived`, `$props`) and snippets (`{#snippet}`, `{@render}`). There are no Svelte stores (`writable`, `readable`) — the `$state` rune replaces them entirely. There is no RxJS dependency.

> **Requires Svelte 5.** The adapter does not support Svelte 4 or earlier.

## Installation

```bash
npm install @daltonr/pathwrite-svelte
```

The `@daltonr/pathwrite-core` peer dependency is bundled into the adapter — you do not need to install it separately.

---

## `usePath()` — function

Creates an isolated path engine instance. The adapter unsubscribes from the engine when the component is destroyed via `onDestroy` — no manual cleanup needed.

### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | An externally-managed engine (e.g. from `restoreOrStart()`). When provided, `usePath` subscribes to it instead of creating a new one. The caller owns the engine's lifecycle. |
| `onEvent` | `(event: PathEvent) => void` | Called for every engine event. |

### Return value

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `PathSnapshot \| null` | Reactive getter backed by `$state`. Re-evaluates on every state change. `null` when no path is active. |
| `start(definition, data?)` | `Promise<void>` | Start or restart a path. |
| `startSubPath(definition, data?, meta?)` | `Promise<void>` | Push a sub-path. `meta` is returned unchanged to `onSubPathComplete` / `onSubPathCancel` on the parent step. |
| `next()` | `Promise<void>` | Advance one step. Completes the path on the last step. |
| `previous()` | `Promise<void>` | Go back one step. No-op on the first step of a top-level path. |
| `cancel()` | `Promise<void>` | Cancel the active path (or sub-path). |
| `goToStep(stepId)` | `Promise<void>` | Jump directly to a step by ID. Calls `onLeave`/`onEnter`; bypasses guards and `shouldSkip`. |
| `goToStepChecked(stepId)` | `Promise<void>` | Jump to a step by ID, checking the current step's guard first. |
| `setData(key, value)` | `Promise<void>` | Update a single data value. When `TData` is specified, `key` and `value` are type-checked against your data shape. |
| `restart(definition, data?)` | `Promise<void>` | Tear down any active path (without firing hooks) and start fresh. Safe to call at any time. |

### Gotcha — do not destructure `snapshot`

The `snapshot` property is a reactive getter backed by a `$state` rune. Destructuring it captures the current value at that moment and loses reactivity — the variable will never update.

```svelte
<script lang="ts">
  import { usePath } from "@daltonr/pathwrite-svelte";

  const path = usePath();

  // ✅ Reactive — re-evaluates on every state change
  // Access as path.snapshot throughout the template.

  // ❌ Not reactive — captured once at construction time
  // const { snapshot } = usePath();
</script>

{#if path.snapshot}
  <h2>{path.snapshot.stepTitle ?? path.snapshot.stepId}</h2>
{/if}
```

---

## `usePathContext()` — accessing state inside step components

Step components rendered inside `<PathShell>` snippets call `usePathContext()` to access the same engine instance. `<PathShell>` calls `setContext()` internally with a private `Symbol` key; `usePathContext()` calls the matching `getContext()`.

```svelte
<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";

  const ctx = usePathContext<ApplicationData>();
</script>

{#if ctx.snapshot}
  <input
    value={ctx.snapshot.data.firstName ?? ""}
    oninput={(e) => ctx.setData("firstName", e.currentTarget.value)}
  />
{/if}
```

`usePathContext()` throws a clear error if called outside a `<PathShell>`.

> **Use `usePathContext()`, not raw `getContext()`.** The context key is a private `Symbol`, so calling Svelte's `getContext()` directly with a string key will silently return `undefined`. Always use `usePathContext()` from `@daltonr/pathwrite-svelte`.

---

## `<PathShell>` — default UI component

`<PathShell>` renders a progress indicator, step content area, validation messages, and navigation buttons. You supply per-step content as **Svelte 5 snippets** whose names match each step's ID.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | — | The path to run. Pass `path` for simple wizards where the shell manages the engine. |
| `engine` | `PathEngine` | — | An externally-managed engine (e.g. from `restoreOrStart()` for persistence). Mutually exclusive with `path`. |
| `initialData` | `PathData` | `{}` | Initial data passed to `engine.start()`. |
| `autoStart` | `boolean` | `true` | Start the path automatically on mount. Ignored when `engine` is provided. |
| `backLabel` | `string` | `"Previous"` | Previous button label. |
| `nextLabel` | `string` | `"Next"` | Next button label. |
| `completeLabel` | `string` | `"Complete"` | Complete button label (last step). |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label. |
| `hideCancel` | `boolean` | `false` | Hide the Cancel button. |
| `hideProgress` | `boolean` | `false` | Hide the progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back. `"auto"` picks `"form"` for single-step paths. |

### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `oncomplete` | `(data: PathData) => void` | Called when the path completes. |
| `oncancel` | `(data: PathData) => void` | Called when the path is cancelled. |
| `onevent` | `(event: PathEvent) => void` | Called for every engine event. |

### Snippets

Step content is provided as Svelte 5 snippets passed as children of `<PathShell>`. The snippet name must match the step ID exactly:

```svelte
<PathShell path={myPath}>
  {#snippet details()}
    <DetailsStep />
  {/snippet}
  {#snippet review()}
    <ReviewStep />
  {/snippet}
</PathShell>
```

You can also replace the header and footer with custom snippets:

```svelte
<PathShell path={myPath}>
  {#snippet header(snap)}
    <p>Step {snap.stepIndex + 1} of {snap.stepCount} — {snap.stepTitle}</p>
  {/snippet}

  {#snippet details()}
    <DetailsStep />
  {/snippet}

  {#snippet footer(snap, actions)}
    <button onclick={actions.previous} disabled={snap.isFirstStep}>
      Back
    </button>
    <button onclick={actions.next} disabled={!snap.canMoveNext}>
      {snap.isLastStep ? "Submit" : "Continue"}
    </button>
  {/snippet}
</PathShell>
```

`actions` contains: `next`, `previous`, `cancel`, `goToStep`, `goToStepChecked`, `setData`, `restart`.

---

## Gotcha — camelCase fallback for hyphenated step IDs

Svelte snippet names must be valid JavaScript identifiers, so they cannot contain hyphens. If your workflow uses a hyphenated step ID such as `"cover-note"`, you cannot write `{#snippet cover-note()}`.

`<PathShell>` handles this automatically: it first looks for a snippet matching the exact step ID, and if it finds nothing it converts the ID to camelCase and checks again. So `"cover-note"` falls back to `"coverNote"`, and `"personal-info"` falls back to `"personalInfo"`.

```svelte
<!-- Path has a step with id="cover-note" -->
<PathShell path={myPath}>
  {#snippet coverNote()}      <!-- camelCase — resolved automatically -->
    <CoverNoteStep />
  {/snippet}
</PathShell>
```

If `<PathShell>` cannot find a snippet under either the exact ID or the camelCase form, it renders `No content for step "cover-note"` and fires a `console.warn` in development to help you diagnose the mismatch.

The rule is simple: if your step ID is hyphenated, pass the camelCase snippet name. If it is already a valid identifier (no hyphens), the snippet name and step ID must match exactly.

---

## Styling

`<PathShell>` ships with no embedded styles. Import the optional stylesheet:

```ts
import "@daltonr/pathwrite-svelte/styles.css";
```

All visual values are CSS custom properties:

```css
:root {
  --pw-color-primary: #8b5cf6;
  --pw-shell-radius: 12px;
}
```

---

## Complete example

A two-step job-application form. The first step collects personal details with `fieldErrors` validation. The second step (a hyphenated ID `"cover-note"`) uses `usePathContext()` and is provided as the camelCase snippet `coverNote`.

```ts
// application-path.ts
import type { PathDefinition, PathData } from "@daltonr/pathwrite-svelte";

export interface ApplicationData extends PathData {
  firstName: string;
  email: string;
  coverNote: string;
}

export const applicationPath: PathDefinition<ApplicationData> = {
  id: "job-application",
  steps: [
    {
      id: "details",
      title: "Your Details",
      fieldErrors: ({ data }) => ({
        firstName: (data.firstName ?? "").trim().length < 2
          ? "First name must be at least 2 characters."
          : undefined,
        email: !(data.email ?? "").includes("@")
          ? "A valid email address is required."
          : undefined,
      }),
    },
    {
      id: "cover-note",   // hyphenated ID — snippet name must be "coverNote"
      title: "Cover Note",
      fieldErrors: ({ data }) => ({
        coverNote: (data.coverNote ?? "").trim().length < 20
          ? "Cover note must be at least 20 characters."
          : undefined,
      }),
    },
  ],
};
```

```svelte
<!-- DetailsStep.svelte — step component uses usePathContext -->
<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "./application-path";

  const ctx = usePathContext<ApplicationData>();
</script>

{#if ctx.snapshot}
  <div>
    <label for="firstName">First name</label>
    <input
      id="firstName"
      value={ctx.snapshot.data.firstName ?? ""}
      oninput={(e) => ctx.setData("firstName", e.currentTarget.value)}
    />
    {#if ctx.snapshot.hasAttemptedNext && ctx.snapshot.fieldErrors.firstName}
      <p class="error">{ctx.snapshot.fieldErrors.firstName}</p>
    {/if}
  </div>
  <div>
    <label for="email">Email</label>
    <input
      id="email"
      type="email"
      value={ctx.snapshot.data.email ?? ""}
      oninput={(e) => ctx.setData("email", e.currentTarget.value)}
    />
    {#if ctx.snapshot.hasAttemptedNext && ctx.snapshot.fieldErrors.email}
      <p class="error">{ctx.snapshot.fieldErrors.email}</p>
    {/if}
  </div>
{/if}
```

```svelte
<!-- CoverNoteStep.svelte -->
<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ApplicationData } from "./application-path";

  const ctx = usePathContext<ApplicationData>();
</script>

{#if ctx.snapshot}
  <label for="coverNote">Cover note</label>
  <textarea
    id="coverNote"
    rows="6"
    value={ctx.snapshot.data.coverNote ?? ""}
    oninput={(e) => ctx.setData("coverNote", e.currentTarget.value)}
    placeholder="Tell us why you're a great fit..."
  ></textarea>
  {#if ctx.snapshot.hasAttemptedNext && ctx.snapshot.fieldErrors.coverNote}
    <p class="error">{ctx.snapshot.fieldErrors.coverNote}</p>
  {/if}
{/if}
```

```svelte
<!-- JobApplicationFlow.svelte — host component -->
<script lang="ts">
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import "@daltonr/pathwrite-svelte/styles.css";
  import { applicationPath } from "./application-path";
  import DetailsStep from "./DetailsStep.svelte";
  import CoverNoteStep from "./CoverNoteStep.svelte";

  function handleComplete(data) {
    console.log("Application submitted:", data);
  }
</script>

<PathShell
  path={applicationPath}
  initialData={{ firstName: "", email: "", coverNote: "" }}
  oncomplete={handleComplete}
>
  {#snippet details()}
    <DetailsStep />
  {/snippet}

  <!--
    Step ID is "cover-note". Svelte snippets can't contain hyphens,
    so PathShell falls back to the camelCase form "coverNote" automatically.
    A console.warn fires during development if neither form is found.
  -->
  {#snippet coverNote()}
    <CoverNoteStep />
  {/snippet}
</PathShell>
```

**What this demonstrates:**

- `fieldErrors` on each step with auto-derived `canMoveNext`.
- `snapshot.hasAttemptedNext` gates inline error display.
- `usePathContext()` inside step components — provided automatically by `<PathShell>`.
- The camelCase fallback: step ID `"cover-note"` resolved via snippet name `coverNote`.

---

## Resetting the path

**Option 1 — Toggle mount** (simplest):

```svelte
<script>
  let isActive = $state(true);
</script>

{#if isActive}
  <PathShell path={myPath} oncomplete={() => (isActive = false)}>
    {#snippet details()}<DetailsStep />{/snippet}
  </PathShell>
{:else}
  <button onclick={() => (isActive = true)}>Try Again</button>
{/if}
```

**Option 2 — `bind:this` + `restart()`** (in-place, no unmount):

```svelte
<script>
  let shellRef;
</script>

<PathShell bind:this={shellRef} path={myPath} oncomplete={onDone}>
  {#snippet details()}<DetailsStep />{/snippet}
</PathShell>

<button onclick={() => shellRef.restart()}>Start Over</button>
```

`restart()` resets to step 1 with the original `initialData` without unmounting the component.

© 2026 Devjoy Ltd. MIT License.
