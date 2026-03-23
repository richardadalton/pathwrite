import { Component } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { OnboardingData } from "../onboarding.types";

@Component({
  selector: "app-preferences-step",
  standalone: true,
  styles: [`
    .step-intro {
      margin: 0 0 28px; font-size: 14px; color: #5b677a;
    }
    .pref-section { margin-bottom: 28px; }
    .pref-section:last-child { margin-bottom: 0; }
    .pref-label {
      font-size: 14px; font-weight: 600; color: #374151;
      margin: 0 0 12px;
    }
    .radio-group { display: flex; flex-direction: column; gap: 10px; }
    .radio-option {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px; border-radius: 8px;
      border: 1px solid #e5e7eb; cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .radio-option:has(input:checked) {
      border-color: #2563eb; background: #eff6ff;
    }
    .radio-option input[type="radio"] {
      accent-color: #2563eb; width: 16px; height: 16px; cursor: pointer;
    }
    .radio-option-label {
      font-size: 14px; color: #374151; cursor: pointer;
    }
    .radio-option-desc {
      font-size: 12px; color: #9ca3af; margin-left: auto;
    }
    .toggle-option {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-radius: 8px;
      border: 1px solid #e5e7eb; background: #fff;
    }
    .toggle-text strong { font-size: 14px; color: #1f2937; display: block; }
    .toggle-text span { font-size: 12px; color: #9ca3af; }
    .toggle {
      position: relative; width: 44px; height: 24px; cursor: pointer;
    }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .toggle-track {
      position: absolute; inset: 0; background: #d1d5db;
      border-radius: 12px; transition: background 0.2s;
    }
    .toggle input:checked ~ .toggle-track { background: #2563eb; }
    .toggle-thumb {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px; background: #fff;
      border-radius: 50%; transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .toggle input:checked ~ .toggle-thumb { transform: translateX(20px); }
  `],
  template: `
    <p class="step-intro">All preferences can be changed later in your account settings.</p>

    <!-- Theme -->
    <div class="pref-section">
      <p class="pref-label">Interface Theme</p>
      <div class="radio-group">
        @for (opt of themeOptions; track opt.value) {
          <label class="radio-option">
            <input
              type="radio" name="theme"
              [value]="opt.value"
              [checked]="data.theme === opt.value"
              (change)="path.setData('theme', opt.value)"
            />
            <span class="radio-option-label">{{ opt.label }}</span>
            <span class="radio-option-desc">{{ opt.desc }}</span>
          </label>
        }
      </div>
    </div>

    <!-- Notifications -->
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
            [checked]="data.notifications !== false"
            (change)="path.setData('notifications', $any($event.target).checked)"
          />
          <span class="toggle-track"></span>
          <span class="toggle-thumb"></span>
        </label>
      </div>
    </div>
  `
})
export class PreferencesStepComponent {
  protected readonly path = injectPath<OnboardingData>();

  protected readonly themeOptions = [
    { value: "light",  label: "Light",         desc: "Always bright" },
    { value: "dark",   label: "Dark",           desc: "Easy on the eyes" },
    { value: "system", label: "System Default", desc: "Follows your OS setting" },
  ];

  // snapshot() is always non-null while this step component is mounted —
  // PathShell only renders step content when the snapshot is active.
  protected get data(): OnboardingData {
    return this.path.snapshot()!.data;
  }
}
