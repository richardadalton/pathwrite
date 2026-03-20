import {
  ref,
  shallowRef,
  readonly,
  onScopeDispose,
  type Ref,
  type DeepReadonly
} from "vue";
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
  /** Current path snapshot, or `null` when no path is active. Reactive — triggers Vue re-renders on change. */
  snapshot: DeepReadonly<Ref<PathSnapshot | null>>;
  /** Start (or restart) a path. */
  start: (path: PathDefinition, initialData?: PathData) => Promise<void>;
  /** Push a sub-path onto the stack. Requires an active path. */
  startSubPath: (path: PathDefinition, initialData?: PathData) => Promise<void>;
  /** Advance one step. Completes the path on the last step. */
  next: () => Promise<void>;
  /** Go back one step. Cancels the path from the first step. */
  previous: () => Promise<void>;
  /** Cancel the active path (or sub-path). */
  cancel: () => Promise<void>;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => Promise<void>;
  /** Update a single data value; triggers a re-render via stateChanged. */
  setData: (key: string, value: unknown) => Promise<void>;
}

// ---------------------------------------------------------------------------
// usePath composable
// ---------------------------------------------------------------------------

export function usePath(options?: UsePathOptions): UsePathReturn {
  const engine = new PathEngine();
  const _snapshot = shallowRef<PathSnapshot | null>(null);

  const unsubscribe = engine.subscribe((event: PathEvent) => {
    if (event.type === "stateChanged" || event.type === "resumed") {
      _snapshot.value = event.snapshot;
    } else if (event.type === "completed" || event.type === "cancelled") {
      _snapshot.value = null;
    }
    options?.onEvent?.(event);
  });

  onScopeDispose(unsubscribe);

  const snapshot = readonly(_snapshot) as DeepReadonly<Ref<PathSnapshot | null>>;

  const start = (path: PathDefinition, initialData: PathData = {}): Promise<void> =>
    engine.start(path, initialData);

  const startSubPath = (path: PathDefinition, initialData: PathData = {}): Promise<void> =>
    engine.startSubPath(path, initialData);

  const next = (): Promise<void> => engine.next();
  const previous = (): Promise<void> => engine.previous();
  const cancel = (): Promise<void> => engine.cancel();

  const goToStep = (stepId: string): Promise<void> => engine.goToStep(stepId);

  const setData = (key: string, value: unknown): Promise<void> =>
    engine.setData(key, value);

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, setData };
}
