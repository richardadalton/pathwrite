import { usePathContext } from "@daltonr/pathwrite-react";
import type { EmployeeDetails } from "../employee-details";

/**
 * Tab bar rendered at the top of each inner step component.
 * Calls `usePathContext()` to get the INNER path's context,
 * then uses `goToStep` to switch between tabs freely.
 */
export function TabBar() {
  const { snapshot, goToStep } = usePathContext<EmployeeDetails>();

  return (
    <div className="tab-bar">
      {snapshot.steps.map(step => (
        <button
          key={step.id}
          type="button"
          className={[
            "tab-btn",
            step.status === "current"   ? "tab-btn--active"    : "",
            step.status === "completed" ? "tab-btn--completed" : "",
          ].join(" ").trim()}
          onClick={() => goToStep(step.id)}
        >
          {step.title}
          {step.status === "completed" && <span className="tab-check"> ✓</span>}
        </button>
      ))}
    </div>
  );
}
