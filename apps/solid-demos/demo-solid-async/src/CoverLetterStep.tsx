import { createMemo, Show } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ApplicationData } from "@daltonr/pathwrite-demo-workflow-job-application";

export default function CoverLetterStep() {
  const ctx = usePathContext<ApplicationData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  return (
    <Show when={ctx.snapshot()}>
      {(snap) => (
        <div class="form-body">
          <p class="step-intro">
            This step uses an async <code>shouldSkip</code>. Selecting{" "}
            <strong>Software Engineer</strong> or <strong>Data Scientist</strong>{" "}
            on the first step routes here; other roles skip straight to Review.
            Notice how the progress bar step count updates once the skip resolves.
          </p>

          <div class="field" classList={{ "field--error": !!errors().coverLetter }}>
            <label for="coverLetter">Cover Letter</label>
            <textarea
              id="coverLetter"
              rows={5}
              value={snap().data.coverLetter}
              onInput={(e) => ctx.setData("coverLetter", e.currentTarget.value)}
              placeholder="Tell us why you're a great fit for this role…"
            />
            <Show when={errors().coverLetter}>
              <span class="field-error">{errors().coverLetter}</span>
            </Show>
          </div>

          <p class="hint">
            <strong>What's happening:</strong> <code>shouldSkip</code> called{" "}
            <code>services.requiresCoverLetter(roleId)</code> asynchronously.
            Before that resolved, <code>snapshot.stepCount</code> included this
            step optimistically. Once navigation walked past it (or landed on it),
            the engine cached the result and the progress bar reflects the true
            visible count.
          </p>
        </div>
      )}
    </Show>
  );
}
