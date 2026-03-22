<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const { snapshot, setData } = getPathContext();

  $: data = $snapshot?.data || {};

  function updateBio(value) {
    setData('bio', value);
  }

  function updateNotifications(checked) {
    setData('notifications', checked);
  }
</script>

<div class="step-card">
  <h2>✨ A bit more about you</h2>

  <div class="form-group">
    <label for="bio">Short Bio (Optional)</label>
    <textarea
      id="bio"
      placeholder="Tell us a bit about yourself..."
      value={data.bio || ''}
      on:input={(e) => updateBio(e.target.value)}
    />
  </div>

  <div class="form-group">
    <label>Notification Preferences</label>
    <div class="toggle-group">
      <label class="toggle-switch">
        <input
          type="checkbox"
          checked={data.notifications ?? true}
          on:change={(e) => updateNotifications(e.target.checked)}
        />
        <span class="toggle-slider"></span>
      </label>
      <span>Send me email notifications</span>
    </div>
  </div>
</div>

<style>
  /* Styles are in global style.css */
</style>

