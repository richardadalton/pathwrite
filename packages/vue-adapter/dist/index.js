import { ref, shallowRef, readonly, onScopeDispose, defineComponent, h, onMounted, provide, inject } from "vue";
import { PathEngine } from "@daltonr/pathwrite-core";
// ---------------------------------------------------------------------------
// usePath composable
// ---------------------------------------------------------------------------
export function usePath(options) {
    const engine = options?.engine ?? new PathEngine();
    // Seed immediately from existing engine state — essential when restoring a
    // persisted path (the engine is already started before usePath is called).
    const _snapshot = shallowRef(engine.snapshot());
    const unsubscribe = engine.subscribe((event) => {
        if (event.type === "stateChanged" || event.type === "resumed") {
            _snapshot.value = event.snapshot;
        }
        else if (event.type === "completed" || event.type === "cancelled") {
            _snapshot.value = null;
        }
        options?.onEvent?.(event);
    });
    onScopeDispose(unsubscribe);
    const snapshot = readonly(_snapshot);
    const start = (path, initialData = {}) => engine.start(path, initialData);
    const startSubPath = (path, initialData = {}, meta) => engine.startSubPath(path, initialData, meta);
    const next = () => engine.next();
    const previous = () => engine.previous();
    const cancel = () => engine.cancel();
    const goToStep = (stepId) => engine.goToStep(stepId);
    const goToStepChecked = (stepId) => engine.goToStepChecked(stepId);
    const setData = ((key, value) => engine.setData(key, value));
    const restart = (path, initialData = {}) => engine.restart(path, initialData);
    return { snapshot, start, startSubPath, next, previous, cancel, goToStep, goToStepChecked, setData, restart };
}
// ---------------------------------------------------------------------------
// Context — provide / inject
// ---------------------------------------------------------------------------
/** Injection key used by PathShell and usePathContext. */
const PathInjectionKey = Symbol("PathContext");
/**
 * Access the nearest `PathShell`'s path instance via Vue `inject`.
 * Throws if used outside of a PathShell component.
 *
 * The optional generic narrows `snapshot.data` for convenience — it is a
 * **type-level assertion**, not a runtime guarantee.
 */
export function usePathContext() {
    const ctx = inject(PathInjectionKey, null);
    if (ctx === null) {
        throw new Error("usePathContext must be used within a PathShell component.");
    }
    return ctx;
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
        path: { type: Object, required: true },
        /**
         * An externally-managed engine — for example, the engine returned by
         * `createPersistedEngine()`. When supplied, `PathShell` will skip its own
         * `start()` call and drive the UI from the provided engine instead.
         */
        engine: { type: Object, default: undefined },
        initialData: { type: Object, default: () => ({}) },
        autoStart: { type: Boolean, default: true },
        backLabel: { type: String, default: "Previous" },
        nextLabel: { type: String, default: "Next" },
        completeLabel: { type: String, default: "Complete" },
        cancelLabel: { type: String, default: "Cancel" },
        hideCancel: { type: Boolean, default: false },
        hideProgress: { type: Boolean, default: false }
    },
    emits: ["complete", "cancel", "event"],
    setup(props, { slots, emit }) {
        const pathReturn = usePath({
            engine: props.engine,
            onEvent(event) {
                emit("event", event);
                if (event.type === "completed")
                    emit("complete", event.data);
                if (event.type === "cancelled")
                    emit("cancel", event.data);
            }
        });
        const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;
        // Provide context so child components can use usePathContext()
        provide(PathInjectionKey, pathReturn);
        const started = ref(false);
        onMounted(() => {
            // Skip auto-start when an external engine has been provided — the caller
            // is responsible for starting it (e.g. via createPersistedEngine).
            if (props.autoStart && !started.value && !props.engine) {
                started.value = true;
                start(props.path, props.initialData);
            }
        });
        const actions = {
            next, previous, cancel, goToStep, goToStepChecked, setData,
            restart: () => restart(props.path, props.initialData)
        };
        return () => {
            const snap = snapshot.value;
            if (!snap) {
                return h("div", { class: "pw-shell" }, h("div", { class: "pw-shell__empty" }, [
                    h("p", "No active path."),
                    !props.autoStart
                        ? h("button", {
                            type: "button",
                            class: "pw-shell__start-btn",
                            onClick: () => start(props.path, props.initialData)
                        }, "Start")
                        : null
                ]));
            }
            // Resolve step content from named slot matching the current step ID
            const stepSlot = slots[snap.stepId];
            const stepContent = stepSlot ? stepSlot({ snapshot: snap }) : null;
            return h("div", { class: "pw-shell" }, [
                // Header — progress
                !props.hideProgress && (slots.header
                    ? slots.header({ snapshot: snap })
                    : renderVueHeader(snap)),
                // Body — step content
                h("div", { class: "pw-shell__body" }, stepContent ?? []),
                // Validation messages
                snap.validationMessages.length > 0
                    ? h("ul", { class: "pw-shell__validation" }, snap.validationMessages.map((msg, i) => h("li", { key: i, class: "pw-shell__validation-item" }, msg)))
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
function renderVueHeader(snapshot) {
    return h("div", { class: "pw-shell__header" }, [
        h("div", { class: "pw-shell__steps" }, snapshot.steps.map((step, i) => h("div", {
            key: step.id,
            class: ["pw-shell__step", `pw-shell__step--${step.status}`]
        }, [
            h("span", { class: "pw-shell__step-dot" }, step.status === "completed" ? "✓" : String(i + 1)),
            h("span", { class: "pw-shell__step-label" }, step.title ?? step.id)
        ]))),
        h("div", { class: "pw-shell__track" }, h("div", {
            class: "pw-shell__track-fill",
            style: { width: `${snapshot.progress * 100}%` }
        }))
    ]);
}
// ---------------------------------------------------------------------------
// Default footer (navigation buttons)
// ---------------------------------------------------------------------------
function renderVueFooter(snapshot, actions, props) {
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
            }, snapshot.isLastStep ? props.completeLabel : props.nextLabel)
        ])
    ]);
}
export { PathEngine } from "@daltonr/pathwrite-core";
//# sourceMappingURL=index.js.map