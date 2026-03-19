import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore
} from "react";
import type { PropsWithChildren, ReactElement } from "react";
import {
  WizardArgs,
  WizardDefinition,
  WizardEngine,
  WizardEngineEvent,
  WizardSnapshot
} from "@pathwrite/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseWizardOptions {
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: WizardEngineEvent) => void;
}

export interface UseWizardReturn {
  /** Current wizard snapshot, or `null` when no wizard is active. Triggers a React re-render on change. */
  snapshot: WizardSnapshot | null;
  /** Start (or restart) a wizard. */
  start: (wizard: WizardDefinition, initialArgs?: WizardArgs) => void;
  /** Push a sub-wizard onto the stack. Requires an active wizard. */
  startSubWizard: (wizard: WizardDefinition, initialArgs?: WizardArgs) => void;
  /** Advance one step. Completes the wizard on the last step. */
  next: () => void;
  /** Go back one step. Cancels the wizard from the first step. */
  previous: () => void;
  /** Cancel the active wizard (or sub-wizard). */
  cancel: () => void;
  /** Jump directly to a step by ID. Calls onLeavingStep / onVisit but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => void;
  /** Update a single arg; triggers a re-render via stateChanged. */
  setArg: (key: string, value: unknown) => void;
}

export type WizardProviderProps = PropsWithChildren<{
  /** Forwarded to the internal useWizard hook. */
  onEvent?: (event: WizardEngineEvent) => void;
}>;

// ---------------------------------------------------------------------------
// useWizard hook
// ---------------------------------------------------------------------------

export function useWizard(options?: UseWizardOptions): UseWizardReturn {
  // Stable engine instance for the lifetime of the hook
  const engineRef = useRef<WizardEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new WizardEngine();
  }
  const engine = engineRef.current;

  // Keep the onEvent callback current without changing the subscribe identity
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Cached snapshot — updated only inside the subscribe callback
  const snapshotRef = useRef<WizardSnapshot | null>(null);

  const subscribe = useCallback(
    (callback: () => void) =>
      engine.subscribe((event: WizardEngineEvent) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
          snapshotRef.current = event.snapshot;
        } else if (event.type === "completed" || event.type === "cancelled") {
          snapshotRef.current = null;
        }
        onEventRef.current?.(event);
        callback();
      }),
    [engine]
  );

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  // Stable action callbacks
  const start = useCallback(
    (wizard: WizardDefinition, initialArgs: WizardArgs = {}) =>
      engine.start(wizard, initialArgs),
    [engine]
  );

  const startSubWizard = useCallback(
    (wizard: WizardDefinition, initialArgs: WizardArgs = {}) =>
      engine.startSubWizard(wizard, initialArgs),
    [engine]
  );

  const next = useCallback(() => engine.moveNext(), [engine]);
  const previous = useCallback(() => engine.movePrevious(), [engine]);
  const cancel = useCallback(() => engine.cancel(), [engine]);

  const goToStep = useCallback(
    (stepId: string) => engine.goToStep(stepId),
    [engine]
  );

  const setArg = useCallback(
    (key: string, value: unknown) => engine.setArg(key, value),
    [engine]
  );

  return { snapshot, start, startSubWizard, next, previous, cancel, goToStep, setArg };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const WizardContext = createContext<UseWizardReturn | null>(null);

/**
 * Provides a single `useWizard` instance to all descendants.
 * Consume with `useWizardContext()`.
 */
export function WizardProvider({ children, onEvent }: WizardProviderProps): ReactElement {
  const wizard = useWizard({ onEvent });
  return createElement(WizardContext.Provider, { value: wizard }, children);
}

/**
 * Access the nearest `WizardProvider`'s wizard instance.
 * Throws if used outside of a `<WizardProvider>`.
 */
export function useWizardContext(): UseWizardReturn {
  const ctx = useContext(WizardContext);
  if (ctx === null) {
    throw new Error("useWizardContext must be used within a <WizardProvider>.");
  }
  return ctx;
}

