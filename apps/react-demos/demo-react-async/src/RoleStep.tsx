import { useEffect, useState } from "react";
import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

export function RoleStep() {
  const { snapshot, setData, services } = usePathContext<ApplicationData, ApplicationServices>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  const [roles, setRoles]       = useState<Role[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    services.getRoles().then(r => {
      setRoles(r);
      setLoading(false);
    });
  }, []);

  return (
    <div className="form-body">
      <p className="step-intro">
        Roles are loaded directly from the service inside the step component —
        not via <code>onEnter</code>. Option lists are UI data; they shouldn't
        live in the form payload.
      </p>

      <div className={`field ${errors.roleId ? "field--error" : ""}`}>
        <label htmlFor="roleId">Open Position</label>

        {loading ? (
          <div className="skeleton-select">Loading roles…</div>
        ) : (
          <select
            id="roleId"
            value={snap.data.roleId}
            onChange={e => setData("roleId", e.target.value)}
          >
            <option value="">— select a role —</option>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}

        {errors.roleId && <span className="field-error">{errors.roleId}</span>}
      </div>

      <p className="hint">
        <strong>What's happening:</strong> <code>usePathContext&lt;ApplicationData, ApplicationServices&gt;()</code>{" "}
        returns <code>services</code> alongside <code>snapshot</code>. The component calls{" "}
        <code>services.getRoles()</code> in a <code>useEffect</code> and manages its
        own loading state — keeping option lists out of the submission payload.
      </p>
    </div>
  );
}
