import type { PathDefinition } from "@daltonr/pathwrite-core";
import type { EmployeeDetails } from "./employee-details.types";

export const employeeDetailsPath: PathDefinition<EmployeeDetails> = {
  id: "employee-details",
  steps: [
    {
      id: "personal",
      title: "Personal",
      fieldErrors: ({ data }) => ({
        firstName: !data.firstName?.trim() ? "First name is required." : undefined,
        lastName:  !data.lastName?.trim()  ? "Last name is required."  : undefined,
      }),
    },
    {
      id: "department",
      title: "Department",
      fieldErrors: ({ data }) => ({
        department: !data.department ? "Department is required." : undefined,
      }),
    },
    { id: "equipment", title: "Equipment" },
    {
      id: "roles",
      title: "Roles",
      fieldErrors: ({ data }) => ({
        jobTitle: !data.jobTitle?.trim() ? "Job title is required." : undefined,
      }),
    },
  ],
};
