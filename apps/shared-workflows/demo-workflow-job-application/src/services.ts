// ---------------------------------------------------------------------------
// Service interface — defines what the workflow depends on.
// In a real app this would be an API client, injected service, or similar.
// The interface is the contract; the mock below is for demos only.
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  label: string;
}

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
}

export interface ApplicationServices {
  /** Fetch the list of open roles. */
  getRoles(): Promise<Role[]>;

  /**
   * Check whether the applicant meets minimum requirements.
   * Returns `{ eligible: false, reason }` when `yearsExperience < 2`.
   * Used in the eligibility step's async `canMoveNext` guard.
   */
  checkEligibility(yearsExperience: number): Promise<EligibilityResult>;

  /**
   * Check whether the selected role requires a cover letter.
   * Used in the cover-letter step's async `shouldSkip` to conditionally
   * include or skip that step; the step count updates once it resolves.
   */
  requiresCoverLetter(roleId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Mock implementation — simulates realistic network latency.
// Replace with a real implementation in production.
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockApplicationServices implements ApplicationServices {
  async getRoles(): Promise<Role[]> {
    await delay(700); // simulate an API round-trip
    return [
      { id: "eng",    label: "Software Engineer" },
      { id: "pm",     label: "Product Manager" },
      { id: "design", label: "Designer" },
      { id: "data",   label: "Data Scientist" },
      { id: "devrel", label: "Developer Advocate" },
    ];
  }

  async checkEligibility(yearsExperience: number): Promise<EligibilityResult> {
    await delay(900); // deliberate pause so the loading state is clearly visible
    if (yearsExperience < 2) {
      return {
        eligible: false,
        reason: "A minimum of 2 years of relevant experience is required.",
      };
    }
    return { eligible: true };
  }

  async requiresCoverLetter(roleId: string): Promise<boolean> {
    await delay(600); // simulate a role-config lookup
    // Engineering and data science roles require a cover letter;
    // all other roles skip straight to Review.
    return roleId === "eng" || roleId === "data";
  }
}

// Convenience singleton — import `services` directly in non-DI frameworks.
// Angular demos should ignore this and use @Injectable instead.
export const services = new MockApplicationServices();
