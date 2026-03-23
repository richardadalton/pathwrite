<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ApprovalData } from "./types";

// This step is inside the approval subwizard — context is ApprovalData
const { snapshot } = usePathContext<ApprovalData>();
const data = computed(() => snapshot.value?.data);
</script>

<template>
  <div class="form-body">
    <p class="step-intro">
      Reviewing as <strong>{{ data?.approverName }}</strong>. Please read the document carefully before making your decision.
    </p>

    <div class="document-preview">
      <p class="document-preview__label">Document</p>
      <p class="document-preview__title">{{ data?.documentTitle }}</p>
      <p class="document-preview__body">{{ data?.documentDescription }}</p>
    </div>

    <p class="step-note">Click <strong>Next</strong> to record your decision, or <strong>Previous</strong> to return to the approvals list.</p>
  </div>
</template>

