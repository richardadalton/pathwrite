<script setup lang="ts">
import { ref } from "vue";
import { PathShell } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { contactFormPath, type ContactData } from "./path";
import ContactStep from "./ContactStep.vue";

const isSubmitted = ref(false);
const isCancelled = ref(false);
const submittedData = ref<ContactData | null>(null);

function handleComplete(data: PathData) {
  submittedData.value = data as ContactData;
  isSubmitted.value = true;
}

function handleCancel() {
  isCancelled.value = true;
}

function tryAgain() {
  isSubmitted.value = false;
  isCancelled.value = false;
  submittedData.value = null;
}
</script>

<template>
  <main class="page">
    <div class="page-header">
      <h1>Contact Us</h1>
      <p class="subtitle">Send us a message and we'll get back to you shortly.</p>
    </div>

    <!-- ── Success ──────────────────────────────────────────────────────── -->
    <section v-if="isSubmitted && submittedData" class="result-panel success-panel">
      <div class="result-icon">✅</div>
      <h2>Message Sent!</h2>
      <p>Thanks <strong>{{ submittedData.name }}</strong>, we've received your message.</p>
      <div class="submitted-summary">
        <div class="summary-row">
          <span class="summary-label">Email</span>
          <span>{{ submittedData.email }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Subject</span>
          <span>{{ submittedData.subject }}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Message</span>
          <span>{{ submittedData.message }}</span>
        </div>
      </div>
      <button class="btn-primary" @click="tryAgain">
        Send Another Message
      </button>
    </section>

    <!-- ── Cancelled ────────────────────────────────────────────────────── -->
    <section v-if="isCancelled" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Message Discarded</h2>
      <p>Your message was not sent.</p>
      <button class="btn-secondary" @click="tryAgain">
        Try Again
      </button>
    </section>

    <!-- ── Active form ───────────────────────────────────────────────────── -->
    <PathShell
      v-if="!isSubmitted && !isCancelled"
      :path="contactFormPath"
      :initial-data="{ name: '', email: '', subject: '', message: '' }"
      complete-label="Send Message"
      cancel-label="Discard"
      validation-display="inline"
      @complete="handleComplete"
      @cancel="handleCancel"
    >
      <!-- Named slot matching the step ID "contact" -->
      <template #contact>
        <ContactStep />
      </template>
    </PathShell>
  </main>
</template>

