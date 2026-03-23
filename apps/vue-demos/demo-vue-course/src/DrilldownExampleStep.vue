<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { DrilldownData } from "./course";

const { snapshot } = usePathContext<DrilldownData>();

const data = computed(() => snapshot.value?.data);
</script>

<template>
  <div class="form-body">
    <p class="doc-chip">Source: {{ data?.sourceDoc }}</p>
    <h3 class="subpath-title">Implementation sketch</h3>
    <pre class="code-block">{{ data?.miniExample }}</pre>
    <p class="step-note">Use Back or Next to return to the parent course flow.</p>
  </div>
</template>

