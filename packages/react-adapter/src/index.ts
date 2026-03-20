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
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@pathwrite/core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn {
  /** Current path snapshot, or `null` when no path is active. Triggers a React re-render on change. */
  snapshot: PathSnapshot | null;
  /** Start (or restart) a path. */
  start: (path: PathDefinition, initialData?: PathData) => void;
  /** Push a sub-path onto the stack. Requires an active path. */
  startSubPath: (path: PathDefinition, initialData?: PathData) => void;
  /** Advance one step. Completes the path on the last step. */
  next: () => void;
  /** Go back one step. Cancels the path from the first step. */
  previous: () => void;
  /** Cancel the active path (or sub-path). */
  cancel: () => void;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => void;
  /** Update a single data value; triggers a re-render via stateChanged. */
  setData: (key: string, value: unknown) => void;
}

export type PathProviderProps = PropsWithChildren<{
  /** Forwarded to the internal usePath hook. */
  onEvent?: (event: PathEvent) => void;
}>;

// ---------------------------------------------------------------------------
// usePath hook
// ---------------------------------------------------------------------------

export function usePath(options?: UsePathOptions): UsePathReturn {
  // Stable engine instance for the lifetime of the hook
  const engineRef = useRef<PathEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = new PathEngine();
  }
  const engine = engineRef.current;

  // Keep the onEvent callback current without changing the subscribe identity
  const onEventRef = useRef(options?.onEvent);
  onEventRef.current = options?.onEvent;

  // Cached snapshot — updated only inside the subscribe callback
  const snapshotRef = useRef<PathSnapshot | null>(null);

  const subscribe = useCallback(
    (callback: () => void) =>
      engine.subscribe((event: PathEvent) => {
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
    (path: PathDefinition, initialData: PathData = {}) =>
      engine.start(path, initialData),
    [engine]
  );

  const startSubPath = useCallback(
    (path: PathDefinition, initialData: PathData = {}) =>
      engine.startSubPath(path, initialData),
    [engine]
  );

  const next = useCallback(() => engine.next(), [engine]);
  const previous = useCallback(() => engine.previous(), [engine]);
  const cancel = useCallback(() => engine.cancel(), [engine]);

  const goToStep = useCallback(
    (stepId: string) => engine.goToStep(stepId),
    [engine]
  );

  const setData = useCallback(
    (key: string, value: unknown) => engine.setData(key, value),
    [engine]
  );

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, setData };
}

// ---------------------------------------------------------------------------
// Context + Provider
// ---------------------------------------------------------------------------

const PathContext = createContext<UsePathReturn | null>(null);

/**
 * Provides a single `usePath` instance to all descendants.
 * Consume with `usePathContext()`.
 */
export function PathProvider({ children, onEvent }: PathProviderProps): ReactElement {
  const path = usePath({ onEvent });
  return createElement(PathContext.Provider, { value: path }, children);
}

/**
 * Access the nearest `PathProvider`'s path instance.
 * Throws if used outside of a `<PathProvider>`.
 */
export function usePathContext(): UsePathReturn {
  const ctx = useContext(PathContext);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathProvider>.");
  }
  return ctx;
}
