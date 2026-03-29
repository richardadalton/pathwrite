# Beyond Wizards: Pathwrite as a General State Orchestration Framework

## The Core Insight

While Pathwrite was designed as a wizard engine, its architecture is actually a **general-purpose state orchestration framework** with these fundamental capabilities:

1. **State Management**: Ordered states with transitions
2. **Data Binding**: Reactive data flow from UI to persistence
3. **Lifecycle Hooks**: Enter/leave/complete callbacks
4. **Guards**: Declarative business rules
5. **Persistence**: Automatic state saving with strategies
6. **Observers**: Event streaming for side effects

A "wizard" is just one UI manifestation of this architecture.

---

## Non-Wizard Use Cases

### 1. Single-Page Forms

A path with **1 step** = a full-featured form with automatic UI adaptations:

```typescript
const contactForm: PathDefinition = {
  id: "contact-form",
  steps: [{
    id: "form",
    title: "Contact Us",
    fieldErrors: (ctx) => ({
      name: !ctx.data.name?.trim() ? "Name is required" : undefined,
      email: !ctx.data.email?.includes("@") ? "Valid email required" : undefined,
      message: !ctx.data.message?.trim() ? "Message is required" : undefined
    })
    // Note: canMoveNext auto-derives from fieldErrors when not explicitly set
  }]
};

// Usage:
<PathShell 
  path={contactForm} 
  initialData={{ name: "", email: "", message: "" }}
  onComplete={(data) => submitToBackend(data)}
/>

// You automatically get:
// ✅ Field-level validation with labeled errors
// ✅ Submit button disabled while invalid
// ✅ Errors hidden until first submit attempt (hasAttemptedNext)
// ✅ Progress indicator auto-hidden (single-step form)
// ✅ Form-style footer layout (Cancel left, Submit right)
// ✅ Auto-persistence (with HTTP store: crash recovery)
// ✅ Type-safe data binding
// ✅ Event streaming for analytics
```

**Why this works better than traditional forms:**
- **Zero configuration** for common behavior (see auto-detection below)
- **Consistent API** across React, Vue, Svelte, Angular
- **Built-in persistence** (strategy: "onEveryChange" + debounce for drafts)
- **Field errors auto-render** (no manual error display code)

