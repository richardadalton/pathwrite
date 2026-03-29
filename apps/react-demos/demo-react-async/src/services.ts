// ---------------------------------------------------------------------------
// Service interface — what the path definition depends on.
// In a real app this would be an API client or injected service class.
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
  /** Fetch the list of open roles. Called from step components via usePathContext. */
  getRoles(): Promise<Role[]>;

  /**
   * Check whether the applicant meets minimum requirements.
   * Returns false (with a reason) when `yearsExperience < 2`.
   * Called from canMoveNext — async guard enforcement.
   */
  checkEligibility(yearsExperience: number): Promise<EligibilityResult>;

  /**
   * Check whether the selected role requires a cover letter.
   * Called from shouldSkip — demonstrates async shouldSkip with accurate
   * stepCount/progress once the result resolves.
   */
  requiresCoverLetter(roleId: string): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Mock implementation — simulates realistic network latency.
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
    await delay(900); // deliberate pause so the spinner is clearly visible
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
    // other roles skip straight to Review.
    return roleId === "eng" || roleId === "data";
  }
}

// Module-level singleton — shared by the path factory and step components.
// In a real app this would typically come from a DI container or React context.
export const services = new MockApplicationServices();
