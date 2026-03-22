# Competitive Analysis: Pathwrite vs Existing Solutions

## TL;DR: Nothing Does Exactly What Pathwrite Does

After analyzing the ecosystem, **there is no package that combines all of Pathwrite's capabilities**:

**Pathwrite is a general-purpose state orchestration library** that provides:
- Multi-framework support (React, Vue, Angular, Svelte) with unified API
- Headless architecture with optional shell components
- Built-in persistence with configurable strategies
- Guards + lifecycle hooks + conditional logic
- Sub-path/nested workflows
- Zero dependencies in core

It **happens to be excellent at wizards**, but is equally capable of handling single-page forms, multi-page workflows, state machines, and backend orchestration.

The closest is **XState**, but it solves a different problem with a different approach.

---

## Existing Solutions by Category

### 1. Wizard-Specific Libraries

#### **react-step-wizard** (React only)
- **What it does**: Provides basic wizard navigation UI
- **What it lacks**:
  - No state management (you manage data yourself)
  - No persistence
  - No guards or validation hooks
  - No framework adapters (React only)
  - UI-focused, not headless

```tsx
// react-step-wizard
<StepWizard>
  <Step1 />
  <Step2 />
  <Step3 />
</StepWizard>
// You handle all state, validation, persistence yourself
```

#### **vue-form-wizard** (Vue only)
- **What it does**: Vue wizard component with tabs/progress
- **What it lacks**:
  - Tightly coupled UI
  - No persistence
  - Basic validation only
  - No lifecycle hooks
  - No nested workflows

#### **Angular Material Stepper** (Angular only)
- **What it does**: Stepper UI component
- **What it lacks**:
  - UI component, not state engine
  - No persistence
  - No observer pattern
  - Linear flow only (no shouldSkip, no goToStep)

**Verdict**: These are UI components, not state orchestration frameworks. They handle rendering, not business logic.

---

### 2. State Machine Libraries

#### **XState** - The Closest Competitor

XState is a **hierarchical finite state machine** library. It's powerful and well-designed, but fundamentally different:

| Feature | XState | Pathwrite |
|---------|--------|-----------|
| **Core Model** | Formal state machine (states + transitions + guards) | Ordered steps with lifecycle hooks |
| **Primary Use** | Complex UI state, app-level state machines | General-purpose orchestration (forms, wizards, workflows, state machines) |
| **Learning Curve** | Steep (state machine concepts, send/actions/context) | Gentle (steps are intuitive, hooks are familiar) |
| **Persistence** | Manual (you implement actors/services) | Built-in with strategies |
| **Guards** | Transition guards (`cond`) | Step guards + validation hooks |
| **Nested States** | Hierarchical states (parallel, history states) | Sub-paths (simpler model) |
| **Framework Support** | React, Vue, Svelte via adapters | React, Vue, Angular, Svelte with unified API |
| **Visualization** | Visual editor, state diagrams | None (but steps are linear/obvious) |
| **Bundle Size** | ~26 KB (minified) | Core: ~15 KB |

**XState Example** (checkout flow):
```typescript
import { createMachine, interpret } from 'xstate';

const checkoutMachine = createMachine({
  id: 'checkout',
  initial: 'cart',
  context: { items: [], total: 0 },
  states: {
    cart: {
      on: {
        NEXT: {
          target: 'shipping',
          cond: (ctx) => ctx.items.length > 0
        }
      }
    },
    shipping: {
      on: {
        NEXT: 'payment',
        BACK: 'cart'
      }
    },
    payment: {
      on: {
        SUBMIT: 'complete',
        BACK: 'shipping'
      }
    },
    complete: { type: 'final' }
  }
});

// You have to:
// - Send events manually: service.send('NEXT')
// - Wire up persistence yourself
// - Handle validation separately
// - Manage UI state separately
```

**Pathwrite Equivalent**:
```typescript
const checkout: PathDefinition = {
  id: 'checkout',
  steps: [
    { 
      id: 'cart', 
      canMoveNext: (ctx) => (ctx.data.items?.length ?? 0) > 0 
    },
    { id: 'shipping' },
    { id: 'payment' },
  ]
};

// Auto-saved, auto-validated, works with React/Vue/Angular shells
const { engine } = await restoreOrStart({
  store, key: 'checkout',
  path: checkout,
  observers: [httpPersistence({ store, key })]
});
```

**When to use XState over Pathwrite:**
- Complex branching logic (parallel states, history states)
- Need formal verification or state diagrams
- Building a state machine for complex UI interactions (not sequential flows)

**When to use Pathwrite over XState:**
- Building any sequential or step-based flow (wizards, forms, onboarding, workflows)
- Want built-in persistence out of the box
- Need multi-framework support with unified API
- Prefer a simpler, more intuitive mental model
- Working with single-page or multi-page forms

