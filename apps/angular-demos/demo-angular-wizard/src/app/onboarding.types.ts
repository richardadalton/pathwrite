import type { PathData } from "@daltonr/pathwrite-angular";

export interface OnboardingData extends PathData {
  // Step 1 — Personal Info
  firstName: string;
  lastName: string;
  email: string;
  // Step 2 — About You
  jobTitle: string;
  company: string;
  experience: string;
  // Step 3 — Preferences
  theme: string;
  notifications: boolean;
}

export const INITIAL_DATA: OnboardingData = {
  firstName: "",
  lastName: "",
  email: "",
  jobTitle: "",
  company: "",
  experience: "",
  theme: "system",
  notifications: true,
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  junior: "Junior (0–2 years)",
  mid: "Mid-level (3–5 years)",
  senior: "Senior (6–10 years)",
  lead: "Lead / Principal (10+ years)",
};

export const THEME_LABELS: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System Default",
};

