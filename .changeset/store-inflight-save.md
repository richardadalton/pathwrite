---
"@daltonr/pathwrite-store": patch
---

`persistence()` no longer drops state that changes while a save is in flight. A save request that arrived while one was already on the wire returned the in-flight promise and never re-ran, so with a slow store two quick `next()` calls saved only the first position. A mid-flight request now marks the observer dirty, and one follow-up save of the engine's latest state runs as soon as the in-flight one settles (success or failure); several mid-flight requests collapse into that single follow-up.
