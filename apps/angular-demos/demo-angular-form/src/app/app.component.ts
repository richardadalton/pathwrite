import { Component } from "@angular/core";
import { PathDefinition, PathData, FieldErrors } from "@daltonr/pathwrite-core";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";

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
  imports: [PathShellComponent, PathStepDirective],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent {
  // ── Local form state (two-way synced to the engine via setData) ─────────
  public name = "";
  public email = "";
  public subject = "";
  public message = "";

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
    // Reset all local form state and page flags — pw-shell will re-mount
    // inside the @if block and auto-start a fresh path.
    this.name = "";
    this.email = "";
    this.subject = "";
    this.message = "";
    this.isSubmitted = false;
    this.isCancelled = false;
    this.submittedData = null;
  }
}
