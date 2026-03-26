<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { CourseData } from "./course";

const { snapshot, setData } = usePathContext<CourseData>();

const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? (snapshot.value.fieldErrors ?? {}) : {}
);

const fullName = computed(() => snapshot.value?.data.fullName ?? "");

function updateName(value: string) {
  setData("fullName", value);
}

function onNameInput(event: Event) {
  const target = event.target as HTMLInputElement | null;
  updateName(target?.value ?? "");
}
</script>

<template>
  <div class="form-body">
    <p class="step-intro">
      Welcome to Pathwrite Academy. Enter your full name to begin the course.
    </p>

    <div class="field" :class="{ 'field--error': errors.fullName }">
      <label for="student-name">Full name</label>
      <input
        id="student-name"
        type="text"
        :value="fullName"
        placeholder="Ada Lovelace"
        autocomplete="name"
        @input="onNameInput"
      />
      <p v-if="errors.fullName" class="field-error">{{ errors.fullName }}</p>
    </div>
  </div>
</template>


