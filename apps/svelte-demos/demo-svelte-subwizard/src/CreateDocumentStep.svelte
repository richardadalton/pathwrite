<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { DocumentData } from "./types";

  const ctx = getPathContext<DocumentData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldMessages : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">Enter the details of the document you want to send for approval.</p>

    <div class="field" class:field--error={errors.title}>
      <label for="title">Title <span class="required">*</span></label>
      <input id="title" type="text" value={ctx.snapshot.data.title ?? ""}
        oninput={(e) => ctx.setData("title", e.currentTarget.value)}
        placeholder="e.g. Q1 Budget Report" autocomplete="off" autofocus />
      {#if errors.title}<span class="field-error">{errors.title}</span>{/if}
    </div>

    <div class="field" class:field--error={errors.description}>
      <label for="description">Description <span class="required">*</span></label>
      <textarea id="description" value={ctx.snapshot.data.description ?? ""} rows={4}
        oninput={(e) => ctx.setData("description", e.currentTarget.value)}
        placeholder="Brief summary of the document and what needs to be approved..." />
      {#if errors.description}<span class="field-error">{errors.description}</span>{/if}
    </div>
  </div>
{/if}

