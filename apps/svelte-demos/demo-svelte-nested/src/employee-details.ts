import type { PathDefinition } from "@daltonr/pathwrite-core";

export interface EmployeeDetails {
  // Personal tab
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  personalEmail: string;
  // Department tab
  department: string;
  manager: string;
  office: string;
  startDate: string;
  // Equipment tab
  laptopType: string;
  needsPhone: string;       // "yes" | "no"
  needsAccessCard: string;  // "yes" | "no"
  otherEquipment: string;
  // Roles tab
  jobTitle: string;
  permAdmin: string;        // "yes" | "no"
  permDev: string;
  permHR: string;
  permFinance: string;
  [key: string]: unknown;
}

export const DETAILS_INITIAL: EmployeeDetails = {
  firstName: "", lastName: "", dateOfBirth: "", phone: "", personalEmail: "",
  department: "", manager: "", office: "", startDate: "",
  laptopType: "macbook-pro", needsPhone: "no", needsAccessCard: "yes", otherEquipment: "",
  jobTitle: "", permAdmin: "no", permDev: "no", permHR: "no", permFinance: "no",
};

export const DEPARTMENTS = ["Engineering", "Product", "Design", "Sales", "Marketing", "HR", "Finance", "Operations"];
export const OFFICES = ["Dublin HQ", "London", "Berlin", "New York", "Remote"];
export const LAPTOP_TYPES = [
  { value: "macbook-pro", label: "MacBook Pro (M-series)" },
  { value: "macbook-air", label: "MacBook Air (M-series)" },
  { value: "dell-xps",    label: "Dell XPS 15" },
  { value: "lenovo-x1",  label: "Lenovo ThinkPad X1" },
];

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
