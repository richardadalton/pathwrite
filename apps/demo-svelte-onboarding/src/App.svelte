<script>
  import { onMount } from 'svelte';
  import { PathShell } from '@daltonr/pathwrite-svelte';
  import { HttpStore, restoreOrStart, httpPersistence } from '@daltonr/pathwrite-store-http';
  import { onboardingWizard } from './wizard';
  import PersonalStep from './PersonalStep.svelte';
  import PreferencesStep from './PreferencesStep.svelte';
  import AdditionalStep from './AdditionalStep.svelte';
  import ReviewStep from './ReviewStep.svelte';

  let engine = $state(null);
  let isLoading = $state(true);
  let wasRestored = $state(false);
  let isCompleted = $state(false);
  let completedData = $state(null);

  const initialData = {
    name: '',
    email: '',
    role: '',
    interests: [],
    bio: '',
    notifications: true
  };

  const store = new HttpStore({ baseUrl: 'http://localhost:3001/api/wizard' });
  const key = 'demo-user:onboarding';

  async function init(clearFirst = false) {
    isLoading = true;
    engine = null;

    try {
      if (clearFirst) {
        // Delete any saved state before starting fresh
        await store.delete(key);
      }

      const result = await restoreOrStart({
        store,
        key,
        path: onboardingWizard,
        initialData,
        observers: [
          httpPersistence({
            store,
            key,
            strategy: 'onNext',
            onSaveError: (err) => console.warn('[persistence] save failed:', err.message)
          })
        ]
      });

      engine = result.engine;
      wasRestored = result.restored;
      console.log('[init] ready — restored:', result.restored, '| step:', result.engine.snapshot()?.stepId);
    } catch (err) {
      console.error('[init] FAILED:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleComplete(data) {
    console.log('[wizard] completed:', data);
    completedData = data;
    isCompleted = true;
  }

  async function restart() {
    isCompleted = false;
    completedData = null;
    await init(true);
  }

  async function clearAndRestart() {
    await init(true);
    wasRestored = false;
  }

  onMount(() => {
    init();
  });
</script>

{#if isLoading}
  <div class="loading">
    Loading your onboarding experience...
    <span class="spinner"></span>
  </div>
{:else if isCompleted}
  <div class="completion-screen">
    <div class="completion-icon">🎉</div>
    <h2>Welcome, {completedData.name}!</h2>
    <p>Your onboarding is complete. We're excited to have you on board.</p>

    <div class="completion-data">
      <h3>Your Profile</h3>
      <div class="review-item">
        <span class="review-label">Email:</span>
        <span class="review-value">{completedData.email}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Role:</span>
        <span class="review-value">{completedData.role}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Interests:</span>
        <div class="interests-list">
          {#each completedData.interests || [] as interest}
            <span class="interest-tag">{interest}</span>
          {/each}
        </div>
      </div>
      {#if completedData.bio}
        <div class="review-item">
          <span class="review-label">Bio:</span>
          <span class="review-value">{completedData.bio}</span>
        </div>
      {/if}
    </div>

    <button class="restart-btn" onclick={restart}>
      Start Over
    </button>
  </div>
{:else}
  <div class="demo-header">
    <h1>🚀 Pathwrite Svelte Onboarding Demo</h1>
    <p>A multi-step onboarding wizard with auto-persistence and validation</p>

    {#if wasRestored}
      <div class="restore-banner">
        <div class="restore-banner-content">
          <h3>Progress Restored</h3>
          <p>We picked up where you left off!</p>
        </div>
      </div>
    {/if}
  </div>

  {#if engine}
    <PathShell {engine} oncomplete={handleComplete}>
      {#snippet personal()}
        <PersonalStep />
      {/snippet}

      {#snippet preferences()}
        <PreferencesStep />
      {/snippet}

      {#snippet additional()}
        <AdditionalStep />
      {/snippet}

      {#snippet review()}
        <ReviewStep />
      {/snippet}
    </PathShell>
  {/if}

  <div class="demo-controls">
    <button onclick={clearAndRestart}>🔄 Clear & Restart</button>
    <button onclick={() => console.log('Current state:', engine?.snapshot())}>
      📊 Log State
    </button>
  </div>
{/if}

<style>
  /* Styles are in global style.css */
</style>
