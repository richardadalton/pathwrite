---
"@daltonr/pathwrite-angular": patch
---

`<pw-shell>` shows "No active path." after the path is cancelled (or dismissed on completion) instead of an empty `.pw-shell`, like the other shells, and wraps the completion panel in `.pw-shell__body` so the shared stylesheet applies to it.
