<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { DrilldownData } from "./course";

const { snapshot } = usePathContext<DrilldownData>();

const data = computed(() => snapshot.value?.data);
</script>

<template>
  <div class="form-body">
    <p class="doc-chip">Subpath lesson</p>
    <h3 class="subpath-title">{{ data?.title }}</h3>
    <p class="step-intro">{{ data?.whyItMatters }}</p>
  </div>
</template>

