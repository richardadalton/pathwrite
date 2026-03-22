# Pathwrite-Vue — Developer Feedback

> Evaluation context: building a multi-step **document approval workflow** in Vue 3 using
> `@daltonr/pathwrite-vue@0.3.0` and `@daltonr/pathwrite-core@0.3.0`.
> Date: March 2026.

---

## What Worked Well

### 1. Sub-path model is a natural fit for "parallel" workflows
The `startSubPath` / `onSubPathComplete` / `onSubPathCancel` trio maps cleanly onto the
"run a child workflow per collection item then resume the parent" pattern.
Once the mental model clicked, implementing approver reviews as sub-paths felt correct and
self-contained.  The `meta` correlation object (passed to `startSubPath` and echoed back to
the hooks) is a small but essential detail — it meant the parent could identify *which*
approver just completed without embedding that into the sub-path's own data.

### 2. `PathShell` removes almost all boilerplate
Dropping `<PathShell>` into `App.vue` and providing named slots per step id gave a working
progress bar, navigation buttons, and validation messages for free.  For a proof-of-concept
this saved a significant amount of wiring.

### 3. `usePathContext` keeps components clean
Child step components can call `usePathContext()` and get full access to `snapshot` and all
actions.  There is no prop drilling and no Vuex/Pinia store needed.  This is the right
approach for a composable-first library.

### 4. `validationMessages` hook is a great UX shortcut
Returning plain strings from `validationMessages` and having `PathShell` render them
automatically means component templates stay free of "show this error if …" boilerplate.
Combined with `canMoveNext` it forms a clean two-layer guard: block navigation *and* explain
why, all from a single step definition.

### 5. `setData` is typed end-to-end
Passing the data shape as a generic to `usePath<MyData>()` / `usePathContext<MyData>()` made
`setData` fully type-safe.  Mistyped keys or value types were caught at compile time with
clear messages.

---

## Pain Points

### 1. Sub-path and parent-path data are completely isolated
**Problem:** When an approver sub-path is running, `usePathContext()` inside any slot
component returns the *sub-path* snapshot — meaning the `ReviewStep` cannot easily reach the
parent path's `documentTitle` / `documentContent` without those values being explicitly
copied into the sub-path's `initialData`.

**Impact:** Led to a slightly awkward duplication: the document content lives in the main
path data and also had to be re-serialised into every sub-path's initial data just so
`ReviewStep` could read it.

**Suggestion:** Consider a `useParentPathContext()` composable, or allow sub-paths to
declare read-only "inherited" keys from the parent that are automatically projected into the
sub-path snapshot.

---

### 2. No way to distinguish "are we in a sub-path?" from template/slot side
**Problem:** `<PathShell>` uses the same slot registry for both the main path steps and
sub-path steps.  If a step id in the sub-path happened to collide with a main-path step id,
the wrong component would render silently.

**Impact:** Required deliberate naming discipline (`review`, `decision` vs. `setup`,
`approvals`, `summary`).  With a larger workflow this collision risk increases.

**Suggestion:** Support a namespaced slot syntax, e.g. `#approver-review::review`, so sub-path
steps can be scoped to their path id.

---

### 3. `onSubPathComplete` return type is `Partial<TData> | void`  but the signature receives `subPathData: PathData` (untyped)
**Problem:** The `subPathData` argument in `onSubPathComplete` is typed as the generic
`PathData` (`Record<string, unknown>`), not as the sub-path's own data type.  Accessing
`subPathData.decision` required a manual cast.

```ts
onSubPathComplete(_subPathId, subPathData, ctx, meta) {
  const result = subPathData as ApproverReviewData  // cast required
  ...
}
```

**Impact:** Loses the type safety that `setData` provides elsewhere; easy to introduce silent
runtime errors if the sub-path's data shape changes.

**Suggestion:** Allow `onSubPathComplete` to accept a generic for the sub-path data type:
```ts
onSubPathComplete<TSubData extends PathData>(
  subPathId: string,
  subPathData: TSubData,
  ctx: PathStepContext<TData>,
  meta?: Record<string, unknown>
): Partial<TData> | void
```

---

