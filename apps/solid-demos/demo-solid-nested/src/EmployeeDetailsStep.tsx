import { usePathContext, PathShell } from "@daltonr/pathwrite-solid";
import { employeeDetailsPath, DETAILS_INITIAL } from "./employee-details";
import type { OnboardingData } from "./onboarding";
import PersonalTab from "./tabs/PersonalTab";
import DepartmentTab from "./tabs/DepartmentTab";
import EquipmentTab from "./tabs/EquipmentTab";
import RolesTab from "./tabs/RolesTab";

export default function EmployeeDetailsStep() {
  const ctx = usePathContext<OnboardingData>();

  return (
    <div class="nested-shell-wrapper">
      <p class="step-intro">
        Fill in details for <strong>{ctx.snapshot()?.data.employeeName}</strong> using the tabs below.
        Switch between tabs freely — data is saved as you type.
        First name, last name, department, and job title are required before proceeding.
      </p>

      <PathShell
        path={employeeDetailsPath}
        initialData={DETAILS_INITIAL}
        restoreKey="details"
        layout="tabs"
        validateWhen={ctx.snapshot()?.hasAttemptedNext ?? false}
        validationDisplay="inline"
        steps={{
          "personal":   () => <PersonalTab />,
          "department": () => <DepartmentTab />,
          "equipment":  () => <EquipmentTab />,
          "roles":      () => <RolesTab />,
        }}
      />
    </div>
  );
}
