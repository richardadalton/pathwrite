import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { WizardData, Person, MemberProfile } from "../wizard";

@Component({
  selector: "app-summary-step",
  standalone: true,
  styles: [`
    .step-intro { margin: 0 0 24px; font-size: 14px; color: #5b677a; }
    .form-body { display: flex; flex-direction: column; gap: 16px; }
    .summary-team-card {
      display: flex; align-items: center; gap: 14px;
      background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px 20px;
    }
    .summary-team-icon { font-size: 28px; }
    .summary-team-name { margin: 0 0 2px; font-size: 17px; font-weight: 700; color: #1f2937; }
    .summary-team-meta { margin: 0; font-size: 13px; color: #6b7280; }
    .summary-member-card {
      border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; background: #fff;
    }
    .summary-member-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid #f1f3f7; }
    .member-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: #dbeafe; color: #1d4ed8;
      font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .summary-member-name { margin: 0 0 2px; font-size: 15px; font-weight: 600; color: #1f2937; }
    .summary-member-role { margin: 0; font-size: 13px; color: #6b7280; }
    .summary-detail-grid {
      display: grid; grid-template-columns: 110px 1fr;
      gap: 0; padding: 12px 16px; border-bottom: 1px solid #f1f3f7;
    }
    .summary-detail-grid span { padding: 3px 0; font-size: 14px; }
    .summary-key { font-weight: 600; color: #374151; }
    .summary-longtext-block { padding: 12px 16px; border-top: 1px solid #f1f3f7; }
    .summary-longtext-label { margin: 0 0 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .summary-longtext-body { margin: 0; font-size: 14px; color: #374151; white-space: pre-wrap; }
    .summary-goals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #f1f3f7; border-top: 1px solid #f1f3f7; }
    .summary-goal-block { background: #fff; padding: 12px 16px; }
    .summary-goal-label { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #374151; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Review everything before submitting. Click <strong>Previous</strong> to go back and make changes.
      </p>

      <div class="summary-team-card">
        <span class="summary-team-icon">🏢</span>
        <div>
          <p class="summary-team-name">{{ data.teamName }}</p>
          <p class="summary-team-meta">
            {{ members().length }} member{{ members().length !== 1 ? 's' : '' }}
          </p>
        </div>
      </div>

      @for (member of members(); track $index) {
        <div class="summary-member-card">
          <div class="summary-member-header">
            <span class="member-avatar">{{ member.name.charAt(0).toUpperCase() }}</span>
            <div>
              <p class="summary-member-name">{{ member.name }}</p>
              @if (member.role) { <p class="summary-member-role">{{ member.role }}</p> }
            </div>
          </div>

          @if (getProfile($index); as prof) {
            <div class="summary-detail-grid">
              <span class="summary-key">Department</span>
              <span>{{ prof.department }}</span>
              <span class="summary-key">Start Date</span>
              <span>{{ formatDate(prof.startDate) }}</span>
            </div>

            <div class="summary-longtext-block">
              <p class="summary-longtext-label">Bio</p>
              <p class="summary-longtext-body">{{ prof.bio }}</p>
            </div>

            <div class="summary-goals-grid">
              <div class="summary-goal-block">
                <p class="summary-goal-label">30-Day Goals</p>
                <p class="summary-longtext-body">{{ prof.goals30 }}</p>
              </div>
              <div class="summary-goal-block">
                <p class="summary-goal-label">90-Day Goals</p>
                <p class="summary-longtext-body">{{ prof.goals90 }}</p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class SummaryStepComponent {
  protected readonly path = injectPath<WizardData>();

  protected get data(): WizardData {
    return this.path.snapshot()!.data;
  }

  protected readonly members = computed(() =>
    (this.path.snapshot()?.data.members ?? []) as Person[]
  );

  protected readonly profilesMap = computed(() =>
    (this.path.snapshot()?.data.profiles ?? {}) as Record<string, MemberProfile>
  );

  protected getProfile(index: number): MemberProfile | null {
    return this.profilesMap()[String(index)] ?? null;
  }

  protected formatDate(d: string): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IE", {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch {
      return d;
    }
  }
}
