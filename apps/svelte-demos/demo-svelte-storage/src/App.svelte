<script lang="ts">
  import { onMount } from "svelte";
  import { PathShell } from "@daltonr/pathwrite-svelte";
  import type { PathData, PathEngine } from "@daltonr/pathwrite-svelte";
  import { LocalStorageStore, httpPersistence, restoreOrStart } from "@daltonr/pathwrite-store-http";
  import { teamOnboardingPath, memberProfileSubPath, INITIAL_DATA } from "./wizard";
  import type { WizardData, Person, MemberProfile } from "./wizard";
  import TeamSetupStep      from "./TeamSetupStep.svelte";
  import MemberProfilesStep from "./MemberProfilesStep.svelte";
  import BackgroundStep     from "./BackgroundStep.svelte";
  import GoalsStep          from "./GoalsStep.svelte";
  import SummaryStep        from "./SummaryStep.svelte";

  // ---------------------------------------------------------------------------
  // Store
  // ---------------------------------------------------------------------------

  const store = new LocalStorageStore({ prefix: "pathwrite-demo:" });

  // ---------------------------------------------------------------------------
  // Session list (the "home" screen)
  // ---------------------------------------------------------------------------

  interface SessionSummary {
    key: string;
    teamName: string;
    memberCount: number;
    profilesDone: number;
    stepLabel: string;
  }

  type View = "sessions" | "wizard" | "completed" | "cancelled";

  let view             = $state<View>("sessions");
  let sessions         = $state<SessionSummary[]>([]);
  let sessionsLoading  = $state(true);

  const STEP_LABELS: Record<string, string> = {
    teamSetup:      "Step 1 — Team Setup",
    memberProfiles: "Step 2 — Member Profiles",
    summary:        "Step 3 — Summary",
  };

  async function loadSessionList() {
    sessionsLoading = true;
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

      sessions = summaries.sort((a, b) => a.key.localeCompare(b.key));
    } catch (err) {
      console.error("Failed to load sessions:", err);
      sessions = [];
    } finally {
      sessionsLoading = false;
    }
  }

  onMount(() => { loadSessionList(); });

  async function deleteSession(key: string) {
    await store.delete(key);
    sessions = sessions.filter(s => s.key !== key);
  }

  // ---------------------------------------------------------------------------
  // Active wizard state
  // ---------------------------------------------------------------------------

  let engine:           PathEngine | null = $state(null);
  let engineKey:        number            = $state(0);
  let activeSessionKey: string | null     = $state(null);
  let isRestored:       boolean           = $state(false);
  let wizardLoading:    boolean           = $state(false);
  let completedData:    WizardData | null = $state(null);

  let saveIndicator       = $state(false);
  let saveIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

  function onSaveSuccess() {
    saveIndicator = true;
    if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
    saveIndicatorTimer = setTimeout(() => { saveIndicator = false; }, 2500);
  }

  // ---------------------------------------------------------------------------
  // Open a session (new or existing)
  // ---------------------------------------------------------------------------

  async function startNew() {
    const key = `session:${Date.now()}`;
    await openSession(key);
  }

  async function resumeSession(key: string) {
    await openSession(key);
  }

  async function openSession(key: string) {
    wizardLoading    = true;
    activeSessionKey = key;

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
        httpPersistence({
          store,
          key,
          strategy: "onEveryChange",
          debounceMs: 500,
          onSaveSuccess,
        }),
      ],
    });

    engine       = result.engine;
    engineKey   += 1;
    isRestored   = result.restored;
    wizardLoading = false;
    view         = "wizard";
  }

  // ---------------------------------------------------------------------------
  // Wizard event handlers
  // ---------------------------------------------------------------------------

  function handleComplete(data: PathData) {
    completedData = data as unknown as WizardData;
    view = "completed";
    // httpPersistence auto-deletes the snapshot on completion; sync the list
    if (activeSessionKey) {
      sessions = sessions.filter(s => s.key !== activeSessionKey);
    }
  }

  function handleCancel() {
    view = "cancelled";
  }

  async function exitToSessions() {
    engine           = null;
    activeSessionKey = null;
    view             = "sessions";
    await loadSessionList();
  }

  // ---------------------------------------------------------------------------
  // Completion screen helpers
  // ---------------------------------------------------------------------------

  function getMembers(): Person[] {
    return (completedData?.members ?? []) as Person[];
  }

  function getProfile(i: number): MemberProfile | null {
    return ((completedData?.profiles ?? {}) as Record<string, MemberProfile>)[String(i)] ?? null;
  }

  function formatDate(d: string): string {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" });
    } catch { return d; }
  }