### 4. No built-in "parallel sub-path" primitive
**Problem:** The approval workflow requires *all approvers* to complete in *any order* before
the parent can advance.  Pathwrite's model is sequential by nature (one active path on the
stack at a time).  The workaround — one sub-path at a time launched from a hub step, with
guards blocking `next()` until all are done — works, but it is not immediately obvious from
the docs.

**Impact:** Higher cognitive load; the solution feels like a workaround rather than a
first-class feature.

**Suggestion:** Document the "hub step with sub-paths" pattern explicitly in the README with
an example of the `canMoveNext` + `onSubPathComplete` combo.  Alternatively, consider a
future `startParallelSubPaths` / `whenAllComplete` API for fan-out/fan-in scenarios.

---

### 5. `goToStep` bypasses guards — the risk is not prominent enough
**Problem:** The distinction between `goToStep` (unsafe) and `goToStepChecked` (safe) is
documented in the API table but easy to miss.  The unsafe variant calls `onLeave`/`onEnter`
but skips `canMoveNext` / `shouldSkip`, which can leave the path in an inconsistent state if
a developer picks the wrong one.

**Suggestion:** Rename or prefix the unsafe variant to make the risk obvious, e.g.
`goToStepUnchecked`, and make `goToStepChecked` the default (shorter) name.

---

### 6. `PathShell` `autoStart` + `key`-based reset is the only reset mechanism
**Problem:** Once a path completes, the only way to restart it inside the same `<PathShell>`
instance is to change the `key` prop (force-remounting the component).  There is no
`reset()` or `restart()` action exposed.

**Impact:** The `App.vue` had to maintain a `key` ref and increment it on restart, which
feels like a workaround.

**Suggestion:** Expose a `restart(initialData?)` method (or emit-triggered prop change) that
resets the engine and re-runs `start` without requiring a DOM remount.

---

### 7. Guards are evaluated synchronously before `onEnter` runs — silent crash on startup

**Problem:** When a path starts, the engine calls `canMoveNext` and `validationMessages`
synchronously to populate the very first snapshot, but this happens *before* the step's
`onEnter` hook has run to seed default data values.  If `initialData` is empty (`{}`) and
the guards access fields that `onEnter` is supposed to provide, they throw a `TypeError` at
runtime.

In this project, passing no `initialData` to `<PathShell>` meant `data.documentTitle` was
`undefined` when `canMoveNext` called `.trim()` on it:

```ts
// guard blows up silently because data.documentTitle === undefined
canMoveNext({ data }) {
  return data.documentTitle.trim().length > 0  // TypeError!
}
```

The promise rejected silently (no console error in the shell), `snapshot.value` stayed
`null`, and the UI showed "No active path." with no way to proceed — a completely invisible
failure.

**Impact:** Hours of debugging with no obvious clue in the UI or console. The root cause is
non-obvious: guards look like simple boolean expressions, not places that can crash the
entire workflow.

**Fix applied:** Use nullish coalescing in all guards (`data.documentTitle ?? ''`) and pass
`initialData` explicitly to `<PathShell>` so fields are present from the very first
snapshot.

**Suggestions:**
- Document clearly that guards *will* be called before `onEnter` on the very first snapshot.
- Consider wrapping `evaluateGuardSync` / `evaluateValidationMessagesSync` in a try/catch
  and emitting a warning rather than letting the error silently kill the startup promise.
- Alternatively, run `onEnter` *before* building the first snapshot so guards always see
  fully initialised data.

---

### 8. Learning curve: "snapshot goes null on complete" is surprising
**Problem:** When a path (or sub-path) completes, `snapshot.value` becomes `null` and a
`stateChanged` → `completed` event fires.  For main paths this clears the UI.  For sub-paths
this is the correct trigger for `onSubPathComplete`, and the shell then immediately shows
the parent's snapshot — but the reactive snapshot briefly flickers through `null`.

**Impact:** A small visual jump on sub-path completion if component logic reads `snapshot`
without null-guarding deeply enough.

**Suggestion:** For sub-paths, consider not nulling the snapshot between sub-path
`completed` and parent `resumed` — or document the brief null window explicitly so
developers can add transition guards.

