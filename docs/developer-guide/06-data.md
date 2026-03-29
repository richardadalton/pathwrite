# Chapter 6: Working with Data

Every step in a path reads from and writes to a single data object that lives for the duration of the flow. This chapter covers how that object works at runtime — how to update it, how to track whether the current step has modified it, and how to roll back changes within a step. It then covers the TypeScript side: how to attach a type to the data object so the compiler catches field-name typos, type mismatches in `setData` calls, and missing keys in your initial data.

---

## The data object

`snapshot.data` is a plain object that accumulates as the user moves through the flow. It is never reset between steps — every key written on step 1 is still present on step 5. Each step can read any earlier field, enrich the object with new fields, or overwrite existing ones.

Initial data is set when you start the path:

```tsx
<PathShell
  path={coursePath}
  initialData={{ courseName: "", subjects: [], isDraft: true }}
  steps={...}
/>
```

From that point on, the engine owns the data object. You update it through `setData()` and read it from `snapshot.data`.

---

## `setData()` patterns

`setData(key, value)` updates a single field and immediately emits a `stateChanged` event, causing your framework adapter to re-render. Because it is async (it returns a `Promise<void>`), you generally do not need to `await` it in event handlers — the re-render happens on the next tick regardless.

**Single field update from an input:**

```tsx
function CourseNameStep() {
  const { snapshot, setData } = usePathContext<CourseData>();

  return (
    <input
      value={snapshot!.data.courseName}
      onChange={(e) => setData("courseName", e.target.value)}
    />
  );
}
```

**Updating an array field** — replace the whole array, never mutate in place:

```tsx
function addSubject(subject: Subject) {
  setData("subjects", [...snapshot!.data.subjects, subject]);
}
```

**Multiple fields at once** — call `setData` once per field. Each call emits a separate `stateChanged` event, but because React batches state updates within the same event handler, this typically results in a single re-render:

```tsx
function handleAddressSelect(addr: Address) {
  setData("addressLine1", addr.line1);
  setData("addressLine2", addr.line2);
  setData("city", addr.city);
  setData("postcode", addr.postcode);
}
```

If your framework does not batch updates and you need to avoid multiple renders, call `setData` inside a step lifecycle hook (`onEnter` or `onLeave`) where batching is handled by the engine.

---

## `isDirty` and `resetStep()`

The engine records a snapshot of `data` every time a step is entered. `snapshot.isDirty` is `true` if the current data differs from that entry snapshot — that is, if any `setData()` call has been made since the step was entered.

This is a per-step flag, not a per-field flag. It tells you whether anything has changed on this step, not which specific fields changed.

Use it to drive a "discard changes" button:

```tsx
function AddressStep() {
  const { snapshot, setData, resetStep } = usePathContext<CheckoutData>();

  return (
    <div>
      <AddressForm data={snapshot!.data} onFieldChange={setData} />

      {snapshot!.isDirty && (
        <button onClick={() => resetStep()}>
          Discard changes
        </button>
      )}
    </div>
  );
}
```

`resetStep()` restores `data` to the entry snapshot and emits a `stateChanged` event with cause `"resetStep"`. It has no effect on steps the user has already left — it only reverts the current step.

`isDirty` also resets to `false` when the user navigates to a new step, because the engine takes a fresh entry snapshot on every step entry.

---

## Typing with `TData`

Without a type argument, `snapshot.data` is `PathData` — `Record<string, unknown>`. Reading any field gives you `unknown`, which forces a cast on every access. Adding a single `TData` generic eliminates all of those casts and gives the compiler enough information to catch typos and type mismatches throughout the path.

### Step 1: Define the data interface

Extend `PathData` from `@daltonr/pathwrite-core`:

```ts
import { PathData } from "@daltonr/pathwrite-core";

interface CourseData extends PathData {
  courseName: string;
  subjects: Array<{ name: string; teacher: string }>;
  isDraft: boolean;
}
```

