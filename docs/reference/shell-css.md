# Shell CSS — Custom Properties

Every visual value in the default `PathShell` UI is a CSS custom property. Override any of them in your own stylesheet — no selector specificity battles required.

## Importing the stylesheet

```js
// React / Vue / Svelte
import "@daltonr/pathwrite-react/styles.css";     // or -vue / -svelte
```

```json
// Angular (angular.json)
"styles": ["node_modules/@daltonr/pathwrite-angular/dist/index.css"]
```

## Custom properties

### Layout

| Property | Default | Description |
|---|---|---|
| `--pw-shell-max-width` | `720px` | Maximum width of the shell container |
| `--pw-shell-padding` | `24px` | Inner padding of each shell section |
| `--pw-shell-gap` | `20px` | Vertical gap between shell sections |
| `--pw-shell-radius` | `10px` | Border radius of the shell card |

### Colours

| Property | Default | Description |
|---|---|---|
| `--pw-color-bg` | `#ffffff` | Shell background |
| `--pw-color-border` | `#dbe4f0` | Section border colour |
| `--pw-color-text` | `#1f2937` | Primary text colour |
| `--pw-color-muted` | `#5b677a` | Secondary / muted text |
| `--pw-color-primary` | `#2563eb` | Accent colour (active step dot, progress bar fill) |
| `--pw-color-primary-light` | `rgba(37,99,235,0.12)` | Light primary tint (active dot background) |
| `--pw-color-btn-bg` | `#f8fbff` | Button background |
| `--pw-color-btn-border` | `#c2d0e5` | Button border |
| `--pw-color-error` | `#dc2626` | Error text and border |
| `--pw-color-error-bg` | `#fef2f2` | Error message background |
| `--pw-color-error-border` | `#fecaca` | Error message border |
| `--pw-color-warning` | `#d97706` | Warning text and border |
| `--pw-color-warning-bg` | `#fffbeb` | Warning message background |
| `--pw-color-warning-border` | `#fde68a` | Warning message border |

### Progress indicator

| Property | Default | Description |
|---|---|---|
| `--pw-dot-size` | `32px` | Diameter of step indicator dots |
| `--pw-dot-font-size` | `13px` | Font size inside step dots |
| `--pw-track-height` | `4px` | Height of the progress bar track |

### Buttons

| Property | Default | Description |
|---|---|---|
| `--pw-btn-padding` | `8px 16px` | Button padding |
| `--pw-btn-radius` | `6px` | Button border radius |

## Example: brand theme

```css
:root {
  --pw-color-primary: #7c3aed;          /* purple brand colour */
  --pw-color-primary-light: rgba(124, 58, 237, 0.1);
  --pw-shell-radius: 4px;               /* sharper corners */
  --pw-shell-max-width: 600px;
}
```

## Dark mode

Override properties inside a `prefers-color-scheme: dark` media query or your own dark-mode selector:

```css
@media (prefers-color-scheme: dark) {
  :root {
    --pw-color-bg: #1e1e2e;
    --pw-color-border: #313244;
    --pw-color-text: #cdd6f4;
    --pw-color-muted: #a6adc8;
    --pw-color-btn-bg: #313244;
    --pw-color-btn-border: #45475a;
  }
}
```

© 2026 Devjoy Ltd. MIT License.
