<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { ContactData } from "./path";

  // getPathContext() retrieves the context provided by PathShell —
  // no props, no template refs needed.
  const ctx = getPathContext<ContactData>();

  const SUBJECTS = [
    "General Enquiry",
    "Bug Report",
    "Feature Request",
    "Other",
  ];

  // Derived reactive value for character count
  let messageLen = $derived((ctx.snapshot?.data.message as string ?? "").length);
</script>

{#if ctx.snapshot}
  <div class="form-body">

    <!-- Name -->
    <div class="field">
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
    </div>

    <!-- Email -->
    <div class="field">
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
    </div>

    <!-- Subject -->
    <div class="field">
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
    </div>

    <!-- Message -->
    <div class="field">
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
    </div>

  </div>
{/if}

