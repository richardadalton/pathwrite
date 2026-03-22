<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const ctx = getPathContext();

  let data = $derived(ctx.snapshot?.data || {});

  const roles = ['Developer', 'Designer', 'Product Manager', 'Marketing', 'Other'];
  const availableInterests = ['Coding', 'Design', 'AI/ML', 'DevOps', 'Mobile', 'Web'];

  function updateRole(value) {
    ctx.setData('role', value);
  }

  function toggleInterest(interest) {
    const current = data.interests || [];
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    ctx.setData('interests', updated);
  }

  let interests = $derived(data.interests || []);
</script>

<div class="step-card">
  <h2>🎯 Tell us about your interests</h2>

  <div class="form-group">
    <label for="role">What's your role? *</label>
    <select
      id="role"
      value={data.role || ''}
      onchange={(e) => updateRole(e.target.value)}
    >
      <option value="">Select a role...</option>
      {#each roles as role}
        <option value={role}>{role}</option>
      {/each}
    </select>
  </div>

  <div class="form-group">
    <label>What are you interested in? * (select at least one)</label>
    <div class="checkbox-group">
      {#each availableInterests as interest}
        <div class="checkbox-item">
          <input
            type="checkbox"
            id={interest}
            checked={interests.includes(interest)}
            onchange={() => toggleInterest(interest)}
          />
          <label for={interest}>{interest}</label>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  /* Styles are in global style.css */
</style>
