import { Component, computed } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import type { WizardData, Person } from "../wizard";

@Component({
  selector: "app-team-setup-step",
  standalone: true,
  styles: [`
    .step-intro { margin: 0 0 24px; font-size: 14px; color: #5b677a; }
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; }
    .required { color: #dc2626; font-size: 13px; }
    .field input {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 9px 12px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .field input:focus {
      outline: none; border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field--error input { border-color: #dc2626; }
    .field--error input:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }
    .field-error { font-size: 13px; color: #dc2626; }
    .section-label { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: #374151; }
    .members-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .members-header p { margin: 0; font-size: 14px; font-weight: 600; color: #374151; }
    .btn-add {
      padding: 6px 12px; border-radius: 6px; border: 1px solid #2563eb;
      background: #eff6ff; color: #2563eb; font-size: 13px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-add:hover { background: #dbeafe; }
    .empty-members { text-align: center; padding: 20px; border: 1px dashed #d1d5db; border-radius: 8px; color: #6b7280; }
    .empty-members p { margin: 4px 0 0; font-size: 14px; }
    .member-list { display: flex; flex-direction: column; gap: 8px; }
    .member-row { display: flex; align-items: center; gap: 10px; }
    .member-number { width: 24px; height: 24px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; color: #374151; flex-shrink: 0; }
    .member-fields { display: flex; gap: 8px; flex: 1; }
    .member-name-input, .member-role-input {
      border: 1px solid #c2d0e5; border-radius: 6px;
      padding: 8px 10px; font-size: 14px; font-family: inherit;
      color: #1f2937; background: #fff;
      transition: border-color 0.15s;
    }
    .member-name-input { flex: 1; }
    .member-role-input { flex: 1; }
    .member-name-input:focus, .member-role-input:focus { outline: none; border-color: #2563eb; }
    .input--error { border-color: #dc2626 !important; }
    .btn-remove {
      width: 28px; height: 28px; border-radius: 50%; border: 1px solid #e5e7eb;
      background: #fff; color: #6b7280; font-size: 13px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s, color 0.15s; flex-shrink: 0;
    }
    .btn-remove:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Enter your team's name and add everyone you'll be onboarding. You'll fill in a detailed
        profile for each person on the next step.
      </p>

      <!-- Team name -->
      <div class="field" [class.field--error]="attempted() && errors()['teamName']">
        <label for="team-name">Team Name <span class="required">*</span></label>
        <input
          id="team-name"
          type="text"
          placeholder="e.g. Platform Engineering"
          [value]="teamName()"
          (input)="path.setData('teamName', $any($event.target).value)"
          autofocus
        />
        @if (attempted() && errors()['teamName']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <!-- Members list -->
      <div>
        <div class="members-header">
          <p>Team Members <span class="required">*</span></p>
          <button type="button" class="btn-add" (click)="addMember()">+ Add Member</button>
        </div>

        @if (members().length === 0) {
          <div class="empty-members">
            <span>👥</span>
            <p>No members yet. Click <strong>+ Add Member</strong> to get started.</p>
          </div>
        }

        <div class="member-list">
          @for (member of members(); track $index) {
            <div class="member-row">
              <span class="member-number">{{ $index + 1 }}</span>
              <div class="member-fields">
                <input
                  type="text"
                  placeholder="Full name *"
                  [value]="member.name"
                  (input)="updateMemberName($index, $any($event.target).value)"
                  class="member-name-input"
                  [class.input--error]="attempted() && !member.name.trim()"
                />
                <input
                  type="text"
                  placeholder="Role / title (optional)"
                  [value]="member.role"
                  (input)="updateMemberRole($index, $any($event.target).value)"
                  class="member-role-input"
                />
              </div>
              <button
                type="button"
                class="btn-remove"
                (click)="removeMember($index)"
                title="Remove member"
              >✕</button>
            </div>
          }
        </div>

        @if (attempted() && errors()['members']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>
    </div>
  `
})
export class TeamSetupStepComponent {
  protected readonly path = usePathContext<WizardData>();

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.fieldErrors ?? {};
  });

  protected readonly attempted = computed(() =>
    this.path.snapshot()?.hasAttemptedNext ?? false
  );

  protected readonly teamName = computed(() =>
    (this.path.snapshot()?.data.teamName as string) ?? ""
  );

  protected readonly members = computed(() =>
    (this.path.snapshot()?.data.members ?? []) as Person[]
  );

  protected addMember(): void {
    this.path.setData("members", [...this.members(), { name: "", role: "" }]);
  }

  protected removeMember(index: number): void {
    this.path.setData("members", this.members().filter((_, i) => i !== index));
  }

  protected updateMemberName(index: number, value: string): void {
    this.path.setData("members", this.members().map((m, i) =>
      i === index ? { ...m, name: value } : m
    ));
  }

  protected updateMemberRole(index: number, value: string): void {
    this.path.setData("members", this.members().map((m, i) =>
      i === index ? { ...m, role: value } : m
    ));
  }
}
