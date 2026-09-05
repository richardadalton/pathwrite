---
"@daltonr/pathwrite-angular": minor
---

**`completionBehaviour`** — `"stayOnFinal"` (default), `"dismiss"`, or `"reset"`. Use the `[pwShellCompletion]` directive to render a custom done screen when `stayOnFinal` is active.

**`restoreKey` input on `<pw-shell>`** — pass a string key and the inner shell automatically saves its full state (data + active step) into the outer path's data on every change, restoring on remount. Eliminates state loss when navigating away from a wizard step that hosts a nested shell.

**`layout` input on `<pw-shell>`** *(replaces `footerLayout`)* — accepted values: `"auto"` (default), `"wizard"`, `"form"`, `"tabs"`. The new `"tabs"` value hides both the progress header and footer in a single prop.

**`validateWhen` input on `<pw-shell>`** — when it becomes `true`, calls `validate()` on the engine. Bind to the outer snapshot's `hasAttemptedNext` when nesting a shell inside a wizard step.

**`services` input on `<pw-shell>` + `usePathContext<TData, TServices>()`** — pass an arbitrary services object to all step components without prop-drilling. Stored on the scoped `PathFacade` instance; access it as `usePathContext<TData, TServices>().services`.

**`goToStep(stepId, options?)` / `goToStepChecked(stepId, options?)`** on both `PathFacade` and `usePathContext()` — both now accept `{ validateOnLeave: true }` to mark the departing step as attempted before navigating.
