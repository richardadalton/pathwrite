import { Component } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "../onboarding.types";

@Component({
  selector: "app-review-step",
  standalone: true,
  styles: [`
    .review-intro {
      margin: 0 0 24px; font-size: 14px; color: #5b677a;
    }
    .review-section { margin-bottom: 24px; }
    .review-section:last-child { margin-bottom: 0; }
    .section-title {
      font-size: 12px; font-weight: 700; color: #2563eb;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin: 0 0 10px;
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
    .review-value.empty { color: #9ca3af; font-style: italic; }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 10px; border-radius: 20px;
      font-size: 12px; font-weight: 600;
    }
    .badge--on  { background: #dcfce7; color: #15803d; }
    .badge--off { background: #f3f4f6; color: #6b7280; }
  `],
  template: `
    @if (path.snapshot(); as s) {
      <p class="review-intro">
        Everything look right? Click <strong>Complete Onboarding</strong> to finish,
        or use <strong>Previous</strong> to make changes.
      </p>

      <!-- Personal Info -->
      <div class="review-section">
        <p class="section-title">Personal Info</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Full Name</span>
            <span class="review-value">
              {{ s.data.firstName }} {{ s.data.lastName }}
            </span>
          </div>
          <div class="review-row">
            <span class="review-key">Email</span>
            <span class="review-value">{{ s.data.email }}</span>
          </div>
        </div>
      </div>

      <!-- About You -->
      <div class="review-section">
        <p class="section-title">About You</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Job Title</span>
            <span class="review-value">{{ s.data.jobTitle }}</span>
          </div>
          <div class="review-row">
            <span class="review-key">Company</span>
            <span [class]="s.data.company ? 'review-value' : 'review-value empty'">
              {{ s.data.company || 'Not provided' }}
            </span>
          </div>
          <div class="review-row">
            <span class="review-key">Experience</span>
            <span class="review-value">{{ experienceLabel(s.data.experience) }}</span>
          </div>
        </div>
      </div>

      <!-- Preferences -->
      <div class="review-section">
        <p class="section-title">Preferences</p>
        <div class="review-card">
          <div class="review-row">
            <span class="review-key">Theme</span>
            <span class="review-value">{{ themeLabel(s.data.theme) }}</span>
          </div>
          <div class="review-row">
            <span class="review-key">Notifications</span>
            <span [class]="s.data.notifications ? 'badge badge--on' : 'badge badge--off'">
              {{ s.data.notifications ? '✓ Enabled' : '✗ Disabled' }}
            </span>
          </div>
        </div>
      </div>
    }
  `
})
export class ReviewStepComponent {
  protected readonly path = injectPath<OnboardingData>();

  protected experienceLabel(value: string): string {
    return EXPERIENCE_LABELS[value] ?? value;
  }

  protected themeLabel(value: string): string {
    return THEME_LABELS[value] ?? value;
  }
}




