# @pathwrite/core

Headless wizard engine with zero dependencies. Manages step navigation, navigation guards, lifecycle hooks, and stack-based sub-wizard orchestration.

## Key types

```typescript
// Define your wizard's data shape once
interface CourseArgs extends WizardArgs {
  courseName: string;
  subjects: SubjectEntry[];
}

const wizard: WizardDefinition<CourseArgs> = {
  id: "course-wizard",
  steps: [
    {
      id: "details",
      okToMoveNext: (ctx) => ctx.args.courseName.length > 0,
      onLeavingStep: (ctx) => ({ courseName: ctx.args.courseName.trim() })
    },
    { id: "review" }
  ]
};
```

| Type | Description |
|------|-------------|
| `WizardDefinition<TArgs>` | A wizard's ID, title, and ordered list of step definitions. |
| `WizardStepDefinition<TArgs>` | A single step: guards, lifecycle hooks. |
| `WizardStepContext<TArgs>` | Passed to every hook and guard. `args` is a **readonly snapshot copy** — return a patch to update state. |
| `WizardSnapshot<TArgs>` | Point-in-time read of the engine: step ID, index, count, flags, and a copy of args. |
| `WizardEngineEvent` | Union of `stateChanged`, `completed`, `cancelled`, and `resumed`. |

## WizardEngine API

```typescript
const engine = new WizardEngine();

engine.start(definition, initialArgs?);   // start or re-start a wizard
engine.startSubWizard(definition, args?); // push sub-wizard onto the stack (requires active wizard)
engine.moveNext();
engine.movePrevious();
engine.cancel();
engine.setArg(key, value);               // update a single arg; emits stateChanged
engine.getSnapshot();                     // returns WizardSnapshot | null

const unsubscribe = engine.subscribe((event) => { ... });
unsubscribe(); // remove the listener
```

## Lifecycle hooks

All hooks are optional. Hooks that want to update args **return a partial patch** — the engine applies it automatically. Direct mutation of `ctx.args` is a no-op; the context receives a copy.

| Hook | When called | Can return patch |
|------|-------------|-----------------|
| `onVisit` | On arrival at a step (start, next, previous, resume) | ✅ |
| `onLeavingStep` | On departure from a step (only when the guard allows) | ✅ |
| `onResumeFromSubWizard` | On the parent step when a sub-wizard finishes | ✅ |
| `okToMoveNext` | Before advancing — return `false` to block | — |
| `okToMovePrevious` | Before going back — return `false` to block | — |

### Example — sub-wizard result merged into parent args

```typescript
{
  id: "subjects-list",
  onResumeFromSubWizard: (_id, subArgs, ctx) => ({
    subjects: [...(ctx.args.subjects ?? []), { name: subArgs.name, teacher: subArgs.teacher }]
  })
}
```

## Sub-wizard flow

```
engine.start(mainWizard)        → stack: []         active: main
engine.startSubWizard(subWizard) → stack: [main]    active: sub
engine.moveNext()  // sub finishes
  → onResumeFromSubWizard fires on the parent step
  → stack: []                                       active: main
```

Cancelling a sub-wizard pops it off the stack silently — `onResumeFromSubWizard` is **not** called.

## Events

```typescript
engine.subscribe((event) => {
  switch (event.type) {
    case "stateChanged": // event.snapshot
    case "completed":    // event.wizardId, event.args
    case "cancelled":    // event.wizardId, event.args
    case "resumed":      // event.resumedWizardId, event.fromSubWizardId, event.snapshot
  }
});
```

