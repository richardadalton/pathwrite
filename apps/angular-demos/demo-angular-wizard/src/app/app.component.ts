import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective, PathShellCompletionDirective } from "@daltonr/pathwrite-angular/shell";
import { onboardingPath } from "./onboarding.path";
import { INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding.types";
import { PersonalInfoStepComponent } from "./steps/personal-info-step.component";
import { AboutYouStepComponent } from "./steps/about-you-step.component";
import { PreferencesStepComponent } from "./steps/preferences-step.component";
import { ReviewStepComponent } from "./steps/review-step.component";

// Rendered inside the [pwShellCompletion] template.
// Uses injectPath() to access the completed snapshot and restart().
@Component({
  selector: "app-completion-panel",
  standalone: true,
  template: `
    @if (path.snapshot(); as s) {
      <section class="result-panel success-panel">
        <div class="result-icon">🎉</div>
        <h2>Welcome aboard!</h2>
        <p>Your profile has been set up, <strong>{{ s.data['firstName'] }}</strong>.</p>

        <div class="summary">
          <div class="summary-section">
            <p class="summary-section__title">Personal Info</p>
            <div class="summary-row">
              <span class="summary-key">Name</span>
              <span>{{ s.data['firstName'] }} {{ s.data['lastName'] }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-key">Email</span>
              <span>{{ s.data['email'] }}</span>
            </div>
          </div>

          <div class="summary-section">
            <p class="summary-section__title">About You</p>
            <div class="summary-row">
              <span class="summary-key">Job Title</span>
              <span>{{ s.data['jobTitle'] }}</span>
            </div>
            @if (s.data['company']) {
              <div class="summary-row">
                <span class="summary-key">Company</span>
                <span>{{ s.data['company'] }}</span>
              </div>
            }
            <div class="summary-row">
              <span class="summary-key">Experience</span>
              <span>{{ experienceLabel(s.data['experience']) }}</span>
            </div>
          </div>

          <div class="summary-section">
            <p class="summary-section__title">Preferences</p>
            <div class="summary-row">
              <span class="summary-key">Theme</span>
              <span>{{ themeLabel(s.data['theme']) }}</span>
            </div>
            <div class="summary-row">
              <span class="summary-key">Notifications</span>
              <span>{{ s.data['notifications'] ? 'Enabled' : 'Disabled' }}</span>
            </div>
          </div>
        </div>

        <button type="button" class="btn-primary" (click)="path.restart()">Start Over</button>
      </section>
    }
  `,
})
export class CompletionPanelComponent {
  protected readonly path = usePathContext<OnboardingData>();

  protected experienceLabel(value: unknown): string {
    return EXPERIENCE_LABELS[value as string] ?? String(value ?? "");
  }

  protected themeLabel(value: unknown): string {
    return THEME_LABELS[value as string] ?? String(value ?? "");
  }
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    PathShellCompletionDirective,
    CompletionPanelComponent,
    PersonalInfoStepComponent,
    AboutYouStepComponent,
    PreferencesStepComponent,
    ReviewStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly onboardingPath = onboardingPath;
  protected readonly initialData   = INITIAL_DATA;

  protected isCancelled = false;

  protected onCancel(): void {
    this.isCancelled = true;
  }
}
