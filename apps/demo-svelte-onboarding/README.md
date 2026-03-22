# Pathwrite Svelte Onboarding Demo

A complete onboarding wizard built with **Svelte** and **Pathwrite**, showcasing:

✅ Multi-step form with validation  
✅ Auto-persistence with HTTP store  
✅ Progress restoration after page refresh  
✅ Type-safe data binding  
✅ PathShell component for rapid UI  
✅ Conditional logic and guards  

## Features Demonstrated

### 1. **PathShell Component**
The demo uses Pathwrite's Svelte `PathShell` component which provides:
- Progress indicator
- Step navigation (Next/Previous buttons)
- Automatic validation display
- Step content slots

### 2. **Auto-Persistence**
Uses `@daltonr/pathwrite-store-http` to automatically save wizard state:
- Strategy: `onNext` (saves after each successful step transition)
- Users can close the browser and resume exactly where they left off
- Restore banner appears when previous progress is detected

### 3. **Validation & Guards**
Each step has:
- `canMoveNext` guards to prevent navigation with invalid data
- `validationMessages` to show specific error messages
- Real-time form validation

### 4. **Step Components**
- **Personal Info**: Name and email with validation
- **Preferences**: Role selection and multi-select interests
- **Additional Info**: Optional bio and notification toggle
- **Review**: Summary of all entered data

## Running the Demo

### Prerequisites
1. Start the API server (handles persistence):
   ```bash
   cd apps/demo-api-server
   npm install
   npm start
   # Runs on http://localhost:3001
   ```

2. Install dependencies and start the Svelte app:
   ```bash
   cd apps/demo-svelte-onboarding
   npm install
   npm run dev
   # Opens on http://localhost:5174
   ```

## Code Highlights

### Using PathShell

```svelte
<script>
  import PersonalStep from './PersonalStep.svelte';
  import PreferencesStep from './PreferencesStep.svelte';
  // ... more imports
</script>

<PathShell {engine} oncomplete={handleComplete}>
  {#snippet personal()}
    <PersonalStep />
  {/snippet}
  {#snippet preferences()}
    <PreferencesStep />
  {/snippet}
  {#snippet additional()}
    <AdditionalStep />
  {/snippet}
  {#snippet review()}
    <ReviewStep />
  {/snippet}
</PathShell>
```

Each step is a Svelte 5 snippet whose name matches the step ID. PathShell collects them automatically and renders the active one.

### Path Context in Step Components

Step components access the path context using `getPathContext()`:

```svelte
<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';
  
  const { snapshot, setData } = getPathContext();
  
  let data = $derived($snapshot?.data || {});
  
  function updateField(field, value) {
    setData(field, value);
  }
</script>
```

> ⚠️ **Always use `getPathContext()`** — not Svelte's raw `getContext()`. See the [adapter README](../../packages/svelte-adapter/README.md) for details.

### Creating Persisted Engine

```javascript
import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';

const store = new HttpStore({ baseUrl: 'http://localhost:3001/api/wizard' });
const key = 'demo-user:onboarding';

const result = await restoreOrStart({
  store,
  key,
  path: onboardingWizard,
  initialData,
  observers: [
    httpPersistence({ 
      store, 
      key, 
      strategy: 'onNext'
    })
  ]
});

engine = result.engine;
wasRestored = result.restored; // true if state was loaded from server
```

## Try It Out

1. **Fill out the first step** and click Next
2. **Close the browser tab**
3. **Reopen** http://localhost:5174
4. **See the restore banner** — you're exactly where you left off!

## Architecture

```
App.svelte
  ├─ Creates engine with restoreOrStart()
  ├─ PathShell (Pathwrite component)
  │   ├─ PersonalStep.svelte
  │   ├─ PreferencesStep.svelte
  │   ├─ AdditionalStep.svelte
  │   └─ ReviewStep.svelte
  └─ Completion screen
```

## Learning Resources

- [Pathwrite Documentation](../../docs/README.md)
- [Svelte Adapter Guide](../../packages/svelte-adapter/README.md)
- [HTTP Store Documentation](../../packages/store-http/README.md)

## Customization

### Styling
The demo uses Pathwrite's CSS variables for theming:

```css
:root {
  --pw-color-primary: #4f46e5;
  --pw-color-primary-hover: #4338ca;
  --pw-shell-radius: 12px;
  --pw-shell-padding: 1.5rem;
}
```

### Persistence Strategy
Change the strategy when creating the observer:

```javascript
observers: [
  httpPersistence({ 
    store, 
    key, 
    strategy: 'onNext'        // Save after successful next()
  })
]

// Other strategies:
strategy: 'onEveryChange' // Save on every setData() (use with debounce)
strategy: 'onComplete'    // Save only when wizard completes
```

### Validation
Customize validation in `wizard.ts`:

```typescript
canMoveNext: ({ data }) => 
  data.name?.length > 0 && data.email?.includes('@'),
  
validationMessages: ({ data }) => {
  const messages = [];
  if (!data.name) messages.push("Name is required");
  if (!data.email?.includes('@')) messages.push("Valid email required");
  return messages;
}
```

## What's Next?

This demo shows the basics. Pathwrite can handle:
- Conditional step skipping (`shouldSkip`)
- Sub-paths for drill-down workflows
- Async lifecycle hooks
- Jump-to-step navigation
- Complex validation logic
- Backend workflows (no UI needed)

See the [Beyond Wizards guide](../../docs/guides/BEYOND_WIZARDS.md) for more advanced patterns!

