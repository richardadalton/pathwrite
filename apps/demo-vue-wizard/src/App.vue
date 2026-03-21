<script setup lang="ts">
import { ref, shallowRef, onUnmounted } from 'vue';
import { PathShell } from '@daltonr/pathwrite-vue';
import type { PathEngine } from '@daltonr/pathwrite-vue';
import { createPersistedEngine } from '@daltonr/pathwrite-store-http';
import { onboardingWizard, type OnboardingData } from './wizard';

// ─── Reactive state ───────────────────────────────────────────────────────────

const engine       = shallowRef<PathEngine | null>(null);
const isLoading    = ref(true);
const wasRestored  = ref(false);
const isCompleted  = ref(false);
const completedName = ref('');

const initialData: OnboardingData = {
  name: '', email: '', role: '',
  interests: [], bio: '', notifications: true,
};

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init(clearFirst = false) {
  isLoading.value = true;
  engine.value = null;

  try {
    if (clearFirst) {
      // Load and immediately delete any saved state before starting fresh
      const { HttpStore } = await import('@daltonr/pathwrite-store-http');
      const store = new HttpStore({ baseUrl: 'http://localhost:3001/api/wizard' });
      await store.delete('demo-user:onboarding');
    }

    const result = await createPersistedEngine({
      baseUrl: 'http://localhost:3001/api/wizard',
      key: 'demo-user:onboarding',
      path: onboardingWizard,
      initialData,
      strategy: 'onNext',
      onSaveError: (err) => console.warn('[persistence] save failed:', err.message),
    });

    engine.value = result.engine;
    wasRestored.value = result.restored;
    console.log('[init] ready — restored:', result.restored, '| step:', result.engine.snapshot()?.stepId);
  } catch (err) {
    console.error('[init] FAILED:', err);
  } finally {
    isLoading.value = false;
  }
}

init();

// ─── Actions ──────────────────────────────────────────────────────────────────

function handleComplete(data: Record<string, unknown>) {
  completedName.value = (data.name as string) || 'there';
  isCompleted.value = true;
}

async function clearState() {
  if (!confirm('Clear saved state and restart from step 1?')) return;
  isCompleted.value = false;
  await init(true);
}
</script>

