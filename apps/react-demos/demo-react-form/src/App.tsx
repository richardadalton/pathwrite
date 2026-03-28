import { useState } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import type { PathData } from "@daltonr/pathwrite-react";
import { contactFormPath, type ContactData } from "./path";
import { ContactStep } from "./ContactStep";

export default function App() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [submittedData, setSubmittedData] = useState<ContactData | null>(null);

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
    <main className="page">
      <div className="page-header">
        <h1>Contact Us</h1>
        <p className="subtitle">Send us a message and we'll get back to you shortly.</p>
      </div>

      {/* ── Success ──────────────────────────────────────────────────────── */}
      {isSubmitted && submittedData && (
        <section className="result-panel success-panel">
          <div className="result-icon">✅</div>
          <h2>Message Sent!</h2>
          <p>Thanks <strong>{submittedData.name}</strong>, we've received your message.</p>
          <div className="submitted-summary">
            <div className="summary-row">
              <span className="summary-label">Email</span>
              <span>{submittedData.email}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Subject</span>
              <span>{submittedData.subject}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Message</span>
              <span>{submittedData.message}</span>
            </div>
          </div>
          <button className="btn-primary" onClick={tryAgain}>
            Send Another Message
          </button>
        </section>
      )}

      {/* ── Cancelled ────────────────────────────────────────────────────── */}
      {isCancelled && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Message Discarded</h2>
          <p>Your message was not sent.</p>
          <button className="btn-secondary" onClick={tryAgain}>
            Try Again
          </button>
        </section>
      )}

      {/* ── Active form ───────────────────────────────────────────────────── */}
      {!isSubmitted && !isCancelled && (
        // PathShell mounts fresh each time this block renders.
        // The steps map passes <ContactStep /> which calls usePathContext()
        // internally — no prop drilling or ref forwarding needed.
        <PathShell
          path={contactFormPath}
          initialData={{ name: "", email: "", subject: "", message: "" }}
          completeLabel="Send Message"
          cancelLabel="Discard"
          validationDisplay="inline"
          onComplete={handleComplete}
          onCancel={handleCancel}
          steps={{
            contact: <ContactStep />
          }}
        />
      )}
    </main>
  );
}

