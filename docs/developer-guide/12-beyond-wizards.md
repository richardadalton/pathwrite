# Chapter 12: Beyond Wizards

Pathwrite is not a wizard library. That is worth saying plainly, because the wizard is the most common application of the abstraction and it is easy to let the common case define your mental model. What Pathwrite actually is: a state machine for sequential, data-collecting processes with optional branching. The engine manages transitions, enforces business rules through guards, fires lifecycle hooks, and emits a consistent snapshot at every point. It does not know whether the current step is being rendered as a form page, a chat message, a background processing stage, or nothing at all. That separation is not incidental — it is the design. This final chapter explores what that separation makes possible.

---

## Single-page forms

A `PathDefinition` with one step is a single form. The engine does not know it is a form; it knows there is one step, a validation function, and an `onComplete` callback. The rest falls out naturally.

```typescript
interface ContactData {
  name: string;
  email: string;
  message: string;
}

const contactForm: PathDefinition<ContactData> = {
  id: "contact-form",
  steps: [
    {
      id: "form",
      title: "Contact Us",
      fieldErrors: ({ data }) => ({
        name:    !data.name?.trim()          ? "Required."              : undefined,
        email:   !data.email?.includes("@") ? "Invalid email address." : undefined,
        message: !data.message?.trim()       ? "Required."              : undefined,
      }),
    },
  ],
  onComplete: async ({ data }) => {
    await submitContactRequest(data);
  },
};
```

When you pass this to `PathShell`, the shell detects it is a single-step path at the top nesting level and adapts automatically: the progress header is hidden, and the footer switches to a form layout with the cancel action on the left and the submit button on the right. You can override either behaviour, but the defaults are correct for a form.

The more important benefit is what the engine handles for you: while `onComplete` is running, `snapshot.status` is `"completing"`. Your submit button can disable on that condition without any local state. If `onComplete` throws, `status` becomes `"error"` and `snapshot.error` holds the message — retry is built in. A 30-line contact form gets async submit handling and error recovery with zero extra code.

```tsx
function SubmitButton() {
  const { snapshot, next } = usePathContext();
  return (
    <button
      onClick={() => next()}
      disabled={snapshot.status === "completing"}
    >
      {snapshot.status === "completing" ? "Sending…" : "Send message"}
    </button>
  );
}
```

---

## Multi-stage checkout

A shopping cart checkout — cart review, shipping, payment, confirmation — looks like a wizard on the surface, but the requirements diverge quickly. Users jump back to edit the cart from the payment screen. The completion step calls an external payments API, not just an internal save. The billing address step is skipped entirely if the user chooses to use their shipping address. These are normal e-commerce requirements, and they are a bad fit for a traditional linear wizard library.

```typescript
interface CheckoutData {
  items: CartItem[];
  shippingAddress: Address | null;
  billingAddress: Address | null;
  sameAddressForBilling: boolean;
  paymentToken: string | null;
  orderId: string | null;
}

const checkout: PathDefinition<CheckoutData> = {
  id: "checkout",
  steps: [
    {
      id: "cart",
      canMoveNext: ({ data }) =>
        data.items.length > 0
          ? true
          : { allowed: false, reason: "Your cart is empty." },
    },
    {
      id: "shipping",
      onEnter: async ({ data, isFirstEntry }) => {
        if (isFirstEntry) {
          return { savedAddresses: await loadSavedAddresses() };
        }
      },
      canMoveNext: ({ data }) => !!data.shippingAddress,
    },
    {
      id: "billing",
      shouldSkip: ({ data }) => data.sameAddressForBilling,
      canMoveNext: ({ data }) => !!data.billingAddress,
    },
    {
      id: "payment",
      canMoveNext: ({ data }) => !!data.paymentToken,
    },
    {
      id: "confirmation",
    },
  ],
  onComplete: async ({ data }) => {
    const order = await submitOrder({
      items: data.items,
      shipping: data.shippingAddress!,
      billing: data.sameAddressForBilling
        ? data.shippingAddress!
        : data.billingAddress!,
      paymentToken: data.paymentToken!,
    });
    // Return a patch — the engine merges this into data before completing
    return { orderId: order.id };
  },
};
```

`goToStep("cart")` lets the user jump back from the payment screen without running `canMovePrevious` at every intermediate step. The `"completing"` / `"error"` status cycle on the confirmation screen manages the submit button state without any component-level loading flags. If the payment API returns an error, `status` is `"error"` and the user can retry — the engine does not reset the form data.

