# demo-angular

Angular demo for `@daltonr/pathwrite-angular` v0.5.0. Demonstrates the recommended way to build a multi-step wizard in Angular using `<pw-shell>` and `pwStep` directives.

## What it demonstrates

| Feature | Details |
|---------|---------|
| `<pw-shell>` | Renders the progress header, step body, validation messages and navigation footer automatically |
| `pwStep` directive | Associates an `<ng-template>` with a step ID — no `*ngIf` switching needed |
| `#shell` template reference | Access `shell.facade.setData()` and `shell.facade.stateSignal()` from inline step templates |
| Guards & validation | `canMoveNext` blocks navigation; `validationMessages` surfaces user-facing errors in the shell |
| `StateChangeCause` | Event log shows the cause of every `stateChanged` event (`start`, `next`, `previous`, `setData`, …) |
| Sub-paths | "Add Lesson" button starts a nested sub-path; `onSubPathComplete` merges the result back |
| Angular 17 control flow | `@if` / `@for` blocks — no `CommonModule` or `NgIf`/`NgFor` imports |

## Path flow

| Path | Steps |
|------|-------|
| `create-course` (main) | `course-details` → `lesson-details` → `review` |
| `new-lesson` (sub-path) | `lesson-name` |

**Guards:**
- `course-details` — Next blocked until title **and** description are non-empty (messages shown inline).
- `lesson-name` — Next blocked until lesson name is non-empty.

**Sub-path lifecycle:**
`lesson-details` starts the `new-lesson` sub-path via `shell.facade.startSubPath()`. When the sub-path completes, `onSubPathComplete` appends the lesson name to the parent path's `lessons` array.

## Run

```bash
npm run demo:angular
```

Or directly:

```bash
npm run -w @daltonr/pathwrite-demo-angular start
```

## Key patterns

### Using pw-shell with inline step templates

```html
<pw-shell #shell [path]="coursePath" (completed)="onComplete($event)">
  <ng-template pwStep="course-details">
    <input [value]="title_"
           (input)="shell.facade.setData('title', $any($event.target).value)" />
  </ng-template>
</pw-shell>
```

### Reading reactive state in step templates

```html
<ng-template pwStep="review">
  @if (shell.facade.stateSignal(); as s) {
    <p>{{ s.data['title'] }}</p>
  }
</ng-template>
```

### Starting a sub-path from a step

```html
<button (click)="shell.facade.startSubPath(addLessonPath)">+ Add Lesson</button>
```

### Guards + validation messages (TypeScript)

```typescript
{
  id: "course-details",
  canMoveNext: ({ data }) => !!(data["title"] as string)?.trim(),
  validationMessages: ({ data }) =>
    (data["title"] as string)?.trim() ? [] : ["Course title is required."]
}
```
