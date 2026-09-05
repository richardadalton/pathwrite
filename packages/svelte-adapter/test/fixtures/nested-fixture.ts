import type { PathDefinition } from "@daltonr/pathwrite-core";
/** Hook call counters shared between the fixture component and the test. */
export const calls = { enterA: 0, leaveA: 0, enterB: 0 };
export function resetCalls(): void {
  calls.enterA = 0;
  calls.leaveA = 0;
  calls.enterB = 0;
}
export const innerPath: PathDefinition = {
  id: "inner",
  steps: [
    {
      id: "inner-a",
      onEnter: () => {
        calls.enterA++;
      },
      onLeave: () => {
        calls.leaveA++;
      },
    },
    {
      id: "inner-b",
      onEnter: () => {
        calls.enterB++;
      },
      fieldErrors: ({ data }) => (data.city ? {} : { city: "City required" }),
    },
  ],
};
