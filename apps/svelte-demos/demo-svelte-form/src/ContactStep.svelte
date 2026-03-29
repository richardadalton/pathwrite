<script lang="ts">
  import { usePathContext } from "@daltonr/pathwrite-svelte";
  import type { ContactData } from "./path";

  // usePathContext() retrieves the context provided by PathShell —
  // no props, no template refs needed.
  const ctx = usePathContext<ContactData>();

  const SUBJECTS = [
    "General Enquiry",
    "Bug Report",
    "Feature Request",
    "Other",
  ];

  // Derived reactive value for character count
  let messageLen = $derived((ctx.snapshot?.data.message as string ?? "").length);
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? (ctx.snapshot.fieldErrors ?? {}) : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">

    <!-- Name -->
    <div class="field" class:field--error={errors.name}>
      <label for="name">
        Full Name <span class="required">*</span>
      </label>
      <input
        id="name"
        type="text"
        value={ctx.snapshot.data.name ?? ""}
        oninput={(e) => ctx.setData("name", e.currentTarget.value)}
        placeholder="Jane Smith"
        autocomplete="name"
        autofocus
      />
      {#if errors.name}<span class="field-error">{errors.name}</span>{/if}
    </div>

    <!-- Email -->
    <div class="field" class:field--error={errors.email}>
      <label for="email">
        Email Address <span class="required">*</span>
      </label>
      <input
        id="email"
        type="email"
        value={ctx.snapshot.data.email ?? ""}
        oninput={(e) => ctx.setData("email", e.currentTarget.value)}
        placeholder="jane@example.com"
        autocomplete="email"
      />
      {#if errors.email}<span class="field-error">{errors.email}</span>{/if}
    </div>

    <!-- Subject -->
    <div class="field" class:field--error={errors.subject}>
      <label for="subject">
        Subject <span class="required">*</span>
      </label>
      <select
        id="subject"
        value={ctx.snapshot.data.subject ?? ""}
        onchange={(e) => ctx.setData("subject", e.currentTarget.value)}
      >
        <option value="" disabled selected>Select a subject…</option>
        {#each SUBJECTS as s}
          <option value={s}>{s}</option>
        {/each}
      </select>
      {#if errors.subject}<span class="field-error">{errors.subject}</span>{/if}
    </div>

    <!-- Message -->
    <div class="field" class:field--error={errors.message}>
      <label for="message">
        Message <span class="required">*</span>
        <span class="field-hint">(min 10 characters)</span>
      </label>
      <textarea
        id="message"
        rows="5"
        value={ctx.snapshot.data.message ?? ""}
        oninput={(e) => ctx.setData("message", e.currentTarget.value)}
        placeholder="How can we help you?"
      ></textarea>
      <span class="char-count">{messageLen} chars</span>
      {#if errors.message}<span class="field-error">{errors.message}</span>{/if}
    </div>

  </div>
{/if}