</script>

<main class="page">
  <div class="page-header">
    <h1>Team Onboarding</h1>
    <p class="subtitle">
      Multi-session localStorage demo. Start several sessions, close the tab, come back and resume any of them.
    </p>
  </div>

  <!-- Fixed save indicator -->
  {#if saveIndicator}
    <div class="save-indicator">✓ Progress saved</div>
  {/if}

  <!-- ── Sessions list ──────────────────────────────────────────────────── -->
  {#if view === "sessions"}
    {#if sessionsLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading saved sessions…</p>
      </div>
    {:else}
      {#if sessions.length > 0}
        <div class="sessions-list">
          <h2 class="sessions-title">In-Progress Onboardings</h2>
          {#each sessions as session (session.key)}
            <div class="session-card">
              <div class="session-card__icon">📋</div>
              <div class="session-card__info">
                <p class="session-card__team">{session.teamName}</p>
                <p class="session-card__meta">
                  {session.memberCount} member{session.memberCount !== 1 ? "s" : ""}
                  {#if session.memberCount > 0}
                    · {session.profilesDone}/{session.memberCount} profiles done
                  {/if}
                  · {session.stepLabel}
                </p>
                <p class="session-card__key">key: <code>{session.key}</code></p>
              </div>
              <div class="session-card__actions">
                <button class="btn-resume" onclick={() => resumeSession(session.key)}>Resume →</button>
                <button class="btn-delete-session" onclick={() => deleteSession(session.key)} title="Delete">🗑</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty-sessions">
          <div class="empty-sessions__icon">🗂️</div>
          <p>No saved onboardings yet.</p>
          <p class="empty-sessions__hint">Start one below — it will be saved automatically as you work.</p>
        </div>
      {/if}

      <div class="new-session-bar">
        <button class="btn-primary btn-new-session" onclick={startNew}>+ Start New Onboarding</button>
        <p class="new-session-hint">Each session gets its own localStorage key and can be resumed independently.</p>
      </div>
    {/if}
  {/if}

  <!-- ── Active wizard ──────────────────────────────────────────────────── -->
  {#if view === "wizard"}
    <div class="wizard-topbar">
      <button class="btn-back-sessions" onclick={exitToSessions}>← All Sessions</button>
      <div class="wizard-topbar__right">
        {#if isRestored}
          <span class="restored-badge">↩ Restored</span>
        {/if}
        <code class="session-key-chip">{activeSessionKey}</code>
      </div>
    </div>

    {#if wizardLoading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading session…</p>
      </div>
    {:else if engine}
      {#key engineKey}
        <PathShell
          {engine}
          path={teamOnboardingPath}
          completeLabel="Submit Onboarding"
          cancelLabel="Cancel"
          validationDisplay="inline"
          progressLayout="split"
          oncomplete={handleComplete}
          oncancel={handleCancel}
          teamSetup={TeamSetupStep}
          memberProfiles={MemberProfilesStep}
          summary={SummaryStep}
          background={BackgroundStep}
          goals={GoalsStep}
        />
      {/key}
    {/if}
  {/if}

  <!-- ── Completed ──────────────────────────────────────────────────────── -->
  {#if view === "completed" && completedData}
    <section class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Onboarding Complete!</h2>
      <p><strong>{completedData.teamName}</strong> — {getMembers().length} member{getMembers().length !== 1 ? "s" : ""} onboarded.</p>
      <div class="result-summary">
        {#each getMembers() as member, i}
          <div class="result-member-card">
            <div class="result-member-header">
              <span class="member-avatar">{member.name.charAt(0).toUpperCase()}</span>
              <div>
                <p class="result-member-name">{member.name}</p>
                {#if member.role}<p class="result-member-role">{member.role}</p>{/if}
              </div>
            </div>
            {#if getProfile(i)}
              <div class="result-detail-grid">
                <span class="result-key">Department</span><span>{getProfile(i)!.department}</span>
                <span class="result-key">Start Date</span><span>{formatDate(getProfile(i)!.startDate)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
      <button class="btn-primary" onclick={exitToSessions}>← Back to Sessions</button>
    </section>
  {/if}

  <!-- ── Cancelled ──────────────────────────────────────────────────────── -->
  {#if view === "cancelled"}
    <section class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your saved progress is still available to resume.</p>
      <button class="btn-secondary" onclick={exitToSessions}>← Back to Sessions</button>
    </section>
  {/if}
</main>
