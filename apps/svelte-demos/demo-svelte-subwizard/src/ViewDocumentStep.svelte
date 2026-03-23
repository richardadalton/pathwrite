<script lang="ts">
  import { getPathContext } from "@daltonr/pathwrite-svelte";
  import type { ApprovalData } from "./types";

  const ctx = getPathContext<ApprovalData>();
</script>

{#if ctx.snapshot}
  <div class="form-body">
    <p class="step-intro">
      Reviewing as <strong>{ctx.snapshot.data.approverName}</strong>. Please read the document carefully before making your decision.
    </p>
    <div class="document-preview">
      <p class="document-preview__label">Document</p>
      <p class="document-preview__title">{ctx.snapshot.data.documentTitle}</p>
      <p class="document-preview__body">{ctx.snapshot.data.documentDescription}</p>
    </div>
    <p class="step-note">Click <strong>Next</strong> to record your decision, or <strong>Previous</strong> to return to the approvals list.</p>
  </div>
{/if}

