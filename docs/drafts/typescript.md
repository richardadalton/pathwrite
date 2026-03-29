# TypeScript Generics

Pathwrite is fully generic. The `TData` type parameter flows from `PathDefinition` through hooks, guards, `setData`, and the snapshot so that your path definitions, step logic, and UI components all share the same typed data shape without manual type assertions.

---

## Defining the data interface

Extend `PathData` to define the shape of your path's data:

```typescript
import { PathData, PathDefinition } from "@daltonr/pathwrite-core";

interface CourseData extends PathData {
  courseName: string;
  subjects: Array<{ name: string; teacher: string }>;
}
```

`PathData` is `Record<string, unknown>`. Extending it keeps the index signature while adding named, typed fields.

---

## Typing `PathDefinition` with `TData`

Pass `TData` as the generic argument to `PathDefinition`. All hooks and guards in the step definitions are then typed against your interface:

```typescript
const path: PathDefinition<CourseData> = {
  id: "course",
  steps: [
    {
      id: "details",
      canMoveNext: (ctx) => ctx.data.courseName.length > 0,  // ctx.data is CourseData
      onLeave: (ctx) => ({
        courseName: ctx.data.courseName.trim()               // return value is Partial<CourseData>
      })
    }
  ]
};
```

Without the generic, `TData` defaults to `PathData` (`Record<string, unknown>`), which still works but requires manual type assertions when reading individual fields.

---

## Typed `usePath()` — React, Vue, Svelte

Pass `TData` to `usePath()` or `usePath<TData>()` at the adapter level. This narrows `snapshot.data` so you can read typed values without assertions:

```tsx
// React
const { snapshot, setData } = usePath<CourseData>();
snapshot?.data.courseName;  // string — no cast needed

// Vue
const { snapshot, setData } = usePath<CourseData>();
snapshot.value?.data.courseName;  // string — no cast needed

// Svelte
const path = usePath<CourseData>();
path.snapshot?.data.courseName;  // string — no cast needed
```

The generic is a type-level assertion — it narrows `snapshot.data` and `setData` for convenience but is not enforced at runtime. Define your data shape once in a `PathDefinition<TData>` and use the same generic at the adapter level to keep types consistent throughout.

---

## Typed Angular `PathFacade`

Because `PathFacade` is injected via Angular's DI (which cannot carry generics at runtime), narrow it with a cast at the injection site:

```typescript
// Cast at injection — most ergonomic for component-scoped facades
protected readonly facade = inject(PathFacade) as PathFacade<CourseData>;

// stateSignal is now Signal<PathSnapshot<CourseData> | null>
protected readonly snapshot = this.facade.stateSignal;
snapshot()?.data.courseName;  // string — no cast needed
```

---

## `usePathContext<TData, TServices>()` — step components

`usePathContext()` is available in all adapters and accepts two generics: `TData` for the path data shape and `TServices` for injected services. Use it inside step components rendered by `PathShell`.

### `TData`

```typescript
// Angular
export class PersonalInfoStepComponent {
  protected readonly path = usePathContext<OnboardingData>();

  // snapshot()! is safe — PathShell guarantees non-null while mounted
  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;  // OnboardingData — no cast needed
  }
}
```

```tsx
// React
function PersonalInfoStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  const data = snapshot!.data;          // OnboardingData — no cast needed
  const name = data.firstName;          // string
  setData("firstName", "Alice");        // key and value are type-checked
}
```

```vue
<!-- Vue -->
<script setup lang="ts">
const { snapshot, setData } = usePathContext<OnboardingData>();
</script>
<template>
  <div v-if="snapshot">
    <!-- snapshot.data is OnboardingData inside v-if -->
    <input :value="snapshot.data.firstName"
           @input="setData('firstName', ($event.target as HTMLInputElement).value)" />
  </div>
</template>
```

```svelte
<!-- Svelte -->
<script lang="ts">
  import { usePathContext } from '@daltonr/pathwrite-svelte';
  const ctx = usePathContext<OnboardingData>();
</script>

{#if ctx.snapshot}
  <!-- ctx.snapshot.data is OnboardingData -->
  <input value={ctx.snapshot.data.firstName}
         oninput={(e) => ctx.setData("firstName", e.currentTarget.value)} />
{/if}
```