#### **robot3** (Lightweight State Machine)
- **What it does**: Minimal state machine (~1KB)
- **What it lacks**:
  - No persistence
  - No framework adapters
  - No built-in validation
  - No lifecycle hooks

**Verdict**: XState is the only serious alternative for complex state orchestration, but it's solving a broader problem with more complexity. Pathwrite is a general-purpose orchestration library with a simpler mental model, purpose-built to handle sequential flows including forms, wizards, workflows, and state machines.

---

### 3. Form State Management

#### **Formik** (React only)
- **What it does**: Form state + validation
- **What it lacks**:
  - Single-page forms only (no multi-step support)
  - No persistence
  - No guards or lifecycle hooks
  - React only

#### **React Hook Form** (React only)
- **What it does**: Performant form state
- **What it lacks**:
  - Single forms (can hack multi-step, but not designed for it)
  - No persistence
  - No step navigation
  - React only

#### **VeeValidate** (Vue only)
- **What it does**: Form validation for Vue
- **What it lacks**:
  - Validation only, not state orchestration
  - No multi-step support
  - No persistence

#### **Angular Forms** (Angular only)
- **What it does**: Reactive/template-driven forms
- **What it lacks**:
  - Single forms only
  - No wizard support
  - No persistence
  - Framework-locked

**Verdict**: These are form state libraries, not workflow orchestration. They handle validation and field state, not step progression or persistence.

---

### 4. Workflow/Orchestration (Backend-focused)

#### **Temporal** (Backend workflows)
- **What it does**: Durable workflow execution engine
- **Use case**: Backend microservices, long-running processes
- **Why it's different**: Server-side, not for web UIs

#### **Camunda** (BPMN workflows)
- **What it does**: Business process management
- **Why it's different**: Enterprise backend, not web forms

**Verdict**: These are for backend orchestration, not frontend UI flows.

---

## What Makes Pathwrite Unique

### 1. **Multi-Framework with Unified API**
No other solution provides:
```typescript
// Same path definition works in React, Vue, Angular, and Svelte
const path = { id: "signup", steps: [...] };

// React
<PathShell path={path} />

// Vue
<PathShell :path="path" />

// Angular
<pw-shell [path]="path"></pw-shell>

// Svelte
<PathShell {path} />
```

### 2. **Built-In Persistence with Strategies**
```typescript
// No other wizard library has this out-of-the-box
httpPersistence({ 
  store, 
  key, 
  strategy: "onEveryChange", 
  debounceMs: 500 
})
```

With XState, you'd implement persistence yourself using actors/services. With wizard libraries, there's no persistence at all.

### 3. **Headless + Optional Shell**
```typescript
// Option 1: Use the provided shell
<PathShell path={path} steps={{ a: <StepA />, b: <StepB /> }} />

// Option 2: Build custom UI with usePath
const { snapshot, next, previous } = usePath();
```

XState is headless but provides no UI. Wizard libraries provide UI but it's not optional.

### 4. **Sub-Paths (Nested Workflows)**
```typescript
// Launch a sub-wizard from within a wizard
await engine.startSubPath(approvalSubPath);
// When it completes, parent resumes with sub-path data
```

XState has hierarchical states, but the model is more complex. Wizard libraries don't support nesting.

### 5. **Zero-Dependency Core**
```typescript
// @daltonr/pathwrite-core has ZERO dependencies
// Works in browser, Node, workers, React Native, Electron
```

XState has minimal dependencies but more than zero. Form libraries are framework-locked.

### 6. **Observer Pattern for Extensibility**
```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key }),
    analyticsObserver,
    auditLogObserver,
    customObserver
  ]
});
```

This composability pattern is unique to Pathwrite.

---

## Feature Comparison Matrix

| Feature | Pathwrite | XState | react-step-wizard | Formik | vue-form-wizard |
|---------|-----------|--------|-------------------|--------|-----------------|
| **Multi-framework** | ✅ R/V/A/S | ✅ R/V/S | ❌ React only | ❌ React only | ❌ Vue only |
| **Headless** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Built-in persistence** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Lifecycle hooks** | ✅ onEnter/onLeave | ✅ entry/exit | ❌ | ✅ onSubmit | ❌ |
| **Guards** | ✅ canMove* | ✅ cond | ❌ | ❌ | ⚠️ basic |
| **Validation hooks** | ✅ | ❌ | ❌ | ✅ | ⚠️ basic |
| **Conditional steps** | ✅ shouldSkip | ✅ guards | ❌ | N/A | ❌ |
| **Non-linear navigation** | ✅ goToStep | ✅ send | ⚠️ limited | N/A | ❌ |
| **Sub-paths/nesting** | ✅ startSubPath | ✅ hierarchical | ❌ | ❌ | ❌ |
| **Observer pattern** | ✅ | ⚠️ actors | ❌ | ❌ | ❌ |
| Zero dependencies** | ✅ core | ❌ | ❌ | ❌ | ❌ |
| **Bundle size (min)** | ~15 KB core | ~26 KB | ~5 KB | ~13 KB | ~20 KB |
| **Learning curve** | Low | High | Low | Low | Low |
| **Primary use case** | General orchestration (wizards, workflows, forms, state machines) | State machines | Basic wizards | Single forms | Basic wizards |

