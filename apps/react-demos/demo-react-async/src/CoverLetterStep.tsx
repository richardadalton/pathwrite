import { usePathContext } from "@daltonr/pathwrite-react";
import type { ApplicationData } from "./application-path";

export function CoverLetterStep() {
  const { snapshot, setData } = usePathContext<ApplicationData>();
  const snap   = snapshot!;
  const errors = snap.hasAttemptedNext ? snap.fieldErrors : {};

  return (
    <div className="form-body">
      <p className="step-intro">
        This step uses an async <code>shouldSkip</code>. Selecting{" "}
        <strong>Software Engineer</strong> or <strong>Data Scientist</strong>{" "}
        on the first step routes here; other roles skip straight to Review.
        Notice how the progress bar step count updates once the skip resolves.
      </p>

      <div className={`field ${errors.coverLetter ? "field--error" : ""}`}>
        <label htmlFor="coverLetter">Cover Letter</label>
        <textarea
          id="coverLetter"
          rows={5}
          value={snap.data.coverLetter}
          onChange={e => setData("coverLetter", e.target.value)}
          placeholder="Tell us why you're a great fit for this role…"
        />
        {errors.coverLetter && (
          <span className="field-error">{errors.coverLetter}</span>
        )}
      </div>

      <p className="hint">
        <strong>What's happening:</strong> <code>shouldSkip</code> called{" "}
        <code>services.requiresCoverLetter(roleId)</code> asynchronously.
        Before that resolved, <code>snapshot.stepCount</code> included this
        step optimistically. Once navigation walked past it (or landed on it),
        the engine cached the result in <code>resolvedSkips</code> and the
        progress bar reflects the true visible count.
      </p>
    </div>
  );
}
