import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ProfileSubData } from "../wizard";

@Component({
  selector: "app-goals-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .subwizard-context {
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 8px; padding: 12px 16px;
    }
    .subwizard-for { margin: 0 0 2px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0369a1; }
    .subwizard-name { margin: 0; font-size: 15px; font-weight: 600; color: #0c4a6e; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
    .required { color: #dc2626; font-size: 13px; }
    .field-hint { font-size: 12px; color: #9ca3af; font-weight: 400; flex: 1 0 100%; }
    .field textarea {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      resize: vertical; min-height: 120px;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field textarea:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field--error textarea { border-color: #dc2626; }
    .field--error textarea:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">

      <div class="subwizard-context">
        <p class="subwizard-for">Setting goals for</p>
        <p class="subwizard-name">{{ data.memberName }}</p>
      </div>

      <!-- 30-day goals -->
      <div class="field" [class.field--error]="errors()['goals30']">
        <label for="goals30">
          30-Day Goals <span class="required">*</span>
          <span class="field-hint">First month priorities</span>
        </label>
        <textarea
          id="goals30"
          rows="6"
          placeholder="What should this person achieve in their first 30 days? Think about: getting set up with tools and access, meeting key stakeholders, completing any required training, understanding current priorities, and making one or two small early contributions."
          [value]="data.goals30 ?? ''"
          (input)="path.setData('goals30', $any($event.target).value)"
        ></textarea>
        @if (errors()['goals30']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- 90-day goals -->
      <div class="field" [class.field--error]="errors()['goals90']">
        <label for="goals90">
          90-Day Goals <span class="required">*</span>
          <span class="field-hint">Full quarter ownership</span>
        </label>
        <textarea
          id="goals90"
          rows="6"
          placeholder="What does success look like after 90 days? Describe the areas they should own independently, projects they should be driving or contributing to significantly, and metrics you'll use to evaluate their progress."
          [value]="data.goals90 ?? ''"
          (input)="path.setData('goals90', $any($event.target).value)"
        ></textarea>
        @if (errors()['goals90']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class GoalsStepComponent {
  protected readonly path = usePathContext<ProfileSubData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  protected get data(): ProfileSubData {
    return this.path.snapshot()!.data;
  }
}
