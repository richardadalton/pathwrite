import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";

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
  // No providers: [PathFacade] here — we inherit pw-shell's PathFacade instance
  // through the injector tree. Adding it here would create a disconnected instance.
  styles: [`
    .form-body {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .field label {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .required {
      color: #dc2626;
      font-size: 13px;
    }

    .field-hint {
      font-size: 12px;
      color: #9ca3af;
      font-weight: 400;
    }

    .field input[type="text"],
    .field input[type="email"],
    .field select,
    .field textarea {
      border: 1px solid #c2d0e5;
      border-radius: 6px;
      padding: 9px 12px;
      font-size: 14px;
      font-family: inherit;
      color: #1f2937;
      background: #fff;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      width: 100%;
      box-sizing: border-box;
    }

    .field input:focus,
    .field select:focus,
    .field textarea:focus {
      outline: none;
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }

    .field select {
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235b677a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 12px center;
      padding-right: 32px;
      cursor: pointer;
    }

    .field textarea {
      resize: vertical;
      min-height: 100px;
    }

    .char-count {
      font-size: 12px;
      color: #9ca3af;
      align-self: flex-end;
    }
    .field-error {
      font-size: 13px;
      color: #dc2626;
    }

    .field--error input,
    .field--error select,
    .field--error textarea {
      border-color: #dc2626;
    }

    .field--error input:focus,
    .field--error select:focus,
    .field--error textarea:focus {
      border-color: #dc2626;
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }
  `],
  template: `
    <div class="form-body">

      <!-- Name -->
      <div class="field" [class.field--error]="errors()['name']">
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
        @if (errors()['name']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Email -->
      <div class="field" [class.field--error]="errors()['email']">
        <label for="email">Email Address <span class="required">*</span></label>
        <input
          id="email"
          type="email"
          [value]="email"
          (input)="updateEmail($any($event.target).value)"
          placeholder="jane@example.com"
          autocomplete="email"
        />
        @if (errors()['email']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Subject -->
      <div class="field" [class.field--error]="errors()['subject']">
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
        @if (errors()['subject']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Message -->
      <div class="field" [class.field--error]="errors()['message']">
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
        @if (errors()['message']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class ContactStepComponent {
  // ── Signal-based path access (modern Angular pattern, new in v0.6.0) ────
  protected readonly path = injectPath<ContactData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? (s.fieldErrors ?? {}) : {};
  });

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

