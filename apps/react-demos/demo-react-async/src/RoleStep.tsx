import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "./application-path";

export function RoleStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  const snap   = snapshot!;
  const data   = snap.data;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  // onEnter is async — while it is running, isNavigating is true and
  // availableRoles is still the empty initial value.
  const isLoading = snap.isNavigating || data.availableRoles.length === 0;

  return (
    <div className="form-body">
      <p className="step-intro">
        We'll load the open positions from our API — watch the Next button while
        this step first mounts.
      </p>

      <div className={`field ${errors.roleId ? "field--error" : ""}`}>
        <label htmlFor="roleId">Open Position</label>

        {isLoading ? (
          <div className="skeleton-select">Loading roles…</div>
        ) : (
          <select
            id="roleId"
            value={data.roleId}
            onChange={e => setData("roleId", e.target.value)}
          >
            <option value="">— select a role —</option>
            {data.availableRoles.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}

        {errors.roleId && <span className="field-error">{errors.roleId}</span>}
      </div>

      <p className="hint">
        <strong>What's happening:</strong> <code>onEnter</code> is async — it
        called <code>services.getRoles()</code> and patched the result into path
        data. The shell's isNavigating flag was true during the fetch.
      </p>
    </div>
  );
}
