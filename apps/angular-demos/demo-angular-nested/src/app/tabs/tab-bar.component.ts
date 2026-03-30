import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { EmployeeDetails } from "../employee-details.types";

/**
 * Tab bar rendered at the top of each inner step component.
 * Calls `usePathContext()` to get the INNER path's facade,
 * then uses `goToStep` to switch between tabs freely.
 */
@Component({
  selector: "app-tab-bar",
  standalone: true,
  styles: [`
    .tab-bar {
      display: flex;
      gap: 4px;
      padding: 0 0 16px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .tab-btn {
      padding: 7px 16px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      color: #4b5563;
      font-size: 13px;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tab-btn:hover { background: #f3f4f6; border-color: #9ca3af; }
    .tab-btn--active {
      background: #2563eb;
      border-color: #2563eb;
      color: #fff;
    }
    .tab-btn--active:hover { background: #1d4ed8; border-color: #1d4ed8; }
    .tab-btn--completed { border-color: #10b981; color: #059669; }
    .tab-btn--completed:hover { background: #ecfdf5; }
    .tab-check { margin-left: 4px; }
  `],
  template: `
    <div class="tab-bar">
      @for (step of steps(); track step.id) {
        <button
          type="button"
          [class]="tabClass(step.status)"
          (click)="path.goToStep(step.id)"
        >
          {{ step.title }}
          @if (step.status === 'completed') {
            <span class="tab-check">&#10003;</span>
          }
        </button>
      }
    </div>
  `,
})
export class TabBarComponent {
  protected readonly path = usePathContext<EmployeeDetails>();

  protected readonly steps = computed(() => this.path.snapshot()?.steps ?? []);

  protected tabClass(status: string): string {
    const classes = ["tab-btn"];
    if (status === "current")   classes.push("tab-btn--active");
    if (status === "completed") classes.push("tab-btn--completed");
    return classes.join(" ");
  }
}
