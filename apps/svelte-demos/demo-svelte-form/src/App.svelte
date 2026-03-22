<script lang="ts">
  import PathShell from "@daltonr/pathwrite-svelte/PathShell.svelte";
  import type { PathData } from "@daltonr/pathwrite-svelte";
  import { contactFormPath, type ContactData } from "./path";
  import ContactStep from "./ContactStep.svelte";

  let isSubmitted = $state(false);
  let isCancelled = $state(false);
  let submittedData = $state<ContactData | null>(null);

  function handleComplete(data: PathData) {
    submittedData = data as ContactData;
    isSubmitted = true;
  }

  function handleCancel() {
    isCancelled = true;
  }

  function tryAgain() {
    isSubmitted = false;
    isCancelled = false;
    submittedData = null;
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>Contact Us</h1>
    <p class="subtitle">Send us a message and we'll get back to you shortly.</p>
  </div>

  <!-- ── Success ──────────────────────────────────────────────────────── -->
  {#if isSubmitted && submittedData}
    <section class="result-panel success-panel">
      <div class="result-icon">✅</div>
      <h2>Message Sent!</h2>
      <p>Thanks <strong>{submittedData.name}</strong>, we've received your message.</p>
      <div class="submitted-summary">
        <div class="summary-row">
          <span class="summary-label">Email</span>
          <span>{submittedData.email}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Subject</span>
          <span>{submittedData.subject}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Message</span>
          <span>{submittedData.message}</span>
        </div>
      </div>
      <button class="btn-primary" onclick={tryAgain}>
        Send Another Message
      </button>
    </section>
  {/if}

  <!-- ── Cancelled ────────────────────────────────────────────────────── -->
  {#if isCancelled}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Message Discarded</h2>
      <p>Your message was not sent.</p>
      <button class="btn-secondary" onclick={tryAgain}>
        Try Again
      </button>
    </section>
  {/if}

  <!-- ── Active form ───────────────────────────────────────────────────── -->
  {#if !isSubmitted && !isCancelled}
    <PathShell
      path={contactFormPath}
      initialData={{ name: "", email: "", subject: "", message: "" }}
      hideProgress
      completeLabel="Send Message"
      cancelLabel="Discard"
      oncomplete={handleComplete}
      oncancel={handleCancel}
      contact={ContactStep}
    />
  {/if}
</main>

