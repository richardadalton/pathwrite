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

  [key: string]: unknown;
}

export const INITIAL_DATA: ApplicationData = {
  roleId:           "",
  yearsExperience:  "",
  skills:           "",
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
        id: "review",
        title: "Review & Submit",
      },
    ],
  };
}