---

## Minor / Ergonomics

| Issue | Suggestion |
|-------|------------|
| `PathShell` ships with no styles and requires a separate `import '@daltonr/pathwrite-vue/styles.css'` | Good pattern, but document the CSS custom-property theme tokens in the README's Styling section (the list of `--pw-*` variables is missing). |
| The library CSS defines `.pw-shell__btn--next` and `.pw-shell__btn--cancel` but not `.pw-shell__btn--back`, even though the shell renders the back button with that class. Every consumer must add their own override to visually distinguish Back from Next. | Add a `.pw-shell__btn--back` rule to the default stylesheet (e.g. a muted grey style) to match the treatment given to `--next` and `--cancel`. |
| `steps` array on `PathSnapshot` includes all steps including sub-path steps — the progress bar jumps when entering a sub-path | Expose a `parentSteps` / `rootSteps` field, or a `nestingLevel`-aware filter, so shells can show only the top-level progress. |
| No TypeScript declaration for the optional `styles.css` export | Add `"./styles.css": "./dist/styles.css"` to `package.json` `exports` with a types entry so IDEs autocomplete the import path. |
| `PathShell` emits `@event` for every engine event — useful for debugging but the payload type (`PathEvent`) is not re-exported from the package index | Re-export `PathEvent` from `@daltonr/pathwrite-vue` so consumers don't have to import it from `@daltonr/pathwrite-core`. |

---

### 9. Default stylesheet uses `position: absolute` on `::before` — breaks when customising validation items

**Problem:** The bundled `styles.css` styles the validation bullet like this:

```css
.pw-shell__validation-item {
  padding-left: 16px;
  position: relative;
}
.pw-shell__validation-item::before {
  content: "•";
  position: absolute;
  left: 4px;
}
```

This works fine in isolation. However, if a consumer imports both the pathwrite stylesheet
*and* their own CSS and tries to override `.pw-shell__validation-item` (e.g. to swap the
icon or change the layout), the `position: absolute` on `::before` is an invisible trap —
the icon drops out of any flex layout and overlaps the text. The fix (`position: static`)
requires knowing an undocumented implementation detail.

**What we did wrong initially:** We imported both the pathwrite CSS and our own CSS and
tried to override `pw-shell__*` selectors directly — a CSS cascade conflict waiting to
happen. The correct pattern is to theme via `--pw-*` custom properties only, and only add
selector overrides for things the library genuinely doesn't expose a variable for.

**Suggestion:** Use a flex-based layout in the default stylesheet, which is more
customisation-friendly and doesn't create hidden layout traps:

```css
.pw-shell__validation-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.pw-shell__validation-item::before {
  content: "•";
  flex-shrink: 0;
}
```

Alternatively, expose a `--pw-validation-bullet` custom property so the icon can be swapped
without any selector override at all.
| `steps` array on `PathSnapshot` includes all steps including sub-path steps — the progress bar jumps when entering a sub-path | Expose a `parentSteps` / `rootSteps` field, or a `nestingLevel`-aware filter, so shells can show only the top-level progress. |
| No TypeScript declaration for the optional `styles.css` export | Add `"./styles.css": "./dist/styles.css"` to `package.json` `exports` with a types entry so IDEs autocomplete the import path. |
| `PathShell` emits `@event` for every engine event — useful for debugging but the payload type (`PathEvent`) is not re-exported from the package index | Re-export `PathEvent` from `@daltonr/pathwrite-vue` so consumers don't have to import it from `@daltonr/pathwrite-core`. |

---

## Overall Impression

Pathwrite-vue is **well-designed for linear multi-step wizards** and the `PathShell`
component makes the common case nearly zero-boilerplate.  The sub-path mechanism is clever
and genuinely useful — it just needs more documentation and a couple of type-safety
improvements before it feels fully polished.

The biggest gap for production use is the **isolated data model between parent and sub-paths**
and the **lack of a parallel fan-out primitive** — both of which are real needs in
document/approval workflows.

With those addressed (or at least documented with patterns), this would be a very strong
foundation for building complex business workflows in Vue 3.

