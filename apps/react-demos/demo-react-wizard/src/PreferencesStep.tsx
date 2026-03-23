import { usePathContext } from "@daltonr/pathwrite-react";
import type { OnboardingData } from "./onboarding";

const THEME_OPTIONS = [
  { value: "light",  label: "Light",         desc: "Always bright" },
  { value: "dark",   label: "Dark",           desc: "Easy on the eyes" },
  { value: "system", label: "System Default", desc: "Follows your OS setting" },
];

export function PreferencesStep() {
  const { snapshot, setData } = usePathContext<OnboardingData>();
  // snapshot is always non-null here — PathShell only renders this component
  // when the path is active. The non-null assertion (!) is safe; no cast needed.
  const data          = snapshot!.data;
  const theme         = data.theme         ?? "system";
  const notifications = data.notifications ?? true;

  return (
    <div className="form-body">
      <p className="step-intro">All preferences can be changed later in your account settings.</p>

      {/* Theme */}
      <div className="pref-section">
        <p className="pref-label">Interface Theme</p>
        <div className="radio-group">
          {THEME_OPTIONS.map(opt => (
            <label key={opt.value} className="radio-option">
              <input type="radio" name="theme" value={opt.value}
                checked={theme === opt.value}
                onChange={() => setData("theme", opt.value)} />
              <span className="radio-option-label">{opt.label}</span>
              <span className="radio-option-desc">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div className="pref-section">
        <p className="pref-label">Notifications</p>
        <div className="toggle-option">
          <div className="toggle-text">
            <strong>Email Notifications</strong>
            <span>Receive updates, tips, and product announcements</span>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={notifications}
              onChange={e => setData("notifications", e.target.checked)} />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>
      </div>
    </div>
  );
}

