import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PathData } from "@daltonr/pathwrite-angular";
import { PathShellComponent, PathStepDirective } from "@daltonr/pathwrite-angular/shell";
import { PathEngine } from "@daltonr/pathwrite-angular";
import { LocalStorageStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";
import { teamOnboardingPath, memberProfileSubPath, INITIAL_DATA } from "./wizard";
import type { WizardData, Person, MemberProfile } from "./wizard";
import { TeamSetupStepComponent }      from "./steps/team-setup-step.component";
import { MemberProfilesStepComponent } from "./steps/member-profiles-step.component";
import { BackgroundStepComponent }     from "./steps/background-step.component";
import { GoalsStepComponent }          from "./steps/goals-step.component";
import { SummaryStepComponent }        from "./steps/summary-step.component";

interface SessionSummary {
  key: string;
  teamName: string;
  memberCount: number;
  profilesDone: number;
  stepLabel: string;
}

const STEP_LABELS: Record<string, string> = {
  "team-setup":      "Step 1 — Team Setup",
  "member-profiles": "Step 2 — Member Profiles",
  "summary":         "Step 3 — Summary",
};

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    PathShellComponent,
    PathStepDirective,
    TeamSetupStepComponent,
    MemberProfilesStepComponent,
    BackgroundStepComponent,
    GoalsStepComponent,
    SummaryStepComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit {

  protected readonly teamOnboardingPath = teamOnboardingPath;

  // ── View state ─────────────────────────────────────────────────────────────
  protected view: "sessions" | "wizard" | "completed" | "cancelled" = "sessions";

  // ── Session list ───────────────────────────────────────────────────────────
  protected sessions: SessionSummary[] = [];
  protected sessionsLoading = true;

  // ── Active wizard ──────────────────────────────────────────────────────────
  // Kept as a plain property (NOT in a signal) to prevent Angular deep-proxying
  // the PathEngine class, which would strip private class members.
  protected engine: PathEngine | null = null;
  protected activeSessionKey: string | null = null;
  protected isRestored = false;
  protected wizardLoading = false;
  protected completedData: WizardData | null = null;

  // ── Save indicator ─────────────────────────────────────────────────────────
  protected saveIndicator = false;
  private saveIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Store ─────────────────────────────────────────────────────────────────
  private readonly store = new LocalStorageStore({ prefix: "pathwrite-demo:" });

  async ngOnInit(): Promise<void> {
    await this.loadSessionList();
  }

  // ── Session management ────────────────────────────────────────────────────

  async loadSessionList(): Promise<void> {
    this.sessionsLoading = true;
    try {
      const keys = await this.store.list();
      const summaries: SessionSummary[] = [];

      for (const key of keys) {
        const state = await this.store.load(key);
        if (!state) continue;
        const data = state.data as WizardData;
        const members = (data.members ?? []) as Person[];
        const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;
        const profilesDone = members.filter((_, i) => !!profiles[String(i)]?.department).length;

        const topLevelStepId = state.pathStack.length > 0
          ? null
          : teamOnboardingPath.steps[state.currentStepIndex]?.id ?? null;

        summaries.push({
          key,
          teamName: (data.teamName as string) || "(unnamed)",
          memberCount: members.length,
          profilesDone,
          stepLabel: topLevelStepId
            ? (STEP_LABELS[topLevelStepId] ?? "In progress")
            : "Sub-wizard in progress",
        });
      }

      this.sessions = summaries.sort((a, b) => a.key.localeCompare(b.key));
    } catch (err) {
      console.error("Failed to load sessions:", err);
      this.sessions = [];
    } finally {
      this.sessionsLoading = false;
    }
  }

  async deleteSession(key: string): Promise<void> {
    await this.store.delete(key);
    this.sessions = this.sessions.filter(s => s.key !== key);
  }

  async startNew(): Promise<void> {
    const key = `session:${Date.now()}`;
    await this.openSession(key);
  }

  async resumeSession(key: string): Promise<void> {
    await this.openSession(key);
  }

  private async openSession(key: string): Promise<void> {
    this.wizardLoading = true;
    this.activeSessionKey = key;

    const result = await restoreOrStart({
      store: this.store,
      key,
      path: teamOnboardingPath,
      pathDefinitions: {
        [teamOnboardingPath.id]: teamOnboardingPath,
        [memberProfileSubPath.id]: memberProfileSubPath,
      },
      initialData: INITIAL_DATA,
      observers: [
        httpPersistence({
          store: this.store,
          key,
          strategy: "onEveryChange",
          debounceMs: 500,
          onSaveSuccess: () => this.showSaveIndicator(),
        }),
      ],
    });

    this.engine = result.engine;
    this.isRestored = result.restored;
    this.wizardLoading = false;
    this.view = "wizard";
  }

  // ── Wizard event handlers ─────────────────────────────────────────────────

  protected handleComplete(data: PathData): void {
    this.completedData = data as unknown as WizardData;
    this.engine = null;
    this.view = "completed";
    // httpPersistence auto-deletes the snapshot on completion; sync the list
    if (this.activeSessionKey) {
      this.sessions = this.sessions.filter(s => s.key !== this.activeSessionKey);
    }
  }

  protected handleCancel(): void {
    this.engine = null;
    this.view = "cancelled";
  }

  protected async exitToSessions(): Promise<void> {
    this.engine = null;
    this.activeSessionKey = null;
    this.view = "sessions";
    await this.loadSessionList();
  }

  // ── Save indicator ─────────────────────────────────────────────────────────

  private showSaveIndicator(): void {
    this.saveIndicator = true;
    if (this.saveIndicatorTimer) clearTimeout(this.saveIndicatorTimer);
    this.saveIndicatorTimer = setTimeout(() => { this.saveIndicator = false; }, 2500);
  }

  // ── Completion screen helpers ──────────────────────────────────────────────

  protected completedMembers(): Person[] {
    return (this.completedData?.members ?? []) as Person[];
  }

  protected completedProfile(i: number): MemberProfile | null {
    return ((this.completedData?.profiles ?? {}) as Record<string, MemberProfile>)[String(i)] ?? null;
  }

  protected formatDate(d: string): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" });
    } catch { return d; }
  }
}
