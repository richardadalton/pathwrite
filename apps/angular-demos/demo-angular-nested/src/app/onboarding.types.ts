import type { PathSnapshot } from "@daltonr/pathwrite-core";
import type { EmployeeDetails } from "./employee-details.types";

export interface OnboardingData {
  employeeName: string;
  details?: PathSnapshot<EmployeeDetails>;
  [key: string]: unknown;
}

export const ONBOARDING_INITIAL: OnboardingData = {
  employeeName: "",
};
