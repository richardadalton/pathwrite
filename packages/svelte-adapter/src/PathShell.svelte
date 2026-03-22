<script lang="ts">
  import { onMount } from 'svelte';
  import { usePath, setPathContext } from './index.svelte.js';
  import type { PathDefinition, PathData, PathEngine, PathSnapshot } from './index.svelte.js';
  import type { Snippet } from 'svelte';

  /** Converts a camelCase or lowercase field key to a display label. */
  function formatFieldKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
  }

  interface Props {
    path?: PathDefinition<any>;
    engine?: PathEngine;
    initialData?: PathData;
    autoStart?: boolean;
    backLabel?: string;
    nextLabel?: string;
    completeLabel?: string;
    cancelLabel?: string;
    hideCancel?: boolean;
    hideProgress?: boolean;
    /**
     * Footer layout mode:
     * - "auto" (default): Uses "form" for single-step top-level paths, "wizard" otherwise.
     * - "wizard": Back button on left, Cancel and Submit together on right.
     * - "form": Cancel on left, Submit alone on right. Back button never shown.
     */
    footerLayout?: "wizard" | "form" | "auto";
    // Callback props replace event dispatching in Svelte 5
    oncomplete?: (data: PathData) => void;
    oncancel?: (data: PathData) => void;
    onevent?: (event: any) => void;
    // Optional override snippets for header and footer
    header?: Snippet<[PathSnapshot<any>]>;
    footer?: Snippet<[PathSnapshot<any>, object]>;
    // All other props treated as step snippets keyed by step ID
    [key: string]: Snippet | any;
  }

  let {
    path,
    engine: engineProp,
    initialData = {},
    autoStart = true,
    backLabel = 'Previous',
    nextLabel = 'Next',
    completeLabel = 'Complete',
    cancelLabel = 'Cancel',
    hideCancel = false,
    hideProgress = false,
    footerLayout = 'auto',
    oncomplete,
    oncancel,
    onevent,
    header,
    footer,
    ...stepSnippets
  }: Props = $props();

  // Initialize path engine
  const pathReturn = usePath({
    engine: engineProp,
    onEvent: (event) => {
      onevent?.(event);
      if (event.type === 'completed') oncomplete?.(event.data);
      if (event.type === 'cancelled') oncancel?.(event.data);
    }
  });

  const { start, next, previous, cancel, goToStep, goToStepChecked, setData, restart: restartFn } = pathReturn;

  // Provide context for child step components
  setPathContext({
    get snapshot() { return pathReturn.snapshot; },
    next,
    previous,
    cancel,
    goToStep,
    goToStepChecked,
    setData,
    restart: () => restartFn(path, initialData)
  });

  // Auto-start the path when no external engine is provided
  let started = false;
  onMount(() => {
    if (autoStart && !started && !engineProp) {
      started = true;
      start(path, initialData);
    }
  });

  let snap = $derived(pathReturn.snapshot);
  let actions = $derived({ next, previous, cancel, goToStep, goToStepChecked, setData, restart: () => restartFn(path, initialData) });

  // Auto-detect footer layout: single-step top-level paths use "form", everything else uses "wizard"
  let resolvedFooterLayout = $derived(
    footerLayout === 'auto' && snap
      ? (snap.stepCount === 1 && snap.nestingLevel === 0 ? 'form' : 'wizard')
      : (footerLayout === 'auto' ? 'wizard' : footerLayout)
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

<div class="pw-shell">
  {#if !snap}
    <div class="pw-shell__empty">
      <p>No active path.</p>
      {#if !autoStart}
        <button type="button" class="pw-shell__start-btn" onclick={() => start(path, initialData)}>
          Start
        </button>
      {/if}
    </div>
  {:else}
    <!-- Header: progress indicator (overridable via header snippet) -->
    {#if !hideProgress}
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

    <!-- Body: current step rendered via named snippet -->
    <div class="pw-shell__body">
      {#if stepSnippets[snap.stepId]}
        {@render stepSnippets[snap.stepId]()}
      {:else}
        <p>No content for step "{snap.stepId}"</p>
      {/if}
    </div>

    <!-- Validation messages — labeled by field name -->
    {#if snap.hasAttemptedNext && Object.keys(snap.fieldMessages).length > 0}
      <ul class="pw-shell__validation">
        {#each Object.entries(snap.fieldMessages) as [key, msg]}
          <li class="pw-shell__validation-item">
            {#if key !== '_'}<span class="pw-shell__validation-label">{formatFieldKey(key)}</span>{/if}{msg}
          </li>
        {/each}
      </ul>
    {/if}

    <!-- Footer: navigation buttons (overridable via footer snippet) -->
    {#if footer}
      {@render footer(snap, actions)}
    {:else}
      <div class="pw-shell__footer">
        <div class="pw-shell__footer-left">
          {#if resolvedFooterLayout === 'form' && !hideCancel}
            <!-- Form mode: Cancel on the left -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              disabled={snap.isNavigating}
              onclick={cancel}
            >
              {cancelLabel}
            </button>
          {:else if resolvedFooterLayout === 'wizard' && !snap.isFirstStep}
            <!-- Wizard mode: Back on the left -->
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--back"
              disabled={snap.isNavigating || !snap.canMovePrevious}
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
              disabled={snap.isNavigating}
              onclick={cancel}
            >
              {cancelLabel}
            </button>
          {/if}
          <!-- Both modes: Submit on the right -->
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--next"
            disabled={snap.isNavigating}
            onclick={next}
          >
            {snap.isLastStep ? completeLabel : nextLabel}
          </button>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  /* Component-level styles inherited from shell.css */
</style>
