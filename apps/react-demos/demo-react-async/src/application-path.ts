import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { ApplicationServices, Role } from "./services";

// ---------------------------------------------------------------------------
// Path data shape
// ---------------------------------------------------------------------------

export interface ApplicationData {
  // Step 1 — role selection
  roleId: string;

  // Step 2 — experience
  yearsExperience: string;
  skills: string;

  // Step 4 — cover letter (only for eng / data roles)
  coverLetter: string;

  [key: string]: unknown;
}

export const INITIAL_DATA: ApplicationData = {
  roleId:           "",
  yearsExperience:  "",
  skills:           "",
  coverLetter:      "",
};

// ---------------------------------------------------------------------------
// Path factory — closes over services so guards can call them.
// Exporting a factory function (not a constant) is the idiomatic pattern
// when steps need to call external services.
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

        // --- Async canMoveNext -----------------------------------------------
        // This is the async guard. The engine awaits this before deciding
        // whether to advance. While it is pending:
        //   - status === "validating"
        //   - the Next button shows a CSS spinner (shell.css pw-shell__btn--loading)
        //   - all navigation buttons are disabled
        //
        // If it returns { allowed: false }, the user stays on this step.
        // The shell renders result.reason as snapshot.blockingError automatically.
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

        // --- Async shouldSkip -----------------------------------------------
        // svc.requiresCoverLetter() is async. While it resolves, stepCount is
        // optimistic (includes this step). Once navigation walks past it and the
        // result is cached in resolvedSkips, the progress bar updates to reflect
        // the true visible count.
        //
        // Try selecting "Software Engineer" or "Data Scientist" — the cover
        // letter step appears. Any other role — it is silently skipped.
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