---

## Tabbed forms

A linear path does not have to feel linear. Replace the default navigation with a custom tab bar and the same engine becomes a tabbed form — one step per tab, free switching between them, no Back or Next buttons in sight.

```typescript
interface ProfileData {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  phone: string;
  linkedinUrl: string;
  bio: string;
}

const profileForm: PathDefinition<ProfileData> = {
  id: "profile-form",
  steps: [
    { id: "personal",  title: "Personal" },
    { id: "work",      title: "Work" },
    { id: "contact",   title: "Contact" },
  ],
  onComplete: async ({ data }) => {
    await saveProfile(data);
  },
};
```

The `PathShell` configuration suppresses the built-in chrome and delegates navigation entirely to a `TabBar` component:

```tsx
<PathShell
  definition={profileForm}
  hideProgress
  renderFooter={() => null}
>
  {(step) => (
    <>
      <TabBar />
      {step.id === "personal" && <PersonalTab />}
      {step.id === "work"     && <WorkTab />}
      {step.id === "contact"  && <ContactTab />}
    </>
  )}
</PathShell>
```

`TabBar` reads `snapshot.steps` for tab labels and status, and calls `goToStep` to switch tabs freely:

```tsx
function TabBar() {
  const { snapshot, goToStep } = usePathContext();
  return (
    <nav>
      {snapshot.steps.map((step) => (
        <button
          key={step.id}
          onClick={() => goToStep(step.id)}
          data-active={step.status === "current"}
          data-visited={step.status === "completed"}
        >
          {step.title}
        </button>
      ))}
    </nav>
  );
}
```

`step.status` gives `"current"` for the active tab, `"completed"` for tabs the user has already visited, and `"upcoming"` for those not yet reached — enough to drive active and visited styling with no extra state. The save button calls `next()` on the final tab, which triggers `onComplete`. The engine handles the `"completing"` / `"error"` cycle the same way it does for a wizard.

One thing to be aware of: `goToStep` bypasses guards and `shouldSkip`, which is exactly what you want for free tab switching. The trade-off is that `hasAttemptedNext` is never set by tab navigation, so field-level errors gated on that flag will not surface until the user explicitly clicks through to the next tab. If you need inline validation on tab switch, trigger it externally before calling `goToStep`.

---

## Nesting a tabbed shell inside a wizard step

The two patterns above — wizard and tabbed form — compose naturally. A wizard step can itself host a tabbed `PathShell`. The outer wizard drives the top-level flow; the inner tabbed shell collects a sub-section of data.

The challenge is state preservation. When the user navigates away from the wizard step that contains the tabbed shell and then returns, React (and every other framework) remounts the inner shell, losing both the tab the user was on and any data they had entered.

`restoreKey` solves this with no wiring code. Pass it to the inner `PathShell` with a key that names the slot in the outer path's data where the inner snapshot should be stored:

```tsx
// Inside a step component rendered by the outer wizard
export function DetailsStep() {
  const { snapshot } = usePathContext<OnboardingData>();

  return (
    <PathShell
      path={employeeDetailsPath}
      initialData={DETAILS_INITIAL}
      restoreKey="details"
      hideProgress
      hideCancel
      hideFooter
      validateWhen={snapshot.hasAttemptedNext}
      validationDisplay="inline"
      steps={{
        personal:   <PersonalTab />,
        department: <DepartmentTab />,
        equipment:  <EquipmentTab />,
        roles:      <RolesTab />,
      }}
    />
  );
}
```

On every state change, the inner shell writes its full `PathSnapshot` — including the active tab ID and all field data — into the outer path's data under `"details"`. When the outer path navigates away and back, the inner shell remounts and reads `data.details` from the outer context before starting. If a stored snapshot is found, it restores both the data and the active tab; if not, it starts fresh from `initialData`.

Later steps in the outer wizard can read inner field values directly through the snapshot:

```typescript
// In the outer path definition:
fieldErrors: ({ data }) => {
  const d = data.details?.data;  // the inner PathSnapshot's data
  return {
    _: !d?.firstName ? "First name is required (Personal tab)." : undefined,
  };
},
```

The outer data type declares `details` as an optional `PathSnapshot`:

