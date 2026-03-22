# @daltonr/pathwrite-svelte

Svelte adapter for [@daltonr/pathwrite-core](../core) — reactive stores with lifecycle hooks, guards, and optional `<PathShell>` default UI.

## Installation

```bash
npm install @daltonr/pathwrite-svelte
```

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
  
  $: snap = $snapshot;
</script>

{#if snap}
  <h2>{snap.steps[snap.stepIndex].title}</h2>
  
  {#if snap.stepId === 'details'}
    <input
      type="text"
      value={snap.data.name || ''}
      on:input={(e) => setData('name', e.currentTarget.value)}
      placeholder="Name"
    />
    <input
      type="email"
      value={snap.data.email || ''}
      on:input={(e) => setData('email', e.currentTarget.value)}
      placeholder="Email"
    />
  {:else if snap.stepId === 'review'}
    <p>Name: {snap.data.name}</p>
    <p>Email: {snap.data.email}</p>
  {/if}
  
  <button on:click={previous} disabled={snap.isFirstStep || snap.isNavigating}>
    Previous
  </button>
  <button on:click={next} disabled={!snap.canMoveNext || snap.isNavigating}>
    {snap.isLastStep ? 'Complete' : 'Next'}
  </button>
{/if}
```

### Option 2: Use `<PathShell>` component

```svelte
<script lang="ts">
  import PathShell from '@daltonr/pathwrite-svelte/PathShell.svelte';
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
  onComplete={handleComplete}
>
  <DetailsForm slot="details" />
  <ReviewPanel slot="review" />
</PathShell>
```

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
| `path` | `PathDefinition` | *required* | Path definition |
| `engine` | `PathEngine` | `undefined` | External engine |
| `initialData` | `PathData` | `{}` | Initial data |
| `autoStart` | `boolean` | `true` | Auto-start on mount |
| `backLabel` | `string` | `"Previous"` | Previous button label |
| `nextLabel` | `string` | `"Next"` | Next button label |
| `completeLabel` | `string` | `"Complete"` | Complete button label |
| `cancelLabel` | `string` | `"Cancel"` | Cancel button label |
| `hideCancel` | `boolean` | `false` | Hide cancel button |
| `hideProgress` | `boolean` | `false` | Hide progress indicator |

#### Callbacks

| Callback | Type | Description |
|----------|------|-------------|
| `onComplete` | `(data) => void` | Called when path completes |
| `onCancel` | `(data) => void` | Called when path is cancelled |
| `onEvent` | `(event) => void` | Called for every event |

#### Slots

| Slot | Props | Description |
|------|-------|-------------|
| `{stepId}` | `snapshot` | Step content (use step ID as slot name) |
| `header` | `snapshot` | Custom header/progress |
| `footer` | `snapshot`, `actions` | Custom footer/navigation |

### `getPathContext<TData>()`

Get the path context from a parent `<PathShell>`. Use this inside step components.

```svelte
<script lang="ts">
  import { getPathContext } from '@daltonr/pathwrite-svelte';
  
  const { snapshot, next, setData } = getPathContext();
  
  let name = '';
  $: if ($snapshot) name = $snapshot.data.name || '';
</script>

<input bind:value={name} on:input={() => setData('name', name)} />
<button on:click={next}>Next</button>
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
  import { usePath } from '@daltonr/pathwrite-svelte';
  import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';
  
  const store = new HttpStore({ baseUrl: '/api/wizard' });
  let engineReady = false;
  let pathEngine;
  
  onMount(async () => {
    const { engine } = await restoreOrStart({
      store,
      key: 'user:123:signup',
      path: signupPath,
      initialData: { name: '', email: '' },
      observers: [
        httpPersistence({ store, key: 'user:123:signup', strategy: 'onNext' })
      ]
    });
    pathEngine = engine;
    engineReady = true;
  });
  
  $: if (engineReady) {
    const { snapshot } = usePath({ engine: pathEngine });
  }
</script>
```

## Custom UI with Slots

Override default rendering:

```svelte
<PathShell path={myPath} initialData={{}}>
  <!-- Step content -->
  <StepA slot="stepA" />
  <StepB slot="stepB" />
  
  <!-- Custom header -->
  <div slot="header" let:snapshot>
    <h2>Step {snapshot.stepIndex + 1} of {snapshot.stepCount}</h2>
  </div>
  
  <!-- Custom footer -->
  <div slot="footer" let:snapshot let:actions>
    <button on:click={actions.previous} disabled={snapshot.isFirstStep}>
      ← Back
    </button>
    <button on:click={actions.next} disabled={!snapshot.canMoveNext}>
      {snapshot.isLastStep ? 'Finish' : 'Continue →'}
    </button>
  </div>
</PathShell>
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

MIT

## See Also

- [@daltonr/pathwrite-core](../core) - Core engine
- [@daltonr/pathwrite-store-http](../store-http) - HTTP persistence
- [Documentation](../../docs/guides/DEVELOPER_GUIDE.md)

