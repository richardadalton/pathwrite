# demo-console

Node script demonstrating the `@pathwrite/core` engine directly — no UI framework required.

## What it demonstrates

- Using `PathEngine` without any framework adapter.
- `subscribe()` to listen for all engine events in a terminal.
- A 3-step main path (`create-course`) with a nested 1-step sub-path (`new-lesson`).
- `onSubPathComplete` merging sub-path data into the parent.
- Properly `await`-ing every navigation call so events fire in order.

## Path flow

| Path | Steps |
|------|-------|
| `create-course` | `course-details` → `lesson-details` → `review` |
| `new-lesson` (sub) | `lesson-name` |

`new-lesson` sets a `lesson` data value via `onEnter`. On completion, `lesson-details` receives it via `onSubPathComplete` and merges it into the parent data.

## Run

```bash
npm run demo
```

## Expected output

```
stateChanged -> create-course/course-details
stateChanged -> create-course/course-details
stateChanged -> create-course/course-details
stateChanged -> create-course/lesson-details
stateChanged -> new-lesson/lesson-name
stateChanged -> new-lesson/lesson-name
stateChanged -> new-lesson/lesson-name
resumed -> create-course from new-lesson
stateChanged -> create-course/lesson-details
stateChanged -> create-course/review
stateChanged -> create-course/review
completed -> create-course { owner: 'demo', lesson: 'Intro' }
```


