import { vi, onTestFinished } from "vitest";

/**
 * Captures console output a test deliberately provokes, so it stops drowning
 * the run, and returns the captured messages so the test can assert on them.
 *
 * The point is to turn noise into an assertion rather than to hide it. A test
 * that triggers a warning on purpose should say so and check it happened; a
 * test that starts warning unexpectedly should still be visible. Blanket
 * suppression would hide both.
 *
 * The full suite emitted roughly half a megabyte of stderr, nearly all of it
 * from passing tests exercising warning paths on purpose. Real failures looked
 * identical to it, which cost several interrupted releases.
 *
 * Spies are restored automatically when the test finishes.
 */
export function captureConsole(methods: ReadonlyArray<"warn" | "error" | "log"> = ["warn", "error"]) {
  const messages: string[] = [];
  const spies = methods.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      messages.push(args.map((a) => (a instanceof Error ? `${a.name}: ${a.message}` : String(a))).join(" "));
    })
  );
  onTestFinished(() => spies.forEach((spy) => spy.mockRestore()));
  return messages;
}

/**
 * Like `captureConsole`, but only tolerates messages the caller lists.
 *
 * Silences the warnings a suite provokes on purpose while still failing if an
 * unlisted one appears, so a file can be quiet without going deaf. Prefer this
 * over `captureConsole` when applying capture across a whole file, where a
 * blanket mute would hide a genuine new warning among hundreds of tests.
 */
export function captureExpectedConsole(
  expected: ReadonlyArray<string>,
  methods: ReadonlyArray<"warn" | "error" | "log"> = ["warn"]
) {
  const messages = captureConsole(methods);
  onTestFinished(() => {
    const unexpected = messages.filter((m) => !expected.some((e) => m.includes(e)));
    if (unexpected.length > 0) {
      throw new Error(
        `Unexpected console output (${unexpected.length}):\n` +
          unexpected.map((m) => `  - ${m.slice(0, 200)}`).join("\n")
      );
    }
  });
  return messages;
}
