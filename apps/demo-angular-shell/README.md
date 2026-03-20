# demo-angular-shell

Angular demo showing the **default UI shell** (`<pw-shell>`) in action.

This is the same sign-up wizard you'd build manually with `PathFacade` + your own template, but here the progress indicator, navigation buttons, and step switching are all handled by the shell. The component only defines the path and the per-step content.

## Running

From the workspace root:

```bash
npm run demo:angular:shell
```

Then open [http://localhost:4200](http://localhost:4200).

## What to notice

Compare this demo's `app.component.ts` + `app.component.html` to `demo-angular-course`:

| Concern | `demo-angular-course` (manual) | This demo (shell) |
|---|---|---|
| Progress dots | ~30 lines template + ~70 lines CSS | Zero — handled by `<pw-shell>` |
| Navigation buttons | ~10 lines template | Zero — handled by `<pw-shell>` |
| Step switching (`*ngIf` on `stepId`) | Manual per step | Zero — handled by `pwStep` |
| Total component template | ~120 lines | ~50 lines |
| Total component CSS | ~155 lines | ~0 lines (global `shell.css` styles) |

The path definition, guards, and lifecycle hooks are identical — only the UI boilerplate disappears.

## How `setData` works with the shell

Since `<pw-shell>` owns its own `PathFacade`, projected step content accesses it via a template reference variable:

```html
<pw-shell #shell [path]="myPath">
  <ng-template pwStep="details">
    <input (ngModelChange)="shell.facade.setData('name', $event)" />
  </ng-template>
</pw-shell>
```

