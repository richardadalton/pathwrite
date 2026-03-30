import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { DocumentData } from "./types";

export default function CreateDocumentStep() {
  const ctx = usePathContext<DocumentData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">
        <p class="step-intro">Enter the details of the document you want to send for approval.</p>

        <div class="field" classList={{ "field--error": !!errors().title }}>
          <label for="title">Title <span class="required">*</span></label>
          <input
            id="title"
            type="text"
            value={ctx.snapshot()?.data.title ?? ""}
            onInput={(e) => ctx.setData("title", e.currentTarget.value)}
            placeholder="e.g. Q1 Budget Report"
            autocomplete="off"
            autofocus
          />
          <Show when={errors().title}>
            <span class="field-error">{errors().title}</span>
          </Show>
        </div>

        <div class="field" classList={{ "field--error": !!errors().description }}>
          <label for="description">Description <span class="required">*</span></label>
          <textarea
            id="description"
            rows={4}
            value={ctx.snapshot()?.data.description ?? ""}
            onInput={(e) => ctx.setData("description", e.currentTarget.value)}
            placeholder="Brief summary of the document and what needs to be approved..."
          />
          <Show when={errors().description}>
            <span class="field-error">{errors().description}</span>
          </Show>
        </div>
      </div>
    </Show>
  );
}
