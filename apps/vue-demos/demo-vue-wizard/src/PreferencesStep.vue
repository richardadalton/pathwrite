<script setup lang="ts">
import { usePathContext } from "@daltonr/pathwrite-vue";
import type { OnboardingData } from "./onboarding";

const { snapshot, setData } = usePathContext<OnboardingData>();

const THEME_OPTIONS = [
  { value: "light",  label: "Light",         desc: "Always bright" },
  { value: "dark",   label: "Dark",           desc: "Easy on the eyes" },
  { value: "system", label: "System Default", desc: "Follows your OS setting" },
];
</script>

<template>
  <div v-if="snapshot" class="form-body">
    <p class="step-intro">All preferences can be changed later in your account settings.</p>

    <div class="pref-section">
      <p class="pref-label">Interface Theme</p>
      <div class="radio-group">
        <label v-for="opt in THEME_OPTIONS" :key="opt.value" class="radio-option">
          <input type="radio" name="theme" :value="opt.value"
            :checked="snapshot.data.theme === opt.value"
            @change="setData('theme', opt.value)" />
          <span class="radio-option-label">{{ opt.label }}</span>
          <span class="radio-option-desc">{{ opt.desc }}</span>
        </label>
      </div>
    </div>

    <div class="pref-section">
      <p class="pref-label">Notifications</p>
      <div class="toggle-option">
        <div class="toggle-text">
          <strong>Email Notifications</strong>
          <span>Receive updates, tips, and product announcements</span>
        </div>
        <label class="toggle">
          <input type="checkbox" :checked="snapshot.data.notifications"
            @change="setData('notifications', ($event.target as HTMLInputElement).checked)" />
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>
  </div>
</template>

