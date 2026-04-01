<script lang="ts">
  import { onMount } from 'svelte';
  import { usePath, setPathContext, getPathContextOrNull, formatFieldKey, errorPhaseMessage, stepIdToCamelCase } from './index.svelte.js';
  import type { PathDefinition, PathData, PathEngine, PathSnapshot, ProgressLayout } from './index.svelte.js';
  import type { Snippet, Component } from 'svelte';


  interface Props {
    path?: PathDefinition<any>;
    engine?: PathEngine;
    initialData?: PathData;
    /**
     * When set, this shell automatically saves its state into the nearest outer `PathShell`'s
     * data under this key on every change, and restores from that stored state on remount.
     * No-op when used on a top-level shell with no outer `PathShell` ancestor.
     */
    restoreKey?: string;
    autoStart?: boolean;
    backLabel?: string;
    nextLabel?: string;
    completeLabel?: string;
    loadingLabel?: string;
    cancelLabel?: string;
    hideCancel?: boolean;
    hideProgress?: boolean;
    /** If true, hide the footer (navigation buttons). The error panel is still shown on async failure regardless of this prop. */
    hideFooter?: boolean;
    /** When true, calls `validate()` on the engine so all steps show inline errors simultaneously. Useful when this shell is nested inside a step of an outer shell: bind to the outer snapshot's `hasAttemptedNext`. */
    validateWhen?: boolean;
    /**
     * Shell layout mode:
     * - "auto" (default): Uses "form" for single-step top-level paths, "wizard" otherwise.
     * - "wizard": Progress header + Back button on left, Cancel and Submit together on right.
     * - "form": Progress header + Cancel on left, Submit alone on right. Back button never shown.
     * - "tabs": No progress header, no footer. Use for tabbed interfaces with a custom tab bar inside the step body.
     */
    layout?: "wizard" | "form" | "auto" | "tabs";
    /**
     * Controls whether the shell renders its auto-generated field-error summary box.
     * - `"summary"` (default): Shell renders the labeled error list below the step body.
     * - `"inline"`: Suppress the summary — handle errors inside the step template instead.
     * - `"both"`: Render the shell summary AND whatever the step template renders.
     */
    validationDisplay?: "summary" | "inline" | "both";
    /**
     * Controls how progress bars are arranged when a sub-path is active.
     * - "merged" (default): Root and sub-path bars in one card.
     * - "split": Root and sub-path bars as separate cards.
     * - "rootOnly": Only the root bar — sub-path bar hidden.
     * - "activeOnly": Only the active (sub-path) bar — root bar hidden.
     */
    progressLayout?: ProgressLayout;
    /**
     * Services object passed through context to all step components.
     * Step components access it via `usePathContext<TData, TServices>()`.
     */
    services?: unknown;
    // Callback props replace event dispatching in Svelte 5
    oncomplete?: (data: PathData) => void;
    oncancel?: (data: PathData) => void;
    onevent?: (event: any) => void;
    // Optional override snippets for header and footer
    header?: Snippet<[PathSnapshot<any>]>;
    footer?: Snippet<[PathSnapshot<any>, object]>;
    /** Snippet rendered when `snapshot.status === "completed"`. Defaults to a simple "All done." panel with a restart button. */
    completion?: Snippet<[PathSnapshot<any>]>;
    // All other props treated as step components keyed by step ID
    [key: string]: Component<any> | any;
  }

  let {
    path,
    engine: engineProp,
    initialData = {},
    restoreKey = undefined,
    autoStart = true,
    backLabel = 'Previous',
    nextLabel = 'Next',
    completeLabel = 'Complete',
    loadingLabel = undefined,
    cancelLabel = 'Cancel',
    hideCancel = false,
    hideProgress = false,
    hideFooter = false,
    validateWhen = false,
    layout = 'auto',
    validationDisplay = 'summary',
    progressLayout = 'merged',
    services = null,
    oncomplete,
    oncancel,
    onevent,
    header,
    footer,
    completion,
    ...stepSnippets
  }: Props = $props();

  // Read outer PathShell context BEFORE setting our own — gives access to
  // parent shell's snapshot and setData for restoreKey auto-wiring.
  const outerCtx = getPathContextOrNull();

  // Initialize path engine
  const pathReturn = usePath({
    get engine() { return engineProp; },
    onEvent: (event) => {
      onevent?.(event);
      if (event.type === 'completed') oncomplete?.(event.data);
      if (event.type === 'cancelled') oncancel?.(event.data);
      if (restoreKey && outerCtx && event.type === 'stateChanged') {
        (outerCtx.setData as unknown as (key: string, value: unknown) => Promise<void>)(
          restoreKey, event.snapshot
        );
      }
    }
  });

  const { start, next, previous, cancel, goToStep, goToStepChecked, setData, restart: restartFn, retry, suspend } = pathReturn;

  // Provide context for child step components
  setPathContext({
    get snapshot() { return pathReturn.snapshot; },
    next,
    previous,
    cancel,
    goToStep,
    goToStepChecked,
    setData,
    restart: () => restartFn(path, initialData),
    retry,
    suspend,
    get services() { return services; },
  });

  // Dev-mode warning: camelCase callback props are silently ignored in Svelte.
  // Warn if the user passed onComplete/onCancel/onEvent instead of the correct
  // lowercase forms oncomplete/oncancel/onevent.
  if (import.meta.env?.DEV !== false) {
    const camelCallbacks = ['onComplete', 'onCancel', 'onEvent'] as const;
    for (const name of camelCallbacks) {
      if (name in stepSnippets) {
        console.warn(
          `[PathShell] "${name}" was passed but will be ignored. Svelte uses lowercase callback props — use "${name.toLowerCase()}" instead.`
        );
      }
    }
  }

  // Auto-start the path when no external engine is provided
  let started = false;
  onMount(() => {
    if (autoStart && !started && !engineProp) {
      started = true;
      let startData: PathData = initialData ?? {};
      let restoreStepId: string | undefined;
      if (restoreKey && outerCtx) {
        const stored = outerCtx.snapshot?.data[restoreKey] as PathSnapshot<any> | undefined;
        if (stored != null && typeof stored === 'object' && 'stepId' in stored) {
          startData = stored.data as PathData;
          if (stored.stepIndex > 0) restoreStepId = stored.stepId as string;
        }
      }
      const p = start(path, startData);
      if (restoreStepId) {
        p.then(() => goToStep(restoreStepId!));
      }
    }
  });

  $effect(() => {
    if (validateWhen) pathReturn.validate();
  });

  function warnMissingStep(stepId: string): void {
    const camel = stepIdToCamelCase(stepId);
    const hint = camel !== stepId
      ? ` No snippet found for "${stepId}" or its camelCase form "${camel}". If your step ID contains hyphens, pass the snippet as a camelCase prop: ${camel}={YourComponent}.`
      : ` No snippet found for "${stepId}".`;
    console.warn(`[PathShell]${hint}`);
  }

  let snap = $derived(pathReturn.snapshot);
  let actions = $derived({ next, previous, cancel, goToStep, goToStepChecked, setData, restart: () => restartFn(path, initialData), retry, suspend });

  let effectiveHideProgress = $derived(hideProgress || layout === 'tabs');
  let effectiveHideFooter = $derived(hideFooter || layout === 'tabs');

  // Auto-detect footer layout: single-step top-level paths use "form", everything else uses "wizard"
  let resolvedFooterLayout = $derived(
    (layout === 'auto' || layout === 'tabs') && snap
      ? (snap.stepCount === 1 && snap.nestingLevel === 0 ? 'form' : 'wizard')
      : (layout === 'auto' || layout === 'tabs' ? 'wizard' : layout)
  );

  /**
   * Restart the active path from step 1 with the original `initialData`,
   * without unmounting the shell. Use with `bind:this`:
   *
   * ```svelte
   * <PathShell bind:this={shellRef} path={myPath} />
   * <button onclick={() => shellRef.restart()}>Try Again</button>
   * ```
   */
  export function restart(): Promise<void> {
    return pathReturn.restart(path, initialData);
  }
