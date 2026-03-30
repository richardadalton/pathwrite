import { createSignal, createMemo, Show, For, onMount } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";
import type { ApplicationServices, Role } from "@daltonr/pathwrite-demo-workflow-job-application";

export default function RoleStep() {
  const ctx = usePathContext<ApplicationData, ApplicationServices>();

  const [roles, setRoles]     = createSignal<Role[]>([]);
  const [loading, setLoading] = createSignal(true);

  onMount(() => {
    ctx.services.getRoles().then((r) => {
      setRoles(r);
      setLoading(false);
    });
  });

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">
          Roles are loaded directly from the service inside the step component —
          not via <code>onEnter</code>. Option lists are UI data; they shouldn't
          live in the form payload.
        </p>

        <div class="field" classList={{ "field--error": !!errors().roleId }}>
          <label for="roleId">Open Position</label>

          <Show
            when={!loading()}
            fallback={<div class="skeleton-select">Loading roles…</div>}
          >
            <select
              id="roleId"
              value={ctx.snapshot()?.data.roleId ?? ""}
              onChange={(e) => ctx.setData("roleId", e.currentTarget.value)}
            >
              <option value="">— select a role —</option>
              <For each={roles()}>
                {(r) => <option value={r.id}>{r.label}</option>}
              </For>
            </select>
          </Show>

          <Show when={errors().roleId}>
            <span class="field-error">{errors().roleId}</span>
          </Show>
        </div>

        <p class="hint">
          <strong>What's happening:</strong>{" "}
          <code>usePathContext&lt;ApplicationData, ApplicationServices&gt;()</code>{" "}
          returns <code>services</code> alongside <code>snapshot</code>. The component calls{" "}
          <code>services.getRoles()</code> in <code>onMount</code> and manages its own loading
          state — keeping option lists out of the submission payload.
        </p>
      </div>
    </Show>
  );
}
