import { Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { OnboardingData } from "./onboarding";

const THEME_OPTIONS = [
  { value: "light",  label: "Light",         desc: "Always bright" },
  { value: "dark",   label: "Dark",           desc: "Easy on the eyes" },
  { value: "system", label: "System Default", desc: "Follows your OS setting" },
];

export default function PreferencesStep() {
  const ctx = usePathContext<OnboardingData>();

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">All preferences can be changed later in your account settings.</p>

        <div class="pref-section">
          <p class="pref-label">Interface Theme</p>
          <div class="radio-group">
            <For each={THEME_OPTIONS}>
              {(opt) => (
                <label class="radio-option">
                  <input
                    type="radio"
                    name="theme"
                    value={opt.value}
                    checked={ctx.snapshot()?.data.theme === opt.value}
                    onChange={() => ctx.setData("theme", opt.value)}
                  />
                  <span class="radio-option-label">{opt.label}</span>
                  <span class="radio-option-desc">{opt.desc}</span>
                </label>
              )}
            </For>
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
              <input
                type="checkbox"
                checked={ctx.snapshot()?.data.notifications as boolean}
                onChange={(e) => ctx.setData("notifications", e.currentTarget.checked)}
              />
              <span class="toggle-track" />
              <span class="toggle-thumb" />
            </label>
          </div>
        </div>
      </div>
    </Show>
  );
}
