/**
 * Complete example of using PathEngineWithStore for auto-persistence
 * 
 * This example shows a multi-step onboarding wizard that automatically
 * saves progress to a backend API and restores on page refresh.
 */

import { PathEngine, PathDefinition } from "@daltonr/pathwrite-core";
import { HttpStore, PathEngineWithStore } from "@daltonr/pathwrite-store-http";

// ============================================================================
// 1. Define your wizard path
// ============================================================================

interface OnboardingData {
  userId: string;
  name?: string;
  email?: string;
  company?: string;
  role?: string;
  preferences?: {
    newsletter: boolean;
    notifications: boolean;
  };
}

const onboardingPath: PathDefinition<OnboardingData> = {
  id: "onboarding",
  title: "Welcome Onboarding",
  steps: [
    {
      id: "welcome",
      title: "Welcome",
      canMoveNext: (ctx) => !!ctx.data.name && ctx.data.name.trim().length > 0,
      validationMessages: (ctx) => {
        if (!ctx.data.name || ctx.data.name.trim().length === 0) {
          return ["Please enter your name"];
        }
        return [];
      },
    },
    {
      id: "contact",
      title: "Contact Information",
      canMoveNext: (ctx) => {
        const email = ctx.data.email || "";
        return email.includes("@") && email.includes(".");
      },
      validationMessages: (ctx) => {
        const email = ctx.data.email || "";
        if (!email) return ["Email is required"];
        if (!email.includes("@")) return ["Please enter a valid email address"];
        return [];
      },
    },
    {
      id: "company",
      title: "Company Details",
      canMoveNext: (ctx) => !!ctx.data.company && !!ctx.data.role,
    },
    {
      id: "preferences",
      title: "Preferences",
      onEnter: (ctx) => {
        // Set defaults on first entry only
        if (ctx.isFirstEntry) {
          return {
            preferences: {
              newsletter: true,
              notifications: true,
            },
          };
        }
      },
    },
    {
      id: "complete",
      title: "All Done!",
    },
  ],
};

// ============================================================================
// 2. Set up HttpStore with your backend API
// ============================================================================

const store = new HttpStore({
  baseUrl: "/api/wizard",
  
  // Add authentication headers
  headers: async () => {
    const token = await getAuthToken(); // Your auth function
    return {
      Authorization: `Bearer ${token}`,
      "X-User-ID": getCurrentUserId(),
    };
  },
  
  // Handle errors gracefully
  onError: (error, operation, key) => {
    console.error(`[Wizard] Failed to ${operation} state for ${key}:`, error);
    
    // Show user-friendly error message
    if (operation === "save") {
      showToast("⚠️ Failed to save progress. Please check your connection.", "warning");
    }
  },
});

// ============================================================================
// 3. Create PathEngineWithStore with auto-persistence
// ============================================================================

const wrapper = new PathEngineWithStore({
  // Unique key for this user's wizard state
  key: `user:${getCurrentUserId()}:onboarding`,
  
  // The HTTP store
  store,
  
  // Save strategy defaults to "onNext" - saves on forward navigation
  // Uncomment to change:
  // persistenceStrategy: "onEveryChange", // Requires debounceMs for text inputs
  
  // Debounce rapid changes (only needed with onEveryChange strategy)
  // debounceMs: 500,
  
  // Success callback
  onSaveSuccess: () => {
    console.log("[Wizard] Progress saved successfully");
    showToast("✓ Progress saved", "success");
  },
  
  // Error callback
  onSaveError: (error) => {
    console.error("[Wizard] Save failed:", error);
    showToast(`✗ Failed to save: ${error.message}`, "error");
    
    // Optionally log to error tracking service
    logErrorToSentry(error, {
      context: "wizard-auto-save",
      userId: getCurrentUserId(),
    });
  },
});

// ============================================================================
// 4. Initialize the wizard (restore or start fresh)
// ============================================================================

async function initializeWizard() {
  try {
    // startOrRestore automatically:
    // 1. Tries to load saved state from the backend
    // 2. If found, restores the PathEngine from saved state
    // 3. If not found, starts a fresh wizard
    await wrapper.startOrRestore(
      onboardingPath,
      { onboarding: onboardingPath }, // Map of all path definitions
      { userId: getCurrentUserId() }  // Initial data for fresh start
    );
    
    console.log("[Wizard] Initialized successfully");
    
    // Get the underlying PathEngine
    const engine = wrapper.getEngine();
    
    // Subscribe to events for UI updates
    engine.subscribe((event) => {
      if (event.type === "stateChanged") {
        updateUI(event.snapshot);
      } else if (event.type === "completed") {
        handleWizardComplete(event.data);
      }
    });
    
    // Render initial state
    const snapshot = engine.snapshot();
    if (snapshot) {
      updateUI(snapshot);
    }
    
    return engine;
  } catch (error) {
    console.error("[Wizard] Failed to initialize:", error);
    showToast("Failed to load wizard. Please refresh the page.", "error");
    throw error;
  }
}

