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
  /** Fetch the list of open roles. Called from onEnter — async, may be slow. */
  getRoles(): Promise<Role[]>;

  /**
   * Check whether the applicant meets minimum requirements.
   * Returns false (with a reason) when `yearsExperience < 2`.
   * Called from canMoveNext — async guard enforcement.
   */
  checkEligibility(yearsExperience: number): Promise<EligibilityResult>;
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
}

// Module-level singleton — shared by the path factory and step components.
// In a real app this would typically come from a DI container or React context.
export const services = new MockApplicationServices();
