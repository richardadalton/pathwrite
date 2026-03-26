<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ProfileSubData } from "./wizard";

const { snapshot, setData } = usePathContext<ProfileSubData>();

const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldErrors ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">

    <!-- Who we're filling in for -->
    <div class="subwizard-context">
      <p class="subwizard-for">Setting goals for</p>
      <p class="subwizard-name">{{ data?.memberName }}</p>
    </div>

    <!-- 30-day goals — extended typing field -->
    <div class="field" :class="{ 'field--error': attempted && errors.goals30 }">
      <label for="goals30">
        30-Day Goals <span class="required">*</span>
        <span class="field-hint">First month priorities</span>
      </label>
      <textarea
        id="goals30"
        rows="6"
        placeholder="What should this person achieve in their first 30 days? Think about: getting set up with tools and access, meeting key stakeholders, completing any required training, understanding current priorities, and making one or two small early contributions."
        :value="data?.goals30 ?? ''"
        @input="setData('goals30', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <p v-if="attempted && errors.goals30" class="field-error">{{ errors.goals30 }}</p>
    </div>

    <!-- 90-day goals — extended typing field -->
    <div class="field" :class="{ 'field--error': attempted && errors.goals90 }">
      <label for="goals90">
        90-Day Goals <span class="required">*</span>
        <span class="field-hint">Full quarter ownership</span>
      </label>
      <textarea
        id="goals90"
        rows="6"
        placeholder="What does success look like after 90 days? Describe the areas they should own independently, projects they should be driving or contributing to significantly, team relationships they should have built, and metrics or outcomes you'll use to evaluate their progress."
        :value="data?.goals90 ?? ''"
        @input="setData('goals90', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <p v-if="attempted && errors.goals90" class="field-error">{{ errors.goals90 }}</p>
    </div>

  </div>
</template>

