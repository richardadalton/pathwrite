import type { PathDefinition } from "@daltonr/pathwrite-core";

export interface DemoData {
  name: string;
  skipOptional: boolean;
}

export const INITIAL_DATA: DemoData = {
  name: "",
  skipOptional: false,
};

export const skipPath: PathDefinition<DemoData> = {
  id: "rn-skip-demo",
  steps: [
    {
      id: "name",
      title: "Your Name",
      canMoveNext: ({ data }) => data.name.trim().length >= 2,
    },
    {
      id: "skip-toggle",
      title: "Conditional Steps",
    },
    {
      id: "optional",
      title: "Optional Step",
      shouldSkip: ({ data }) => data.skipOptional,
    },
    {
      id: "done",
      title: "Done",
    },
  ],
};
