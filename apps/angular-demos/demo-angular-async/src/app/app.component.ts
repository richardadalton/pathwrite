import { Component, inject } from "@angular/core";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { MockApplicationServices } from "./services";
import { createApplicationPath, INITIAL_DATA, type ApplicationData } from "./application-path";
import { RoleStepComponent }        from "./steps/role-step.component";
import { ExperienceStepComponent }  from "./steps/experience-step.component";
import { EligibilityStepComponent } from "./steps/eligibility-step.component";
import { CoverLetterStepComponent } from "./steps/cover-letter-step.component";
import { ReviewStepComponent }      from "./steps/review-step.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    RoleStepComponent,
    ExperienceStepComponent,
    EligibilityStepComponent,
    CoverLetterStepComponent,
    ReviewStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  // Services are provided at root via @Injectable({ providedIn: 'root' }).
  // Step components inject them independently — no services prop on the shell.
  private readonly svc = inject(MockApplicationServices);

  protected readonly applicationPath = createApplicationPath(this.svc);
  protected readonly initialData     = INITIAL_DATA;

  protected isCompleted  = false;
  protected completedData: ApplicationData | null = null;

  protected onComplete(data: PathData): void {
    this.completedData = data as ApplicationData;
    this.isCompleted   = true;
  }

  protected startOver(): void {
    this.isCompleted   = false;
    this.completedData = null;
  }
}
