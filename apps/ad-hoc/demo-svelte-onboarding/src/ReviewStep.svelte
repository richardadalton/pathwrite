<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const ctx = getPathContext();

  let data = $derived(ctx.snapshot?.data || {});
</script>

<div class="step-card">
  <h2>📋 Review Your Information</h2>

  <div class="review-section">
    <h3>Personal Information</h3>
    <div class="review-item">
      <span class="review-label">Name:</span>
      <span class="review-value">{data.name || 'N/A'}</span>
    </div>
    <div class="review-item">
      <span class="review-label">Email:</span>
      <span class="review-value">{data.email || 'N/A'}</span>
    </div>
  </div>

  <div class="review-section">
    <h3>Preferences</h3>
    <div class="review-item">
      <span class="review-label">Role:</span>
      <span class="review-value">{data.role || 'N/A'}</span>
    </div>
    <div class="review-item">
      <span class="review-label">Interests:</span>
      <div class="interests-list">
        {#if data.interests && data.interests.length > 0}
          {#each data.interests as interest}
            <span class="interest-tag">{interest}</span>
          {/each}
        {:else}
          <span class="review-value">None selected</span>
        {/if}
      </div>
    </div>
  </div>

  <div class="review-section">
    <h3>Additional Information</h3>
    <div class="review-item">
      <span class="review-label">Bio:</span>
      <span class="review-value">{data.bio || 'Not provided'}</span>
    </div>
    <div class="review-item">
      <span class="review-label">Email Notifications:</span>
      <span class="review-value">{data.notifications ?? true ? 'Enabled' : 'Disabled'}</span>
    </div>
  </div>
</div>

<style>
  /* Styles are in global style.css */
</style>