---

## Market Gap Analysis

### What Exists
1. **Form libraries** - Handle single-page forms well (Formik, React Hook Form)
2. **State machines** - Handle complex state logic (XState)
3. **Wizard UI components** - Basic step rendering (react-step-wizard)

### What's Missing (Pathwrite's Gap)
A general-purpose orchestration framework that combines:
- ✅ Multi-step orchestration
- ✅ Built-in persistence
- ✅ Framework adapters (React/Vue/Angular/Svelte)
- ✅ Headless + optional shell
- ✅ Lifecycle hooks + guards + validation
- ✅ Simple mental model (steps, not state machines)
- ✅ Works for wizards, forms, workflows, state machines

**Pathwrite fills this gap.**

---

## Use Case Mapping

| Use Case | Best Existing Solution | Why Pathwrite is Better |
|----------|------------------------|-------------------------|
| **Single-page form** | Formik, React Hook Form | Can use single-step path with guards, validation hooks, persistence |
| **Multi-step form** | react-step-wizard | Built-in persistence, validation, guards, multi-framework |
| **Checkout flow** | Custom state management | Auto-persistence, declarative guards, headless UI |
| **Onboarding wizard** | Custom implementation | Conditional steps, sub-paths, persistence |
| **Survey/quiz** | Custom forms | shouldSkip branching, validation hooks |
| **Backend workflow** | Temporal (overkill) | Simpler model, works in Node.js, zero dependencies |
| **Document lifecycle** | Custom state machine | Lifecycle hooks, guards, non-linear transitions |
| **Complex state machine** | XState | XState still better for complex parallel states |

---

## Positioning Strategy

### Current Market
- **Form libraries**: Solve single-page forms
- **State machines**: Solve complex state logic
- **Wizard components**: Solve basic UI rendering

### Pathwrite's Position
**"General-purpose state orchestration for web applications"**

Pathwrite handles any sequential flow with lifecycle management:
- Single-page forms (with validation, guards, persistence)
- Multi-step forms and wizards
- Workflows and processes
- State machines with simpler mental models

Or:

**"The missing layer between form libraries and state machines"**

### Target Audience
1. **Teams building any sequential flow** who are frustrated with:
   - Form libraries (single-page only)
   - XState (too complex for simple flows)
   - Custom solutions (reinventing the wheel)

2. **Teams needing persistence** for:
   - Abandoned cart recovery
   - Draft auto-save
   - Resume-after-crash

3. **Full-stack developers** who want:
   - Same tool for frontend forms/wizards and backend workflows
   - Framework flexibility (not locked to React/Vue/Angular/Svelte)

---

## Conclusion

### Direct Answer: No Exact Equivalent Exists

There is no package that:
1. Does multi-step orchestration with lifecycle hooks
2. Has built-in persistence strategies
3. Works across React, Vue, Angular, and Svelte
4. Is headless with optional shell components
5. Has zero dependencies in core
6. Supports sub-paths/nested workflows

### Closest Alternatives

1. **XState** - If you need complex state machines and don't mind the learning curve
2. **react-step-wizard** - If you only need React and want to manage state yourself
3. **Custom solution** - What most teams end up building (and what Pathwrite replaces)

### Pathwrite's Unique Value

Pathwrite is **a general-purpose orchestration library** that excels at:
- Single-page forms (with guards, validation, persistence)
- Multi-step forms and wizards
- Checkout flows and onboarding
- Workflows and state machines

While XState is a **general-purpose state machine** that can do anything but requires more expertise.

**Pathwrite bridges the gap between form libraries (too limited) and state machines (too complex)** - it solves sequential flows elegantly, with minimal boilerplate and maximum developer experience.

The fact that it happens to be excellent at wizards doesn't mean that's all it does - it's fundamentally a state orchestration engine that works for any step-based flow.

---

## References

- [XState](https://xstate.js.org/) - State machines and statecharts
- [react-step-wizard](https://github.com/jcmcneal/react-step-wizard) - React wizard component
- [Formik](https://formik.org/) - React forms
- [vue-form-wizard](https://github.com/cristijora/vue-form-wizard) - Vue wizard
- [Angular Material Stepper](https://material.angular.io/components/stepper/overview) - Angular stepper
- [robot3](https://thisrobot.life/) - Lightweight state machine

