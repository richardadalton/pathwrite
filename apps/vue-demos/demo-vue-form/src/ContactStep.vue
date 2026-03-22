<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { ContactData } from "./path";

// usePathContext() reaches into PathShell's provided context —
// no prop drilling or template references needed.
const { snapshot, setData } = usePathContext<ContactData>();

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
    <div class="field">
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
    </div>

    <!-- Email -->
    <div class="field">
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
    </div>

    <!-- Subject -->
    <div class="field">
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
    </div>

    <!-- Message -->
    <div class="field">
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
    </div>

  </div>
</template>