**Auto-detection for single-step forms:**
When `stepCount === 1 && nestingLevel === 0`:
- Progress header automatically hidden (user doesn't need to see "Step 1 of 1")
- Footer switches to "form" layout (Cancel on left, Submit on right)
- No Back button clutter

Override when needed:
```tsx
<PathShell 
  path={form} 
  hideProgress={false}      // Force show progress
  footerLayout="wizard"     // Force wizard layout
/>
```
- User can close browser and resume
- Full audit trail via observers
- No manual form state management

### 2. Shopping Cart / Checkout Flow

Not a "wizard" - just a checkout process:

```typescript
const checkout: PathDefinition = {
  id: "checkout",
  steps: [
    { 
      id: "cart",
      canMoveNext: (ctx) => (ctx.data.items?.length ?? 0) > 0,
      validationMessages: (ctx) => 
        ctx.data.items?.length ? [] : ["Cart is empty"]
    },
    { 
      id: "shipping",
      onEnter: async (ctx) => {
        if (ctx.isFirstEntry) {
          // Load saved addresses from API
          const addresses = await loadAddresses();
          return { savedAddresses: addresses };
        }
      },
      canMoveNext: (ctx) => !!ctx.data.shippingAddress,
      onLeave: (ctx) => {
        // Default to same billing address unless user changes it
        if (!ctx.data.billingAddressDifferent) {
          return { useSameAddressForBilling: true };
        }
      }
    },
    {
      id: "billing",
      // Skip billing address step entirely if user chose to use same address as shipping
      shouldSkip: (ctx) => ctx.data.useSameAddressForBilling === true,
      onEnter: async (ctx) => {
        if (ctx.isFirstEntry && !ctx.data.useSameAddressForBilling) {
          // Load saved billing addresses if different from shipping
          const addresses = await loadAddresses();
          return { savedBillingAddresses: addresses };
        }
      },
      canMoveNext: (ctx) => !!ctx.data.billingAddress
    },
    { 
      id: "payment",
      canMoveNext: (ctx) => ctx.data.paymentValid === true
    },
    { 
      id: "review",
      onEnter: (ctx) => {
        // Use shipping address for billing if same
        const billingAddr = ctx.data.useSameAddressForBilling 
          ? ctx.data.shippingAddress 
          : ctx.data.billingAddress;
        
        // Calculate final totals
        return {
          finalBillingAddress: billingAddr,
          subtotal: calculateSubtotal(ctx.data.items),
          shipping: calculateShipping(ctx.data.shippingAddress),
          tax: calculateTax(ctx.data.items, ctx.data.shippingAddress)
        };
      }
    }
  ]
};
```

**Why this works:**
- Each "step" is just a checkout stage
- Guards enforce business rules (can't pay with empty cart)
- **Conditional skipping**: billing address step skipped if same as shipping
- Hooks calculate derived state (totals, merged addresses)
- Persistence means abandoned carts are saved
- No "wizard" UI needed - render however you want

### 3. Backend Workflows (No UI)

The `demo-lifecycle` app shows this: a document approval workflow with **zero UI:**

```typescript
const documentLifecycle: PathDefinition = {
  id: "document-workflow",
  steps: [
    { 
      id: "draft",
      onEnter: (ctx) => ({ createdAt: Date.now() }),
      canMoveNext: (ctx) => ctx.data.title && ctx.data.body
    },
    { 
      id: "review",
      shouldSkip: (ctx) => ctx.data.docType === "memo",
      onEnter: (ctx) => ({ reviewStartedAt: Date.now() }),
      canMoveNext: (ctx) => ctx.data.reviewDecision !== "pending",
      onLeave: (ctx) => {
        if (ctx.data.reviewDecision === "rejected") {
          // Non-linear: jump back to draft
          engine.goToStep("draft");
        }
      }
    },
    { 
      id: "approved",
      onEnter: (ctx) => ({ approvedAt: Date.now() })
    },
    { 
      id: "published",
      onEnter: async (ctx) => {
        await publishDocument(ctx.data);
        return { publishedAt: Date.now() };
      }
    }
  ]
};
```

**This is a pure state machine** driven by:
- API calls (`engine.next()` after review)
- Background jobs (`engine.goToStep("published")`)
- Scheduled tasks

### 4. Multi-Page Forms (Not Wizards)

A single logical form split across multiple pages/routes for UX:

```typescript
const registration: PathDefinition = {
  id: "signup",
  steps: [
    { id: "personal" },    // /signup/personal
    { id: "company" },     // /signup/company
    { id: "payment" },     // /signup/payment
    { id: "preferences" }  // /signup/preferences
  ]
};
```

**Key difference from wizard:**
- No progress bar
- No "Next/Previous" buttons (just route changes)
- Each page feels standalone but shares state
- Users can jump between pages (use `goToStep` or `goToStepChecked`)

### 5. Onboarding Flows

Guide users through app setup (not a form):

```typescript
const onboarding: PathDefinition = {
  id: "onboarding",
  steps: [
    { 
      id: "welcome",
      canMoveNext: () => true  // Always allows skip
    },
    { 
      id: "connect-account",
      shouldSkip: (ctx) => ctx.data.accountConnected,
      canMoveNext: (ctx) => ctx.data.accountConnected
    },
    { 
      id: "invite-team",
      canMoveNext: () => true  // Optional
    },
    { 
      id: "tour-features" }
  ]
};
```

**UI could be:**
- Modal overlays
- Slideout panels
- Full-page takeovers
- Inline tooltips

Same engine, different UI.

### 6. Survey / Quiz Applications

Conditional branching based on answers:

```typescript
const survey: PathDefinition = {
  id: "health-survey",
  steps: [
    { id: "age" },
    { id: "exercise" },
    { 
      id: "exercise-details",
      shouldSkip: (ctx) => ctx.data.exerciseFrequency === "never"
    },
    { 
      id: "diet",
      shouldSkip: (ctx) => (ctx.data.age as number) < 18
    },
    { id: "summary" }
  ]
};
```

### 7. Approval Workflows

Multi-stakeholder approvals:

```typescript
const approvalFlow: PathDefinition = {
  id: "approval",
  steps: [
    { 
      id: "manager-review",
      canMoveNext: (ctx) => ctx.data.managerApproval === "approved",
      onEnter: (ctx) => {
        if (ctx.isFirstEntry) sendNotification("manager", ctx.data.requestId);
      }
    },
    { 
      id: "hr-review",
      canMoveNext: (ctx) => ctx.data.hrApproval === "approved"
    },
    { 
      id: "finance-review",
      shouldSkip: (ctx) => (ctx.data.amount as number) < 1000,
      canMoveNext: (ctx) => ctx.data.financeApproval === "approved"
    },
    { id: "approved" }
  ]
};
```

### 8. Training / E-Learning Platform

A powerful example showing **sub-paths for drill-down**, **jump to section**, and **conditional skipping**:

```typescript
// Main course path
const webDevCourse: PathDefinition = {
  id: "web-dev-101",
  steps: [
    { 
      id: "introduction",
      onEnter: (ctx) => {
        if (ctx.isFirstEntry) {
          return { 
            startedAt: Date.now(),
            completedModules: []
          };
        }
      }
    },
    { 
      id: "html-basics",
      canMoveNext: (ctx) => ctx.data.htmlQuizScore >= 70,
      validationMessages: (ctx) => 
        ctx.data.htmlQuizScore < 70 
          ? ["You must score at least 70% to continue"] 
          : [],
      onComplete: (ctx) => ({
        completedModules: [...(ctx.data.completedModules || []), "html-basics"]
      })
    },
    { 
      id: "css-fundamentals",
      // Skip if student already certified in CSS
      shouldSkip: (ctx) => ctx.data.certifications?.includes("css-certified"),
      canMoveNext: (ctx) => ctx.data.cssQuizScore >= 70,
      onComplete: (ctx) => ({
        completedModules: [...(ctx.data.completedModules || []), "css-fundamentals"]
      })
    },
    { 
      id: "javascript-intro",
      canMoveNext: (ctx) => ctx.data.jsQuizScore >= 70,
      onComplete: (ctx) => ({
        completedModules: [...(ctx.data.completedModules || []), "javascript-intro"]
      })
    },
    {
      id: "advanced-topics",
      // Only available if student scored 90+ on all previous quizzes
      shouldSkip: (ctx) => {
        const avgScore = (
          (ctx.data.htmlQuizScore || 0) +
          (ctx.data.cssQuizScore || 0) +
          (ctx.data.jsQuizScore || 0)
        ) / 3;
        return avgScore < 90;
      },
      onEnter: (ctx) => ({
        message: "Congratulations! You qualify for advanced content."
      })
    },
    { 
      id: "final-project",
      canMoveNext: (ctx) => ctx.data.projectSubmitted === true,
      validationMessages: (ctx) => 
        !ctx.data.projectSubmitted 
          ? ["Please submit your final project to complete the course"] 
          : []
    },
    {
      id: "certificate",
      onEnter: async (ctx) => {
        // Award certificate
        const cert = await generateCertificate({
          studentId: ctx.data.studentId,
          courseName: "Web Development 101",
          completedAt: Date.now(),
          score: calculateFinalScore(ctx.data)
        });
        return { 
          certificateUrl: cert.url,
          completedAt: Date.now()
        };
      }
    }
  ]
};

// Sub-path for deep dive into HTML topics
const htmlDeepDive: PathDefinition = {
  id: "html-deep-dive",
  steps: [
    { id: "semantic-html" },
    { id: "forms-inputs" },
    { id: "accessibility" },
    { id: "html5-apis" },
    {
      id: "html-quiz",
      canMoveNext: (ctx) => ctx.data.htmlDeepDiveScore >= 80
    }
  ]
};

// Sub-path for interactive CSS exercises
const cssWorkshop: PathDefinition = {
  id: "css-workshop",
  steps: [
    { id: "flexbox-lab" },
    { id: "grid-lab" },
    { id: "animations-lab" },
    { id: "responsive-design" },
    {
      id: "css-challenge",
      canMoveNext: (ctx) => ctx.data.challengeCompleted === true
    }
  ]
};

// Usage in React component
function CoursePlayer({ engine }) {
  const { snapshot, next, previous, goToStep, startSubPath, completeSubPath } = usePath(engine);
  
  // Jump to any module (e.g., from table of contents)
  const jumpToModule = (moduleId: string) => {
    // goToStepChecked ensures prerequisites are met
    const result = engine.goToStepChecked(moduleId);
    if (!result.success) {
      alert(result.error); // "Cannot access: prerequisites not met"
    }
  };
  
  // Start a sub-path for drill-down content
  const startDeepDive = (topic: string) => {
    if (topic === "html") {
      startSubPath(htmlDeepDive, { topic: "html" });
    } else if (topic === "css") {
      startSubPath(cssWorkshop, { topic: "css" });
    }
  };
  
  // Complete sub-path and return to main course
  const finishDeepDive = () => {
    completeSubPath({ 
      deepDiveCompleted: true,
      deepDiveScore: snapshot.data.htmlDeepDiveScore || snapshot.data.challengeCompleted
    });
    // Student is automatically returned to the main course step they were on
  };
  
  return (
    <div className="course-player">
      {/* Table of Contents - Jump to Section */}
      <nav className="toc">
        <h3>Course Modules</h3>
        <button onClick={() => jumpToModule("html-basics")}>
          HTML Basics {snapshot.data.completedModules?.includes("html-basics") && "✓"}
        </button>
        <button onClick={() => jumpToModule("css-fundamentals")}>
          CSS Fundamentals {snapshot.data.completedModules?.includes("css-fundamentals") && "✓"}
        </button>
        <button onClick={() => jumpToModule("javascript-intro")}>
          JavaScript Intro {snapshot.data.completedModules?.includes("javascript-intro") && "✓"}
        </button>
        <button onClick={() => jumpToModule("final-project")}>
          Final Project
        </button>
      </nav>
      
      {/* Current Module Content */}
      <main className="module-content">
        <h2>{snapshot.currentStep.id}</h2>
        
        {/* Show deep-dive option on relevant modules */}
        {snapshot.currentStep.id === "html-basics" && (
          <button onClick={() => startDeepDive("html")}>
            📚 Take HTML Deep Dive Course
          </button>
        )}
        
        {snapshot.currentStep.id === "css-fundamentals" && (
          <button onClick={() => startDeepDive("css")}>
            🎨 Start CSS Workshop
          </button>
        )}
        
        {/* Module content */}
        <ModuleContent step={snapshot.currentStep.id} />
        
        {/* Quiz */}
        {snapshot.currentStep.id.includes("quiz") && (
          <Quiz 
            onComplete={(score) => {
              engine.setData(`${snapshot.currentStep.id}Score`, score);
            }}
          />
        )}
        
        {/* Navigation */}
        <div className="nav-buttons">
          <button onClick={previous} disabled={!snapshot.canMovePrevious}>
            Previous
          </button>
          <button onClick={next} disabled={!snapshot.canMoveNext}>
            {snapshot.validationMessages.length > 0 
              ? `Complete quiz (${snapshot.validationMessages[0]})` 
              : "Next"}
          </button>
        </div>
      </main>
      
      {/* Progress Indicator */}
      <div className="progress">
        Module {snapshot.currentStepIndex + 1} of {snapshot.steps.length}
        <div className="progress-bar">
          <div 
            style={{ width: `${(snapshot.currentStepIndex / snapshot.steps.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
```

**Why this is powerful for e-learning:**

1. **Jump to Section**: Students can navigate via table of contents using `goToStep()` or `goToStepChecked()`
2. **Sub-Paths for Drill-Down**: Click "Deep Dive" button to start a sub-path, complete it, and return to main course
3. **Conditional Skipping**: Advanced topics skip if student didn't score high enough
4. **Progress Tracking**: Automatic tracking of completed modules
5. **Quiz Guards**: Can't proceed without passing quiz (`canMoveNext`)
6. **Auto-Persistence**: Student can close browser and resume exactly where they left off
7. **Certification**: Final step generates certificate with all data
8. **Prerequisites**: Use `shouldSkip` to skip modules if student already certified
9. **Branching Logic**: Advanced content only appears for high-performers

**Real-world scenarios:**

- **Corporate Training**: Compliance courses with mandatory sections and optional deep-dives
- **Online Courses**: MOOCs with linear progression and supplementary content
- **Skill Assessments**: Skip sections based on pre-test results
- **Certification Programs**: Track progress across multiple modules with sub-paths for specializations

---

## What Makes This General-Purpose

### 1. **Framework-Agnostic Core**
The `@daltonr/pathwrite-core` package has **zero dependencies**. It's pure TypeScript that works:
- In browsers
- On servers (Node.js)
- In workers
- In React Native / Electron
- In backend services

### 2. **Headless Architecture**
Pathwrite owns **zero HTML**. You control:
- Layout
- Styling
- Navigation UX
- Display logic

The engine just manages state.

### 3. **Composable Observers**
The observer pattern makes it extensible:

```typescript
const engine = new PathEngine({
  observers: [
    httpPersistence({ store, key }),          // Auto-save
    analyticsObserver,                        // Track usage
    auditLogObserver,                         // Compliance
    (event) => console.log(event),            // Debug
    (event) => socket.emit("state", event),   // Real-time sync
  ]
});
```

### 4. **Data = Application State**
The `data` object isn't limited to form fields:

```typescript
interface AppState {
  // Form fields
  name: string;
  email: string;
  
  // UI state
  selectedTab: string;
  expandedSections: string[];
  
  // Business state
  cartItems: Product[];
  discountApplied: boolean;
  
  // Derived state
  subtotal: number;
  tax: number;
  
  // Async results
  addressValidated: boolean;
  paymentToken: string;
}
```

### 5. **Steps = Any Ordered States**
"Steps" don't have to be pages:

```typescript
// Could be:
{ id: "idle" }           // App states
{ id: "loading" }
{ id: "error" }
{ id: "success" }

// Or:
{ id: "pending" }        // API states
{ id: "processing" }
{ id: "completed" }

// Or:
{ id: "logged-out" }     // Auth states
{ id: "logging-in" }
{ id: "logged-in" }
```

---

## Architecture Patterns

### Pattern 1: Single-Page App State Management

Use a 1-step path as your global state manager:

```typescript
const appState: PathDefinition = {
  id: "app",
  steps: [{
    id: "main",
    validationMessages: (ctx) => {
      // Validation for current action
      if (ctx.data.currentAction === "submit" && !ctx.data.formValid) {
        return ["Please complete the form"];
      }
      return [];
    }
  }]
};

// Use setData for all state changes
facade.setData("currentUser", user);
facade.setData("theme", "dark");
facade.setData("cart", updatedCart);

// Get reactive updates
const snapshot = facade.snapshot();
```

### Pattern 2: Backend State Machine

No UI, just business logic:

```typescript
// order-service.ts
const orderLifecycle: PathDefinition = {
  id: "order",
  steps: [
    { id: "pending", onEnter: () => ({ createdAt: Date.now() }) },
    { id: "paid", onEnter: (ctx) => notifyWarehouse(ctx.data.orderId) },
    { id: "shipped", onEnter: (ctx) => notifyCustomer(ctx.data.trackingNumber) },
    { id: "delivered" }
  ]
};

// Advance state via API
app.post("/orders/:id/pay", async (req, res) => {
  const engine = await restoreOrder(req.params.id);
  await engine.next();  // pending → paid
  res.json(engine.snapshot());
});
```

### Pattern 3: Hybrid UI (Wizard + Non-Wizard)

Same path, different UX for different sections:

```typescript
const hybridFlow: PathDefinition = {
  id: "hybrid",
  steps: [
    // Wizard-style (with shell)
    { id: "step1" },
    { id: "step2" },
    { id: "step3" },
    
    // Custom UI (no shell)
    { id: "dashboard" },      // Full custom layout
    { id: "settings" },       // Route-based
  ]
};
```

Use `PathShell` for steps 1-3, custom UI for the rest.

---

## Messaging / Positioning

### Current Positioning
**"Headless multi-step form engine for React/Vue/Angular"**

### Broader Positioning
**"State orchestration framework with persistent data binding"**

Or:

**"Headless state machine + data management for modern web apps"**

### Feature Comparison

| Traditional Wizard Library | Pathwrite's Actual Scope |
|---------------------------|-------------------------|
| Multi-step forms only | Any ordered state transitions |
| UI components | Headless (bring your own UI) |
| Client-side only | Works server-side too |
| Form validation | Business rule engine |
| Progress tracking | Full state machine |
| Manual persistence | Automatic with strategies |

---

## Real-World Example: E-Commerce Admin

Imagine a product management interface (not a wizard at all):

```typescript
const productEditor: PathDefinition = {
  id: "product-editor",
  steps: [
    { 
      id: "draft",
      // Auto-save every change
      validationMessages: (ctx) => {
        const errors = [];
        if (!ctx.data.name) errors.push("Name required");
        if (!ctx.data.price || ctx.data.price <= 0) errors.push("Valid price required");
        return errors;
      }
    },
    { 
      id: "review",
      canMoveNext: (ctx) => ctx.data.reviewApproved,
      onEnter: async (ctx) => {
        // Load review checklist
        return { checklist: await getChecklist() };
      }
    },
    { 
      id: "published",
      onEnter: async (ctx) => {
        await publishProduct(ctx.data);
        return { publishedAt: Date.now() };
      }
    }
  ]
};

// Persist with strategy
const { engine } = await restoreOrStart({
  store,
  key: `product:${productId}`,
  path: productEditor,
  observers: [
    httpPersistence({ store, key, strategy: "onEveryChange", debounceMs: 500 }),
    auditLogObserver,
  ]
});
```

**Benefits:**
- Auto-save every 500ms (no lost work)
- Enforced workflow (can't publish without review)
- Audit trail (who changed what when)
- Restore from crash/tab close
- No manual state management

---

## Conclusion

**You've built a general-purpose state orchestration framework** that happens to excel at wizards but is powerful for:

✅ Single-page forms  
✅ Multi-page forms  
✅ Shopping carts  
✅ Checkout flows  
✅ Onboarding  
✅ Surveys  
✅ Backend workflows  
✅ Document lifecycles  
✅ Approval processes  
✅ State machines  

The "wizard" is just one UI pattern. The underlying architecture is **state + lifecycle + guards + persistence** - which is universally useful.

### Next Steps

Consider:
1. **Rebranding?** "State orchestration framework" vs "wizard library"
2. **Examples**: Add non-wizard demos to showcase versatility
3. **Marketing**: Show the breadth of use cases
4. **Documentation**: Add this "Beyond Wizards" guide to official docs

You've created something more powerful than you initially realized!


---

© 2026 Devjoy Ltd. MIT License.

