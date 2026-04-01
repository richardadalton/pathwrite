import { Component } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { employeeDetailsPath } from "../employee-details.path";
import { DETAILS_INITIAL } from "../employee-details.types";
import type { OnboardingData } from "../onboarding.types";
import { PersonalTabComponent }    from "../tabs/personal-tab.component";
import { DepartmentTabComponent }  from "../tabs/department-tab.component";
import { EquipmentTabComponent }   from "../tabs/equipment-tab.component";
import { RolesTabComponent }       from "../tabs/roles-tab.component";

@Component({
  selector: "app-details-step",
  standalone: true,
  imports: [
    PathShellComponent,
    PathStepDirective,
    PersonalTabComponent,
    DepartmentTabComponent,
    EquipmentTabComponent,
    RolesTabComponent,
  ],
  styles: [`
    .nested-shell-wrapper { display: flex; flex-direction: column; gap: 0; }
    .step-intro {
      margin: 0 0 20px;
      font-size: 14px;
      color: #5b677a;
      line-height: 1.6;
    }
    .step-intro strong { color: #1f2937; }
  `],
  template: `
    @if (outerSnapshot(); as outerSnap) {
      <div class="nested-shell-wrapper">
        <p class="step-intro">
          Fill in details for <strong>{{ outerSnap.data.employeeName }}</strong> using the tabs below.
          Switch between tabs freely — data is saved as you type.
          First name, last name, department, and job title are required before proceeding.
        </p>

        <pw-shell
          [path]="employeeDetailsPath"
          [initialData]="DETAILS_INITIAL"
          restoreKey="details"
          layout="tabs"
          [validateWhen]="outerSnapshot()?.hasAttemptedNext"
          validationDisplay="inline"
        >
          <ng-template pwStep="personal">
            <app-personal-tab />
          </ng-template>

          <ng-template pwStep="department">
            <app-department-tab />
          </ng-template>

          <ng-template pwStep="equipment">
            <app-equipment-tab />
          </ng-template>

          <ng-template pwStep="roles">
            <app-roles-tab />
          </ng-template>
        </pw-shell>
      </div>
    }
  `,
})
export class DetailsStepComponent {
  protected readonly outerPath = usePathContext<OnboardingData>();
  protected readonly employeeDetailsPath = employeeDetailsPath;
  protected readonly DETAILS_INITIAL = DETAILS_INITIAL;
  protected readonly outerSnapshot = this.outerPath.snapshot;
}
