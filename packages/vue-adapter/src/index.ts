import {
  ref,
  shallowRef,
  readonly,
  onScopeDispose,
  defineComponent,
  h,
  computed,
  onMounted,
  provide,
  inject,
  type Ref,
  type DeepReadonly,
  type PropType,
  type InjectionKey,
  type VNode
} from "vue";
import {
  PathData,
  PathDefinition,
  PathEngine,
  PathEvent,
  PathSnapshot
} from "@daltonr/pathwrite-core";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePathOptions {
  /** Called for every engine event (stateChanged, completed, cancelled, resumed). */
  onEvent?: (event: PathEvent) => void;
}

export interface UsePathReturn<TData extends PathData = PathData> {
  /** Current path snapshot, or `null` when no path is active. Reactive — triggers Vue re-renders on change. */
  snapshot: DeepReadonly<Ref<PathSnapshot<TData> | null>>;
  /** Start (or restart) a path. */
  start: (path: PathDefinition<any>, initialData?: PathData) => Promise<void>;
  /** Push a sub-path onto the stack. Requires an active path. Pass an optional `meta` object for correlation — it is returned unchanged to the parent step's `onSubPathComplete` / `onSubPathCancel` hooks. */
  startSubPath: (path: PathDefinition<any>, initialData?: PathData, meta?: Record<string, unknown>) => Promise<void>;
  /** Advance one step. Completes the path on the last step. */
  next: () => Promise<void>;
  /** Go back one step. No-op when already on the first step of a top-level path. Pops back to the parent path when on the first step of a sub-path. */
  previous: () => Promise<void>;
  /** Cancel the active path (or sub-path). */
  cancel: () => Promise<void>;
  /** Jump directly to a step by ID. Calls onLeave / onEnter but bypasses guards and shouldSkip. */
  goToStep: (stepId: string) => Promise<void>;
  /** Jump directly to a step by ID, checking the current step's canMoveNext (forward) or canMovePrevious (backward) guard first. Navigation is blocked if the guard returns false. */
  goToStepChecked: (stepId: string) => Promise<void>;
  /** Update a single data value; triggers a re-render via stateChanged. When `TData` is specified, `key` and `value` are type-checked against your data shape. */
  setData: <K extends string & keyof TData>(key: K, value: TData[K]) => Promise<void>;
  /**
   * Tear down any active path (without firing hooks) and immediately start the
   * given path fresh. Safe to call whether or not a path is currently active.
   * Use for "Start over" / retry flows without remounting the component.
   */
  restart: (path: PathDefinition<any>, initialData?: PathData) => Promise<void>;
}

// ---------------------------------------------------------------------------
// usePath composable
// ---------------------------------------------------------------------------

export function usePath<TData extends PathData = PathData>(options?: UsePathOptions): UsePathReturn<TData> {
  const engine = new PathEngine();
  const _snapshot = shallowRef<PathSnapshot<TData> | null>(null);

  const unsubscribe = engine.subscribe((event: PathEvent) => {
    if (event.type === "stateChanged" || event.type === "resumed") {
      _snapshot.value = event.snapshot as PathSnapshot<TData>;
    } else if (event.type === "completed" || event.type === "cancelled") {
      _snapshot.value = null;
    }
    options?.onEvent?.(event);
  });

  onScopeDispose(unsubscribe);

  const snapshot = readonly(_snapshot) as DeepReadonly<Ref<PathSnapshot<TData> | null>>;

  const start = (path: PathDefinition<any>, initialData: PathData = {}): Promise<void> =>
    engine.start(path, initialData);

  const startSubPath = (path: PathDefinition<any>, initialData: PathData = {}, meta?: Record<string, unknown>): Promise<void> =>
    engine.startSubPath(path, initialData, meta);

  const next = (): Promise<void> => engine.next();
  const previous = (): Promise<void> => engine.previous();
  const cancel = (): Promise<void> => engine.cancel();

  const goToStep = (stepId: string): Promise<void> => engine.goToStep(stepId);
  const goToStepChecked = (stepId: string): Promise<void> => engine.goToStepChecked(stepId);

  const setData = (<K extends string & keyof TData>(key: K, value: TData[K]): Promise<void> =>
    engine.setData(key, value as unknown)) as UsePathReturn<TData>["setData"];

  const restart = (path: PathDefinition<any>, initialData: PathData = {}): Promise<void> =>
    engine.restart(path, initialData);

  return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, restart };
}

// ---------------------------------------------------------------------------
// Context — provide / inject
// ---------------------------------------------------------------------------

/** Injection key used by PathShell and usePathContext. */
const PathInjectionKey: InjectionKey<UsePathReturn> = Symbol("PathContext");

/**
 * Access the nearest `PathShell`'s path instance via Vue `inject`.
 * Throws if used outside of a `<PathShell>`.
 *
 * The optional generic narrows `snapshot.data` for convenience — it is a
 * **type-level assertion**, not a runtime guarantee.
 */
export function usePathContext<TData extends PathData = PathData>(): UsePathReturn<TData> {
  const ctx = inject(PathInjectionKey, null);
  if (ctx === null) {
    throw new Error("usePathContext must be used within a <PathShell>.");
  }
  return ctx as UsePathReturn<TData>;
}

// ---------------------------------------------------------------------------
// Default UI — PathShell
// ---------------------------------------------------------------------------

export interface PathShellActions {
  next: () => Promise<void>;
  previous: () => Promise<void>;
  cancel: () => Promise<void>;
  goToStep: (stepId: string) => Promise<void>;
  goToStepChecked: (stepId: string) => Promise<void>;
  setData: (key: string, value: unknown) => Promise<void>;
  /** Restart the shell's current path with its current `initialData`. */
  restart: () => Promise<void>;
}

