---
"@daltonr/pathwrite-react-native": patch
---

`PathShell` no longer disables the Next button when `snapshot.canMoveNext` is false. The button only looked enabled (the disabled style was tied to the busy status alone) but ignored presses, so on a step with `fieldErrors` or a blocking `canMoveNext` the user could never trigger the attempt that reveals the validation summary or the blocking reason. Next now stays pressable, like the other five shells, and is disabled only while a navigation is in flight.
