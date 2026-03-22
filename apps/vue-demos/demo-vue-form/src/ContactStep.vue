<script setup lang="ts">
import { computed } from "vue";
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ContactData } from "./path";

// usePathContext() reaches into PathShell's provided context —
// no prop drilling or template references needed.
const { snapshot, setData } = usePathContext<ContactData>();

const errors = computed(() =>
  snapshot.value?.hasAttemptedNext ? (snapshot.value.fieldMessages ?? {}) : {}
);

const SUBJECTS = [
  "General Enquiry",
  "Bug Report",
  "Feature Request",
  "Other",
];
</script>

<template>
  <div v-if="snapshot" class="form-body">

    <!-- Name -->
    <div class="field" :class="{ 'field--error': errors.name }">
      <label for="name">
        Full Name <span class="required">*</span>
      </label>
      <input
        id="name"
        type="text"
        :value="snapshot.data['name']"
        @input="setData('name', ($event.target as HTMLInputElement).value)"
        placeholder="Jane Smith"
        autocomplete="name"
        autofocus
      />
      <span v-if="errors.name" class="field-error">{{ errors.name }}</span>
    </div>

    <!-- Email -->
    <div class="field" :class="{ 'field--error': errors.email }">
      <label for="email">
        Email Address <span class="required">*</span>
      </label>
      <input
        id="email"
        type="email"
        :value="snapshot.data['email']"
        @input="setData('email', ($event.target as HTMLInputElement).value)"
        placeholder="jane@example.com"
        autocomplete="email"
      />
      <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
    </div>

    <!-- Subject -->
    <div class="field" :class="{ 'field--error': errors.subject }">
      <label for="subject">
        Subject <span class="required">*</span>
      </label>
      <select
        id="subject"
        :value="snapshot.data['subject']"
        @change="setData('subject', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled selected>Select a subject…</option>
        <option v-for="s in SUBJECTS" :key="s" :value="s">{{ s }}</option>
      </select>
      <span v-if="errors.subject" class="field-error">{{ errors.subject }}</span>
    </div>

    <!-- Message -->
    <div class="field" :class="{ 'field--error': errors.message }">
      <label for="message">
        Message <span class="required">*</span>
        <span class="field-hint">(min 10 characters)</span>
      </label>
      <textarea
        id="message"
        rows="5"
        :value="snapshot.data['message']"
        @input="setData('message', ($event.target as HTMLTextAreaElement).value)"
        placeholder="How can we help you?"
      />
      <span class="char-count">
        {{ (snapshot.data['message'] as string ?? '').length }} chars
      </span>
      <span v-if="errors.message" class="field-error">{{ errors.message }}</span>
    </div>

  </div>
</template>

