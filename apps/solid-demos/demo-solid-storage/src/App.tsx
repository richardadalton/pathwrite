import { createSignal, onMount, Show, For } from "solid-js";
import { PathShell } from "@daltonr/pathwrite-solid";
import type { PathData, PathEngine } from "@daltonr/pathwrite-solid";
import { LocalStorageStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";
import { teamOnboardingPath, memberProfileSubPath, INITIAL_DATA } from "./wizard";
import type { WizardData, Person, MemberProfile } from "./wizard";
import TeamSetupStep      from "./TeamSetupStep";
import MemberProfilesStep from "./MemberProfilesStep";
import BackgroundStep     from "./BackgroundStep";
import GoalsStep          from "./GoalsStep";
import SummaryStep        from "./SummaryStep";

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const store = new LocalStorageStore({ prefix: "pathwrite-demo:" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionSummary {
  key: string;
  teamName: string;
  memberCount: number;
  profilesDone: number;
  stepLabel: string;
}

type View = "sessions" | "wizard" | "completed" | "cancelled";

const STEP_LABELS: Record<string, string> = {
  teamSetup:      "Step 1 — Team Setup",
  memberProfiles: "Step 2 — Member Profiles",
  summary:        "Step 3 — Summary",
};

function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [view, setView]                     = createSignal<View>("sessions");
  const [sessions, setSessions]             = createSignal<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = createSignal(true);

  const [engine, setEngine]                 = createSignal<PathEngine | null>(null);
  const [engineKey, setEngineKey]           = createSignal(0);
  const [activeSessionKey, setActiveSessionKey] = createSignal<string | null>(null);
  const [isRestored, setIsRestored]         = createSignal(false);
  const [wizardLoading, setWizardLoading]   = createSignal(false);
  const [completedData, setCompletedData]   = createSignal<WizardData | null>(null);

  const [saveIndicator, setSaveIndicator]   = createSignal(false);
  let saveIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  function onSaveSuccess() {
    setSaveIndicator(true);
    if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
    saveIndicatorTimer = setTimeout(() => setSaveIndicator(false), 2500);
  }

  // -------------------------------------------------------------------------
  // Session list
  // -------------------------------------------------------------------------

  async function loadSessionList() {
    setSessionsLoading(true);
    try {
      const keys = await store.list();
      const summaries: SessionSummary[] = [];

      for (const key of keys) {
        const state = await store.load(key);
        if (!state) continue;
        const data = state.data as WizardData;
        const members  = (data.members ?? []) as Person[];
        const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;
        const profilesDone = members.filter((_, i) => !!profiles[String(i)]?.department).length;

        const topLevelStepId = state.pathStack.length > 0
          ? null
          : teamOnboardingPath.steps[state.currentStepIndex]?.id ?? null;

        summaries.push({
          key,
          teamName:    (data.teamName as string) || "(unnamed)",
          memberCount: members.length,
          profilesDone,
          stepLabel: topLevelStepId
            ? (STEP_LABELS[topLevelStepId] ?? "In progress")
            : "Sub-wizard in progress",
        });
      }

      setSessions(summaries.sort((a, b) => a.key.localeCompare(b.key)));
    } catch (err) {
      console.error("Failed to load sessions:", err);
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }

  onMount(() => { loadSessionList(); });

  async function deleteSession(key: string) {
    await store.delete(key);
    setSessions(sessions().filter(s => s.key !== key));
  }

  // -------------------------------------------------------------------------
  // Open a session
  // -------------------------------------------------------------------------

  async function startNew() {
    const key = `session:${Date.now()}`;
    await openSession(key);
  }

  async function resumeSession(key: string) {
    await openSession(key);
  }

  async function openSession(key: string) {
    setWizardLoading(true);
    setActiveSessionKey(key);

    const result = await restoreOrStart({
      store,
      key,
      path: teamOnboardingPath,
      pathDefinitions: {
        [teamOnboardingPath.id]: teamOnboardingPath,
        [memberProfileSubPath.id]: memberProfileSubPath,
      },
      initialData: INITIAL_DATA,
      observers: [
        persistence({
          store,
          key,
          strategy: "onEveryChange",
          debounceMs: 500,
          onSaveSuccess,
        }),
      ],
    });

    setEngine(result.engine);
    setEngineKey(k => k + 1);
    setIsRestored(result.restored);
    setWizardLoading(false);
    setView("wizard");
  }

  // -------------------------------------------------------------------------
  // Wizard event handlers
  // -------------------------------------------------------------------------

  function handleComplete(data: PathData) {
    setCompletedData(data as unknown as WizardData);
    setView("completed");
    const key = activeSessionKey();
    if (key) {
      setSessions(sessions().filter(s => s.key !== key));
    }
  }

  function handleCancel() {
    setView("cancelled");
  }

  async function exitToSessions() {
    setEngine(null);
    setActiveSessionKey(null);
    setView("sessions");
    await loadSessionList();
  }

  // -------------------------------------------------------------------------
  // Completion helpers
  // -------------------------------------------------------------------------

  function getMembers(): Person[] {
    return (completedData()?.members ?? []) as Person[];
  }

  function getProfile(i: number): MemberProfile | null {
    return ((completedData()?.profiles ?? {}) as Record<string, MemberProfile>)[String(i)] ?? null;
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <main class="page">
      <div class="page-header">
        <h1>Team Onboarding</h1>
        <p class="subtitle">
          Multi-session localStorage demo. Start several sessions, close the tab, come back and resume any of them.
        </p>
      </div>

      {/* Fixed save indicator */}
      <Show when={saveIndicator()}>
        <div class="save-indicator">✓ Progress saved</div>
      </Show>

      {/* Sessions list */}
      <Show when={view() === "sessions"}>
        <Show when={sessionsLoading()}>
          <div class="loading-state">
            <p>Loading saved sessions…</p>
          </div>
        </Show>

        <Show when={!sessionsLoading()}>
          <Show when={sessions().length > 0}>
            <div class="sessions-list">
              <h2 class="sessions-title">In-Progress Onboardings</h2>
              <For each={sessions()}>
                {(session) => (
                  <div class="session-card">
                    <div class="session-card__icon">📋</div>
                    <div class="session-card__info">
                      <p class="session-card__team">{session.teamName}</p>
                      <p class="session-card__meta">
                        {session.memberCount} member{session.memberCount !== 1 ? "s" : ""}
                        {session.memberCount > 0 ? ` · ${session.profilesDone}/${session.memberCount} profiles done` : ""}
                        {" · "}{session.stepLabel}
                      </p>
                      <p class="session-card__key">key: <code>{session.key}</code></p>
                    </div>
                    <div class="session-card__actions">
                      <button class="btn-resume" onClick={() => resumeSession(session.key)}>Resume →</button>
                      <button class="btn-delete-session" onClick={() => deleteSession(session.key)} title="Delete">🗑</button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={sessions().length === 0}>
            <div class="empty-sessions">
              <div class="empty-sessions__icon">🗂️</div>
              <p>No saved onboardings yet.</p>
              <p class="empty-sessions__hint">Start one below — it will be saved automatically as you work.</p>
            </div>
          </Show>

          <div class="new-session-bar">
            <button class="btn-primary btn-new-session" onClick={startNew}>+ Start New Onboarding</button>
            <p class="new-session-hint">Each session gets its own localStorage key and can be resumed independently.</p>
          </div>
        </Show>
      </Show>

      {/* Active wizard */}
      <Show when={view() === "wizard"}>
        <div class="wizard-topbar">
          <button class="btn-back-sessions" onClick={exitToSessions}>← All Sessions</button>
          <div class="wizard-topbar__right">
            <Show when={isRestored()}>
              <span class="restored-badge">↩ Restored</span>
            </Show>
            <code class="session-key-chip">{activeSessionKey()}</code>
          </div>
        </div>

        <Show when={wizardLoading()}>
          <div class="loading-state">
            <p>Loading session…</p>
          </div>
        </Show>

        {/*
          The engineKey() signal is used to force a full remount of PathShell
          when a new session is opened. We achieve this by rendering a unique
          component per key value using a keyed Show — when the key changes the
          old component is destroyed and a new one is created.
        */}
        <Show when={!wizardLoading() && engine() !== null} keyed>
          <PathShell
            engine={engine()!}
            path={teamOnboardingPath}
            completeLabel="Submit Onboarding"
            cancelLabel="Cancel"
            validationDisplay="inline"
            progressLayout="split"
            onComplete={handleComplete}
            onCancel={handleCancel}
            steps={{
              teamSetup:      () => <TeamSetupStep />,
              memberProfiles: () => <MemberProfilesStep />,
              summary:        () => <SummaryStep />,
              background:     () => <BackgroundStep />,
              goals:          () => <GoalsStep />,
            }}
          />
        </Show>
      </Show>

      {/* Completed */}
      <Show when={view() === "completed" && completedData()}>
        <section class="result-panel success-panel">
          <div class="result-icon">🎉</div>
          <h2>Onboarding Complete!</h2>
          <p>
            <strong>{completedData()?.teamName}</strong> — {getMembers().length} member{getMembers().length !== 1 ? "s" : ""} onboarded.
          </p>
          <div class="result-summary">
            <For each={getMembers()}>
              {(member, i) => (
                <div class="result-member-card">
                  <div class="result-member-header">
                    <span class="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                    <div>
                      <p class="result-member-name">{member.name}</p>
                      <Show when={member.role}>
                        <p class="result-member-role">{member.role}</p>
                      </Show>
                    </div>
                  </div>
                  <Show when={getProfile(i())}>
                    <div class="result-detail-grid">
                      <span class="result-key">Department</span>
                      <span>{getProfile(i())!.department}</span>
                      <span class="result-key">Start Date</span>
                      <span>{formatDate(getProfile(i())!.startDate)}</span>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
          <button class="btn-primary" onClick={exitToSessions}>← Back to Sessions</button>
        </section>
      </Show>

      {/* Cancelled */}
      <Show when={view() === "cancelled"}>
        <section class="result-panel cancel-panel">
          <div class="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>Your saved progress is still available to resume.</p>
          <button class="btn-secondary" onClick={exitToSessions}>← Back to Sessions</button>
        </section>
      </Show>
    </main>
  );
}
