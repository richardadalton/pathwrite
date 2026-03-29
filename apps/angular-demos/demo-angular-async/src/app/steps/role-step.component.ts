import { Component, computed, OnInit, signal } from "@angular/core";
import { inject } from "@angular/core";
import { usePathContext } from "@daltonr/pathwrite-angular";
import { MockApplicationServices, type Role } from "../services";
import type { ApplicationData } from "../application-path";

@Component({
  selector: "app-role-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; line-height: 1.6; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; }
    .field select {
      border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px;
      font-family: inherit; color: #1f2937; background: #fff; width: 100%;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235b677a' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center; padding-right: 32px;
    }
    .field select:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
    .field--error select { border-color: #dc2626; }
    .field-error { font-size: 13px; color: #dc2626; }
    .skeleton-select { border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px; color: #9ca3af; background: #f0f4f8; }
    .hint { margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6; padding: 10px 14px; background: #f8fafc; border: 1px solid #e5e7eb; border-radius: 6px; }
    .hint code { font-size: 12px; background: #eef2ff; color: #4f46e5; padding: 1px 5px; border-radius: 4px; }
    .hint strong { color: #374151; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">
        Roles are loaded directly from the service inside the step component — not via
        <code>onEnter</code>.
      </p>

      <div class="field" [class.field--error]="errors()['roleId']">
        <label for="roleId">Open Position</label>

        @if (loading()) {
          <div class="skeleton-select">Loading roles…</div>
        } @else {
          <select
            id="roleId"
            [value]="data.roleId ?? ''"
            (change)="path.setData('roleId', $any($event.target).value)"
          >
            <option value="">— select a role —</option>
            @for (r of roles(); track r.id) {
              <option [value]="r.id">{{ r.label }}</option>
            }
          </select>
        }

        @if (errors()['roleId']; as msg) {
          <span class="field-error">{{ msg }}</span>
        }
      </div>

      <p class="hint">
        <strong>What's happening:</strong>
        In Angular, services are injected via <code>inject(MockApplicationServices)</code>
        directly in the step component — there is no <code>services</code> prop on
        <code>pw-shell</code>. This is idiomatic Angular DI. The path factory still
        closes over the same service instance injected in <code>AppComponent</code>.
      </p>
    </div>
  `
})
export class RoleStepComponent implements OnInit {
  protected readonly path    = usePathContext<ApplicationData>();
  private  readonly svc      = inject(MockApplicationServices);
  protected readonly roles   = signal<Role[]>([]);
  protected readonly loading = signal(true);

  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });

  protected get data(): ApplicationData {
    return this.path.snapshot()!.data;
  }

  ngOnInit(): void {
    this.svc.getRoles().then(r => {
      this.roles.set(r);
      this.loading.set(false);
    });
  }
}