`PathData` is `Record<string, unknown>`. Extending it preserves the index signature (required for the engine's internal data handling) while adding your named, typed fields.

### Step 2: Type the `PathDefinition`

```ts
import { PathDefinition } from "@daltonr/pathwrite-core";

const coursePath: PathDefinition<CourseData> = {
  id: "course",
  steps: [
    {
      id: "details",
      // ctx.data is CourseData — no casts needed
      canMoveNext: ({ data }) => data.courseName.trim().length > 0,
      // return value is Partial<CourseData> — wrong keys are compile errors
      onLeave: ({ data }) => ({ courseName: data.courseName.trim() }),
    },
    { id: "subjects" },
    { id: "review" },
  ],
  onComplete: async (data) => {
    // data is CourseData
    await saveCourse(data);
  },
};
```

Every hook and guard in the definition is now typed against `CourseData`. Returning a field that does not exist, or a value of the wrong type, is a compile error.

### Step 3: Type the hook

Pass `TData` to `usePath()` (or `usePathContext()` in step components):

```tsx
// In the wizard container
function CourseWizard() {
  const { snapshot, start } = usePath<CourseData>();
  // snapshot?.data is CourseData
}
```

```tsx
// In a step component rendered by PathShell
function CourseNameStep() {
  const { snapshot, setData } = usePathContext<CourseData>();
  const data = snapshot!.data;   // CourseData — no cast
  const name = data.courseName;  // string — no cast
}
```

> **Angular:** Angular's DI cannot carry generics at runtime. Cast at the injection site: `inject(PathFacade) as PathFacade<CourseData>`. Inside a step component, use `usePathContext<CourseData>()` — this works identically across all adapters including Angular.

### Step 4: Typed `setData()`

`setData` is typed as:

```ts
setData<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void>
```

Both the key and value are checked against `TData`:

```ts
setData("courseName", "Biology");  // OK
setData("courseName", 42);         // TS error: number is not assignable to string
setData("typo", "x");              // TS error: "typo" is not a key of CourseData
```

The `string &` intersection on `K` is required because `keyof TData` technically includes `number` and `symbol` (inherited from `Record<string, unknown>`), but `setData` only accepts string keys. Inline string literals always narrow correctly — the intersection only matters if you write a reusable helper:

```ts
// Reusable update helper in a step component
function update(field: string & keyof CourseData, value: string) {
  setData(field, value);  // OK
}
```

---

## Typing services

`usePathContext` accepts a second generic for the services object:

```ts
usePathContext<TData, TServices>()
```

Services are the external dependencies — API clients, analytics, feature flags — passed to `PathShell` and made available inside step components without prop drilling. Typing the second generic gives you autocomplete and type-safety on `ctx.services` inside any step component:

```ts
interface CourseServices {
  courseApi: CourseApiClient;
  analytics: AnalyticsService;
}

function CourseReviewStep() {
  const { snapshot, services } = usePathContext<CourseData, CourseServices>();
  // services.courseApi is CourseApiClient — fully typed
  // services.analytics is AnalyticsService — fully typed
}
```

Services are covered in detail in Chapter 7. The pattern is introduced here because the type belongs alongside the data type in your path module.

---

## The path factory pattern

When a path has both a data type and a services type, the cleanest organization is to define both in one file alongside a factory function that constructs the `PathDefinition`:

```ts
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

export interface CourseServices {
  courseApi: CourseApiClient;
  analytics: AnalyticsService;
}

export function createCoursePath(svc: CourseServices): PathDefinition<CourseData> {
  return {
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
      await svc.courseApi.save(data);
      svc.analytics.track("course_created", { courseName: data.courseName });
    },
  };
}
```

This pattern has three advantages. First, the path is fully typed: guards and hooks compile against `CourseData`, and the factory is injected with typed services. Second, it is testable: pass mock services to `createCoursePath` in tests and run the engine directly without mounting any UI. Third, it is injectable: your framework's DI container (or a React context, or a Svelte store) can construct the path and hand it to the shell with no coupling between the path logic and any specific framework primitive.

```tsx
// React — construct once and pass to the shell
const coursePath = createCoursePath({ courseApi, analytics });

<PathShell
  path={coursePath}
  initialData={INITIAL_COURSE_DATA}
  services={{ courseApi, analytics }}
  steps={...}
/>
```

All adapters accept `PathDefinition<any>` at their public boundary, so a `PathDefinition<CourseData>` passes without a cast. The `TData` generic is a compile-time narrowing tool; it does not affect runtime behaviour.

---

The factory pattern sets up cleanly for Chapter 7, where services — the external dependencies your guards need — are injected through exactly this mechanism.

© 2026 Devjoy Ltd. MIT License.
