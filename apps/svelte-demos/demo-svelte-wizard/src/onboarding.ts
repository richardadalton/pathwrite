import type { PathDefinition } from "@daltonr/pathwrite-svelte";

export interface OnboardingData {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  company: string;
  experience: string;
  theme: string;
  notifications: boolean;
  [key: string]: unknown;
}

export const INITIAL_DATA: OnboardingData = {
  firstName: "", lastName: "", email: "",
  jobTitle: "", company: "", experience: "",
  theme: "system", notifications: true,
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  junior: "Junior (0–2 years)",
  mid:    "Mid-level (3–5 years)",
  senior: "Senior (6–10 years)",
  lead:   "Lead / Principal (10+ years)",
};

export const THEME_LABELS: Record<string, string> = {
  light:  "Light",
  dark:   "Dark",
  system: "System Default",
};

function isValidEmail(email: string) {
  return email.includes("@") && email.includes(".");
}

/**
 * Step IDs use camelCase because Svelte component props must be valid
 * JS identifiers — hyphens are not allowed in prop names.
 */
export const onboardingPath: PathDefinition<OnboardingData> = {
  id: "onboarding",
  steps: [
    {
      id: "personalInfo",
      title: "Personal Info",
      fieldErrors: ({ data }) => ({
        firstName: !data.firstName?.trim() ? "First name is required."    : undefined,
        lastName:  !data.lastName?.trim()  ? "Last name is required."     : undefined,
        email:     !data.email?.trim()     ? "Email address is required."
                 : !isValidEmail(data.email) ? "Enter a valid email address." : undefined,
      }),
    },
    {
      id: "aboutYou",
      title: "About You",
      canMoveNext: ({ data }) => !!data.jobTitle?.trim() && !!data.experience,
      fieldErrors: ({ data }) => ({
        jobTitle:   !data.jobTitle?.trim() ? "Job title is required."               : undefined,
        experience: !data.experience       ? "Please select your experience level." : undefined,
      }),
    },
    { id: "preferences", title: "Preferences" },
    { id: "review",      title: "Review" },
  ],
};

