/**
 * Complete working example: Vue 3 wizard with HTTP persistence
 * 
 * This shows the full pattern once core has exportState()/fromState()
 * and the Vue adapter exposes them.
 */

import { ref, onMounted, watch } from "vue";
import { PathEngine, PathDefinition, PathData } from "@daltonr/pathwrite-core";
import { HttpStore } from "@daltonr/pathwrite-store-http";

// Define your path
interface FormData extends PathData {
  name: string;
  email: string;
  company: string;
  approved: boolean;
}

const registrationPath: PathDefinition<FormData> = {
  id: "registration",
  steps: [
    {
      id: "personal",
      canMoveNext: (ctx) => ctx.data.name.length > 0 && ctx.data.email.length > 0,
    },
    {
      id: "company",
      canMoveNext: (ctx) => ctx.data.company.length > 0,
    },
    {
      id: "review",
    },
  ],
};

// ============================================================================
// Composable: usePersistentPath
// ============================================================================

export function usePersistentPath<TData extends PathData>(options: {
  path: PathDefinition<TData>;
  store: HttpStore;
  storeKey: string;
  initialData?: TData;
  onComplete?: (data: TData) => void;
}) {
  const engine = ref<PathEngine | null>(null);
  const snapshot = ref<PathSnapshot<TData> | null>(null);
  const isLoading = ref(true);
  const saveError = ref<Error | null>(null);

  // Load saved state on mount
  onMounted(async () => {
    try {
      const saved = await options.store.load(options.storeKey);

      if (saved) {
        // Restore from saved state
        engine.value = PathEngine.fromState(saved, options.path);
      } else {
        // Start fresh
        engine.value = new PathEngine();
        await engine.value.start(options.path, options.initialData ?? ({} as TData));
      }

      // Subscribe to events
      engine.value.subscribe((event) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
          snapshot.value = event.snapshot as PathSnapshot<TData>;
        }
        if (event.type === "completed") {
          snapshot.value = null;
          options.onComplete?.(event.data as TData);
        }
      });

      // Set initial snapshot
      snapshot.value = engine.value.snapshot() as PathSnapshot<TData> | null;
    } catch (error) {
      console.error("Failed to load wizard state:", error);
    } finally {
      isLoading.value = false;
    }
  });

  // Auto-save on snapshot changes (debounced)
  let saveTimeout: number | null = null;
  watch(
    snapshot,
    async (newSnapshot) => {
      if (!newSnapshot || !engine.value) return;

      // Clear pending save
      if (saveTimeout) clearTimeout(saveTimeout);

      // Debounce: save 500ms after last change
      saveTimeout = setTimeout(async () => {
        try {
          const state = engine.value!.exportState();
          await options.store.save(options.storeKey, state);
          saveError.value = null;
        } catch (error) {
          saveError.value = error instanceof Error ? error : new Error(String(error));
          console.error("Failed to save wizard state:", error);
        }
      }, 500) as unknown as number;
    },
    { deep: true }
  );

  // Navigation methods
  const next = async () => engine.value?.next();
  const previous = async () => engine.value?.previous();
  const cancel = async () => engine.value?.cancel();
  const setData = async <K extends keyof TData>(key: K, value: TData[K]) =>
    engine.value?.setData(key as string, value);
  const restart = async () => engine.value?.restart(options.path, options.initialData);

  return {
    snapshot,
    isLoading,
    saveError,
    next,
    previous,
    cancel,
    setData,
    restart,
  };
}

// ============================================================================
// Usage in a component
// ============================================================================

export default {
  setup() {
    const userId = "user-123"; // From auth context

    const store = new HttpStore({
      baseUrl: "/api/wizard",
      headers: () => ({
        Authorization: `Bearer ${localStorage.getItem("authToken")}`,
      }),
      onError: (error, operation, key) => {
        console.error(`HTTP store ${operation} failed for ${key}:`, error);
      },
    });

    const { snapshot, isLoading, saveError, next, previous, setData } = usePersistentPath({
      path: registrationPath,
      store,
      storeKey: `user:${userId}:registration`,
      initialData: { name: "", email: "", company: "", approved: false },
      onComplete: async (data) => {
        console.log("Registration complete!", data);
        // Submit to backend
        await fetch("/api/registrations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      },
    });

    return {
      snapshot,
      isLoading,
      saveError,
      next,
      previous,
      setData,
    };
  },

  template: `
    <div class="wizard">
      <div v-if="isLoading">Loading...</div>
      
      <div v-else-if="snapshot">
        <div v-if="saveError" class="save-error">
          ⚠️ Failed to save progress: {{ saveError.message }}
        </div>

        <!-- Personal step -->
        <div v-if="snapshot.stepId === 'personal'">
          <h2>Personal Information</h2>
          <label>
            Name
            <input 
              :value="snapshot.data.name" 
              @input="setData('name', $event.target.value)"
            />
          </label>
          <label>
            Email
            <input 
              :value="snapshot.data.email" 
              @input="setData('email', $event.target.value)"
            />
          </label>
        </div>

        <!-- Company step -->
        <div v-if="snapshot.stepId === 'company'">
          <h2>Company</h2>
          <label>
            Company name
            <input 
              :value="snapshot.data.company" 
              @input="setData('company', $event.target.value)"
            />
          </label>
        </div>

        <!-- Review step -->
        <div v-if="snapshot.stepId === 'review'">
          <h2>Review</h2>
          <dl>
            <dt>Name</dt><dd>{{ snapshot.data.name }}</dd>
            <dt>Email</dt><dd>{{ snapshot.data.email }}</dd>
            <dt>Company</dt><dd>{{ snapshot.data.company }}</dd>
          </dl>
        </div>

        <!-- Navigation -->
        <div class="nav">
          <button 
            v-if="!snapshot.isFirstStep"
            @click="previous" 
            :disabled="snapshot.isNavigating"
          >
            Back
          </button>
          <button 
            @click="next" 
            :disabled="snapshot.isNavigating || !snapshot.canMoveNext"
          >
            {{ snapshot.isLastStep ? "Submit" : "Next" }}
          </button>
        </div>
      </div>

      <div v-else>
        <p>Wizard completed or not started.</p>
      </div>
    </div>
  `,
};