<template>
  <div>
    <div class="demo-header">
      <h1>🧙‍♂️ Vue Wizard Demo</h1>
      <p>Saves on each "Next" &bull; Restores automatically on page reload</p>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="wizard-container">
      <div class="step-content" style="text-align:center; padding:60px 20px; color:#64748b;">
        ⏳ Loading wizard state…
      </div>
    </div>

    <!-- Completed -->
    <div v-else-if="isCompleted" class="wizard-container">
      <div class="success-message">
        <div class="success-icon">🎉</div>
        <h2>Welcome aboard, {{ completedName }}!</h2>
        <p>Your onboarding is complete.</p>
        <button class="btn-small" style="margin-top:24px;" @click="clearState">
          Start Again
        </button>
      </div>
    </div>

    <!-- Active wizard — PathShell drives from the external engine -->
    <div v-else-if="engine" class="wizard-container">

      <div class="status-bar">
        <div class="status-indicator">
          <div class="status-dot"></div>
          <span>API: <code>http://localhost:3001</code> &bull; key: <code>demo-user:onboarding</code></span>
        </div>
        <div class="actions">
          <span v-if="wasRestored" style="color:#10b981; font-size:0.8em; margin-right:8px;">
            ✅ Restored from saved state
          </span>
          <button class="btn-small" @click="clearState">Clear State</button>
        </div>
      </div>

      <!--
        Pass :engine to PathShell — it subscribes to it directly and skips
        its own start() call, so persistence is fully controlled by the wrapper.
      -->
      <PathShell
        :path="onboardingWizard"
        :engine="engine"
        hide-cancel
        @complete="handleComplete"
      >
        <!-- Step 1 -->
        <template #personal="{ snapshot }">
          <div class="step-content">
            <div class="form-group">
              <label>Full Name *</label>
              <input
                type="text" :value="snapshot.data.name"
                @input="engine!.setData('name', ($event.target as HTMLInputElement).value)"
                placeholder="Enter your full name" autofocus
              />
            </div>
            <div class="form-group">
              <label>Email Address *</label>
              <input
                type="email" :value="snapshot.data.email"
                @input="engine!.setData('email', ($event.target as HTMLInputElement).value)"
                placeholder="you@example.com"
              />
            </div>
          </div>
        </template>

        <!-- Step 2 -->
        <template #preferences="{ snapshot }">
          <div class="step-content">
            <div class="form-group">
              <label>What best describes you? *</label>
              <select
                :value="snapshot.data.role"
                @change="engine!.setData('role', ($event.target as HTMLSelectElement).value)"
              >
                <option value="">-- Select a role --</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="manager">Manager</option>
                <option value="student">Student</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-group">
              <label>Your Interests * (select at least one)</label>
              <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-top:10px;">
                <label
                  v-for="interest in ['JavaScript','TypeScript','Vue.js','React','Angular','Node.js','Design','Testing']"
                  :key="interest"
                  style="display:flex; align-items:center; gap:8px; cursor:pointer;"
                >
                  <input
                    type="checkbox"
                    :checked="(snapshot.data.interests ?? []).includes(interest)"
                    @change="engine!.setData('interests',
                      (snapshot.data.interests ?? []).includes(interest)
                        ? (snapshot.data.interests ?? []).filter((i: string) => i !== interest)
                        : [...(snapshot.data.interests ?? []), interest]
                    )"
                  />
                  {{ interest }}
                </label>
              </div>
            </div>
          </div>
        </template>

        <!-- Step 3 -->
        <template #additional="{ snapshot }">
          <div class="step-content">
            <div class="form-group">
              <label>Tell us about yourself (optional)</label>
              <textarea
                :value="snapshot.data.bio"
                @input="engine!.setData('bio', ($event.target as HTMLTextAreaElement).value)"
                placeholder="What would you like us to know?"
              ></textarea>
            </div>
            <div class="form-group">
              <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                <input
                  type="checkbox" :checked="snapshot.data.notifications"
                  @change="engine!.setData('notifications', ($event.target as HTMLInputElement).checked)"
                />
                Send me email notifications
              </label>
            </div>
          </div>
        </template>

        <!-- Step 4 -->
        <template #review="{ snapshot }">
          <div class="step-content">
            <div class="summary-section">
              <h3>Personal Information</h3>
              <div class="summary-item"><span class="summary-label">Name:</span>  <span class="summary-value">{{ snapshot.data.name }}</span></div>
              <div class="summary-item"><span class="summary-label">Email:</span> <span class="summary-value">{{ snapshot.data.email }}</span></div>
            </div>
            <div class="summary-section">
              <h3>Preferences</h3>
              <div class="summary-item"><span class="summary-label">Role:</span>      <span class="summary-value">{{ snapshot.data.role }}</span></div>
              <div class="summary-item"><span class="summary-label">Interests:</span> <span class="summary-value">{{ (snapshot.data.interests ?? []).join(', ') }}</span></div>
            </div>
            <div class="summary-section">
              <h3>Additional</h3>
              <div class="summary-item"><span class="summary-label">Bio:</span>           <span class="summary-value">{{ snapshot.data.bio || '(not provided)' }}</span></div>
              <div class="summary-item"><span class="summary-label">Notifications:</span> <span class="summary-value">{{ snapshot.data.notifications ? 'Enabled' : 'Disabled' }}</span></div>
            </div>
          </div>
        </template>
      </PathShell>
    </div>

    <!-- Fallback: init failed -->
    <div v-else class="wizard-container">
      <div class="step-content" style="text-align:center; padding:60px 20px;">
        <p style="color:#ef4444; font-weight:600;">Failed to initialize wizard</p>
        <p style="color:#64748b; font-size:0.9em;">Check the browser console for errors.</p>
        <button class="btn-small" style="margin-top:16px;" @click="init()">Retry</button>
      </div>
    </div>

  </div>
</template>

