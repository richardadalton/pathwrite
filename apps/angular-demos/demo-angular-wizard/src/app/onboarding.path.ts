/**
 * onboarding.path.ts — Core path definition (no Angular imports).
 *
 * This file is pure TypeScript. It can be tested in isolation, reused across
 * frameworks, and run on a server. The Angular adapter only wires up the UI.
 */
import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { OnboardingData } from "./onboarding.types";

function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

export const onboardingPath: PathDefinition<OnboardingData> = {
  id: "onboarding",
  steps: [
    {
      id: "personal-info",
      title: "Personal Info",
      // fieldErrors without an explicit canMoveNext — the engine auto-derives
      // canMoveNext as true when all messages are undefined.
      fieldErrors: ({ data }) => ({
        firstName: !(data.firstName as string)?.trim()
          ? "First name is required."
          : undefined,
        lastName: !(data.lastName as string)?.trim()
          ? "Last name is required."
          : undefined,
        email: !(data.email as string)?.trim()
          ? "Email address is required."
          : !isValidEmail(data.email as string)
          ? "Enter a valid email address."
          : undefined,
      }),
    },
    {
      id: "about-you",
      title: "About You",
      // Explicit canMoveNext plus fieldErrors — demonstrates both together.
      canMoveNext: ({ data }) =>
        !!(data.jobTitle as string)?.trim() && !!(data.experience as string),
      fieldErrors: ({ data }) => ({
        jobTitle: !(data.jobTitle as string)?.trim()
          ? "Job title is required."
          : undefined,
        experience: !(data.experience as string)
          ? "Please select your experience level."
          : undefined,
      }),
    },
    {
      id: "preferences",
      title: "Preferences",
      // No guard — theme and notifications both have defaults; nothing to block on.
    },
    {
      id: "review",
      title: "Review",
      // Final confirmation step — no guard, completion is intentional.
    },
  ],
};

