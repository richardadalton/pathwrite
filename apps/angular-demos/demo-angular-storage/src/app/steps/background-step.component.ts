import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { ProfileSubData } from "../wizard";

@Component({
  selector: "app-background-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .subwizard-context {
      background: #f0f9ff; border: 1px solid #bae6fd;
      border-radius: 8px; padding: 12px 16px;
    }
    .subwizard-for { margin: 0 0 2px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #0369a1; }
    .subwizard-name { margin: 0; font-size: 15px; font-weight: 600; color: #0c4a6e; }
    .subwizard-role { font-weight: 400; color: #0369a1; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; flex-wrap: wrap; }
    .required { color: #dc2626; font-size: 13px; }
    .field-hint { font-size: 12px; color: #9ca3af; font-weight: 400; flex: 1 0 100%; }
    .field input, .field textarea {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus, .field textarea:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field textarea { resize: vertical; min-height: 120px; }
    .field--error input, .field--error textarea { border-color: #dc2626; }
    .field--error input:focus, .field--error textarea:focus {
      border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1);
    }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">

      <div class="subwizard-context">
        <p class="subwizard-for">Completing profile for</p>
        <p class="subwizard-name">
          {{ data.memberName }}
          @if (data.memberRole) {
            <span class="subwizard-role"> — {{ data.memberRole }}</span>
          }
        </p>
      </div>

      <!-- Department -->
      <div class="field" [class.field--error]="errors()['department']">
        <label for="department">Department <span class="required">*</span></label>
        <input
          id="department" type="text"
          placeholder="e.g. Engineering, Design, Product, Marketing…"
          [value]="data.department ?? ''"
          (input)="path.setData('department', $any($event.target).value)"
          autofocus
        />
        @if (errors()['department']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Start date -->
      <div class="field" [class.field--error]="errors()['startDate']">
        <label for="start-date">Start Date <span class="required">*</span></label>
        <input
          id="start-date" type="date"
          [value]="data.startDate ?? ''"
          (change)="path.setData('startDate', $any($event.target).value)"
        />
        @if (errors()['startDate']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Bio -->
      <div class="field" [class.field--error]="errors()['bio']">
        <label for="bio">
          Short Bio <span class="required">*</span>
          <span class="field-hint">Introduce this person to the team</span>
        </label>
        <textarea
          id="bio"
          rows="6"
          placeholder="Describe their background, previous experience, what drew them to this role, and what they'll bring to the team."
          [value]="data.bio ?? ''"
          (input)="path.setData('bio', $any($event.target).value)"
        ></textarea>
        @if (errors()['bio']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

    </div>
  `
})
export class BackgroundStepComponent {
  protected readonly path = usePathContext<ProfileSubData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  protected get data(): ProfileSubData {
    return this.path.snapshot()!.data;
  }
}
