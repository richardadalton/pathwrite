import type { PathDefinition } from "@daltonr/pathwrite-core";

export interface DemoData {
  name: string;
  country: string;
  state: string;
  county: string;
  skipNext: boolean;
  notes: string;
  [key: string]: unknown;
}

export const INITIAL_DATA: DemoData = {
  name: "",
  country: "",
  state: "",
  county: "",
  skipNext: false,
  notes: "",
};

export const subPath: PathDefinition<DemoData> = {
  id: "sub-v2",
  steps: [
    { id: "sub-1", title: "Sub-Wizard: Step 1" },
    { id: "sub-2", title: "Sub-Wizard: Step 2" },
  ],
};

export const mainPath: PathDefinition<DemoData> = {
  id: "demo-v2",
  steps: [
    {
      id: "name",
      title: "Your Name",
      canMoveNext: ({ data }) => (data.name ?? "").trim().length >= 2,
    },
    {
      id: "country",
      title: "Country",
      canMoveNext: ({ data }) => !!data.country,
    },
    {
      id: "address",
      title: "Address",
      select: ({ data }) => data.country === "US" ? "address-us" : "address-ie",
      steps: [
        {
          id: "address-us",
          title: "US Address",
          canMoveNext: ({ data }) => !!data.state,
        },
        {
          id: "address-ie",
          title: "Irish Address",
          canMoveNext: ({ data }) => !!data.county,
        },
      ],
    },
    {
      id: "skip-toggle",
      title: "Conditional Steps",
    },
    {
      id: "optional",
      title: "Optional Step",
      shouldSkip: ({ data }) => !!data.skipNext,
    },
    {
      id: "subwizard-intro",
      title: "Sub-Wizard",
    },
    {
      id: "done",
      title: "Done",
    },
  ],
};