```typescript
import type { PathSnapshot } from "@daltonr/pathwrite-core";

interface OnboardingData {
  employeeName: string;
  details?: PathSnapshot<EmployeeDetails>;
}
```

`restoreKey` is a no-op when the shell has no outer `PathShell` ancestor, so the same inner `PathShell` component can safely be used at the top level in tests or standalone.

---

## Document and approval lifecycles

Not all processes have a human clicking Next. Consider a document that moves through states: draft, review, approved, published. Each state is a step. An author advances from draft to review by submitting; a reviewer advances to approved or sends back to draft by making a decision. Finance may skip the review stage for certain document types.

```typescript
interface DocumentData {
  title: string;
  body: string;
  docType: "memo" | "policy" | "contract";
  reviewerRole: string | null;
  reviewDecision: "pending" | "approved" | "rejected" | null;
  publishedAt: number | null;
}

const documentLifecycle: PathDefinition<DocumentData> = {
  id: "document-lifecycle",
  steps: [
    {
      id: "draft",
      canMoveNext: ({ data }) =>
        data.title && data.body
          ? true
          : { allowed: false, reason: "Title and body are required." },
    },
    {
      id: "review",
      shouldSkip: ({ data }) => data.docType === "memo",
      onEnter: ({ data, isFirstEntry }) => {
        if (isFirstEntry) return { reviewDecision: "pending" };
      },
      canMoveNext: ({ data }) => {
        if (data.reviewerRole !== "approver")
          return { allowed: false, reason: "Only approvers can advance this document." };
        if (data.reviewDecision !== "approved")
          return { allowed: false, reason: "Document must be approved before publishing." };
        return true;
      },
    },
    {
      id: "approved",
    },
    {
      id: "published",
      onEnter: async ({ data }) => {
        await publishDocument(data);
        return { publishedAt: Date.now() };
      },
    },
  ],
};
```

There is no UI here at all. The engine runs on a server. An API endpoint receives a review decision, loads the engine state from a store, calls `engine.setData("reviewDecision", decision)` and `engine.next()`, and serializes the result back. The guard in the review step does double duty: it enforces both the role check and the decision check with a human-readable `reason` that the API can return to the caller. `shouldSkip` eliminates the review stage for memos without an `if` anywhere in the calling code.

---

## Server-side orchestration

The engine has zero browser dependencies. `@daltonr/pathwrite-core` is plain TypeScript with no DOM globals, which means a background job can use it as a workflow engine.

```typescript
interface EnrichmentJob {
  sourceId: string;
  rawData: Record<string, unknown> | null;
  validationResult: { valid: boolean; errors: string[] } | null;
  enrichedData: Record<string, unknown> | null;
  submittedAt: number | null;
  notificationSent: boolean;
}

const enrichmentPipeline: PathDefinition<EnrichmentJob> = {
  id: "enrichment-pipeline",
  steps: [
    {
      id: "collect",
      onEnter: async ({ data }) => {
        const rawData = await fetchFromSource(data.sourceId);
        return { rawData };
      },
      canMoveNext: ({ data }) => !!data.rawData,
    },
    {
      id: "validate",
      onEnter: async ({ data }) => {
        const validationResult = await validateExternally(data.rawData!);
        return { validationResult };
      },
      canMoveNext: ({ data }) =>
        data.validationResult?.valid
          ? true
          : { allowed: false, reason: data.validationResult?.errors.join(", ") },
    },
    {
      id: "enrich",
      onEnter: async ({ data }) => {
        const enrichedData = await enrichRecord(data.rawData!);
        return { enrichedData };
      },
    },
    {
      id: "submit",
      onEnter: async ({ data }) => {
        await submitToDownstream(data.enrichedData!);
        return { submittedAt: Date.now() };
      },
    },
    {
      id: "notify",
      onEnter: async ({ data }) => {
        await sendCompletionNotification(data.sourceId, data.submittedAt!);
        return { notificationSent: true };
      },
    },
  ],
};
```

The "UI" for this pipeline is a status API and a log stream. The engine manages the progress pointer, the data accumulated at each stage, and the error state if any step throws. If the job crashes between stages, `restoreOrStart` picks up from where it left off — the same persistence model that saves a half-filled form saves a half-processed pipeline. The retry semantics on `onComplete` and the `"error"` status are just as useful in a job queue as in a browser.

---

## State machines for feature flows