### `TServices`

Pass a second generic for typed injected services. Services are provided when constructing `PathShell` or the engine in adapters that support them:

```svelte
<script lang="ts">
  import { usePathContext } from '@daltonr/pathwrite-svelte';

  const ctx = usePathContext<MyData, typeof myServices>();
  // ctx.snapshot.data is MyData
  // ctx.services is typeof myServices
</script>
```

---

## Typed `setData()`

`setData` is typed as:

```typescript
setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void>
```

Both the key and value are checked against `TData` at compile time:

```typescript
setData("courseName", 42);        // TS error: number is not assignable to string
setData("typo", "x");             // TS error: "typo" is not a key of CourseData
setData("courseName", "Biology"); // OK
```

The `string &` intersection on `K` is necessary because `keyof TData` includes `number` and `symbol`, but `setData` only accepts string keys. When writing a reusable update helper, use `string & keyof TData`:

```typescript
// ❌ Type error: keyof OnboardingData is string | number | symbol
protected update(field: keyof OnboardingData, value: string): void {
  this.path.setData(field, value);
}

// ✅ Correct
protected update(field: string & keyof OnboardingData, value: string): void {
  this.path.setData(field, value);
}
```

Inline string literals are always fine — TypeScript infers the literal type directly.

---

## Common patterns

### Defining the data interface and path factory

A clean pattern is to define the interface and path factory in one file and import them wherever needed:

```typescript
// course-path.ts
import { PathData, PathDefinition } from "@daltonr/pathwrite-core";

export interface CourseData extends PathData {
  courseName: string;
  subjects: Array<{ name: string; teacher: string }>;
  isDraft: boolean;
}

export const INITIAL_COURSE_DATA: CourseData = {
  courseName: "",
  subjects: [],
  isDraft: true,
};

export const coursePath: PathDefinition<CourseData> = {
  id: "course",
  steps: [
    {
      id: "details",
      fieldErrors: ({ data }) => ({
        courseName: !data.courseName.trim() ? "Course name is required." : undefined,
      }),
    },
    { id: "subjects" },
    { id: "review" },
  ],
  onComplete: async (data) => {
    await saveCourse(data);
  },
};
```

### Using the typed path at the adapter level

```tsx
// React
import { coursePath, CourseData, INITIAL_COURSE_DATA } from "./course-path";

function CourseWizard() {
  const { snapshot, start, next, setData } = usePath<CourseData>();

  // snapshot.data is CourseData — typed throughout
  return (
    <PathShell
      path={coursePath}
      initialData={INITIAL_COURSE_DATA}
      steps={{ ... }}
    />
  );
}
```

All adapters accept `PathDefinition<any>` at their public boundaries, so a typed `PathDefinition<CourseData>` can be passed directly — no cast required:

```typescript
await facade.start(coursePath);           // Angular
await engine.start(coursePath);           // core
start(coursePath);                        // React / Vue
```

### Typing the services interface

```typescript
interface CourseServices {
  courseApi: CourseApi;
  analytics: AnalyticsService;
}

// Inside a step component
const ctx = usePathContext<CourseData, CourseServices>();
ctx.services.courseApi.save(ctx.snapshot!.data);
```

---

## Non-generic usage

When no type argument is supplied, `TData` defaults to `PathData` (`Record<string, unknown>`), and `setData` collapses to `(key: string, value: unknown) => void`. Existing code without generics is unaffected.

---

## Snapshot non-null assertion in step components

Step components are only rendered while `PathShell` has a non-null snapshot, so `snapshot` (or `snapshot()` in Angular) is guaranteed non-null inside any step component. Use `!` rather than optional chaining with a fallback — it eliminates casts and throws at runtime if the assumption is ever violated:

```typescript
// ✅ Safe inside a step component
const data = snapshot!.data;

// ❌ Produces a union type (T | {}) that TypeScript cannot narrow
const data = (snapshot?.data ?? {}) as CourseData;
```
