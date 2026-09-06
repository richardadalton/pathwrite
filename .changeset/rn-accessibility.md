---
"@daltonr/pathwrite-react-native": minor
---

**The React Native shell is now usable with a screen reader.** It previously set no accessibility props at all. `Pressable` has no implicit role, so VoiceOver and TalkBack announced every control as static text, never said a control was disabled (that was conveyed by reduced opacity alone), and read the progress indicator as a row of loose digits. The busy state replaced the button's label with a spinner, leaving nothing to announce.

- Every control carries `accessibilityRole="button"` and an `accessibilityLabel`: Next, Complete, Previous, Cancel, Start, Start over, Try again, and Save and come back later.
- Controls that are disabled report `accessibilityState.disabled`, so the state is announced rather than only drawn.
- The Next button reports `accessibilityState.busy` while an async step runs, and keeps a spoken label when the spinner replaces its text. `loadingLabel` is used when set; otherwise it falls back to "Working, please wait" so the button is never silent.
- The progress track is a `progressbar` with `accessibilityValue`, reporting percentage complete and "Step N of M". Each step dot is labelled with its position and state, for example "Step 2 of 4, current".
- The validation summary, field warnings, the blocking-guard reason and the error panel are live regions, so a message that appears in response to pressing Next is announced. Focus has already moved on by then, so without this they were never read at all. The error panel is `assertive`; the rest are `polite`.

Message containers also gained `testID`s (`pw-validation`, `pw-warnings`, `pw-blocking-error`, `pw-error`) so applications and tests can target them.

The react-native test stub now forwards the accessibility props to their nearest ARIA equivalents, which is what lets the new suite assert any of this. That mapping is an approximation of what React Native hands to the platform, but the shell shipped with none of these props set, and asserting they are set at all is the point.