// ============================================================================
// 5. Wire up UI interactions
// ============================================================================

let engine: PathEngine;

document.addEventListener("DOMContentLoaded", async () => {
  // Initialize the wizard
  engine = await initializeWizard();
  
  // Wire up navigation buttons
  document.getElementById("next-btn")?.addEventListener("click", async () => {
    try {
      await engine.next();
      // State automatically saved by PathEngineWithStore!
    } catch (error) {
      console.error("Navigation error:", error);
    }
  });
  
  document.getElementById("back-btn")?.addEventListener("click", async () => {
    try {
      await engine.previous();
    } catch (error) {
      console.error("Navigation error:", error);
    }
  });
  
  // Wire up form fields
  document.getElementById("name-input")?.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    engine.setData("name", value);
    // Debounced save will happen automatically!
  });
  
  document.getElementById("email-input")?.addEventListener("input", (e) => {
    const value = (e.target as HTMLInputElement).value;
    engine.setData("email", value);
  });
  
  // Cleanup on page unload
  window.addEventListener("beforeunload", async () => {
    // Ensure any pending saves complete
    await wrapper.waitForPendingSave();
    wrapper.cleanup();
  });
});

// ============================================================================
// 6. Handle wizard completion
// ============================================================================

async function handleWizardComplete(data: OnboardingData) {
  console.log("[Wizard] Completed with data:", data);
  
  // Send final data to your backend
  try {
    await fetch("/api/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    
    // Delete the saved wizard state (no longer needed)
    await wrapper.deleteSavedState();
    
    // Show success message
    showToast("🎉 Onboarding complete!", "success");
    
    // Redirect to dashboard
    setTimeout(() => {
      window.location.href = "/dashboard";
    }, 2000);
  } catch (error) {
    console.error("[Wizard] Failed to complete onboarding:", error);
    showToast("Failed to complete onboarding. Please try again.", "error");
  }
}

// ============================================================================
// 7. UI update function
// ============================================================================

function updateUI(snapshot: ReturnType<PathEngine["snapshot"]>) {
  if (!snapshot) return;
  
  // Update progress indicator
  const progressBar = document.getElementById("progress-bar");
  if (progressBar) {
    progressBar.style.width = `${snapshot.progress * 100}%`;
  }
  
  // Update step title
  const titleElement = document.getElementById("step-title");
  if (titleElement) {
    titleElement.textContent = snapshot.stepTitle || snapshot.stepId;
  }
  
  // Update navigation buttons
  const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
  const nextBtn = document.getElementById("next-btn") as HTMLButtonElement;
  
  if (backBtn) {
    backBtn.disabled = snapshot.isFirstStep || snapshot.isNavigating;
  }
  
  if (nextBtn) {
    nextBtn.disabled = !snapshot.canMoveNext || snapshot.isNavigating;
    nextBtn.textContent = snapshot.isLastStep ? "Complete" : "Next";
  }
  
  // Show validation messages
  const messagesContainer = document.getElementById("validation-messages");
  if (messagesContainer) {
    messagesContainer.innerHTML = snapshot.validationMessages
      .map((msg) => `<div class="error-message">${msg}</div>`)
      .join("");
  }
  
  // Update step indicator
  const stepsContainer = document.getElementById("steps-indicator");
  if (stepsContainer) {
    stepsContainer.innerHTML = snapshot.steps
      .map(
        (step) => `
        <div class="step step-${step.status}">
          <div class="step-number">${step.status === "completed" ? "✓" : ""}</div>
          <div class="step-title">${step.title || step.id}</div>
        </div>
      `
      )
      .join("");
  }
}

// ============================================================================
// Helper functions (implement these based on your app)
// ============================================================================

function getAuthToken(): Promise<string> {
  // Return your auth token
  return Promise.resolve(localStorage.getItem("auth_token") || "");
}

function getCurrentUserId(): string {
  // Return current user ID
  return localStorage.getItem("user_id") || "anonymous";
}

function showToast(message: string, type: "success" | "error" | "warning" = "success") {
  // Show toast notification to user
  console.log(`[Toast ${type}]`, message);
  // Implement with your preferred toast library
}

function logErrorToSentry(error: Error, context: Record<string, any>) {
  // Log error to your error tracking service
  console.error("[Sentry]", error, context);
}

export { engine, wrapper, initializeWizard };


