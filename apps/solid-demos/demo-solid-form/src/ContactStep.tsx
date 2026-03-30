import { createMemo, Show, For } from "solid-js";
import { usePathContext } from "@daltonr/pathwrite-solid";
import type { ContactData } from "./path";

const SUBJECTS = [
  "General Enquiry",
  "Bug Report",
  "Feature Request",
  "Other",
];

export default function ContactStep() {
  const ctx = usePathContext<ContactData>();

  const errors = createMemo(() =>
    ctx.snapshot()?.hasAttemptedNext ? (ctx.snapshot()?.fieldErrors ?? {}) : {}
  );

  const messageLen = createMemo(() =>
    ((ctx.snapshot()?.data.message as string) ?? "").length
  );

  return (
    <Show when={ctx.snapshot()}>
      <div class="form-body">

        {/* Name */}
        <div class="field" classList={{ "field--error": !!errors().name }}>
          <label for="name">
            Full Name <span class="required">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={ctx.snapshot()?.data.name ?? ""}
            onInput={(e) => ctx.setData("name", e.currentTarget.value)}
            placeholder="Jane Smith"
            autocomplete="name"
            autofocus
          />
          <Show when={errors().name}>
            <span class="field-error">{errors().name}</span>
          </Show>
        </div>

        {/* Email */}
        <div class="field" classList={{ "field--error": !!errors().email }}>
          <label for="email">
            Email Address <span class="required">*</span>
          </label>
          <input
            id="email"
            type="email"
            value={ctx.snapshot()?.data.email ?? ""}
            onInput={(e) => ctx.setData("email", e.currentTarget.value)}
            placeholder="jane@example.com"
            autocomplete="email"
          />
          <Show when={errors().email}>
            <span class="field-error">{errors().email}</span>
          </Show>
        </div>

        {/* Subject */}
        <div class="field" classList={{ "field--error": !!errors().subject }}>
          <label for="subject">
            Subject <span class="required">*</span>
          </label>
          <select
            id="subject"
            value={ctx.snapshot()?.data.subject ?? ""}
            onChange={(e) => ctx.setData("subject", e.currentTarget.value)}
          >
            <option value="" disabled>Select a subject…</option>
            <For each={SUBJECTS}>
              {(s) => <option value={s}>{s}</option>}
            </For>
          </select>
          <Show when={errors().subject}>
            <span class="field-error">{errors().subject}</span>
          </Show>
        </div>

        {/* Message */}
        <div class="field" classList={{ "field--error": !!errors().message }}>
          <label for="message">
            Message <span class="required">*</span>
            <span class="field-hint">(min 10 characters)</span>
          </label>
          <textarea
            id="message"
            rows="5"
            value={ctx.snapshot()?.data.message ?? ""}
            onInput={(e) => ctx.setData("message", e.currentTarget.value)}
            placeholder="How can we help you?"
          />
          <span class="char-count">{messageLen()} chars</span>
          <Show when={errors().message}>
            <span class="field-error">{errors().message}</span>
          </Show>
        </div>

      </div>
    </Show>
  );
}