</script>

<div class="pw-shell {progressLayout !== 'merged' ? `pw-shell--progress-${progressLayout}` : ''}">
  {#if !snap}
    <div class="pw-shell__empty">
      <p>No active path.</p>
      {#if !autoStart}
        <button type="button" class="pw-shell__start-btn" onclick={() => start(path, initialData)}>
          Start
        </button>
      {/if}
    </div>
  {:else if snap.status === 'completed'}
    <!-- Completion panel: shown after stayOnFinal completion -->
    {#if !effectiveHideProgress && snap.stepCount > 1}
      <div class="pw-shell__header">
        <div class="pw-shell__steps">
          {#each snap.steps as step, i}
            <div class="pw-shell__step pw-shell__step--{step.status}">
              <span class="pw-shell__step-dot">✓</span>
              <span class="pw-shell__step-label">{step.title ?? step.id}</span>
            </div>
          {/each}
        </div>
        <div class="pw-shell__track">
          <div class="pw-shell__track-fill" style="width: 100%"></div>
        </div>
      </div>
    {/if}
    <div class="pw-shell__body">
      {#if completion}
        {@render completion(snap)}
      {:else}
        <div class="pw-shell__completion">
          <p class="pw-shell__completion-message">All done.</p>
          <button type="button" class="pw-shell__completion-restart" onclick={() => restartFn(path, initialData)}>
            Start over
          </button>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Root progress: persistent top-level bar visible during sub-paths -->
    {#if !effectiveHideProgress && snap.rootProgress && progressLayout !== 'activeOnly'}
      <div class="pw-shell__root-progress">
        <div class="pw-shell__steps">
          {#each snap.rootProgress.steps as step, i}
            <div class="pw-shell__step pw-shell__step--{step.status}">
              <span class="pw-shell__step-dot">
                {step.status === 'completed' ? '✓' : i + 1}
              </span>
              <span class="pw-shell__step-label">{step.title ?? step.id}</span>
            </div>
          {/each}
        </div>
        <div class="pw-shell__track">
          <div class="pw-shell__track-fill" style="width: {snap.rootProgress.progress * 100}%"></div>
        </div>
      </div>
    {/if}

    <!-- Header: progress indicator (overridable via header snippet) -->
    {#if !effectiveHideProgress && progressLayout !== 'rootOnly'}
      {#if header}
        {@render header(snap)}
      {:else if snap.stepCount > 1 || snap.nestingLevel > 0}
        <div class="pw-shell__header">
          <div class="pw-shell__steps">
            {#each snap.steps as step, i}
              <div class="pw-shell__step pw-shell__step--{step.status}">
                <span class="pw-shell__step-dot">
                  {step.status === 'completed' ? '✓' : i + 1}
                </span>
                <span class="pw-shell__step-label">{step.title ?? step.id}</span>
              </div>
            {/each}
          </div>
          <div class="pw-shell__track">
            <div class="pw-shell__track-fill" style="width: {snap.progress * 100}%"></div>
          </div>
        </div>
      {/if}
    {/if}

    <!-- Body: current step rendered via named snippet.
         Prefer formId (inner step id of a StepChoice) so consumers can
         register snippets by inner step ids directly.
         Hyphenated step IDs (e.g. "cover-letter") are normalised to camelCase
         ("coverLetter") as a fallback, since Svelte props must be valid JS
         identifiers. -->
    <div class="pw-shell__body">
      {#if snap.formId && stepSnippets[snap.formId]}
        {@const StepComponent = stepSnippets[snap.formId]}
        <StepComponent />
      {:else if stepSnippets[snap.stepId]}
        {@const StepComponent = stepSnippets[snap.stepId]}
        <StepComponent />
      {:else if stepSnippets[stepIdToCamelCase(snap.formId ?? snap.stepId)]}
        {@const StepComponent = stepSnippets[stepIdToCamelCase(snap.formId ?? snap.stepId)]}
        <StepComponent />
      {:else}
        {warnMissingStep(snap.stepId)}
        <p>No content for step "{snap.stepId}"</p>
      {/if}
    </div>

    <!-- Validation messages — suppressed when validationDisplay="inline" -->
    {#if validationDisplay !== 'inline' && (snap.hasAttemptedNext || snap.hasValidated) && Object.keys(snap.fieldErrors).length > 0}
      <ul class="pw-shell__validation">
        {#each Object.entries(snap.fieldErrors) as [key, msg]}
          <li class="pw-shell__validation-item">
            {#if key !== '_'}<span class="pw-shell__validation-label">{formatFieldKey(key)}</span>{/if}{msg}
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Warning messages — non-blocking, shown immediately (no hasAttemptedNext gate) -->
    {#if validationDisplay !== 'inline' && Object.keys(snap.fieldWarnings).length > 0}
      <ul class="pw-shell__warnings">
        {#each Object.entries(snap.fieldWarnings) as [key, msg]}
          <li class="pw-shell__warnings-item">
            {#if key !== '_'}<span class="pw-shell__warnings-label">{formatFieldKey(key)}</span>{/if}{msg}
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Blocking error — guard returned { allowed: false, reason } -->
    {#if validationDisplay !== 'inline' && (snap.hasAttemptedNext || snap.hasValidated) && snap.blockingError}
      <p class="pw-shell__blocking-error">{snap.blockingError}</p>
    {/if}

    <!-- Error panel: replaces footer when an async operation has failed -->
    {#if snap.status === "error" && snap.error}
      {@const err = snap.error}
      {@const escalated = err.retryCount >= 2}
      <div class="pw-shell__error">
        <div class="pw-shell__error-title">{escalated ? "Still having trouble." : "Something went wrong."}</div>
        <div class="pw-shell__error-message">{errorPhaseMessage(err.phase)}{err.message ? ` ${err.message}` : ""}</div>
        <div class="pw-shell__error-actions">
          {#if !escalated}
            <button type="button" class="pw-shell__btn pw-shell__btn--retry" onclick={retry}>Try again</button>
          {/if}
          {#if snap.hasPersistence}
            <button
              type="button"
              class="pw-shell__btn {escalated ? 'pw-shell__btn--retry' : 'pw-shell__btn--suspend'}"
              onclick={suspend}
            >Save and come back later</button>
          {/if}
          {#if escalated && !snap.hasPersistence}
            <button type="button" class="pw-shell__btn pw-shell__btn--retry" onclick={retry}>Try again</button>
          {/if}
        </div>
      </div>
    <!-- Footer: navigation buttons (overridable via footer snippet) -->
    {:else if !effectiveHideFooter && footer}
      {@render footer(snap, actions)}
    {:else if !effectiveHideFooter}
      <div class="pw-shell__footer">
        <div class="pw-shell__footer-left">
          {#if resolvedFooterLayout === 'form' && !hideCancel}
            <!-- Form mode: Cancel on the left -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              disabled={snap.status !== "idle"}
              onclick={cancel}
            >
              {cancelLabel}
            </button>
          {:else if resolvedFooterLayout === 'wizard' && !snap.isFirstStep}
            <!-- Wizard mode: Back on the left -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--back"
              disabled={snap.status !== "idle" || !snap.canMovePrevious}
              onclick={previous}
            >
              {backLabel}
            </button>
          {/if}
        </div>
        <div class="pw-shell__footer-right">
          {#if resolvedFooterLayout === 'wizard' && !hideCancel}
            <!-- Wizard mode: Cancel on the right -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              disabled={snap.status !== "idle"}
              onclick={cancel}
            >
              {cancelLabel}
            </button>
          {/if}
          <!-- Both modes: Submit on the right -->
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--next"
            class:pw-shell__btn--loading={snap.status !== "idle"}
            disabled={snap.status !== "idle"}
            onclick={next}
          >
            {snap.status !== 'idle' && loadingLabel ? loadingLabel : snap.isLastStep ? completeLabel : nextLabel}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Component-level styles inherited from shell.css */
</style>
