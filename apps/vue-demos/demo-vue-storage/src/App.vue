<script setup lang="ts">
import { ref, shallowRef, onMounted, computed } from "vue";
import { PathShell, PathEngine } from "@daltonr/pathwrite-vue";
import type { PathData } from "@daltonr/pathwrite-vue";
import { LocalStorageStore, persistence, restoreOrStart } from "@daltonr/pathwrite-store";
import { ApiStore } from "./ApiStore";
import { teamOnboardingPath, memberProfileSubPath, INITIAL_DATA } from "./wizard";
import type { WizardData, Person, MemberProfile } from "./wizard";
import TeamSetupStep from "./TeamSetupStep.vue";
import MemberProfilesStep from "./MemberProfilesStep.vue";
import BackgroundStep from "./BackgroundStep.vue";
import GoalsStep from "./GoalsStep.vue";
import SummaryStep from "./SummaryStep.vue";

// ---------------------------------------------------------------------------
// Storage mode toggle (localStorage vs API)
// ---------------------------------------------------------------------------

type StorageMode = "localStorage" | "api";
const storageMode = ref<StorageMode>("localStorage");
const apiConnectionError = ref(false);
const apiAvailable = ref(false);
const checkingApi = ref(true);

const store = computed(() => {
  if (storageMode.value === "api") {
    return new ApiStore("http://localhost:3001/api");
  }
  return new LocalStorageStore({ prefix: "pathwrite-demo:" });
});

async function checkApiAvailability() {
  checkingApi.value = true;
  try {
    const testStore = new ApiStore("http://localhost:3001/api");
    await testStore.list();
    apiAvailable.value = true;
  } catch (err) {
    apiAvailable.value = false;
    console.log("API server not available - localStorage mode only");
  } finally {
    checkingApi.value = false;
  }
}

async function switchStorageMode(mode: StorageMode) {
  if (mode === "api") {
    if (!apiAvailable.value) {
      apiConnectionError.value = true;
      return;
    }
    // Test API connection before switching
    try {
      const testStore = new ApiStore("http://localhost:3001/api");
      await testStore.list();
      apiConnectionError.value = false;
      storageMode.value = mode;
    } catch (err) {
      apiConnectionError.value = true;
      apiAvailable.value = false;
      console.error("Failed to connect to API:", err);
      return;
    }
  } else {
    apiConnectionError.value = false;
    storageMode.value = mode;
  }

  // Reload session list with new store
  await loadSessionList();
}

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

const view = ref<"sessions" | "wizard" | "completed" | "cancelled">("sessions");
const sessions = ref<SessionSummary[]>([]);
const sessionsLoading = ref(true);

async function loadSessionList() {
  sessionsLoading.value = true;
  try {
    const keys = await store.value.list();
    const summaries: SessionSummary[] = [];

    for (const key of keys) {
      const state = await store.value.load(key);
      if (!state) continue;
      const data = state.data as WizardData;
      const members = (data.members ?? []) as Person[];
      const profiles = (data.profiles ?? {}) as Record<string, MemberProfile>;
      const profilesDone = members.filter((_, i) => !!profiles[String(i)]?.department).length;

      const topLevelStepId = state.pathStack.length > 0
        ? null   // mid-subwizard — report as "Sub-wizard in progress"
        : teamOnboardingPath.steps[state.currentStepIndex]?.id ?? null;

      const STEP_LABELS: Record<string, string> = {
        "team-setup":      "Step 1 — Team Setup",
        "member-profiles": "Step 2 — Member Profiles",
        "summary":         "Step 3 — Summary",
      };

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

    sessions.value = summaries.sort((a, b) => a.key.localeCompare(b.key));
  } catch (err) {
    console.error("Failed to load sessions:", err);
    sessions.value = [];
  } finally {
    sessionsLoading.value = false;
  }
}

onMounted(async () => {
  await checkApiAvailability();
  await loadSessionList();
});

async function deleteSession(key: string) {
  await store.value.delete(key);
  sessions.value = sessions.value.filter(s => s.key !== key);
}

// ---------------------------------------------------------------------------
// Active wizard state
// ---------------------------------------------------------------------------

// shallowRef prevents Vue from deep-proxying PathEngine (which strips
// private class members and breaks the :engine prop type check in PathShell).
const engine = shallowRef<InstanceType<typeof PathEngine> | null>(null);
const engineKey = ref(0);
const activeSessionKey = ref<string | null>(null);
const isRestored = ref(false);
const wizardLoading = ref(false);
const completedData = ref<WizardData | null>(null);

const saveIndicator = ref(false);
let saveIndicatorTimer: ReturnType<typeof setTimeout> | null = null;

function onSaveSuccess() {
  saveIndicator.value = true;
  if (saveIndicatorTimer) clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => { saveIndicator.value = false; }, 2500);
}

