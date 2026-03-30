import { createSignal, Show } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData } from "@daltonr/pathwrite-solid";
import { contactFormPath, type ContactData } from "./path";
import ContactStep from "./ContactStep";

export default function App() {
  const [isSubmitted, setIsSubmitted] = createSignal(false);
  const [isCancelled, setIsCancelled] = createSignal(false);
  const [submittedData, setSubmittedData] = createSignal<ContactData | null>(null);

  function handleComplete(data: PathData) {
    setSubmittedData(data as ContactData);
    setIsSubmitted(true);
  }

  function handleCancel() {
    setIsCancelled(true);
  }

  function tryAgain() {
    setIsSubmitted(false);
    setIsCancelled(false);
    setSubmittedData(null);
  }

  return (
    <main class="page">
      <div class="page-header">
        <h1>Contact Us</h1>
        <p class="subtitle">Send us a message and we'll get back to you shortly.</p>
      </div>

      {/* Success */}
      <Show when={isSubmitted() && submittedData()}>
        {(data) => (
          <section class="result-panel success-panel">
            <div class="result-icon">✅</div>
            <h2>Message Sent!</h2>
            <p>Thanks <strong>{data().name}</strong>, we've received your message.</p>
            <div class="submitted-summary">
              <div class="summary-row">
                <span class="summary-label">Email</span>
                <span>{data().email}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Subject</span>
                <span>{data().subject}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Message</span>
                <span>{data().message}</span>
              </div>
            </div>
            <button class="btn-primary" onClick={tryAgain}>
              Send Another Message
            </button>
          </section>
        )}
      </Show>

      {/* Cancelled */}
      <Show when={isCancelled()}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✖</div>
          <h2>Message Discarded</h2>
          <p>Your message was not sent.</p>
          <button class="btn-secondary" onClick={tryAgain}>
            Try Again
          </button>
        </section>
      </Show>

      {/* Active form */}
      <Show when={!isSubmitted() && !isCancelled()}>
        <PathShell
          path={contactFormPath}
          initialData={{ name: "", email: "", subject: "", message: "" }}
          completeLabel="Send Message"
          cancelLabel="Discard"
          validationDisplay="inline"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{ contact: () => <ContactStep /> }}
        />
      </Show>
    </main>
  );
}
