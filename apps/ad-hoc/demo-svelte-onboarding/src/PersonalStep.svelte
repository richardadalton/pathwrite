<script>
  import { getPathContext } from '@daltonr/pathwrite-svelte';

  const ctx = getPathContext();

  let data = $derived(ctx.snapshot?.data || {});

  function updateField(field, value) {
    ctx.setData(field, value);
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
      oninput={(e) => updateField('name', e.target.value)}
    />
  </div>

  <div class="form-group">
    <label for="email">Email Address *</label>
    <input
      id="email"
      type="email"
      placeholder="you@example.com"
      value={data.email || ''}
      oninput={(e) => updateField('email', e.target.value)}
    />
  </div>
</div>

<style>
  /* Styles are in global style.css */
</style>