function makeObservers(key: string) {
  return [
    persistence({
      store: store.value,
      key,
      strategy: "onEveryChange",
      debounceMs: 500,
      onSaveSuccess,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Open a session (new or existing)
// ---------------------------------------------------------------------------

async function startNew() {
  // Timestamp as a unique, sortable key
  const key = `session:${Date.now()}`;
  await openSession(key);
}

async function resumeSession(key: string) {
  await openSession(key);
}

async function openSession(key: string) {
  wizardLoading.value = true;
  activeSessionKey.value = key;

  const result = await restoreOrStart({
    store: store.value,
    key,
    path: teamOnboardingPath,
    pathDefinitions: {
      [teamOnboardingPath.id]: teamOnboardingPath,
      [memberProfileSubPath.id]: memberProfileSubPath,
    },
    initialData: INITIAL_DATA,
    observers: makeObservers(key),
  });

  engine.value = result.engine;
  engineKey.value++;       // force PathShell to remount with the new engine
  isRestored.value = result.restored;
  wizardLoading.value = false;
  view.value = "wizard";
}

// ---------------------------------------------------------------------------
// Wizard event handlers
// ---------------------------------------------------------------------------

function handleComplete(data: PathData) {
  completedData.value = data as unknown as WizardData;
  view.value = "completed";
  // persistence auto-deletes the snapshot on completion; sync the list
  if (activeSessionKey.value) {
    sessions.value = sessions.value.filter(s => s.key !== activeSessionKey.value);
  }
}

function handleCancel() {
  view.value = "cancelled";
}

async function exitToSessions() {
  engine.value = null;
  activeSessionKey.value = null;
  view.value = "sessions";
  await loadSessionList(); // refresh with latest snapshot data
}

// ---------------------------------------------------------------------------
// Completion screen helpers
// ---------------------------------------------------------------------------

function members(): Person[] {
  return (completedData.value?.members ?? []) as Person[];
}
function profile(i: number): MemberProfile | null {
  return ((completedData.value?.profiles ?? {}) as Record<string, MemberProfile>)[String(i)] ?? null;
}
function formatDate(d: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-IE", { year: "numeric", month: "long", day: "numeric" });
  } catch { return d; }
}
</script>

<template>
  <main class="page">

    <div class="page-header">
      <h1>Team Onboarding</h1>
      <p class="subtitle">
        Multi-session demo with switchable storage backends.
        Start several sessions, close the tab, come back and resume any of them.
      </p>

      <!-- Storage mode toggle -->
      <div class="storage-toggle">
        <label class="storage-toggle__label">Storage:</label>
        <button
          class="storage-toggle__btn"
          :class="{ 'storage-toggle__btn--active': storageMode === 'localStorage' }"
          @click="switchStorageMode('localStorage')"
          :disabled="view !== 'sessions'"
        >
          💾 localStorage
        </button>
        <button
          class="storage-toggle__btn"
          :class="{
            'storage-toggle__btn--active': storageMode === 'api',
            'storage-toggle__btn--disabled': !apiAvailable && !checkingApi
          }"
          @click="switchStorageMode('api')"
          :disabled="view !== 'sessions' || !apiAvailable"
          :title="!apiAvailable ? 'API server not available - run locally with npm run server' : ''"
        >
          <span v-if="!apiAvailable && !checkingApi">🔒</span>
          <span v-else>🌐</span>
          API (port 3001)
        </button>
      </div>

      <!-- API connection error -->
      <transition name="banner-fade">
        <div v-if="apiConnectionError" class="api-error-banner">
          <span class="api-error-banner__icon">⚠️</span>
          <span>Cannot connect to API server at http://localhost:3001. Run <code>npm run server</code> in a separate terminal.</span>
        </div>
      </transition>
    </div>

    <!-- Fixed save indicator -->
    <transition name="save-fade">
      <div v-if="saveIndicator" class="save-indicator">✓ Progress saved</div>
    </transition>

    <!-- ── Sessions list ────────────────────────────────────────────────── -->
    <section v-if="view === 'sessions'">
      <div v-if="sessionsLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading saved sessions…</p>
      </div>
      <template v-else>
        <div v-if="sessions.length > 0" class="sessions-list">
          <h2 class="sessions-title">In-Progress Onboardings</h2>
          <div v-for="session in sessions" :key="session.key" class="session-card">
            <div class="session-card__icon">📋</div>
            <div class="session-card__info">
              <p class="session-card__team">{{ session.teamName }}</p>
              <p class="session-card__meta">
                {{ session.memberCount }} member{{ session.memberCount !== 1 ? "s" : "" }}
                <template v-if="session.memberCount > 0">
                  · {{ session.profilesDone }}/{{ session.memberCount }} profiles done
                </template>
                · {{ session.stepLabel }}
              </p>
              <p class="session-card__key">key: <code>{{ session.key }}</code></p>
            </div>
            <div class="session-card__actions">
              <button class="btn-resume" @click="resumeSession(session.key)">Resume →</button>
              <button class="btn-delete-session" @click="deleteSession(session.key)" title="Delete">🗑</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-sessions">
          <div class="empty-sessions__icon">🗂️</div>
          <p>No saved onboardings yet.</p>
          <p class="empty-sessions__hint">Start one below — it will be saved automatically as you work.</p>
        </div>

        <div class="new-session-bar">
          <button class="btn-primary btn-new-session" @click="startNew">+ Start New Onboarding</button>
          <p class="new-session-hint">Each session gets its own localStorage key and can be resumed independently.</p>
        </div>
      </template>
    </section>

    <!-- ── Active wizard ────────────────────────────────────────────────── -->
    <section v-else-if="view === 'wizard'">
      <div class="wizard-topbar">
        <button class="btn-back-sessions" @click="exitToSessions">← All Sessions</button>
        <div class="wizard-topbar__right">
          <span v-if="isRestored" class="restored-badge">↩️ Restored</span>
          <code class="session-key-chip">{{ activeSessionKey }}</code>
        </div>
      </div>

      <div v-if="wizardLoading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading session…</p>
      </div>

      <PathShell
        v-else-if="engine"
        :key="engineKey"
        :path="teamOnboardingPath"
        :engine="engine"
        complete-label="Submit Onboarding"
        validation-display="inline"
        cancel-label="Cancel"
        progress-layout="split"
        @complete="handleComplete"
        @cancel="handleCancel"
      >
        <template #team-setup><TeamSetupStep /></template>
        <template #member-profiles><MemberProfilesStep /></template>
        <template #summary><SummaryStep /></template>
        <template #background><BackgroundStep /></template>
        <template #goals><GoalsStep /></template>
      </PathShell>
    </section>

    <!-- ── Completed ────────────────────────────────────────────────────── -->
    <section v-else-if="view === 'completed' && completedData" class="result-panel success-panel">
      <div class="result-icon">🎉</div>
      <h2>Onboarding Complete!</h2>
      <p><strong>{{ completedData.teamName }}</strong> — {{ members().length }} member{{ members().length !== 1 ? "s" : "" }} onboarded.</p>
      <div class="result-summary">
        <div v-for="(member, i) in members()" :key="i" class="result-member-card">
          <div class="result-member-header">
            <span class="member-avatar">{{ member.name.charAt(0).toUpperCase() }}</span>
            <div>
              <p class="result-member-name">{{ member.name }}</p>
              <p v-if="member.role" class="result-member-role">{{ member.role }}</p>
            </div>
          </div>
          <div v-if="profile(i)" class="result-detail-grid">
            <span class="result-key">Department</span><span>{{ profile(i)!.department }}</span>
            <span class="result-key">Start Date</span><span>{{ formatDate(profile(i)!.startDate) }}</span>
          </div>
        </div>
      </div>
      <button class="btn-primary" @click="exitToSessions">← Back to Sessions</button>
    </section>

    <!-- ── Cancelled ────────────────────────────────────────────────────── -->
    <section v-else-if="view === 'cancelled'" class="result-panel cancel-panel">
      <div class="result-icon">✖</div>
      <h2>Onboarding Cancelled</h2>
      <p>Your saved progress is still available to resume.</p>
      <button class="btn-secondary" @click="exitToSessions">← Back to Sessions</button>
    </section>

  </main>
</template>