Any product feature with a defined sequence of states and transitions is a candidate. An onboarding checklist where each item must be completed in order, with branching based on the user's subscription plan, does not look or feel like a wizard — but the underlying structure is identical.

```typescript
interface OnboardingData {
  plan: "starter" | "growth" | "enterprise";
  profileComplete: boolean;
  integrationConnected: boolean;
  teamInviteSent: boolean;
  billingConfigured: boolean;
}

const onboarding: PathDefinition<OnboardingData> = {
  id: "onboarding",
  steps: [
    {
      id: "profile",
      canMoveNext: ({ data }) => data.profileComplete,
    },
    {
      id: "integration",
      canMoveNext: ({ data }) => data.integrationConnected,
    },
    {
      id: "invite-team",
      // Solo starter plan users skip team invite
      shouldSkip: ({ data }) => data.plan === "starter",
      canMoveNext: ({ data }) => data.teamInviteSent,
    },
    {
      id: "billing",
      // Enterprise deals are invoiced externally — skip in-app billing setup
      shouldSkip: ({ data }) => data.plan === "enterprise",
      canMoveNext: ({ data }) => data.billingConfigured,
    },
    {
      id: "complete",
    },
  ],
};
```

The wizard metaphor does not apply here. There is no Back button — `canMovePrevious` is absent from every step. The checklist UI reads `snapshot.visitedStepIds` to show checkmarks. A sidebar indicator reads `snapshot.currentStep.id` to highlight the active item. The engine is managing state; the checklist is reading it.

---

## Conversational and chatbot flows

`PathDefinition` has no concept of rendering. A step is an object with hooks and guards. It does not know whether it will be displayed as a form page, a dialog, or a chat bubble.

```typescript
interface QuoteData {
  insuranceType: "home" | "auto" | "life" | null;
  yearBuilt: number | null;
  vehicleMake: string | null;
  dateOfBirth: string | null;
  coverageLevel: "basic" | "standard" | "comprehensive" | null;
}

const quoteFlow: PathDefinition<QuoteData> = {
  id: "insurance-quote",
  steps: [
    {
      id: "insurance-type",
      canMoveNext: ({ data }) => !!data.insuranceType,
    },
    {
      id: "year-built",
      shouldSkip: ({ data }) => data.insuranceType !== "home",
      canMoveNext: ({ data }) =>
        data.yearBuilt && data.yearBuilt > 1800 && data.yearBuilt <= new Date().getFullYear()
          ? true
          : { allowed: false, reason: "Please enter a valid year." },
    },
    {
      id: "vehicle-make",
      shouldSkip: ({ data }) => data.insuranceType !== "auto",
      canMoveNext: ({ data }) => !!data.vehicleMake,
    },
    {
      id: "date-of-birth",
      canMoveNext: ({ data }) =>
        isValidDate(data.dateOfBirth)
          ? true
          : { allowed: false, reason: "Please enter your date of birth as DD/MM/YYYY." },
    },
    {
      id: "coverage-level",
      canMoveNext: ({ data }) => !!data.coverageLevel,
    },
    {
      id: "summary",
    },
  ],
};
```

A web form renders each step as a form page. A chatbot renders each step as a question, calls `engine.setData()` with the user's reply, and calls `engine.next()`. The guard on `year-built` validates the reply and returns a `reason` if it is malformed — the bot surfaces that reason as its next message. The `shouldSkip` logic skips the vehicle and home questions that are irrelevant to the user's insurance type. Neither the definition nor the engine changes between surfaces. Only the rendering layer changes.

---

## What you now hold

Working through this guide, you have built up a complete picture of how Pathwrite models a process: a definition that declares the shape of a flow, an engine that enforces it, a snapshot that expresses the current state to any consumer, and adapters that translate that snapshot into whatever reactive primitive your framework uses. You have seen how guards enforce business rules without coupling them to UI, how persistence makes a flow resumable across sessions and crashes, how sub-paths compose complex branching into nested flows, and how the workflow-as-package pattern makes all of it testable and portable.

What you hold is a process engine that separates business rules from rendering. The rules live in the definition — version-controlled, unit-tested, framework-agnostic. The rendering lives in your components. That separation is what makes a flow testable without mounting a UI, shareable as an npm package across three different applications, runnable on a server without any browser globals, and deployable across a chat interface, a mobile screen, and a web form using the same definition file. The wizard is the most common shape. It is far from the only one.

© 2026 Devjoy Ltd. MIT License.
