<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { ApprovalData } from "./types";

  const ctx = getPathContext<ApprovalData>();
  let errors = $derived(ctx.snapshot?.hasAttemptedNext ? ctx.snapshot.fieldErrors : {});
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      You are reviewing <strong>{ctx.snapshot.data.documentTitle}</strong> as <strong>{ctx.snapshot.data.approverName}</strong>.
    </p>

    <div>
      <p class="pref-label">Your Decision <span class="required">*</span></p>
      <div class="radio-group">
        <label class="radio-option" class:radio-option--approved={ctx.snapshot.data.decision === 'approved'}>
          <input type="radio" name="decision" value="approved"
            checked={ctx.snapshot.data.decision === 'approved'}
            onchange={() => ctx.setData("decision", "approved")} />
          <span class="radio-option-label">✓ Approve</span>
          <span class="radio-option-desc">The document is ready to proceed.</span>
        </label>
        <label class="radio-option" class:radio-option--rejected={ctx.snapshot.data.decision === 'rejected'}>
          <input type="radio" name="decision" value="rejected"
            checked={ctx.snapshot.data.decision === 'rejected'}
            onchange={() => ctx.setData("decision", "rejected")} />
          <span class="radio-option-label">✗ Reject</span>
          <span class="radio-option-desc">Changes are required before this can proceed.</span>
        </label>
      </div>
      {#if errors.decision}<span class="field-error">{errors.decision}</span>{/if}
    </div>

    <div class="field">
      <label for="comment">Comment <span class="optional">(optional)</span></label>
      <textarea id="comment" value={ctx.snapshot.data.comment ?? ""} rows={3}
        oninput={(e) => ctx.setData("comment", e.currentTarget.value)}
        placeholder="Add any notes or feedback for the document author..." />
    </div>
  </div>
{/if}

