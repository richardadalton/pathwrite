import { Component } from "@angular/core";
import { PathDefinition, PathData, FieldErrors } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { ContactStepComponent } from "./contact-step.component";

interface ContactData extends PathData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

function isValidEmail(value: string): boolean {
  return value.includes("@") && value.includes(".");
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [PathShellComponent, PathStepDirective, ContactStepComponent],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  // ── Page state ──────────────────────────────────────────────────────────
  protected isSubmitted = false;
  protected isCancelled = false;
  protected submittedData: ContactData | null = null;

  // ── Path definition ─────────────────────────────────────────────────────
  protected readonly contactFormPath: PathDefinition<ContactData> = {
    id: "contact-form",
    steps: [
      {
        id: "contact",
        title: "Contact Us",
        onEnter: ({ isFirstEntry }) =>
          isFirstEntry
            ? { name: "", email: "", subject: "", message: "" }
            : undefined,
        fieldMessages: ({ data }) => {
          const m: FieldErrors = {};
          if (!(data.name as string)?.trim())                               m["name"]    = "Required.";
          if (!(data.email as string)?.trim())                              m["email"]   = "Required.";
          else if (!isValidEmail(data.email as string))                     m["email"]   = "Invalid email address.";
          if (!(data.subject as string))                                    m["subject"] = "Please select a subject.";
          if (((data.message as string) ?? "").trim().length < 10)          m["message"] = "Minimum 10 characters.";
          return m;
        },
        fieldWarnings: ({ data }) => {
          const w: FieldErrors = {};
          const email = (data.email as string)?.trim() ?? "";
          if (email && /@(gmial|gmali|gmal|gamil)\./i.test(email))
            w["email"] = "Did you mean gmail.com?";
          const msgLen = ((data.message as string) ?? "").trim().length;
          if (msgLen >= 10 && msgLen < 30)
            w["message"] = "Short messages may not get a detailed reply.";
          return w;
        }
      }
    ]
  };

  // ── Output handlers ─────────────────────────────────────────────────────
  protected onSubmit(data: PathData): void {
    this.submittedData = data as ContactData;
    this.isSubmitted = true;
  }

  protected onCancel(): void {
    this.isCancelled = true;
  }

  protected tryAgain(): void {
    // Reset page flags — pw-shell will re-mount inside the @if block
    // and auto-start a fresh path
    this.isSubmitted = false;
    this.isCancelled = false;
    this.submittedData = null;
  }
}
