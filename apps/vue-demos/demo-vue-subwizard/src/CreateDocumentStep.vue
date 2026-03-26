<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { DocumentData } from "./types";

const { snapshot, setData } = usePathContext<DocumentData>();
const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldErrors ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">
    <p class="step-intro">Enter the details of the document you want to send for approval.</p>

    <div :class="['field', attempted && errors.title ? 'field--error' : '']">
      <label for="title">Title <span class="required">*</span></label>
      <input
        id="title"
        type="text"
        :value="data?.title"
        @input="setData('title', ($event.target as HTMLInputElement).value)"
        placeholder="e.g. Q1 Budget Report"
        autofocus
        autocomplete="off"
      />
      <span v-if="attempted && errors.title" class="field-error">{{ errors.title }}</span>
    </div>

    <div :class="['field', attempted && errors.description ? 'field--error' : '']">
      <label for="description">Description <span class="required">*</span></label>
      <textarea
        id="description"
        :value="data?.description"
        @input="setData('description', ($event.target as HTMLTextAreaElement).value)"
        placeholder="Brief summary of the document and what needs to be approved..."
        rows="4"
      />
      <span v-if="attempted && errors.description" class="field-error">{{ errors.description }}</span>
    </div>
  </div>
</template>

