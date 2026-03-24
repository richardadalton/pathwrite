<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ProfileSubData } from "./wizard";

const { snapshot, setData } = usePathContext<ProfileSubData>();

const data     = computed(() => snapshot.value?.data);
const errors   = computed(() => snapshot.value?.fieldMessages ?? {});
const attempted = computed(() => snapshot.value?.hasAttemptedNext ?? false);
</script>

<template>
  <div class="form-body">

    <!-- Who we're filling in for -->
    <div class="subwizard-context">
      <p class="subwizard-for">Completing profile for</p>
      <p class="subwizard-name">
        {{ data?.memberName }}
        <span v-if="data?.memberRole" class="subwizard-role"> — {{ data?.memberRole }}</span>
      </p>
    </div>

    <!-- Department -->
    <div class="field" :class="{ 'field--error': attempted && errors.department }">
      <label for="department">Department <span class="required">*</span></label>
      <input
        id="department"
        type="text"
        placeholder="e.g. Engineering, Design, Product, Marketing…"
        :value="data?.department ?? ''"
        @input="setData('department', ($event.target as HTMLInputElement).value)"
      />
      <p v-if="attempted && errors.department" class="field-error">{{ errors.department }}</p>
    </div>

    <!-- Start date -->
    <div class="field" :class="{ 'field--error': attempted && errors.startDate }">
      <label for="start-date">Start Date <span class="required">*</span></label>
      <input
        id="start-date"
        type="date"
        :value="data?.startDate ?? ''"
        @change="setData('startDate', ($event.target as HTMLInputElement).value)"
      />
      <p v-if="attempted && errors.startDate" class="field-error">{{ errors.startDate }}</p>
    </div>

    <!-- Bio — extended typing field -->
    <div class="field" :class="{ 'field--error': attempted && errors.bio }">
      <label for="bio">
        Short Bio <span class="required">*</span>
        <span class="field-hint">Introduce this person to the team</span>
      </label>
      <textarea
        id="bio"
        rows="6"
        placeholder="Describe their background, previous experience, what drew them to this role, and what they'll bring to the team. The more context you give, the better the team can prepare to welcome them."
        :value="data?.bio ?? ''"
        @input="setData('bio', ($event.target as HTMLTextAreaElement).value)"
      ></textarea>
      <p v-if="attempted && errors.bio" class="field-error">{{ errors.bio }}</p>
    </div>

  </div>
</template>