/**
 * `<PathShell>` — default UI shell that renders a progress indicator,
 * step content, and navigation buttons. Step content is provided via
 * **named slots** matching each step's `id`.
 *
 * ```vue
 * <PathShell :path="myPath" :initial-data="{ name: '' }" @complete="handleDone">
 *   <template #details><DetailsForm /></template>
 *   <template #review><ReviewPanel /></template>
 * </PathShell>
 * ```
 */
export const PathShell = defineComponent({
  name: "PathShell",
  props: {
    path: { type: Object as PropType<PathDefinition<any>>, required: true },
    initialData: { type: Object as PropType<PathData>, default: () => ({}) },
    autoStart: { type: Boolean, default: true },
    backLabel: { type: String, default: "Back" },
    nextLabel: { type: String, default: "Next" },
    finishLabel: { type: String, default: "Finish" },
    cancelLabel: { type: String, default: "Cancel" },
    hideCancel: { type: Boolean, default: false },
    hideProgress: { type: Boolean, default: false }
  },
  emits: ["complete", "cancel", "event"],
  setup(props, { slots, emit }) {
    const pathReturn = usePath({
      onEvent(event) {
        emit("event", event);
        if (event.type === "completed") emit("complete", event.data);
        if (event.type === "cancelled") emit("cancel", event.data);
      }
    });

    const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;

    // Provide context so child components can use usePathContext()
    provide(PathInjectionKey, pathReturn);

    const started = ref(false);
    onMounted(() => {
      if (props.autoStart && !started.value) {
        started.value = true;
        start(props.path, props.initialData);
      }
    });

    const actions: PathShellActions = {
      next, previous, cancel, goToStep, goToStepChecked, setData,
      restart: () => restart(props.path, props.initialData)
    };

    return () => {
      const snap = snapshot.value as PathSnapshot | null;

      if (!snap) {
        return h("div", { class: "pw-shell" },
          h("div", { class: "pw-shell__empty" }, [
            h("p", "No active path."),
            !props.autoStart
              ? h("button", {
                  type: "button",
                  class: "pw-shell__start-btn",
                  onClick: () => start(props.path, props.initialData)
                }, "Start")
              : null
          ])
        );
      }

      // Resolve step content from named slot matching the current step ID
      const stepSlot = slots[snap.stepId];
      const stepContent = stepSlot ? stepSlot({ snapshot: snap }) : null;

      return h("div", { class: "pw-shell" }, [
        // Header — progress
        !props.hideProgress && (
          slots.header
            ? slots.header({ snapshot: snap })
            : renderVueHeader(snap)
        ),
        // Body — step content
        h("div", { class: "pw-shell__body" }, stepContent ?? []),
        // Validation messages
        snap.validationMessages.length > 0
          ? h("ul", { class: "pw-shell__validation" },
              snap.validationMessages.map((msg, i) =>
                h("li", { key: i, class: "pw-shell__validation-item" }, msg)
              )
            )
          : null,
        // Footer — navigation
        slots.footer
          ? slots.footer({ snapshot: snap, actions })
          : renderVueFooter(snap, actions, props)
      ]);
    };
  }
});

// ---------------------------------------------------------------------------
// Default header (progress indicator)
// ---------------------------------------------------------------------------

function renderVueHeader(snapshot: PathSnapshot): VNode {
  return h("div", { class: "pw-shell__header" }, [
    h("div", { class: "pw-shell__steps" },
      snapshot.steps.map((step, i) =>
        h("div", {
          key: step.id,
          class: ["pw-shell__step", `pw-shell__step--${step.status}`]
        }, [
          h("span", { class: "pw-shell__step-dot" },
            step.status === "completed" ? "✓" : String(i + 1)
          ),
          h("span", { class: "pw-shell__step-label" },
            step.title ?? step.id
          )
        ])
      )
    ),
    h("div", { class: "pw-shell__track" },
      h("div", {
        class: "pw-shell__track-fill",
        style: { width: `${snapshot.progress * 100}%` }
      })
    )
  ]);
}

// ---------------------------------------------------------------------------
// Default footer (navigation buttons)
// ---------------------------------------------------------------------------

function renderVueFooter(
  snapshot: PathSnapshot,
  actions: PathShellActions,
  props: { backLabel: string; nextLabel: string; finishLabel: string; cancelLabel: string; hideCancel: boolean }
): VNode {
  return h("div", { class: "pw-shell__footer" }, [
    h("div", { class: "pw-shell__footer-left" }, [
      !snapshot.isFirstStep
        ? h("button", {
            type: "button",
            class: "pw-shell__btn pw-shell__btn--back",
            disabled: snapshot.isNavigating || !snapshot.canMovePrevious,
            onClick: actions.previous
          }, props.backLabel)
        : null
    ]),
    h("div", { class: "pw-shell__footer-right" }, [
      !props.hideCancel
        ? h("button", {
            type: "button",
            class: "pw-shell__btn pw-shell__btn--cancel",
            disabled: snapshot.isNavigating,
            onClick: actions.cancel
          }, props.cancelLabel)
        : null,
      h("button", {
        type: "button",
        class: "pw-shell__btn pw-shell__btn--next",
        disabled: snapshot.isNavigating || !snapshot.canMoveNext,
        onClick: actions.next
      }, snapshot.isLastStep ? props.finishLabel : props.nextLabel)
    ])
  ]);
}

