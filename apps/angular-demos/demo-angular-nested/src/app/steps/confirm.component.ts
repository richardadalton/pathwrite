import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { OnboardingData } from "../onboarding.types";
import type { EmployeeDetails } from "../employee-details.types";
import { LAPTOP_TYPES } from "../employee-details.types";

@Component({
  selector: "app-confirm-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 20px; }
    .step-intro {
      margin: 0 0 4px;
      font-size: 14px;
      color: #5b677a;
      line-height: 1.6;
    }
    .review-section { display: flex; flex-direction: column; gap: 8px; }
    .section-title {
      font-size: 12px; font-weight: 700; color: #2563eb;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 0;
    }
    .review-card {
      background: #f8fafc; border: 1px solid #e5e7eb;
      border-radius: 8px; overflow: hidden;
    }
    .review-row {
      display: grid; grid-template-columns: 140px 1fr;
      gap: 8px 16px; padding: 10px 16px;
      border-bottom: 1px solid #f1f3f7;
      font-size: 14px;
    }
    .review-row:last-child { border-bottom: none; }
    .review-key { color: #6b7280; font-weight: 500; }
    .review-value { color: #1f2937; font-weight: 500; }
    .badge {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
      margin-right: 4px;
    }
    .badge--on  { background: #dcfce7; color: #15803d; }
    .badge--off { background: #f3f4f6; color: #6b7280; }
  `],
  template: `
    @if (path.snapshot(); as s) {
      <div class="form-body">
        <p class="step-intro">
          Review the details below. Click <strong>Complete Onboarding</strong> to submit,
          or use <strong>Previous</strong> to go back and make changes.
        </p>

        <!-- Employee -->
        <div class="review-section">
          <p class="section-title">Employee</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Name</span>
              <span class="review-value">{{ s.data.employeeName }}</span>
            </div>
          </div>
        </div>

        <!-- Personal -->
        <div class="review-section">
          <p class="section-title">Personal</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Full Name</span>
              <span class="review-value">{{ fullName() || '—' }}</span>
            </div>
            @if (details().dateOfBirth) {
              <div class="review-row">
                <span class="review-key">Date of Birth</span>
                <span class="review-value">{{ details().dateOfBirth }}</span>
              </div>
            }
            @if (details().phone) {
              <div class="review-row">
                <span class="review-key">Phone</span>
                <span class="review-value">{{ details().phone }}</span>
              </div>
            }
            @if (details().personalEmail) {
              <div class="review-row">
                <span class="review-key">Personal Email</span>
                <span class="review-value">{{ details().personalEmail }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Department -->
        <div class="review-section">
          <p class="section-title">Department</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Department</span>
              <span class="review-value">{{ details().department || '—' }}</span>
            </div>
            @if (details().manager) {
              <div class="review-row">
                <span class="review-key">Manager</span>
                <span class="review-value">{{ details().manager }}</span>
              </div>
            }
            @if (details().office) {
              <div class="review-row">
                <span class="review-key">Office</span>
                <span class="review-value">{{ details().office }}</span>
              </div>
            }
            @if (details().startDate) {
              <div class="review-row">
                <span class="review-key">Start Date</span>
                <span class="review-value">{{ details().startDate }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Equipment -->
        <div class="review-section">
          <p class="section-title">Equipment</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Laptop</span>
              <span class="review-value">{{ laptopLabel() }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Mobile Phone</span>
              <span class="review-value">{{ yesNo(details().needsPhone) }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Access Card</span>
              <span class="review-value">{{ yesNo(details().needsAccessCard) }}</span>
            </div>
            @if (details().otherEquipment) {
              <div class="review-row">
                <span class="review-key">Other</span>
                <span class="review-value">{{ details().otherEquipment }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Roles & Permissions -->
        <div class="review-section">
          <p class="section-title">Roles &amp; Permissions</p>
          <div class="review-card">
            <div class="review-row">
              <span class="review-key">Job Title</span>
              <span class="review-value">{{ details().jobTitle || '—' }}</span>
            </div>
            <div class="review-row">
              <span class="review-key">Permissions</span>
              <span class="review-value">
                @if (activePerms().length > 0) {
                  @for (perm of activePerms(); track perm) {
                    <span class="badge badge--on">{{ perm }}</span>
                  }
                } @else {
                  <span class="badge badge--off">None</span>
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmStepComponent {
  protected readonly path = usePathContext<OnboardingData>();

  protected details(): EmployeeDetails {
    const d = this.path.snapshot()?.data.details?.data;
    return d ?? {} as EmployeeDetails;
  }

  protected fullName(): string {
    const d = this.details();
    return [d.firstName, d.lastName].filter(Boolean).join(" ");
  }

  protected laptopLabel(): string {
    const val = this.details().laptopType ?? "macbook-pro";
    return LAPTOP_TYPES.find(l => l.value === val)?.label ?? val;
  }

  protected yesNo(val: string | undefined): string {
    return val === "yes" ? "Yes" : "No";
  }

  protected activePerms(): string[] {
    const d = this.details();
    return [
      d.permAdmin   === "yes" ? "Admin"     : null,
      d.permDev     === "yes" ? "Developer" : null,
      d.permHR      === "yes" ? "HR"        : null,
      d.permFinance === "yes" ? "Finance"   : null,
    ].filter((p): p is string => p !== null);
  }
}
