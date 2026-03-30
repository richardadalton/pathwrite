import type { EmployeeDetails } from "./employee-details.types";

export interface OnboardingData {
  employeeName: string;
  details: Partial<EmployeeDetails>;
  [key: string]: unknown;
}

export const ONBOARDING_INITIAL: OnboardingData = {
  employeeName: "",
  details: {},
};
