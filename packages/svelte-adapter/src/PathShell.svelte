<script lang="ts">
  import { onMount } from 'svelte';
  import { usePath, setPathContext } from './index.js';
  import type { PathDefinition, PathData, PathEngine } from './index.js';

  // Props
  export let path: PathDefinition<any>;
  export let engine: PathEngine | undefined = undefined;
  export let initialData: PathData = {};
  export let autoStart = true;
  export let backLabel = 'Previous';
  export let nextLabel = 'Next';
  export let completeLabel = 'Complete';
  export let cancelLabel = 'Cancel';
  export let hideCancel = false;
  export let hideProgress = false;

  // Events
  export let onComplete: ((data: PathData) => void) | undefined = undefined;
  export let onCancel: ((data: PathData) => void) | undefined = undefined;
  export let onEvent: ((event: any) => void) | undefined = undefined;

  // Initialize path engine
  const pathReturn = usePath({
    engine,
    onEvent: (event) => {
      onEvent?.(event);
      if (event.type === 'completed') onComplete?.(event.data);
      if (event.type === 'cancelled') onCancel?.(event.data);
    }
  });

  const { snapshot, start, next, previous, cancel, goToStep, goToStepChecked, setData, restart } = pathReturn;

  // Provide context for child components
  setPathContext({
    snapshot,
    next,
    previous,
    cancel,
    goToStep,
    goToStepChecked,
    setData,
    restart: () => restart(path, initialData)
  });

  // Auto-start the path
  let started = false;
  onMount(() => {
    if (autoStart && !started && !engine) {
      started = true;
      start(path, initialData);
    }
  });

  $: snap = $snapshot;
</script>

<div class="pw-shell">
  {#if !snap}
    <div class="pw-shell__empty">
      <p>No active path.</p>
      {#if !autoStart}
        <button
          type="button"
          class="pw-shell__start-btn"
          on:click={() => start(path, initialData)}
        >
          Start
        </button>
      {/if}
    </div>
  {:else}
    <!-- Header: Progress indicator -->
    {#if !hideProgress}
      <slot name="header" snapshot={snap}>
        <div class="pw-shell__header">
          <div class="pw-shell__steps">
            {#each snap.steps as step, i}
              <div class="pw-shell__step pw-shell__step--{step.status}">
                <span class="pw-shell__step-dot">
                  {step.status === 'completed' ? '✓' : i + 1}
                </span>
                <span class="pw-shell__step-label">
                  {step.title ?? step.id}
                </span>
              </div>
            {/each}
          </div>
          <div class="pw-shell__track">
            <div class="pw-shell__track-fill" style="width: {snap.progress * 100}%"></div>
          </div>
        </div>
      </slot>
    {/if}

    <!-- Body: Step content -->
    <div class="pw-shell__body">
      <slot name={snap.stepId} {snapshot}>
        <p>No content for step "{snap.stepId}"</p>
      </slot>
    </div>

    <!-- Validation messages -->
    {#if snap.validationMessages.length > 0}
      <ul class="pw-shell__validation">
        {#each snap.validationMessages as msg}
          <li class="pw-shell__validation-item">{msg}</li>
        {/each}
      </ul>
    {/if}

    <!-- Footer: Navigation buttons -->
    <slot name="footer" {snapshot} actions={{ next, previous, cancel, goToStep, goToStepChecked, setData, restart: () => restart(path, initialData) }}>
      <div class="pw-shell__footer">
        <div class="pw-shell__footer-left">
          {#if !snap.isFirstStep}
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--back"
              disabled={snap.isNavigating || !snap.canMovePrevious}
              on:click={previous}
            >
              {backLabel}
            </button>
          {/if}
        </div>
        <div class="pw-shell__footer-right">
          {#if !hideCancel}
            <button
              type="button"
              class="pw-shell__btn pw-shell__btn--cancel"
              disabled={snap.isNavigating}
              on:click={cancel}
            >
              {cancelLabel}
            </button>
          {/if}
          <button
            type="button"
            class="pw-shell__btn pw-shell__btn--next"
            disabled={snap.isNavigating || !snap.canMoveNext}
            on:click={next}
          >
            {snap.isLastStep ? completeLabel : nextLabel}
          </button>
        </div>
      </div>
    </slot>
  {/if}
</div>

<style>
  /* Component-level styles are inherited from shell.css */
  /* This empty style block ensures Svelte treats this as a styled component */
</style>

