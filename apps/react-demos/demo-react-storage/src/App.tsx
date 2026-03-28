import { useState, useEffect, useRef } from "react";
import { PathShell } from "@daltonr/pathwrite-react";
import type { PathData } from "@daltonr/pathwrite-react";
import { PathEngine } from "@daltonr/pathwrite-core";
import { LocalStorageStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";
import {
  teamOnboardingPath,
  memberProfileSubPath,
  INITIAL_DATA,
} from "./wizard";
import type { WizardData, Person, MemberProfile } from "./wizard";
import { TeamSetupStep }     from "./TeamSetupStep";
import { MemberProfilesStep } from "./MemberProfilesStep";
import { BackgroundStep }    from "./BackgroundStep";
import { GoalsStep }         from "./GoalsStep";
import { SummaryStep }       from "./SummaryStep";

const store = new LocalStorageStore({ prefix: "pathwrite-demo:" });

type View = "sessions" | "wizard" | "completed" | "cancelled";

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

export default function App() {
  const [view,          setView]          = useState<View>("sessions");
  const [sessions,      setSessions]      = useState<SessionSummary[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [activeKey,     setActiveKey]     = useState<string | null>(null);
  const [isRestored,    setIsRestored]    = useState(false);
  const [wizardLoading, setWizardLoading] = useState(false);
  const [completedData, setCompletedData] = useState<WizardData | null>(null);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [engine,        setEngine]        = useState<PathEngine | null>(null);
  const [engineKey,     setEngineKey]     = useState(0);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSaveSuccess() {
    setSaveIndicator(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveIndicator(false), 2500);
  }

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
          teamName:     (data.teamName as string) || "(unnamed)",
          memberCount:  members.length,
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

  useEffect(() => {
    loadSessionList();
  }, []);

  async function deleteSession(key: string) {
    await store.delete(key);
    setSessions(prev => prev.filter(s => s.key !== key));
  }

  async function openSession(key: string) {
    setWizardLoading(true);
    setActiveKey(key);

    const result = await restoreOrStart({
      store,
      key,
      path: teamOnboardingPath,
      pathDefinitions: {
        [teamOnboardingPath.id]:    teamOnboardingPath,
        [memberProfileSubPath.id]:  memberProfileSubPath,
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

  async function startNew() {
    const key = `session:${Date.now()}`;
    await openSession(key);
  }

  function handleComplete(data: PathData) {
    setCompletedData(data as WizardData);
    setView("completed");
    // persistence auto-deletes the snapshot on completion; sync the list
    if (activeKey) {
      setSessions(prev => prev.filter(s => s.key !== activeKey));
    }
  }

  function handleCancel() {
    setView("cancelled");
  }

  async function exitToSessions() {
    setEngine(null);
    setActiveKey(null);
    setView("sessions");
    await loadSessionList();
  }

  const members  = () => (completedData?.members ?? []) as Person[];
  const profile  = (i: number) =>
    ((completedData?.profiles ?? {}) as Record<string, MemberProfile>)[String(i)] ?? null;

  function formatDate(d: string): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IE", {
        year: "numeric", month: "long", day: "numeric",
      });
    } catch { return d; }
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>Team Onboarding</h1>
        <p className="subtitle">
          Multi-session localStorage demo. Start several onboardings, close the tab, come back and
          resume any of them.
        </p>
      </div>

      {/* Save indicator */}
      {saveIndicator && (
        <div className="save-indicator">✓ Progress saved</div>
      )}

      {/* ── Sessions list ─────────────────────────────────────────────────── */}
      {view === "sessions" && (
        <section>
          {sessionsLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading saved sessions…</p>
            </div>
          ) : (
            <>
              {sessions.length > 0 ? (
                <div className="sessions-list">
                  <h2 className="sessions-title">In-Progress Onboardings</h2>
                  {sessions.map(session => (
                    <div key={session.key} className="session-card">
                      <div className="session-card__icon">📋</div>
                      <div className="session-card__info">
                        <p className="session-card__team">{session.teamName}</p>
                        <p className="session-card__meta">
                          {session.memberCount} member{session.memberCount !== 1 ? "s" : ""}
                          {session.memberCount > 0 && (
                            <> · {session.profilesDone}/{session.memberCount} profiles done</>
                          )}
                          {" "}· {session.stepLabel}
                        </p>
                        <p className="session-card__key">key: <code>{session.key}</code></p>
                      </div>
                      <div className="session-card__actions">
                        <button className="btn-resume" onClick={() => openSession(session.key)}>
                          Resume →
                        </button>
                        <button
                          className="btn-delete-session"
                          onClick={() => deleteSession(session.key)}
                          title="Delete"
                        >🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-sessions">
                  <div className="empty-sessions__icon">🗂️</div>
                  <p>No saved onboardings yet.</p>
                  <p className="empty-sessions__hint">
                    Start one below — it will be saved automatically as you work.
                  </p>
                </div>
              )}

              <div className="new-session-bar">
                <button className="btn-primary btn-new-session" onClick={startNew}>
                  + Start New Onboarding
                </button>
                <p className="new-session-hint">
                  Each session gets its own localStorage key and can be resumed independently.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Active wizard ─────────────────────────────────────────────────── */}
      {view === "wizard" && (
        <section>
          <div className="wizard-topbar">
            <button className="btn-back-sessions" onClick={exitToSessions}>
              ← All Sessions
            </button>
            <div className="wizard-topbar__right">
              {isRestored && <span className="restored-badge">↩️ Restored</span>}
              <code className="session-key-chip">{activeKey}</code>
            </div>
          </div>

          {wizardLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading session…</p>
            </div>
          ) : engine ? (
            <PathShell
              key={engineKey}
              path={teamOnboardingPath}
              engine={engine}
              completeLabel="Submit Onboarding"
              validationDisplay="inline"
              cancelLabel="Cancel"
              onComplete={handleComplete}
              onCancel={handleCancel}
              steps={{
                "team-setup":      <TeamSetupStep />,
                "member-profiles": <MemberProfilesStep />,
                "summary":         <SummaryStep />,
                "background":      <BackgroundStep />,
                "goals":           <GoalsStep />,
              }}
            />
          ) : null}
        </section>
      )}

      {/* ── Completed ─────────────────────────────────────────────────────── */}
      {view === "completed" && completedData && (
        <section className="result-panel success-panel">
          <div className="result-icon">🎉</div>
          <h2>Onboarding Complete!</h2>
          <p>
            <strong>{completedData.teamName as string}</strong> —{" "}
            {members().length} member{members().length !== 1 ? "s" : ""} onboarded.
          </p>
          <div className="result-summary">
            {members().map((member, i) => (
              <div key={i} className="result-member-card">
                <div className="result-member-header">
                  <span className="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
                  <div>
                    <p className="result-member-name">{member.name}</p>
                    {member.role && <p className="result-member-role">{member.role}</p>}
                  </div>
                </div>
                {profile(i) && (
                  <div className="result-detail-grid">
                    <span className="result-key">Department</span>
                    <span>{profile(i)!.department}</span>
                    <span className="result-key">Start Date</span>
                    <span>{formatDate(profile(i)!.startDate)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={exitToSessions}>
            ← Back to Sessions
          </button>
        </section>
      )}

      {/* ── Cancelled ─────────────────────────────────────────────────────── */}
      {view === "cancelled" && (
        <section className="result-panel cancel-panel">
          <div className="result-icon">✖</div>
          <h2>Onboarding Cancelled</h2>
          <p>Your saved progress is still available to resume.</p>
          <button className="btn-secondary" onClick={exitToSessions}>
            ← Back to Sessions
          </button>
        </section>
      )}
    </main>
  );
}
