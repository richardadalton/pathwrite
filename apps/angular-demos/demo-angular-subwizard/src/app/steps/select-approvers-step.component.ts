import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import { AVAILABLE_APPROVERS, type DocumentData } from "../approval.types";

@Component({
  selector: "app-select-approvers-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .pref-label { font-size: 14px; font-weight: 600; color: #374151; margin: 0 0 10px; }
    .approver-select-list { display: flex; flex-direction: column; gap: 8px; }
    .approver-select-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
    .approver-select-item input[type="checkbox"] { accent-color: #2563eb; width: 16px; height: 16px; cursor: pointer; }
    .approver-select-item--selected { border-color: #2563eb; background: #eff6ff; }
    .approver-avatar { width: 32px; height: 32px; border-radius: 50%; background: #dbeafe; color: #1d4ed8; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .approver-name { font-size: 14px; color: #374151; font-weight: 500; }
    .selection-count { margin: 4px 0 0; font-size: 13px; color: #2563eb; font-weight: 500; }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Choose who needs to approve this document. All selected approvers must review before the workflow can proceed.</p>

      <div>
        <p class="pref-label">Available Approvers</p>
        <div class="approver-select-list">
          @for (approver of approvers; track approver.id) {
            <label class="approver-select-item" [class.approver-select-item--selected]="isSelected(approver.id)">
              <input type="checkbox" [checked]="isSelected(approver.id)" (change)="toggle(approver.id)" />
              <span class="approver-avatar">{{ approver.name.charAt(0) }}</span>
              <span class="approver-name">{{ approver.name }}</span>
            </label>
          }
        </div>
        @if (errors()['approvers']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>

      @if (selected.length) {
        <p class="selection-count">{{ selected.length }} approver{{ selected.length !== 1 ? 's' : '' }} selected</p>
      }
    </div>
  `
})
export class SelectApproversStepComponent {
  protected readonly path   = injectPath<DocumentData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldMessages : {};
  });
  protected readonly approvers = AVAILABLE_APPROVERS;

  protected get selected(): string[] {
    return (this.path.snapshot()!.data.approvers ?? []) as string[];
  }

  protected isSelected(id: string): boolean {
    return this.selected.includes(id);
  }

  protected toggle(id: string): void {
    const updated = this.isSelected(id)
      ? this.selected.filter(a => a !== id)
      : [...this.selected, id];
    this.path.setData("approvers", updated);
  }
}

