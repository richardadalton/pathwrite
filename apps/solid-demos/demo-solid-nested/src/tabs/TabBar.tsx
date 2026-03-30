import { For, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { EmployeeDetails } from "../employee-details";

/**
 * Tab bar rendered at the top of each inner step component.
 * Calls usePathContext() to get the INNER path's context,
 * then uses goToStep to switch between tabs freely.
 */
export default function TabBar() {
  const ctx = usePathContext<EmployeeDetails>();

  return (
    <div class="tab-bar">
      <For each={ctx.snapshot()?.steps ?? []}>
        {(step) => (
          <button
            type="button"
            class="tab-btn"
            classList={{
              "tab-btn--active":    step.status === "current",
              "tab-btn--completed": step.status === "completed",
            }}
            onClick={() => ctx.goToStep(step.id)}
          >
            {step.title}
            <Show when={step.status === "completed"}>
              <span class="tab-check"> ✓</span>
            </Show>
          </button>
        )}
      </For>
    </div>
  );
}
