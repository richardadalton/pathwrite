import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { EmployeeDetails } from "./employee-details";

export interface OnboardingData {
  employeeName: string;
  details: Partial<EmployeeDetails>;
  [key: string]: unknown;
}

export const ONBOARDING_INITIAL: OnboardingData = {
  employeeName: "",
  details: {},
};

export const employeeOnboardingPath: PathDefinition<OnboardingData> = {
  id: "employee-onboarding",
  steps: [
    {
      id: "enter-name",
      title: "Employee Name",
      fieldErrors: ({ data }) => ({
        employeeName: !data.employeeName?.trim() ? "Employee name is required." : undefined,
      }),
    },
    {
      id: "employee-details",
      title: "Employee Details",
      // fieldErrors drives canMoveNext (auto-derived when canMoveNext is absent).
      // The inner PathShell syncs its data to outer data.details via @event,
      // so these checks always reflect the latest values typed into the inner tabs.
      fieldErrors: ({ data }) => {
        const d = data.details as EmployeeDetails | undefined;
        const missing: string[] = [];
        if (!d?.firstName?.trim())  missing.push("First name (Personal tab)");
        if (!d?.lastName?.trim())   missing.push("Last name (Personal tab)");
        if (!d?.department?.trim()) missing.push("Department (Department tab)");
        if (!d?.jobTitle?.trim())   missing.push("Job title (Roles tab)");
        return {
          _: missing.length > 0
            ? `Please complete the required fields: ${missing.join(", ")}.`
            : undefined,
        };
      },
    },
    {
      id: "confirm",
      title: "Confirmation",
    },
  ],
};
