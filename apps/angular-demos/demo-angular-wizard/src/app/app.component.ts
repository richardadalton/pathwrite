import { Component } from "@angular/core";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { onboardingPath } from "./onboarding.path";
import { INITIAL_DATA, EXPERIENCE_LABELS, THEME_LABELS, type OnboardingData } from "./onboarding.types";
import { PersonalInfoStepComponent } from "./steps/personal-info-step.component";
import { AboutYouStepComponent } from "./steps/about-you-step.component";
import { PreferencesStepComponent } from "./steps/preferences-step.component";
import { ReviewStepComponent } from "./steps/review-step.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
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

  protected isCompleted  = false;
  protected isCancelled  = false;
  protected completedData: OnboardingData | null = null;

  protected onComplete(data: PathData): void {
    this.completedData = data as OnboardingData;
    this.isCompleted   = true;
  }

  protected onCancel(): void {
    this.isCancelled = true;
  }

  protected startOver(): void {
    this.isCompleted   = false;
    this.isCancelled   = false;
    this.completedData = null;
  }

  protected experienceLabel(value: unknown): string {
    return EXPERIENCE_LABELS[value as string] ?? String(value ?? "");
  }

  protected themeLabel(value: unknown): string {
    return THEME_LABELS[value as string] ?? String(value ?? "");
  }
}


