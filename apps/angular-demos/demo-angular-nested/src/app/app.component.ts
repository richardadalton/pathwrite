import { Component } from "@angular/core";
import type { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { employeeOnboardingPath } from "./onboarding.path";
import { ONBOARDING_INITIAL, type OnboardingData } from "./onboarding.types";
import type { EmployeeDetails } from "./employee-details.types";
import { LAPTOP_TYPES } from "./employee-details.types";
import { EnterNameComponent }   from "./steps/enter-name.component";
import { DetailsStepComponent } from "./steps/details.component";
import { ConfirmStepComponent } from "./steps/confirm.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    EnterNameComponent,
    DetailsStepComponent,
    ConfirmStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent {
  protected readonly employeeOnboardingPath = employeeOnboardingPath;
  protected readonly initialData = ONBOARDING_INITIAL;

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

  protected details(): EmployeeDetails {
    const d = this.completedData?.details as EmployeeDetails | undefined;
    return d ?? {} as EmployeeDetails;
  }

  protected laptopLabel(val: string | undefined): string {
    const v = val ?? "macbook-pro";
    return LAPTOP_TYPES.find(l => l.value === v)?.label ?? v;
  }

  protected yesNo(val: string | undefined): string {
    return val === "yes" ? "Yes" : "No";
  }

  protected activePerms(d: EmployeeDetails): string[] {
    return [
      d.permAdmin   === "yes" ? "Admin"     : null,
      d.permDev     === "yes" ? "Developer" : null,
      d.permHR      === "yes" ? "HR"        : null,
      d.permFinance === "yes" ? "Finance"   : null,
    ].filter((p): p is string => p !== null);
  }
}
