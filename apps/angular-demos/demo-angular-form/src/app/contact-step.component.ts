import { Component } from "@angular/core";
import { PathFacade, injectPath } from "@daltonr/pathwrite-angular";

interface ContactData {
  name: string;
  email: string;
  subject: string;
  message: string;
  [key: string]: unknown;  // Required for PathData constraint
}

/**
 * Demonstrates the modern `injectPath()` API (new in v0.6.0) for accessing
 * the path engine. No template references needed — just inject and use signals.
 */
@Component({
  selector: "app-contact-step",
  standalone: true,
  providers: [PathFacade],  // ← Required for injectPath() to work
  template: `
    <div class="form-body">

      <!-- Name -->
      <div class="field">
        <label for="name">Full Name <span class="required">*</span></label>
        <input
          id="name"
          type="text"
          [value]="name"
          (input)="updateName($any($event.target).value)"
          placeholder="Jane Smith"
          autocomplete="name"
          autofocus
        />
      </div>

      <!-- Email -->
      <div class="field">
        <label for="email">Email Address <span class="required">*</span></label>
        <input
          id="email"
          type="email"
          [value]="email"
          (input)="updateEmail($any($event.target).value)"
          placeholder="jane@example.com"
          autocomplete="email"
        />
      </div>

      <!-- Subject -->
      <div class="field">
        <label for="subject">Subject <span class="required">*</span></label>
        <select
          id="subject"
          (change)="updateSubject($any($event.target).value)"
        >
          <option value="" disabled [selected]="!subject">Select a subject…</option>
          <option value="General Enquiry">General Enquiry</option>
          <option value="Bug Report">Bug Report</option>
          <option value="Feature Request">Feature Request</option>
          <option value="Other">Other</option>
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
          [value]="message"
          (input)="updateMessage($any($event.target).value)"
          placeholder="How can we help you?"
        ></textarea>
        @if (path.snapshot(); as s) {
          <span class="char-count">{{ (s.data.message || '').length }} chars</span>
        }
      </div>

    </div>
  `
})
export class ContactStepComponent {
  // ── Signal-based path access (modern Angular pattern, new in v0.6.0) ────
  protected readonly path = injectPath<ContactData>();

  // ── Local form state (two-way synced to engine via setData) ──────────────
  protected name = "";
  protected email = "";
  protected subject = "";
  protected message = "";

  // ── Update methods (call path.setData directly, no template ref needed) ──
  protected updateName(value: string): void {
    this.name = value;
    this.path.setData("name", value.trim());
  }

  protected updateEmail(value: string): void {
    this.email = value;
    this.path.setData("email", value.trim());
  }

  protected updateSubject(value: string): void {
    this.subject = value;
    this.path.setData("subject", value);
  }

  protected updateMessage(value: string): void {
    this.message = value;
    this.path.setData("message", value.trim());
  }
}

