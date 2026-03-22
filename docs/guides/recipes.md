# Recipes

This file collects short, actionable recipes for common Pathwrite developer tasks. Each recipe is intentionally concise — use the linked guides and code for full context.

--

## 1) FORM: Single-page Form

Description:
- A standalone, one-step Path (or a Path with a single step) used as a form.
- Includes: input fields, validation on the step, a `Cancel` button, and an `onComplete` guard (callback) that runs when the user completes the form.

Demo goals:
- Show how to create a Path with a single step and wiring to UI.
- Demonstrate `onComplete` handling and a `cancel()` action that resets or navigates away.

Core vs Adapter:
- Core: path/step definition, guards, snapshot/export.
- Adapter: UI-specific binding (Vue/React/Svelte components) — minimal adapter-specific code.

Implementation notes:
- Scaffold a new app in `apps/` for the demo.
- Create a simple Path with one step in the core engine.
- Wire up a form UI in the adapter using your framework of choice.
- Implement onComplete and cancel logic in the step definition.

--

## 2) WIZARD: Linear Onboarding

Description:
- A linear wizard with 3–4 steps capturing user profile data.
- Each step has validation; some steps may have guards that prevent progressing when validation fails.
- Show `Next` / `Previous` navigation and a final completion handler.

Demo goals:
- Demonstrate defining a linear Path with guards and step-level validation.
- Show local state updates, navigation, and a completion flow.

Core vs Adapter:
- Core: PathEngine navigation, guards, step snapshots.
- Adapter: step components and shell UI.

Implementation notes:
- Create a new app in `apps/` for the demo.
- Define a linear Path with multiple steps in the core engine.
- Implement step components in the adapter, including validation and guards.
- Wire up navigation and completion handling in the Path engine.
- Demonstrate a full onboarding flow no state persistence in this demo, just in-memory state management and navigation.
- 

--

## 3) SUBWIZARD: Approval Workflow

Description:
- User A creates a document and selects N approvers (e.g., B, C, D, E).
- On the next step the approvers are listed, and each approver can click "Review" to open a subwizard that shows the document and allows them to approve/reject with comments.
- A gate waits until all approvers finish before continuing.

Demo goals:
- Demonstrate dynamically generated subwizards based on user input (approver selection).

Core vs Adapter:
- Core: gate points, patch application primitives, export/import state helpers.
- Adapter: UI for selecting approvers and launching per-approver subwizards.

Implementation notes:
- Scaffold a new app in `apps/` for the demo.
- Create the main wizard Path and approval subwizards in the core engine.

--

## 4) SKIP: Conditional Steps (Subscription Flow)

Description:
- Step 1: Select a plan (Free or Paid).
- If Free: skip payment and billing steps.
- If Paid: show billing/payment steps and billing address form.
- Add a `billingSameAsShipping` checkbox; when checked, skip the billing address step (or copy shipping address into billing automatically).

Demo goals:
- Demonstrate `shouldSkip` functions on steps and conditional navigation.
- Show how to keep UX simple by skipping steps rather than toggling visibility inside a step.

Core vs Adapter:
- Core: `shouldSkip` logic and conditional navigation.
- Adapter: UI for plan selection and checkbox binding.

Example snippet for skip condition (add comment in docs/demo):

shouldSkip: (ctx) => ctx.data.useSameAddressForBilling === true, // if checked, bypass the billing address step

Implementation notes:
- Create a new app in `apps/` for the demo.
- Define the subscription Path with conditional steps in the core engine.
- Implement step components and conditional logic in the adapter.
- Wire up navigation and state management in the Path engine.
- Demonstrate the subscription flow with plan selection and conditional billing steps.

--

## 5) AUTOPERSIST: Persist to REST API (OnNext)

Description:
- A wizard that persists state to a REST API using the `store-http` adapter and `OnNext` persistence strategy.
- The demo also includes a small API server (Express recommended) that exposes endpoints to list, load, create, update, and delete wizard documents.
- Show a list of saved wizards on the UI; clicking a saved item restores that wizard. Starting a new wizard creates a unique id and persists under it.

Demo goals:
- Demonstrate full load/restore and persistence on `Next` only.
- Show wiring between Pathwrite's `observer` (persistence observer) and the `store-http` adapter.
- Exercise `exportState()/fromState()` for persistence of engine state.

Core vs Adapter:
- Core: observer/strategy utilities, exportState/fromState.
- Adapter: `store-http` consumption and REST adapter factory for the demo API.

Server notes:
- Implement a simple Express server with endpoints:
  - GET /api/wizard/state/:id
  - POST /api/wizard/state (create)
  - PUT /api/wizard/state/:id (update)
  - DELETE /api/wizard/state/:id
- Keep the server implementation small and suitable for local dev/demo.

Implementation notes:
- Scaffold a new app in `apps/` for the demo.
- Create a wizard Path with multiple steps and OnNext persistence in the core engine.
- Implement REST API wiring and observer pattern in the adapter.
- Provide a minimal Express server implementation for demo purposes.
- Demonstrate the full persistence flow with API integration and state restoration.

--

## 6) TABS: Non-linear Tabbed Steps

Description:
- A single-page UI where each wizard step is represented by a tab.
- Users may jump between tabs in any order.
- A completion guard ensures the whole wizard cannot be completed until all tabs (steps) are valid.

Demo goals:
- Demonstrate that Pathwrite's model of steps doesn't require linear UI; tabs show a different visual metaphor but use the same engine.
- Show a `canComplete()` check that aggregates per-step completion to allow final completion.

Core vs Adapter:
- Core: step definition and validation API remains identical.
- Adapter: tabbed shell UI and navigation controls.

Implementation notes:
- Create a new app in `apps/` for the demo.
- Define a wizard Path with multiple steps in the core engine.
- Implement tabbed navigation and step components in the adapter.
- Wire up completion guards and state management in the Path engine.
- Demonstrate the tabbed wizard flow with non-linear navigation and completion.

--

## 7) E-LEARNING: Topics + Subwizard Quizzes

Description:
- A learning path consisting of several topics (steps).
- Each topic has an optional quiz implemented as a subwizard.
- The user must score >70% on a quiz to mark the topic complete and allow progression.
- Progress and scores are persisted (optionally) so users can return where they left off.

Demo goals:
- Demonstrate subwizards (topic->quiz), conditional gating based on quiz score, and persistence of results.
- Show UI for drill-down and returning to parent topic after subwizard completion.

Core vs Adapter:
- Core: subwizard composition, gates, conditional logic, snapshot/export.
- Adapter: quiz UI components, scoring display, and optional persistence wiring.

Implementation notes:
- Create a new app in `apps/` for the demo.
- Define a learning Path with topics and quizzes in the core engine.
- Implement quiz subwizards and scoring logic in the adapter.
- Wire up conditional gating and persistence in the Path engine.
- Demonstrate the e-learning flow with topic navigation, quizzes, and progress persistence.

--

## Implementation and Demo guidance

- For each demo app create a small, focused repo or app inside `apps/` that demonstrates only the features required for that recipe.
- Keep UI shell code shared if possible (small `PathShell` in adapters) so demos focus on wiring and UX rather than boilerplate.
- Prefer `OnNext` as the default persistence strategy in demos that persist.
- Use the `store-http` package for REST examples; provide a tiny Express server (for local dev) that stores JSON files or uses an in-memory store.

--

## Next steps

- Turn each recipe into an actionable checklist for building the demo app (scaffold, core path, adapter wiring, persistence), then implement the demos in `apps/` as you prefer.
- I can scaffold any of these demos for you — tell me which one you want first and I will generate the minimal app and server code.
