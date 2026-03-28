import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { memberProfileSubPath } from "../wizard";
import type { WizardData, Person, MemberProfile, ProfileSubData } from "../wizard";

@Component({
  selector: "app-member-profiles-step",
  standalone: true,
  styles: [`
    .step-intro { margin: 0 0 24px; font-size: 14px; color: #5b677a; }
    .form-body { display: flex; flex-direction: column; gap: 16px; }
    .profile-list { display: flex; flex-direction: column; gap: 8px; }
    .profile-item {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px; border: 1px solid #e5e7eb; border-radius: 8px;
      background: #fff; transition: border-color 0.15s;
    }
    .profile-item--done { border-color: #bbf7d0; background: #f0fdf4; }
    .member-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #dbeafe; color: #1d4ed8;
      font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .profile-item--done .member-avatar { background: #d1fae5; color: #15803d; }
    .profile-item-info { flex: 1; }
    .profile-item-name { font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 2px; }
    .profile-item-role { font-size: 13px; color: #6b7280; margin: 0; }
    .profile-done-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; margin-right: 8px; }
    .profile-done-dept { font-size: 13px; color: #374151; }
    .profile-done-badge { font-size: 12px; font-weight: 600; color: #15803d; }
    .btn-fill {
      padding: 7px 14px; border-radius: 6px; border: 1px solid #2563eb;
      background: #eff6ff; color: #2563eb; font-size: 13px; font-weight: 600;
      cursor: pointer; white-space: nowrap; transition: background 0.15s;
    }
    .btn-fill:hover:not(:disabled) { background: #dbeafe; }
    .btn-fill:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-edit {
      padding: 6px 12px; border-radius: 6px; border: 1px solid #d1d5db;
      background: #fff; color: #374151; font-size: 13px;
      cursor: pointer; transition: background 0.15s;
    }
    .btn-edit:hover:not(:disabled) { background: #f3f4f6; }
    .btn-edit:disabled { opacity: 0.5; cursor: not-allowed; }
    .gate-done { margin: 0; font-size: 13px; color: #15803d; font-weight: 500; }
    .gate-pending { margin: 0; font-size: 13px; color: #9ca3af; font-style: italic; }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Complete a profile for each team member. Click <strong>Fill in Profile</strong> to open a
        short two-step wizard, then return here when done. You can edit any profile before moving on.
      </p>

      <div class="profile-list">
        @for (member of members(); track $index) {
          <div class="profile-item" [class.profile-item--done]="!!getProfile($index)">
            <span class="member-avatar">{{ member.name.charAt(0).toUpperCase() }}</span>

            <div class="profile-item-info">
              <p class="profile-item-name">{{ member.name }}</p>
              @if (member.role) { <p class="profile-item-role">{{ member.role }}</p> }
            </div>

            @if (getProfile($index); as prof) {
              <div class="profile-done-meta">
                <span class="profile-done-dept">{{ prof.department }}</span>
                <span class="profile-done-badge">✓ Done</span>
              </div>
              <button
                type="button"
                class="btn-edit"
                [disabled]="path.snapshot()?.isNavigating"
                (click)="openProfile(member, $index)"
              >Edit</button>
            } @else {
              <button
                type="button"
                class="btn-fill"
                [disabled]="path.snapshot()?.isNavigating"
                (click)="openProfile(member, $index)"
              >Fill in Profile →</button>
            }
          </div>
        }
      </div>

      @if (allDone()) {
        <p class="gate-done">✓ All {{ members().length }} profiles complete — click Next to review.</p>
      } @else if (attempted() && errors()['_']; as msg) {
        <p class="gate-pending">⏳ {{ msg }}</p>
      }
    </div>
  `
})
export class MemberProfilesStepComponent {
  protected readonly path = injectPath<WizardData>();

  protected readonly errors = computed(() =>
    this.path.snapshot()?.fieldErrors ?? {}
  );

  protected readonly attempted = computed(() =>
    this.path.snapshot()?.hasAttemptedNext ?? false
  );

  protected readonly members = computed(() =>
    (this.path.snapshot()?.data.members ?? []) as Person[]
  );

  protected readonly profiles = computed(() =>
    (this.path.snapshot()?.data.profiles ?? {}) as Record<string, MemberProfile>
  );

  protected readonly allDone = computed(() => {
    const members = this.members();
    return members.length > 0 && members.every((_, i) => !!this.getProfile(i)?.department);
  });

  protected getProfile(index: number): MemberProfile | null {
    return this.profiles()[String(index)] ?? null;
  }

  protected openProfile(member: Person, index: number): void {
    const existing = this.getProfile(index);
    const initialData: ProfileSubData = {
      memberName:  member.name,
      memberRole:  member.role,
      memberIndex: index,
      department: existing?.department ?? "",
      startDate:  existing?.startDate  ?? "",
      bio:        existing?.bio        ?? "",
      goals30:    existing?.goals30    ?? "",
      goals90:    existing?.goals90    ?? "",
    };
    this.path.startSubPath(memberProfileSubPath, initialData, { memberIndex: index });
  }
}
