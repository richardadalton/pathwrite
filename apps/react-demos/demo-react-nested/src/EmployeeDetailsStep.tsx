import { PathShell, usePathContext } from "@daltonr/pathwrite-react";
import type { PathEvent, PathSnapshot } from "@daltonr/pathwrite-react";
import { employeeDetailsPath, DETAILS_INITIAL } from "./employee-details";
import type { EmployeeDetails } from "./employee-details";
import type { OnboardingData } from "./onboarding";
import { PersonalTab }    from "./tabs/PersonalTab";
import { DepartmentTab }  from "./tabs/DepartmentTab";
import { EquipmentTab }   from "./tabs/EquipmentTab";
import { RolesTab }       from "./tabs/RolesTab";

export function EmployeeDetailsStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  const outerSnap = snapshot!;

  const initialDetails: EmployeeDetails = {
    ...DETAILS_INITIAL,
    ...(outerSnap.data.details as Partial<EmployeeDetails> ?? {}),
  };

  function handleInnerEvent(event: PathEvent) {
    if (event.type === "stateChanged") {
      setData("details", (event.snapshot as PathSnapshot<EmployeeDetails>).data);
    }
  }

  return (
    <div className="nested-shell-wrapper">
      <p className="step-intro">
        Fill in details for <strong>{outerSnap.data.employeeName}</strong> using the tabs below.
        Switch between tabs freely — data is saved as you type.
        First name, last name, department, and job title are required before proceeding.
      </p>

      <PathShell
        path={employeeDetailsPath}
        initialData={initialDetails}
        hideProgress={true}
        hideCancel={true}
        hideFooter={true}
        onEvent={handleInnerEvent}
        validateWhen={outerSnap.hasAttemptedNext}
        validationDisplay="inline"
        steps={{
          "personal":   <PersonalTab />,
          "department": <DepartmentTab />,
          "equipment":  <EquipmentTab />,
          "roles":      <RolesTab />,
        }}
      />
    </div>
  );
}
