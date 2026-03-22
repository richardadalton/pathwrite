<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const { snapshot, setData } = getPathContext();

  $: data = $snapshot?.data || {};

  function updateField(field, value) {
    setData(field, value);
  }
</script>

<div class="step-card">
  <h2>👋 Welcome! Let's get to know you</h2>

  <div class="form-group">
    <label for="name">Full Name *</label>
    <input
      id="name"
      type="text"
      placeholder="Enter your full name"
      value={data.name || ''}
      on:input={(e) => updateField('name', e.target.value)}
    />
  </div>

  <div class="form-group">
    <label for="email">Email Address *</label>
    <input
      id="email"
      type="email"
      placeholder="you@example.com"
      value={data.email || ''}
      on:input={(e) => updateField('email', e.target.value)}
    />
  </div>
</div>

<style>
  /* Styles are in global style.css */
</style>

