import { PathData, PathDefinition } from "@daltonr/pathwrite-vue";

export interface OnboardingData extends PathData {
  // Step 1: Personal Info
  name: string;
  email: string;
  
  // Step 2: Preferences
  role: string;
  interests: string[];
  
  // Step 3: Additional Info
  bio: string;
  notifications: boolean;
}

export const onboardingWizard: PathDefinition<OnboardingData> = {
  id: "onboarding-wizard",
  steps: [
    {
      id: "personal",
      title: "Personal Information",
      canMoveNext: ({ data }) => 
        (data.name ?? "").trim().length > 0 && 
        (data.email ?? "").trim().length > 0 &&
        (data.email ?? "").includes("@"),
      validationMessages: ({ data }) => {
        const messages = [];
        if (!(data.name ?? "").trim()) {
          messages.push("Name is required");
        }
        if (!(data.email ?? "").trim()) {
          messages.push("Email is required");
        } else if (!(data.email ?? "").includes("@")) {
          messages.push("Email must be valid");
        }
        return messages;
      }
    },
    {
      id: "preferences",
      title: "Your Preferences",
      canMoveNext: ({ data }) => 
        (data.role ?? "").trim().length > 0 &&
        (data.interests ?? []).length > 0,
      validationMessages: ({ data }) => {
        const messages = [];
        if (!(data.role ?? "").trim()) {
          messages.push("Please select a role");
        }
        if ((data.interests ?? []).length === 0) {
          messages.push("Please select at least one interest");
        }
        return messages;
      }
    },
    {
      id: "additional",
      title: "Additional Information"
    },
    {
      id: "review",
      title: "Review & Confirm"
    }
  ]
};

