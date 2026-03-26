import { Component, computed } from "@angular/core";
import { injectPath } from "@daltonr/pathwrite-angular";
import type { DocumentData } from "../approval.types";

@Component({
  selector: "app-create-document-step",
  standalone: true,
  styles: [`
    .form-body { display: flex; flex-direction: column; gap: 18px; }
    .step-intro { margin: 0; font-size: 14px; color: #5b677a; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label { font-size: 14px; font-weight: 500; color: #374151; display: flex; align-items: baseline; gap: 4px; }
    .required { color: #dc2626; font-size: 13px; }
    .field input, .field textarea {
      border: 1px solid #c2d0e5; border-radius: 6px; padding: 9px 12px; font-size: 14px;
      font-family: inherit; color: #1f2937; background: #fff; width: 100%;
      transition: border-color 0.15s, box-shadow 0.15s; resize: vertical;
    }
    .field input:focus, .field textarea:focus {
      outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
    }
    .field--error input, .field--error textarea { border-color: #dc2626; }
    .field-error { font-size: 13px; color: #dc2626; }
  `],
  template: `
    <div class="form-body">
      <p class="step-intro">Enter the details of the document you want to send for approval.</p>

      <div class="field" [class.field--error]="errors()['title']">
        <label for="title">Title <span class="required">*</span></label>
        <input id="title" type="text" [value]="data.title ?? ''" autofocus autocomplete="off"
          (input)="path.setData('title', $any($event.target).value)" placeholder="e.g. Q1 Budget Report" />
        @if (errors()['title']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>

      <div class="field" [class.field--error]="errors()['description']">
        <label for="desc">Description <span class="required">*</span></label>
        <textarea id="desc" [value]="data.description ?? ''" rows="4"
          (input)="path.setData('description', $any($event.target).value)"
          placeholder="Brief summary of the document and what needs to be approved..."></textarea>
        @if (errors()['description']; as msg) { <span class="field-error">{{ msg }}</span> }
      </div>
    </div>
  `
})
export class CreateDocumentStepComponent {
  protected readonly path   = injectPath<DocumentData>();
  protected readonly errors = computed(() => {
    const s = this.path.snapshot();
    return s?.hasAttemptedNext ? s.fieldErrors : {};
  });
  protected get data(): DocumentData { return this.path.snapshot()!.data; }
}

