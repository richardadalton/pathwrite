# @daltonr/pathwrite-svelte

Svelte 5 adapter for [@daltonr/pathwrite-core](../core) — reactive stores with lifecycle hooks, guards, and optional `<PathShell>` default UI.

## Installation

```bash
npm install @daltonr/pathwrite-svelte
```

> **Requires Svelte 5.** This adapter uses runes (`$props`, `$derived`, `$state`) and snippets (`{#snippet}`, `{@render}`).

## Quick Start

### Option 1: Use `usePath()` with custom UI

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { usePath } from '@daltonr/pathwrite-svelte';
  
  const { snapshot, start, next, previous, setData } = usePath();
  
  const myPath = {
    id: 'signup',
    steps: [
      { id: 'details', title: 'Your Details' },
      { id: 'review', title: 'Review' }
    ]
  };
  
  onMount(() => {
    start(myPath, { name: '', email: '' });
  });
  
  let snap = $derived($snapshot);
</script>

{#if snap}
  <h2>{snap.steps[snap.stepIndex].title}</h2>
  
  {#if snap.stepId === 'details'}
    <input
      type="text"
      value={snap.data.name || ''}
      oninput={(e) => setData('name', e.currentTarget.value)}
      placeholder="Name"
    />
    <input
      type="email"
      value={snap.data.email || ''}
      oninput={(e) => setData('email', e.currentTarget.value)}
      placeholder="Email"
    />
  {:else if snap.stepId === 'review'}
    <p>Name: {snap.data.name}</p>
    <p>Email: {snap.data.email}</p>
  {/if}
  
  <button onclick={previous} disabled={snap.isFirstStep || snap.isNavigating}>
    Previous
  </button>
  <button onclick={next} disabled={!snap.canMoveNext || snap.isNavigating}>
    {snap.isLastStep ? 'Complete' : 'Next'}
  </button>
{/if}
```

### Option 2: Use `<PathShell>` with snippets

```svelte
<script lang="ts">
  import { PathShell } from '@daltonr/pathwrite-svelte';
  import '@daltonr/pathwrite-svelte/styles.css';
  
  import DetailsForm from './DetailsForm.svelte';
  import ReviewPanel from './ReviewPanel.svelte';
  
  const signupPath = {
    id: 'signup',
    steps: [
      { id: 'details', title: 'Your Details' },
      { id: 'review', title: 'Review' }
    ]
  };
  
  function handleComplete(data) {
    console.log('Completed!', data);
  }
</script>

<PathShell
  path={signupPath}
  initialData={{ name: '', email: '' }}
  oncomplete={handleComplete}
>
  {#snippet details()}
    <DetailsForm />
  {/snippet}
  {#snippet review()}
    <ReviewPanel />
  {/snippet}
</PathShell>
```

Each step is a **Svelte 5 snippet** whose name matches the step ID. PathShell collects them automatically and renders the active one.

> **⚠️ Important: Snippet Names Must Match Step IDs**
>
> When passing step content to `<PathShell>`, each snippet's name **must exactly match** the corresponding step's `id`:
>
> ```typescript
> const myPath = {
>   id: 'signup',
>   steps: [
>     { id: 'details' },  // ← Step ID
>     { id: 'review' }    // ← Step ID
>   ]
> };
> ```
>
> ```svelte
> <PathShell path={myPath}>
>   {#snippet details()}  <!-- ✅ Matches "details" step -->
>     <DetailsForm />
>   {/snippet}
>   {#snippet review()}   <!-- ✅ Matches "review" step -->
>     <ReviewPanel />
>   {/snippet}
>   {#snippet foo()}      <!-- ❌ No step with id "foo" -->
>     <FooPanel />
>   {/snippet}
> </PathShell>
> ```
>
> If a snippet name doesn't match any step ID, PathShell will render:  
> **`No content for step "foo"`**
>
> **💡 Tip:** Use your IDE's "Go to Definition" on the step ID in your path definition, then copy-paste the exact string when creating the snippet. This ensures perfect matching and avoids typos.

---

## Simple vs Persisted

PathShell supports two modes. Pick the one that fits your use case:

### Simple — PathShell manages the engine

Pass `path` and `initialData`. PathShell creates and starts the engine for you:

```svelte
<PathShell
  path={signupPath}
  initialData={{ name: '' }}
  oncomplete={handleComplete}
>
  {#snippet details()}
    <DetailsForm />
  {/snippet}
</PathShell>
```

**Use this when:** you don't need persistence, restoration, or custom observers. Quick prototypes, simple forms, one-off wizards.

### Persisted — you create the engine

Create the engine yourself with `restoreOrStart()` and pass it via `engine`. PathShell subscribes to it but does not start or own it:

```svelte
<script>
  import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';

  let engine = $state(null);

  onMount(async () => {
    const result = await restoreOrStart({
      store: new HttpStore({ baseUrl: '/api/wizard' }),
      key: 'user:onboarding',
      path: signupPath,
      initialData: { name: '' },
      observers: [
        httpPersistence({ store, key: 'user:onboarding', strategy: 'onNext' })
      ]
    });
    engine = result.engine;
  });
</script>

{#if engine}
  <PathShell {engine} oncomplete={handleComplete}>
    {#snippet details()}
      <DetailsForm />
    {/snippet}
  </PathShell>
{/if}
```

**Use this when:** you need auto-persistence, restore-on-reload, or custom observers. Production apps, checkout flows, anything where losing progress matters.

> **Don't pass both.** `path` and `engine` are mutually exclusive. If you pass `engine`, PathShell will not call `start()` — it assumes the engine is already running.

---

## ⚠️ Step Components Must Use `getPathContext()`

Step components rendered inside `<PathShell>` access the path engine via `getPathContext()` — **not** Svelte's raw `getContext()`.

```svelte
<script lang="ts">
  // ✅ Correct — always use getPathContext()
  import { getPathContext } from '@daltonr/pathwrite-svelte';
  const { snapshot, setData } = getPathContext();

  // ❌ Wrong — this will silently return undefined
  // import { getContext } from 'svelte';
  // const { snapshot, setData } = getContext('pathContext');
</script>

{#if $snapshot}
  <input
    value={$snapshot.data.name || ''}
    oninput={(e) => setData('name', e.currentTarget.value)}
  />
{/if}
```

`getPathContext()` uses a `Symbol` key internally and throws a clear error if called outside a `<PathShell>`. Using `getContext()` with a string key will fail silently.

---

## API

### `usePath<TData>(options?)`

Create a Pathwrite engine with Svelte store bindings. Returns reactive stores and action methods.

```typescript
const {
  snapshot,    // Readable<PathSnapshot | null>
  start,       // (path, initialData?) => Promise<void>
  next,        // () => Promise<void>
  previous,    // () => Promise<void>
  cancel,      // () => Promise<void>
  setData,     // (key, value) => Promise<void>
  // ... more actions
} = usePath();
```

#### Options

| Option | Type | Description |
|--------|------|-------------|
| `engine` | `PathEngine` | External engine (e.g., from `restoreOrStart()`) |
| `onEvent` | `(event) => void` | Called for every engine event |

#### Returns

| Property | Type | Description |
|----------|------|-------------|
| `snapshot` | `Readable<PathSnapshot \| null>` | Current path state (reactive store) |
| `start` | `function` | Start a path |
| `startSubPath` | `function` | Launch a sub-path |
| `next` | `function` | Go to next step |
| `previous` | `function` | Go to previous step |
| `cancel` | `function` | Cancel the path |
| `goToStep` | `function` | Jump to step by ID |
| `goToStepChecked` | `function` | Jump with guard checks |
| `setData` | `function` | Update data |
| `restart` | `function` | Restart the path |

### `<PathShell>`

Default UI shell with progress indicator and navigation buttons.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `path` | `PathDefinition` | — | Path definition (for self-managed engine) |
| `engine` | `PathEngine` | — | External engine (for persistence — see below) |
| `initialData` | `PathData` | `{}` | Initial data |
| `autoStart` | `boolean` | `true` | Auto-start on mount |
| `backLabel` | `string` | `"Previous"` | Previous button label |
| `nextLabel` | `string` | `"Next"` | Next button label |
| `completeLabel` | `string` | `"Complete"` | Complete button label |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label |
| `hideCancel` | `boolean` | `false` | Hide cancel button |
| `hideProgress` | `boolean` | `false` | Hide progress indicator. Also hidden automatically for single-step top-level paths. |
| `footerLayout` | `"wizard" \| "form" \| "auto"` | `"auto"` | Footer button layout. `"auto"` uses `"form"` for single-step top-level paths, `"wizard"` otherwise. `"wizard"`: Back on left, Cancel+Submit on right. `"form"`: Cancel on left, Submit on right, no Back button. |

> **`path` vs `engine`:** Pass `path` for simple wizards where PathShell manages the engine. Pass `engine` when you create the engine yourself (e.g., via `restoreOrStart()` for persistence). These are mutually exclusive — don't pass both.

#### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `oncomplete` | `(data) => void` | Called when path completes |
| `oncancel` | `(data) => void` | Called when path is cancelled |
| `onevent` | `(event) => void` | Called for every event |

#### Snippets

Step content is provided as Svelte 5 snippets. The snippet name must match the step ID:

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

You can also override the header and footer:

```svelte
<PathShell path={myPath}>
  {#snippet header(snap)}
    <h2>Step {snap.stepIndex + 1} of {snap.stepCount}</h2>
  {/snippet}

  {#snippet details()}
    <DetailsStep />
  {/snippet}

  {#snippet footer(snap, actions)}
    <button onclick={actions.previous} disabled={snap.isFirstStep}>
      ← Back
    </button>
    <button onclick={actions.next} disabled={!snap.canMoveNext}>
      {snap.isLastStep ? 'Finish' : 'Continue →'}
    </button>
  {/snippet}
</PathShell>
```

#### Resetting the path

There are two ways to reset `<PathShell>` to step 1.

**Option 1 — Toggle mount** (simplest, always correct)

Toggle a `$state` rune to destroy and recreate the shell:

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

**Option 2 — Call `restart()` on the shell ref** (in-place, no unmount)

Use `bind:this` to get a reference to the shell instance, then call `restart()`:

```svelte
<script>
  let shellRef;
</script>

<PathShell bind:this={shellRef} path={myPath} oncomplete={onDone}>
  {#snippet details()}<DetailsStep />{/snippet}
</PathShell>

<button onclick={() => shellRef.restart()}>Try Again</button>
```

`restart()` resets the path engine to step 1 with the original `initialData` without unmounting the component. Use this when you need to keep the shell mounted — for example, to preserve scroll position or drive a CSS transition.

### `getPathContext<TData>()`

Get the path context from a parent `<PathShell>`. Use this inside step components.

```svelte
<script lang="ts">
  import { getPathContext } from '@daltonr/pathwrite-svelte';
  
  const { snapshot, next, setData } = getPathContext();
</script>

{#if $snapshot}
  <input
    value={$snapshot.data.name || ''}
    oninput={(e) => setData('name', e.currentTarget.value)}
  />
  <button onclick={next}>Next</button>
{/if}
```

### `bindData(snapshot, setData, key)`

Helper to create a two-way binding store.

```svelte
<script lang="ts">
  import { usePath, bindData } from '@daltonr/pathwrite-svelte';
  
  const { snapshot, setData } = usePath();
  const name = bindData(snapshot, setData, 'name');
</script>

<input bind:value={$name} />
```

## PathSnapshot

The `snapshot` store contains the current path state:

```typescript
interface PathSnapshot {
  pathId: string;
  stepId: string;
  stepIndex: number;
  stepCount: number;
  data: PathData;
  nestingLevel: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canMoveNext: boolean;
  canMovePrevious: boolean;
  isNavigating: boolean;
  progress: number;  // 0-1
  steps: Array<{ id: string; title?: string; status: 'completed' | 'current' | 'upcoming' }>;
  validationMessages: string[];
}
```

Access it via the store: `$snapshot`

## Guards and Hooks

Define validation and lifecycle logic in your path definition:

```typescript
const myPath = {
  id: 'signup',
  steps: [
    {
      id: 'details',
      canMoveNext: (ctx) => ctx.data.name && ctx.data.email,
      validationMessages: (ctx) => {
        const errors = [];
        if (!ctx.data.name) errors.push('Name is required');
        if (!ctx.data.email) errors.push('Email is required');
        return errors;
      },
      onEnter: (ctx) => {
        console.log('Entered details step');
      },
      onLeave: (ctx) => {
        console.log('Leaving details step');
      }
    },
    { id: 'review' }
  ]
};
```

## Persistence

Use with [@daltonr/pathwrite-store-http](../store-http) for automatic state persistence:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { PathShell } from '@daltonr/pathwrite-svelte';
  import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';
  import DetailsForm from './DetailsForm.svelte';
  import ReviewPanel from './ReviewPanel.svelte';
  
  const store = new HttpStore({ baseUrl: '/api/wizard' });
  const key = 'user:123:signup';
  
  let engine = $state(null);
  let restored = $state(false);
  
  onMount(async () => {
    const result = await restoreOrStart({
      store,
      key,
      path: signupPath,
      initialData: { name: '', email: '' },
      observers: [
        httpPersistence({ store, key, strategy: 'onNext' })
      ]
    });
    engine = result.engine;
    restored = result.restored;
  });
</script>

{#if engine}
  <PathShell {engine} oncomplete={(data) => console.log('Done!', data)}>
    {#snippet details()}
      <DetailsForm />
    {/snippet}
    {#snippet review()}
      <ReviewPanel />
    {/snippet}
  </PathShell>
{/if}
```

## TypeScript

Type your path data for full type safety:

```typescript
interface SignupData {
  name: string;
  email: string;
  age: number;
}

const { snapshot, setData } = usePath<SignupData>();

// ✅ Type-checked
setData('name', 'John');

// ❌ Type error
setData('invalid', 'value');
```

## License

MIT — © 2026 Devjoy Ltd.

## See Also

- [@daltonr/pathwrite-core](../core) - Core engine
- [@daltonr/pathwrite-store-http](../store-http) - HTTP persistence
- [Documentation](../../docs/guides/DEVELOPER_GUIDE.md)


---

© 2026 Devjoy Ltd. MIT License.

