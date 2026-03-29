import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { ApplicationServices } from "./services";

// ---------------------------------------------------------------------------
// Workflow data shape — the fields collected across all steps.
// ---------------------------------------------------------------------------

export interface ApplicationData {
  roleId: string;
  yearsExperience: string;
  skills: string;
  coverLetter: string;
  [key: string]: unknown;
}

export const INITIAL_DATA: ApplicationData = {
  roleId:          "",
  yearsExperience: "",
  skills:          "",
  coverLetter:     "",
};

// ---------------------------------------------------------------------------
// Workflow factory — framework-agnostic PathDefinition.
//
// This is the first-class artifact: pure business logic with no UI, no
// framework imports, and no rendering concerns. The same definition runs
// in React, Vue, Angular, Svelte, and React Native — the adapter renders
// it; this file defines what happens.
//
// The factory pattern (vs. a plain constant) lets guards close over the
// services instance, keeping async calls out of the path definition itself.
// ---------------------------------------------------------------------------

export function createApplicationPath(
  svc: ApplicationServices
): PathDefinition<ApplicationData> {
  return {
    id: "job-application",
    steps: [
      {
        id: "role",
        title: "Choose a Role",

        fieldErrors: ({ data }) => ({
          roleId: !data.roleId ? "Please select a role to continue." : undefined,
        }),
      },

      {
        id: "experience",
        title: "Your Experience",

        fieldErrors: ({ data }) => {
          const years = Number(data.yearsExperience);
          return {
            yearsExperience: !data.yearsExperience
              ? "Required."
              : isNaN(years) || years < 0
                ? "Enter a valid number of years."
                : undefined,
            skills: !data.skills?.trim() ? "Required." : undefined,
          };
        },
      },

      {
        id: "eligibility",
        title: "Eligibility Check",

        // Async guard — the engine awaits this before advancing.
        // While pending: status === "validating", navigation is disabled,
        // and the Next button shows a loading state.
        // { allowed: false, reason } keeps the user on this step and
        // surfaces reason as snapshot.blockingError.
        canMoveNext: async ({ data }) => {
          const years = Number(data.yearsExperience);
          const result = await svc.checkEligibility(years);
          if (!result.eligible) return { allowed: false, reason: result.reason };
          return true;
        },
      },

      {
        id: "cover-letter",
        title: "Cover Letter",

        // Async shouldSkip — resolves which roles need a cover letter.
        // stepCount is optimistic until the result resolves and is cached
        // in resolvedSkips; the progress bar then reflects the true count.
        shouldSkip: async ({ data }) => {
          const needed = await svc.requiresCoverLetter(data.roleId);
          return !needed;
        },

        fieldErrors: ({ data }) => ({
          coverLetter: !data.coverLetter?.trim()
            ? "Please write a short cover letter."
            : data.coverLetter.trim().length < 20
              ? "Cover letter must be at least 20 characters."
              : undefined,
        }),
      },

      {
        id: "review",
        title: "Review & Submit",
      },
    ],
  };
}
